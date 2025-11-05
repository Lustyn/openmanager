import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const PROJECT_ROOT = resolve(__dirname, "../../../");
export const DEFAULT_IMAGE = "openmanager/opencode:latest";
export const DEFAULT_BASE_IMAGE = "node:24";
export const DEFAULT_BUILD_STEPS = [
  "RUN corepack enable",
  "RUN npm install -g opencode-ai",
];
export const WORKTREE_TARGET = "/openmanager/worktree";
export const PROMPT_TARGET_DIR = "/openmanager/prompt";
