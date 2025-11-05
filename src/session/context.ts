import { PromptConfig } from './options.js';

export interface SessionContext {
  sessionId: string;
  repoPath: string;
  sessionRoot: string;
  worktreePath: string;
  gitRef: string;
  agentId: string;
  promptPath: string;
  prompt: PromptConfig;
}
