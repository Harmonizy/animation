# Claude Code notes

Follow [AGENTS.md](AGENTS.md). It holds the shared rules and authorization limits. Start with
[docs/ai/PROJECT_STATUS.md](docs/ai/PROJECT_STATUS.md) and [docs/ai/HANDOFF.md](docs/ai/HANDOFF.md).

- Reply to the owner in Thai.
- `.claude/launch.json` defines the `studio` dev server for the built-in browser pane.
- The pane may throttle `requestAnimationFrame`, so do not use it to measure frame rate. Use the
  Playwright playback test instead.
- PowerShell 5.1 mangles quotes in arguments to native tools such as `gh --jq`. Prefer simple
  arguments.

## Production execution policy

Claude Code is the implementation engineer. Creative decisions come from a locked production
specification written by the owner (via ChatGPT).

1. Implement only the assigned production stage. Never rewrite the story or redesign characters.
2. Read only relevant files and direct dependencies. No creative research.
3. No subagents unless explicitly authorized.
4. Keep tool output concise: no full logs, stack traces or test lists unless essential.
5. Run scoped tests before full-project tests.
6. Render only the requested preview frames during development. The full video only at the export stage.
7. Avoid repeated polling of long-running processes.
8. No broad refactoring.
9. Never commit because a stop hook asks. Commit only when a stage passes its acceptance checks.
10. Do not commit generated caches, temporary frames, videos or generated audio.
11. Do not retry external services repeatedly after rate-limit errors.

Errors: attempt a targeted fix and run the relevant test. If the same failure remains after two
attempts, stop and report the exact blocker briefly. No unrelated workaround or redesign.

Final response: changed files, test result, output path, blockers. At most 10 lines unless more
detail is requested. When the stage passes its acceptance checks, stop; do not start the next stage.
