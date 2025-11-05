import { resolve } from "node:path";
import { posix as pathPosix } from "node:path";

import { execa } from "execa";
import { z } from "zod";

import type { DockerConfig } from "../config/session-config.ts";
import type { SessionContext } from "../session/context.ts";
import type { HookResult } from "./session-hooks.ts";
import {
  PROJECT_ROOT,
  WORKTREE_TARGET,
} from "../worker/docker/shared.ts";

export interface PreSessionHook {
  name: string;
  execute(
    context: SessionContext,
    dockerConfig: DockerConfig | undefined,
    options?: Record<string, unknown>,
  ): Promise<HookResult>;
}

export class PreSessionHookManager {
  private readonly hooks = new Map<string, PreSessionHook>();

  constructor() {
    const runCommand = new RunCommandHook();
    this.registerHook(runCommand.name, runCommand);
    this.registerHook(
      "install-node-deps",
      new InstallNodeDependenciesHook(runCommand),
    );
  }

  registerHook(name: string, hook: PreSessionHook): void {
    this.hooks.set(name, hook);
  }

  async executeHook(
    name: string,
    context: SessionContext,
    dockerConfig: DockerConfig | undefined,
    options: Record<string, unknown> = {},
  ): Promise<HookResult> {
    const hook = this.hooks.get(name);
    if (!hook) {
      return {
        success: false,
        message: `Pre-session hook '${name}' not found. Available hooks: ${this.listHooks().join(
          ", ",
        )}`,
      };
    }

    try {
      return await hook.execute(context, dockerConfig, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Pre-session hook '${name}' failed: ${message}`,
      };
    }
  }

  listHooks(): string[] {
    return Array.from(this.hooks.keys()).sort();
  }
}

const RunCommandOptionsSchema = z
  .object({
    command: z.string().min(1, "Command must not be empty"),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    env: z.record(z.string()).optional(),
    runInContainer: z.boolean().optional(),
  })
  .strict();

type RunCommandOptionValues = z.infer<typeof RunCommandOptionsSchema>;

class RunCommandHook implements PreSessionHook {
  readonly name = "run-command";

  async execute(
    context: SessionContext,
    _dockerConfig: DockerConfig | undefined,
    options: Record<string, unknown> = {},
  ): Promise<HookResult> {
    const parsed = RunCommandOptionsSchema.parse(options ?? {});

    if (parsed.runInContainer) {
      return this.executeInContainer(context, parsed);
    }

    return this.executeOnHost(context, parsed);
  }

  private async executeOnHost(
    context: SessionContext,
    options: RunCommandOptionValues,
  ): Promise<HookResult> {
    if (!context.worktreePath) {
      throw new Error("Session worktree path is not available.");
    }

    const cwd = options.cwd
      ? resolve(context.worktreePath, options.cwd)
      : context.worktreePath;

    const env = {
      ...process.env,
      ...(options.env ?? {}),
    } as NodeJS.ProcessEnv;

    const result = await execa(options.command, options.args ?? [], {
      cwd,
      env,
    });

    return {
      success: true,
      message: `Executed '${options.command}' on host`,
      data: {
        stdout: result.stdout,
        stderr: result.stderr,
      },
    };
  }

  private async executeInContainer(
    context: SessionContext,
    options: RunCommandOptionValues,
  ): Promise<HookResult> {
    if (!context.dockerImage) {
      throw new Error(
        "Docker image not available. Ensure image is built before running container commands.",
      );
    }
    if (!context.worktreePath) {
      throw new Error("Session worktree path is not available.");
    }

    const containerCwd = options.cwd
      ? pathPosix.join(WORKTREE_TARGET, options.cwd.replace(/\\/g, "/"))
      : WORKTREE_TARGET;

    const dockerArgs = [
      "run",
      "--rm",
      "--workdir",
      containerCwd,
      "--mount",
      `type=bind,src=${context.worktreePath},dst=${WORKTREE_TARGET}`,
    ];

    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        dockerArgs.push("-e", `${key}=${value}`);
      }
    }

    dockerArgs.push(context.dockerImage, options.command, ...(options.args ?? []));

    const result = await execa("docker", dockerArgs, {
      cwd: PROJECT_ROOT,
    });

    return {
      success: true,
      message: `Executed '${options.command}' inside container`,
      data: {
        stdout: result.stdout,
        stderr: result.stderr,
      },
    };
  }
}

const InstallNodeDepsOptionsSchema = z
  .object({
    packageManager: z.enum(["pnpm", "npm", "yarn"]).optional(),
    additionalArgs: z.array(z.string()).optional(),
    runInContainer: z.boolean().optional(),
  })
  .strict();

class InstallNodeDependenciesHook implements PreSessionHook {
  readonly name = "install-node-deps";

  private readonly runCommandHook: RunCommandHook;

  constructor(runCommandHook: RunCommandHook) {
    this.runCommandHook = runCommandHook;
  }

  async execute(
    context: SessionContext,
    dockerConfig: DockerConfig | undefined,
    options: Record<string, unknown> = {},
  ): Promise<HookResult> {
    const parsed = InstallNodeDepsOptionsSchema.parse(options ?? {});

    const packageManager = parsed.packageManager ?? inferPackageManager();
    const defaultArgs = packageManager === "pnpm" ? ["install"] : ["install"];
    const args = parsed.additionalArgs ?? defaultArgs;

    return this.runCommandHook.execute(context, dockerConfig, {
      command: packageManager,
      args,
      runInContainer: parsed.runInContainer ?? true,
    });
  }
}

function inferPackageManager(): "pnpm" | "npm" | "yarn" {
  const defaultManager = process.env.OPENMANAGER_DEFAULT_PACKAGE_MANAGER;
  if (defaultManager === "npm" || defaultManager === "yarn") {
    return defaultManager;
  }
  return "pnpm";
}
