# OpenManager

OpenManager is a CLI tool for launching sandboxed coding agent sessions inside Docker containers. The initial target agent is [opencode.ai](https://opencode.ai/), with a focus on safe access to user repositories via Git worktrees.

## Features

### Core Functionality

- **Git Worktree Isolation**: Start sessions from any Git repository using detached worktree copies
- **Docker Sandbox**: Run coding agents in isolated Docker containers with configurable environments
- **Prompt Management**: Materialize initial prompts from files or inline text
- **Session Management**: Automatic session directory creation under `.openmanager/sessions/`
- **Local Changes Support**: Option to include current uncommitted changes in session worktrees

### Configuration & Hooks

- **Pre-Session Hooks**: Execute setup commands before agent launch (install dependencies, run scripts)
- **Post-Session Hooks**: Automated cleanup and artifact generation (patches, PRs, worktree removal)
- **Flexible Configuration**: JSON-based configuration for Docker builds and hook settings
- **Multiple Package Managers**: Support for pnpm, npm, and yarn with automatic detection

### Output & Integration

- **Patch Generation**: Create git patches from session changes with optional base diffs
- **PR Preparation**: Generate branches and commits for pull requests with optional auto-push
- **Interactive & Non-Interactive**: Terminal attachment or background execution modes
- **Comprehensive CLI**: Rich command-line interface powered by [`commander`](https://github.com/tj/commander.js)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd openmanager

# Install dependencies
pnpm install

# Build the project
pnpm run build
```

## Quick Start

### Basic Session

```bash
# Start a session with inline prompt
pnpm run dev -- start --repo /path/to/repo --prompt-text "Summarise open PRs"

# Start a session with prompt file
pnpm run dev -- start --repo /path/to/repo --prompt-file prompt.txt
```

### Advanced Usage

```bash
# Include local changes and generate patch
pnpm run dev -- start \
  --repo /path/to/repo \
  --prompt-text "Fix lint issues" \
  --include-local-changes \
  --post-session-hooks create-patch remove-worktree

# Create PR with auto-push
pnpm run dev -- start \
  --repo /path/to/repo \
  --prompt-text "Ship new feature" \
  --post-session-hooks create-pr remove-worktree \
  --pr-title "Add new feature" \
  --pr-description "Implementation of the requested feature" \
  --pr-auto-push
```

### Cleanup

```bash
# Clean up all worktrees
pnpm run dev -- cleanup

# Clean up specific repository
pnpm run dev -- cleanup --repo /path/to/repo
```

## Configuration

### Session Configuration

Create `openmanager/config.json` or `.openmanager/config.json` in your repository:

```json
{
  "docker": {
    "steps": ["RUN corepack prepare pnpm@10.18.3 --activate"]
  },
  "preSessionHooks": [
    {
      "name": "install-node-deps",
      "options": {
        "additionalArgs": ["install", "--frozen-lockfile"]
      }
    }
  ]
}
```

## Command Reference

### `openmanager start`

Start a sandboxed coding agent session.

**Options:**

- `-r, --repo <path>`: Target Git repository (default: current directory)
- `--ref <git-ref>`: Git ref to base session on (default: HEAD)
- `-a, --agent <agent-id>`: Agent provider (default: opencode)
- `-f, --prompt-file <path>`: File containing initial prompt
- `-t, --prompt-text <text>`: Inline prompt text
- `-i, --include-local-changes`: Copy uncommitted changes to worktree
- `-n, --non-interactive`: Skip terminal attachment
- `-h, --post-session-hooks <hooks...>`: Post-session hooks to run
- `--patch-output-dir <path>`: Directory for patch files
- `--patch-file-name <name>`: Custom patch filename
- `--patch-include-base-diff`: Include diff against original git ref
- `-T, --pr-title <title>`: PR commit title
- `-D, --pr-description <description>`: PR commit description
- `--pr-branch-prefix <prefix>`: PR branch name prefix
- `-P, --pr-auto-push`: Auto-push PR branch to origin

### `openmanager cleanup`

Clean up all worktrees created by OpenManager.

**Options:**

- `-r, --repo <path>`: Target repository (default: current directory)

## Architecture

```
src/
├── cli.ts                    # CLI bootstrap and entry point
├── commands/                 # Commander command definitions
│   ├── start.ts             # Session start command
│   └── cleanup.ts           # Worktree cleanup command
├── session/                  # Session orchestration logic
│   ├── context.ts           # Session context interface
│   ├── options.ts           # Command line option parsing
│   ├── start-session.ts     # Session lifecycle management
│   └── cleanup.ts           # Post-session cleanup
├── worktree/                 # Git worktree management
│   └── prepare.ts           # Worktree creation and sync
├── hooks/                    # Session hook system
│   ├── session-hooks.ts     # Post-session hooks (patch, PR, cleanup)
│   └── pre-session-hooks.ts # Pre-session hooks (deps, commands)
├── worker/                   # Docker and terminal adapters
│   ├── docker.ts            # Container launch logic
│   ├── docker/
│   │   ├── image-builder.ts # Docker image building
│   │   └── shared.ts        # Docker constants and utilities
│   └── terminal.ts          # Terminal attachment utilities
└── config/                   # Configuration management
    ├── package.ts           # Package metadata utilities
    └── session-config.ts    # Session configuration loading
```

## Development

### Scripts

```bash
# Development mode (run from source)
pnpm run dev

# Build for production
pnpm run build

# Lint code
pnpm run lint

# Format code
pnpm run format
```

### Project Structure

- **TypeScript**: Full TypeScript implementation with strict type checking
- **ESM**: ES modules with modern Node.js features
- **Zod**: Runtime type validation for configuration and options
- **Execa**: Process execution for Git and Docker commands
- **Commander**: CLI framework for command parsing
