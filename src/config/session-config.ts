import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

const CONFIG_LOCATIONS = ["openmanager/config.json", ".openmanager/config.json"];

export interface HookInvocation {
  name: string;
  options?: Record<string, unknown>;
}

export interface DockerConfig {
  baseImage?: string;
  steps?: string[];
}

export interface SessionConfig {
  docker?: DockerConfig;
  preSessionHooks?: HookInvocation[];
}

const HookInvocationSchema = z.object({
  name: z.string().min(1, "Hook name must not be empty"),
  options: z.record(z.unknown()).optional(),
});

const DockerConfigSchema = z
  .object({
    baseImage: z.string().min(1).optional(),
    steps: z.array(z.string().min(1)).optional(),
  })
  .strict();

const SessionConfigSchema = z
  .object({
    docker: DockerConfigSchema.optional(),
    preSessionHooks: z.array(HookInvocationSchema).optional(),
  })
  .strict();

const DEFAULT_SESSION_CONFIG: SessionConfig = {};

export async function loadSessionConfig(repoPath: string): Promise<SessionConfig> {
  for (const relativePath of CONFIG_LOCATIONS) {
    const configPath = resolve(repoPath, relativePath);

    try {
      const raw = await readFile(configPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return SessionConfigSchema.parse(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }

      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid session configuration at ${configPath}: ${error.message}`,
        );
      }

      throw new Error(
        `Failed to read session configuration at ${configPath}: ${String(error)}`,
      );
    }
  }

  return DEFAULT_SESSION_CONFIG;
}
