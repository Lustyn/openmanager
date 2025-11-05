import { Command } from "commander";

import { parseStartOptions } from "../session/options.ts";
import { startSession } from "../session/start-session.ts";

export function createStartCommand(): Command {
  const command = new Command("start");

  command
    .description("Start a sandboxed coding agent session")
    .option(
      "-r, --repo <path>",
      "Path to the target Git repository",
      process.cwd(),
    )
    .option("--ref <git-ref>", "Git ref to base the session on", "HEAD")
    .option("-a, --agent <agent-id>", "Agent provider identifier", "opencode")
    .option(
      "--prompt-file <path>",
      "Path to a file containing the initial prompt",
    )
    .option("--prompt-text <text>", "Inline text to use as the initial prompt")
    .option(
      "--include-local-changes",
      "Copy current uncommitted changes into the session worktree",
    )
    .option("--non-interactive", "Skip automatic terminal attach after launch")
    .option(
      "--post-session-hooks <hooks...>",
      "Hooks to run after the agent finishes (e.g. create-patch create-pr prune-worktree)",
    )
    .option(
      "--patch-output-dir <path>",
      "Directory to write generated patch files",
    )
    .option("--patch-file-name <name>", "Custom filename for generated patch")
    .option(
      "--patch-include-base-diff",
      "Also emit a patch against the original git ref",
    )
    .option("--pr-title <title>", "Title to use for the generated PR commit")
    .option(
      "--pr-description <description>",
      "Description/body to include in the generated PR commit",
    )
    .option(
      "--pr-branch-prefix <prefix>",
      "Prefix to use when naming the generated PR branch (default openmanager/session)",
    )
    .option("--pr-auto-push", "Push the generated PR branch to origin")
    .action(async (rawOptions: Record<string, unknown>) => {
      try {
        const options = await parseStartOptions(rawOptions);
        await startSession(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exitCode = 1;
      }
    });

  command.addHelpText(
    "after",
    `
Examples:
  $ openmanager start --repo /path/to/repo --prompt-file prompt.txt
  $ openmanager start --prompt-text "Fix lint issues" --post-session-hooks create-patch
  $ openmanager start --prompt-text "Ship feature" --post-session-hooks create-pr prune-worktree --pr-title "Add feature" --pr-auto-push
`,
  );

  return command;
}
