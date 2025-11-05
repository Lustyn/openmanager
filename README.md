# Openmanager

Openmanager is a CLI tool for launching sandboxed coding agent sessions inside Docker containers. The initial target agent is [opencode.ai](https://opencode.ai/), with a focus on safe access to user repositories via Git worktrees.

## Features (in progress)

- Start a session from any existing Git repository using a detached worktree copy
- Materialise initial prompts from files or inline text
- Prepare per-session directories for prompts and metadata under `.openmanager/`
- Stubbed Docker launch flow ready for integration with container runtime
- CLI powered by [`commander`](https://github.com/tj/commander.js)

## Getting Started

```bash
pnpm install
pnpm run dev -- start --repo /path/to/repo --prompt-text "Summarise open PRs"
```

### Build

```bash
pnpm run build
```

### Lint & Test

```bash
pnpm run lint
pnpm run test
```

## Project Structure

```
src/
  cli.ts               # CLI bootstrap
  commands/            # Commander commands
  session/             # Session orchestration logic
  worktree/            # Git worktree helpers
  worker/              # Docker + terminal adapters
```

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for near-term implementation milestones.
