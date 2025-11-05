import { SessionHookManager } from "../hooks/session-hooks.ts";
import type { SessionContext } from "./context.ts";
import type { StartOptions } from "./options.ts";

const DEFAULT_HOOKS = ["prune-worktree"];

export async function cleanupSession(
  context: SessionContext,
  options: StartOptions,
): Promise<void> {
  const hookManager = new SessionHookManager();
  const hooks = options.postSessionHooks.length
    ? options.postSessionHooks
    : DEFAULT_HOOKS;

  console.log(`Running post-session hooks: ${hooks.join(", ")}`);

  for (const hookName of hooks) {
    let hookOptions: Record<string, unknown> = {};

    if (hookName === "create-patch" && options.patchOptions) {
      hookOptions = options.patchOptions;
    } else if (hookName === "create-pr" && options.prOptions) {
      hookOptions = options.prOptions;
    }

    const result = await hookManager.executeHook(
      hookName,
      context,
      hookOptions,
    );

    const prefix = result.success ? "✓" : "✗";
    const baseMessage = `${prefix} ${hookName}: ${result.message}`;

    if (result.success) {
      console.log(baseMessage);
      if (result.data) {
        console.log(JSON.stringify(result.data, null, 2));
      }
    } else {
      console.warn(baseMessage);
    }
  }
}
