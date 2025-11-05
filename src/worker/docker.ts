import { execa } from 'execa';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { SessionContext } from '../session/context.js';

interface LaunchAgentArgs {
  session: SessionContext;
  nonInteractive: boolean;
}

interface LaunchResult {
  containerId: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../../');
const DOCKERFILE_PATH = resolve(PROJECT_ROOT, 'docker', 'Dockerfile.opencode');
const OPENCODE_IMAGE = 'openmanager/opencode:latest';
const WORKTREE_TARGET = '/openmanager/worktree';
const PROMPT_TARGET_DIR = '/openmanager/prompt';

export async function launchAgentContainer({ session }: LaunchAgentArgs): Promise<LaunchResult> {
  await ensureImageBuilt();

  if (!session.worktreePath) {
    throw new Error('Session worktree path is not set.');
  }

  const containerName = `openmanager-session-${session.sessionId}`;
  const promptDir = dirname(session.promptPath);
  const promptFileName = basename(session.promptPath);
  const promptTargetPath = `${PROMPT_TARGET_DIR}/${promptFileName}`;

  const promptContent = await readFile(session.promptPath, 'utf8');

  const runArgs = [
    'run',
    '--detach',
    '--rm',
    '--name',
    containerName,
    '--label',
    `openmanager.session=${session.sessionId}`,
    '--workdir',
    WORKTREE_TARGET,
    '--mount',
    `type=bind,src=${session.worktreePath},dst=${WORKTREE_TARGET}`,
    '--mount',
    `type=bind,src=${promptDir},dst=${PROMPT_TARGET_DIR},ro`,
    '-e',
    `OPENMANAGER_SESSION_ID=${session.sessionId}`,
    '-e',
    `OPENMANAGER_AGENT_ID=${session.agentId}`,
    '-e',
    `OPENMANAGER_REPO_PATH=${session.repoPath}`,
    '-e',
    `OPENMANAGER_WORKTREE=${WORKTREE_TARGET}`,
    '-e',
    `OPENMANAGER_PROMPT_FILE=${promptTargetPath}`,
    OPENCODE_IMAGE,
    'run',
    promptContent
  ];

  const { stdout } = await execa('docker', runArgs, { cwd: PROJECT_ROOT });
  const containerId = stdout.trim();

  return { containerId };
}

async function ensureImageBuilt(): Promise<void> {
  try {
    await execa('docker', ['image', 'inspect', OPENCODE_IMAGE], { cwd: PROJECT_ROOT });
  } catch (error) {
    await execa('docker', ['build', '-f', DOCKERFILE_PATH, '-t', OPENCODE_IMAGE, PROJECT_ROOT], {
      cwd: PROJECT_ROOT
    });
  }
}
