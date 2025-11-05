import { access, constants } from "node:fs/promises";
import { resolve } from "node:path";
import { cwd } from "node:process";

import { z } from "zod";

import type { PatchOptions, PrOptions } from "../hooks/session-hooks.ts";

export type PromptConfig =
  | { kind: "file"; path: string }
  | { kind: "text"; content: string };

export const DEFAULT_POST_SESSION_HOOKS = ["create-patch", "prune-worktree"];

export interface StartOptions {
  repoPath: string;
  gitRef: string;
  agentId: string;
  prompt: PromptConfig;
  nonInteractive: boolean;
  includeLocalChanges: boolean;
  postSessionHooks: string[];
  patchOptions?: PatchOptions;
  prOptions?: PrOptions;
}

const RawOptionsSchema = z.object({
  repo: z.string().min(1, "Repository path is required").optional(),
  ref: z.string().min(1, "Git ref must not be empty").optional(),
  agent: z.string().min(1, "Agent identifier must not be empty").optional(),
  promptFile: z
    .string()
    .min(1, "Prompt file path must not be empty")
    .optional(),
  promptText: z.string().min(1, "Prompt text must not be empty").optional(),
  nonInteractive: z.boolean().optional(),
  includeLocalChanges: z.boolean().optional(),
  postSessionHooks: z.array(z.string()).optional(),
  patchOutputDir: z.string().optional(),
  patchFileName: z.string().optional(),
  patchIncludeBaseDiff: z.boolean().optional(),
  prTitle: z.string().optional(),
  prDescription: z.string().optional(),
  prBranchPrefix: z.string().optional(),
  prAutoPush: z.boolean().optional(),
});

function resolveRepoPath(value: string | undefined): string {
  const path = value ?? cwd();
  return resolve(path);
}

async function ensurePromptFileExists(
  promptFile: string,
  repoPath: string,
): Promise<string> {
  const fullPath = resolve(repoPath, promptFile);
  await access(fullPath, constants.R_OK);
  return fullPath;
}

function ensurePromptChoice(promptFile?: string, promptText?: string): void {
  if (promptFile && promptText) {
    throw new Error("Specify either --prompt-file or --prompt-text, not both.");
  }

  if (!promptFile && !promptText) {
    throw new Error(
      "An initial prompt is required. Provide --prompt-file or --prompt-text.",
    );
  }
}

export async function parseStartOptions(
  raw: Record<string, unknown>,
): Promise<StartOptions> {
  const parsed = RawOptionsSchema.parse(raw);

  const repoPath = resolveRepoPath(parsed.repo);
  const gitRef = parsed.ref ?? "HEAD";
  const agentId = parsed.agent ?? "opencode";

  ensurePromptChoice(parsed.promptFile, parsed.promptText);

  const patchOptions: PatchOptions | undefined =
    parsed.patchOutputDir || parsed.patchFileName || parsed.patchIncludeBaseDiff
      ? {
          outputDir: parsed.patchOutputDir,
          patchFileName: parsed.patchFileName,
          includeBaseDiff: parsed.patchIncludeBaseDiff,
        }
      : undefined;

  const prOptions: PrOptions | undefined =
    parsed.prTitle ||
    parsed.prDescription ||
    parsed.prBranchPrefix ||
    parsed.prAutoPush !== undefined
      ? {
          title: parsed.prTitle,
          description: parsed.prDescription,
          branchPrefix: parsed.prBranchPrefix,
          autoPush: parsed.prAutoPush,
        }
      : undefined;

  const postSessionHooks =
    parsed.postSessionHooks && parsed.postSessionHooks.length > 0
      ? parsed.postSessionHooks
      : [...DEFAULT_POST_SESSION_HOOKS];

  if (parsed.promptFile) {
    const promptFilePath = await ensurePromptFileExists(
      parsed.promptFile,
      repoPath,
    );
    return {
      repoPath,
      gitRef,
      agentId,
      prompt: { kind: "file", path: promptFilePath },
      nonInteractive: Boolean(parsed.nonInteractive),
      includeLocalChanges: Boolean(parsed.includeLocalChanges),
      postSessionHooks,
      patchOptions,
      prOptions,
    };
  }

  return {
    repoPath,
    gitRef,
    agentId,
    prompt: { kind: "text", content: parsed.promptText ?? "" },
    nonInteractive: Boolean(parsed.nonInteractive),
    includeLocalChanges: Boolean(parsed.includeLocalChanges),
    postSessionHooks,
    patchOptions,
    prOptions,
  };
}
