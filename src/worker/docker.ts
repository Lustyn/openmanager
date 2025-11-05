import { execa } from "execa";
import { basename, dirname } from "node:path";
import { readFile } from "node:fs/promises";

import type { SessionContext } from "../session/context.ts";
import {
  DEFAULT_IMAGE,
  PROMPT_TARGET_DIR,
  PROJECT_ROOT,
  WORKTREE_TARGET,
} from "./docker/shared.ts";

interface LaunchAgentArgs {
  session: SessionContext;
  nonInteractive: boolean;
  image?: string;
}

interface LaunchResult {
  containerId: string;
}

export async function launchAgentContainer({
  session,
  image,
}: LaunchAgentArgs): Promise<LaunchResult> {
  if (!session.worktreePath) {
    throw new Error("Session worktree path is not set.");
  }

  const resolvedImage = image ?? DEFAULT_IMAGE;
  const containerName = `openmanager-session-${session.sessionId}`;
  const promptDir = dirname(session.promptPath);
  const promptFileName = basename(session.promptPath);
  const promptTargetPath = `${PROMPT_TARGET_DIR}/${promptFileName}`;

  const promptContent = (await readFile(session.promptPath, "utf8")).trim();

  const runArgs = [
    "run",
    "--detach",
    "--rm",
    "--name",
    containerName,
    "--label",
    `openmanager.session=${session.sessionId}`,
    "--workdir",
    WORKTREE_TARGET,
    "--mount",
    `type=bind,src=${session.worktreePath},dst=${WORKTREE_TARGET}`,
    "--mount",
    `type=bind,src=${promptDir},dst=${PROMPT_TARGET_DIR},ro`,
    "-e",
    `OPENMANAGER_SESSION_ID=${session.sessionId}`,
    "-e",
    `OPENMANAGER_AGENT_ID=${session.agentId}`,
    "-e",
    `OPENMANAGER_REPO_PATH=${session.repoPath}`,
    "-e",
    `OPENMANAGER_WORKTREE=${WORKTREE_TARGET}`,
    "-e",
    `OPENMANAGER_PROMPT_FILE=${promptTargetPath}`,
    resolvedImage,
    "opencode",
    "run",
    promptContent,
  ];

  const { stdout } = await execa("docker", runArgs, { cwd: PROJECT_ROOT });
  const containerId = stdout.trim();

  return { containerId };
}
