import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { prepareWorktree, syncLocalChangesIntoWorktree } from '../worktree/prepare.js';
import { launchAgentContainer } from '../worker/docker.js';
import { attachToSession } from '../worker/terminal.js';
import { PromptConfig, StartOptions } from './options.js';
import { SessionContext } from './context.js';

export async function startSession(options: StartOptions): Promise<void> {
  const session = await createSessionContext(options);

  const worktreePath = await prepareWorktree({
    repoPath: session.repoPath,
    gitRef: session.gitRef,
    sessionId: session.sessionId
  });

  session.worktreePath = worktreePath;

  if (options.includeLocalChanges) {
    await syncLocalChangesIntoWorktree({
      repoPath: session.repoPath,
      worktreePath
    });
  }

  const { containerId } = await launchAgentContainer({
    session,
    nonInteractive: options.nonInteractive
  });

  if (!options.nonInteractive) {
    await attachToSession(containerId);
  }
}

async function createSessionContext(options: StartOptions): Promise<SessionContext> {
  const sessionId = randomUUID();
  const sessionRoot = await ensureSessionRoot(options.repoPath, sessionId);
  const promptPath = await materializePrompt({
    prompt: options.prompt,
    sessionRoot
  });

  return {
    sessionId,
    repoPath: options.repoPath,
    sessionRoot,
    worktreePath: '',
    gitRef: options.gitRef,
    agentId: options.agentId,
    promptPath,
    prompt: options.prompt
  };
}

async function materializePrompt({
  prompt,
  sessionRoot
}: {
  prompt: PromptConfig;
  sessionRoot: string;
}): Promise<string> {
  const promptDir = await ensurePromptDir(sessionRoot);
  const promptPath = resolve(promptDir, 'prompt.txt');

  if (prompt.kind === 'file') {
    const content = await readFile(prompt.path, 'utf8');
    await writeFile(promptPath, content, 'utf8');
    return promptPath;
  }

  await writeFile(promptPath, prompt.content, 'utf8');
  return promptPath;
}

async function ensureSessionRoot(repoPath: string, sessionId: string): Promise<string> {
  const sessionRoot = resolve(repoPath, '.openmanager', 'sessions', sessionId);
  await mkdir(sessionRoot, { recursive: true });
  return sessionRoot;
}

async function ensurePromptDir(sessionRoot: string): Promise<string> {
  const promptDir = resolve(sessionRoot, 'prompt');
  await mkdir(promptDir, { recursive: true });
  return promptDir;
}
