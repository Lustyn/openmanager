#!/usr/bin/env node

import { Command } from "commander";
import { fileURLToPath } from "url";

import { createStartCommand } from "./commands/start.js";
import { loadPackageMetadata } from "./config/package.js";

export async function buildCli(program = new Command()): Promise<Command> {
  const pkg = await loadPackageMetadata();

  program
    .name("openmanager")
    .description(pkg.description ?? "")
    .version(pkg.version ?? "0.0.0");

  program.addCommand(createStartCommand());

  return program;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const program = await buildCli();
  program.parse(process.argv);
}
