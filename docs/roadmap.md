# Openmanager Roadmap

## Milestone 1: Session bootstrap (current)
- [x] CLI scaffolding with Commander
- [x] Start command parsing prompt input from file or inline text
- [x] Git worktree creation and clean repository check
- [x] Session directory preparation for prompts and metadata
- [ ] Docker container launch implementation
- [ ] Interactive terminal attachment to running container

## Milestone 2: Docker integration
- Build opencode.ai Docker image wrapper with configurable entrypoint
- Implement container launch with bind mounts for worktree and prompt files
- Enforce resource limits, seccomp profile, and optional network policies
- Stream logs and allow controlled terminal attach/detach operations

## Milestone 3: Completion workflows
- Detect agent completion and gather git status/diff from worktree
- Generate patch artifacts and optional PR descriptions
- Support pushing changes via user-provided credentials or tokens
- Persist session metadata for auditing and history

## Milestone 4: Extensibility
- Abstract provider interface to add additional agent backends
- Configuration system for per-provider docker images and environment
- Plugin mechanism for custom completion hooks and artifact exporters

## Milestone 5: UX and tooling
- CLI UX refinements (progress indicators, prompts, validation)
- Optional TUI or web dashboard to manage sessions
- Telemetry and diagnostics (opt-in)
