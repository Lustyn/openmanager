import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { nanoid } from "nanoid";

import {
  prepareWorktree,
  syncLocalChangesIntoWorktree,
} from "../worktree/prepare.ts";
import { launchAgentContainer } from "../worker/docker.ts";
import { attachToSession, waitForContainer } from "../worker/terminal.ts";
import type { PromptConfig, StartOptions } from "./options.ts";
import type { SessionContext } from "./context.ts";
import { cleanupSession } from "./cleanup.ts";
import { ensureAgentImage } from "../worker/docker/image-builder.ts";
import { PreSessionHookManager } from "../hooks/pre-session-hooks.ts";

export async function startSession(options: StartOptions): Promise<void> {
  const session = await createSessionContext(options);

  const worktreePath = await prepareWorktree({
    repoPath: session.repoPath,
    gitRef: session.gitRef,
    sessionId: session.sessionId,
  });

  session.worktreePath = worktreePath;

  if (options.includeLocalChanges) {
    await syncLocalChangesIntoWorktree({
      repoPath: session.repoPath,
      worktreePath,
    });
  }

  session.dockerImage = await ensureAgentImage(options.dockerConfig);

  await runPreSessionHooks(session, options);

  const { containerId } = await launchAgentContainer({
    session,
    nonInteractive: options.nonInteractive,
    image: session.dockerImage,
  });

  try {
    if (options.nonInteractive) {
      await waitForContainer(containerId);
    } else {
      await attachToSession(containerId);
    }
  } finally {
    await cleanupSession(session, options);
  }
}

async function runPreSessionHooks(
  session: SessionContext,
  options: StartOptions,
): Promise<void> {
  if (!options.preSessionHooks.length) {
    return;
  }

  const hookManager = new PreSessionHookManager();
  console.log(
    `Running pre-session hooks: ${options.preSessionHooks
      .map((hook) => hook.name)
      .join(", ")}`,
  );

  for (const invocation of options.preSessionHooks) {
    const result = await hookManager.executeHook(
      invocation.name,
      session,
      options.dockerConfig,
      invocation.options ?? {},
    );

    const prefix = result.success ? "✓" : "✗";
    const baseMessage = `${prefix} ${invocation.name}: ${result.message}`;

    if (!result.success) {
      throw new Error(baseMessage);
    }

    console.log(baseMessage);
    if (result.data) {
      console.log(JSON.stringify(result.data, null, 2));
    }
  }
}

async function createSessionContext(
  options: StartOptions,
): Promise<SessionContext> {
  const sessionId = nanoid();
  const sessionRoot = await ensureSessionRoot(options.repoPath, sessionId);
  const promptPath = await materializePrompt({
    prompt: options.prompt,
    sessionRoot,
  });

  return {
    sessionId,
    repoPath: options.repoPath,
    sessionRoot,
    worktreePath: "",
    gitRef: options.gitRef,
    agentId: options.agentId,
    promptPath,
    prompt: options.prompt,
  };
}

async function materializePrompt({
  prompt,
  sessionRoot,
}: {
  prompt: PromptConfig;
  sessionRoot: string;
}): Promise<string> {
  const promptDir = await ensurePromptDir(sessionRoot);
  const promptPath = resolve(promptDir, "prompt.txt");

  if (prompt.kind === "file") {
    const content = await readFile(prompt.path, "utf8");
    await writeFile(promptPath, content, "utf8");
    return promptPath;
  }

  await writeFile(promptPath, prompt.content, "utf8");
  return promptPath;
}

async function ensureSessionRoot(
  repoPath: string,
  sessionId: string,
): Promise<string> {
  const sessionRoot = resolve(repoPath, ".openmanager", "sessions", sessionId);
  await mkdir(sessionRoot, { recursive: true });
  return sessionRoot;
}

async function ensurePromptDir(sessionRoot: string): Promise<string> {
  const promptDir = resolve(sessionRoot, "prompt");
  await mkdir(promptDir, { recursive: true });
  return promptDir;
}
