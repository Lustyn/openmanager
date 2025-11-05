import type { PromptConfig } from "./options.ts";

export interface SessionContext {
  sessionId: string;
  repoPath: string;
  sessionRoot: string;
  worktreePath: string;
  gitRef: string;
  agentId: string;
  promptPath: string;
  prompt: PromptConfig;
  dockerImage?: string;
}
