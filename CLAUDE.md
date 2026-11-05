# Claude Code notes

Follow [AGENTS.md](AGENTS.md). It holds the shared rules and authorization limits. Start with
[docs/ai/PROJECT_STATUS.md](docs/ai/PROJECT_STATUS.md) and [docs/ai/HANDOFF.md](docs/ai/HANDOFF.md).

- Reply to the owner in Thai.
- `.claude/launch.json` defines the `studio` dev server for the built-in browser pane.
- The pane may throttle `requestAnimationFrame`, so do not use it to measure frame rate. Use the
  Playwright playback test instead.
- PowerShell 5.1 mangles quotes in arguments to native tools such as `gh --jq`. Prefer simple
  arguments.
