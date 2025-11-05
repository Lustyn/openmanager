import { access, constants, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import { execa } from "execa";

import type { SessionContext } from "../session/context.ts";

export interface HookResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface PatchOptions extends Record<string, unknown> {
  outputDir?: string;
  patchFileName?: string;
  includeBaseDiff?: boolean;
}

export interface PrOptions extends Record<string, unknown> {
  title?: string;
  description?: string;
  branchPrefix?: string;
  autoPush?: boolean;
}

export interface SessionHook {
  name: string;
  execute(
    context: SessionContext,
    options?: Record<string, unknown>,
  ): Promise<HookResult>;
}

export class SessionHookManager {
  private readonly hooks = new Map<string, SessionHook>();

  constructor() {
    this.registerHook("create-patch", new CreatePatchHook());
    this.registerHook("create-pr", new CreatePrHook());
    this.registerHook("prune-worktree", new PruneWorktreeHook());
  }

  registerHook(name: string, hook: SessionHook): void {
    this.hooks.set(name, hook);
  }

  getHook(name: string): SessionHook | undefined {
    return this.hooks.get(name);
  }

  async executeHook(
    name: string,
    context: SessionContext,
    options: Record<string, unknown> = {},
  ): Promise<HookResult> {
    const hook = this.hooks.get(name);
    if (!hook) {
      return {
        success: false,
        message: `Hook '${name}' not found. Available hooks: ${this.listHooks().join(
          ", ",
        )}`,
      };
    }

    try {
      return await hook.execute(context, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Hook '${name}' failed: ${message}`,
      };
    }
  }

  async executeHooks(
    names: string[],
    context: SessionContext,
    options: Record<string, unknown> = {},
  ): Promise<HookResult[]> {
    const results: HookResult[] = [];
    for (const name of names) {
      const result = await this.executeHook(name, context, options);
      results.push(result);
    }
    return results;
  }

  listHooks(): string[] {
    return Array.from(this.hooks.keys()).sort();
  }
}

class CreatePatchHook implements SessionHook {
  readonly name = "create-patch";

  async execute(
    context: SessionContext,
    options: Record<string, unknown> = {},
  ): Promise<HookResult> {
    const patchOptions = options as PatchOptions;
    const worktreePath = context.worktreePath;
    const outputDir = patchOptions.outputDir ?? context.sessionRoot;
    const patchFileName =
      patchOptions.patchFileName ?? `session-${context.sessionId}.patch`;

    // First, add all untracked files to the index temporarily
    await execa("git", ["add", "-N", "."], {
      cwd: worktreePath,
    });

    // Get diff including both staged and unstaged changes
    const diffResult = await execa("git", ["diff", "--binary", "HEAD"], {
      cwd: worktreePath,
    });
    const diff = diffResult.stdout.trim();

    // Reset the index to remove intent-to-add entries
    await execa("git", ["reset", "--mixed"], {
      cwd: worktreePath,
    });

    if (!diff) {
      return {
        success: true,
        message: "No changes detected in worktree; skipping patch creation.",
      };
    }

    const patchPath = resolve(outputDir, patchFileName);
    await ensureDirectoryExists(dirname(patchPath));
    await writeFile(patchPath, `${diff}\n`, "utf8");

    let basePatchPath: string | undefined;
    if (patchOptions.includeBaseDiff) {
      const baseDiffResult = await execa(
        "git",
        ["diff", "--binary", `${context.gitRef}`],
        { cwd: worktreePath },
      );
      const baseDiff = baseDiffResult.stdout.trim();
      if (baseDiff) {
        const baseName = basename(patchFileName, ".patch");
        basePatchPath = resolve(
          outputDir,
          `${baseName}-vs-${sanitizeRef(context.gitRef)}.patch`,
        );
        await writeFile(basePatchPath, `${baseDiff}\n`, "utf8");
      }
    }

    return {
      success: true,
      message: `Patch written to ${patchPath}`,
      data: {
        patchPath,
        basePatchPath,
      },
    };
  }
}

class CreatePrHook implements SessionHook {
  readonly name = "create-pr";

  async execute(
    context: SessionContext,
    options: Record<string, unknown> = {},
  ): Promise<HookResult> {
    const prOptions = options as PrOptions;
    const worktreePath = context.worktreePath;

    const statusResult = await execa("git", ["status", "--porcelain"], {
      cwd: worktreePath,
    });
    if (!statusResult.stdout.trim()) {
      return {
        success: true,
        message: "No changes detected in worktree; skipping PR preparation.",
      };
    }

    const branchPrefix = prOptions.branchPrefix ?? "openmanager/session";
    const branchName = `${branchPrefix}/${context.sessionId}`;

    await execa("git", ["checkout", "-B", branchName], { cwd: worktreePath });
    await execa("git", ["add", "."], { cwd: worktreePath });

    const commitTitle =
      prOptions.title ?? `OpenManager session ${context.sessionId}`;
    const commitBody =
      prOptions.description ??
      `Automated changes generated by OpenManager session ${context.sessionId}.`;

    await execa("git", ["commit", "-m", commitTitle, "-m", commitBody], {
      cwd: worktreePath,
    });

    const autoPush = prOptions.autoPush === true;
    if (autoPush) {
      try {
        await execa("git", ["push", "-u", "origin", branchName], {
          cwd: worktreePath,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message: `Branch '${branchName}' created but push failed: ${message}`,
          data: { branchName },
        };
      }
    }

    return {
      success: true,
      message: autoPush
        ? `Branch '${branchName}' created and pushed.`
        : `Branch '${branchName}' created locally. Push to remote to open a PR.`,
      data: {
        branchName,
        pushed: autoPush,
      },
    };
  }
}

class PruneWorktreeHook implements SessionHook {
  readonly name = "prune-worktree";

  async execute(context: SessionContext): Promise<HookResult> {
    const { repoPath, worktreePath } = context;

    try {
      await access(worktreePath, constants.F_OK);
    } catch {
      // Worktree already gone; prune references and exit gracefully.
      await execa("git", ["worktree", "prune"], { cwd: repoPath });
      return {
        success: true,
        message: `Worktree '${worktreePath}' already removed. Pruned stale references.`,
      };
    }

    await execa("git", ["worktree", "remove", "--force", worktreePath], {
      cwd: repoPath,
    });
    await execa("git", ["worktree", "prune"], { cwd: repoPath });

    return {
      success: true,
      message: `Worktree '${worktreePath}' removed and references pruned.`,
    };
  }
}

async function ensureDirectoryExists(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

function sanitizeRef(ref: string): string {
  return ref.replace(/[^a-zA-Z0-9._-]/g, "-");
}
