import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { execa } from "execa";

interface PrepareWorktreeArgs {
  repoPath: string;
  gitRef?: string;
  sessionId: string;
}

export async function prepareWorktree({
  repoPath,
  gitRef,
  sessionId,
}: PrepareWorktreeArgs): Promise<string> {
  const worktreeRoot = resolve(repoPath, ".openmanager", "worktrees");
  await mkdir(worktreeRoot, { recursive: true });

  const worktreePath = resolve(worktreeRoot, sessionId);
  await assertWorktreeDoesNotExist(worktreePath);

  const worktreeArgs = ["worktree", "add", "--force", worktreePath];
  if (gitRef) {
    worktreeArgs.push(gitRef);
  }

  await execa("git", worktreeArgs, {
    cwd: repoPath,
  });
  return worktreePath;
}

interface SyncLocalChangesArgs {
  repoPath: string;
  worktreePath: string;
}

export async function syncLocalChangesIntoWorktree({
  repoPath,
  worktreePath,
}: SyncLocalChangesArgs): Promise<void> {
  await applyTrackedChanges({ repoPath, worktreePath });
  await copyUntrackedFiles({ repoPath, worktreePath });
}

async function assertWorktreeDoesNotExist(worktreePath: string): Promise<void> {
  try {
    await stat(worktreePath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }

  throw new Error(
    `Worktree path ${worktreePath} already exists. Remove it or choose a different session ID.`,
  );
}

async function applyTrackedChanges({
  repoPath,
  worktreePath,
}: SyncLocalChangesArgs): Promise<void> {
  const { stdout } = await execa("git", ["diff", "--binary", "HEAD"], {
    cwd: repoPath,
  });
  if (!stdout.trim()) {
    return;
  }

  await execa("git", ["apply", "--binary", "--whitespace=nowarn"], {
    cwd: worktreePath,
    input: stdout,
  });
}

async function copyUntrackedFiles({
  repoPath,
  worktreePath,
}: SyncLocalChangesArgs): Promise<void> {
  const { stdout } = await execa(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    { cwd: repoPath },
  );
  const files = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (files.length === 0) {
    return;
  }

  for (const relativePath of files) {
    const source = resolve(repoPath, relativePath);
    const destination = resolve(worktreePath, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true });
  }
}
