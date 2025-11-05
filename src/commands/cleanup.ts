import { Command } from "commander";

import { execa } from "execa";
import { z } from "zod";
import { cwd } from "node:process";
import { resolve } from "node:path";
import { readdir } from "node:fs/promises";

export function createCleanupCommand(): Command {
  const command = new Command("cleanup");

  command
    .description("Clean up all worktrees in .openmanager/worktrees")
    .option(
      "-r, --repo <path>",
      "Path to the target Git repository",
      process.cwd(),
    )
    .action(async (rawOptions: Record<string, unknown>) => {
      try {
        const options = parseCleanupOptions(rawOptions);
        await cleanupWorktrees(options);
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
  $ openmanager cleanup
  $ openmanager cleanup --repo /path/to/repo
`,
  );

  return command;
}

export interface CleanupOptions {
  repoPath: string;
}

const RawCleanupOptionsSchema = z.object({
  repo: z.string().min(1, "Repository path is required").optional(),
});

function resolveRepoPath(value: string | undefined): string {
  const path = value ?? cwd();
  return resolve(path);
}

export function parseCleanupOptions(
  raw: Record<string, unknown>,
): CleanupOptions {
  const parsed = RawCleanupOptionsSchema.parse(raw);
  const repoPath = resolveRepoPath(parsed.repo);

  return {
    repoPath,
  };
}

async function cleanupWorktrees(options: CleanupOptions): Promise<void> {
  const { repoPath } = options;
  const worktreeRoot = resolve(repoPath, ".openmanager", "worktrees");

  console.log(`Cleaning up worktrees in: ${worktreeRoot}`);

  // List all worktree directories
  let worktreePaths: string[] = [];
  try {
    const entries = await readdir(worktreeRoot, { withFileTypes: true });
    worktreePaths = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(worktreeRoot, entry.name));
  } catch {
    console.log("No .openmanager/worktrees directory found. Nothing to clean up.");
    return;
  }

  if (worktreePaths.length === 0) {
    console.log("No worktrees found. Nothing to clean up.");
    return;
  }

  console.log(`Found ${worktreePaths.length} worktree(s) to remove:`);
  worktreePaths.forEach((path) => console.log(`  - ${path}`));

  // Remove each worktree
  for (const worktreePath of worktreePaths) {
    try {
      await execa("git", ["worktree", "remove", "--force", worktreePath], {
        cwd: repoPath,
      });
      console.log(`✓ Removed worktree: ${worktreePath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`✗ Failed to remove worktree ${worktreePath}: ${message}`);
    }
  }

  // Prune stale worktree references
  try {
    await execa("git", ["worktree", "prune"], { cwd: repoPath });
    console.log("✓ Pruned stale worktree references");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`✗ Failed to prune worktree references: ${message}`);
  }

  console.log("Cleanup completed.");
}
