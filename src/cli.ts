#!/usr/bin/env node

import { Command } from "commander";

import { createStartCommand } from "./commands/start.ts";
import { loadPackageMetadata } from "./config/package.ts";

export async function buildCli(program = new Command()): Promise<Command> {
  const pkg = await loadPackageMetadata();

  program
    .name("openmanager")
    .description(pkg.description ?? "")
    .version(pkg.version ?? "0.0.0");

  program.addCommand(createStartCommand());

  return program;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const program = await buildCli();
  program.parse(process.argv);
}
