import { Command } from 'commander';

import { parseStartOptions } from '../session/options.js';
import { startSession } from '../session/start-session.js';

export function createStartCommand(): Command {
  const command = new Command('start');

  command
    .description('Start a sandboxed coding agent session')
    .option('-r, --repo <path>', 'Path to the target Git repository', process.cwd())
    .option('--ref <git-ref>', 'Git ref to base the session on', 'HEAD')
    .option('-a, --agent <agent-id>', 'Agent provider identifier', 'opencode')
    .option('--prompt-file <path>', 'Path to a file containing the initial prompt')
    .option('--prompt-text <text>', 'Inline text to use as the initial prompt')
    .option('--include-local-changes', 'Copy current uncommitted changes into the session worktree')
    .option('--non-interactive', 'Skip automatic terminal attach after launch')
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

  command.addHelpText('after', `
Examples:
  $ openmanager start --repo /path/to/repo --prompt-file prompt.txt
  $ openmanager start --prompt-text "Fix lint issues in src/app.ts"
`);

  return command;
}
