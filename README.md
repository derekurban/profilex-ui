# ProfileX-UI

A beautiful web UI for unified usage/cost analysis across:

- **Claude Code** JSONL usage files
- **Codex CLI** session JSONL files
- **ProfileX** profile mappings (`state.json`)

Built with **Svelte + Vite + Tailwind CSS + TypeScript**.

---

## What it does

- Imports ProfileX `state.json`
- Imports usage files (multiple JSONL files)
- Imports ProfileX unified usage bundle JSON files (great for multi-machine aggregation)
- Detects Claude vs Codex event formats
- Normalizes events into one schema
- Maps each event to profile:
  - ProfileX-managed profile if matched
  - `default-<counter>` fallback if not matched
- Pulls latest LiteLLM model pricing
- Computes costs in configurable mode:
  - `auto` (observed if available, else calculated)
  - `calculate`
  - `display`
- Produces tabular breakdowns:
  - Daily × Profile
  - Profile Summary
  - Tool Totals
  - Grand Totals

---

## Quick start

```bash
pnpm install
pnpm dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

`pnpm dev` now preflights `public/local-unified-usage.json` before Vite starts:

- If the report exists, it is reused.
- If missing, it runs `pnpm generate:local:deep` first.
- Pass `--force-report` to regenerate even when it exists.
- Pass `--skip-report` to skip preflight generation.

Examples:

```bash
pnpm dev -- --force-report
pnpm dev -- --skip-report
```

---

## Build

```bash
pnpm build
pnpm preview
```

---

## Data input guidance

### Optional local auto-import command

If you want this UI to auto-load local data on startup (without manual file picking), run:

```bash
pnpm generate:local
```

By default this uses the ProfileX CLI bridge:

```bash
profilex usage export --out ./public/local-unified-usage.json
```

If `profilex` is unavailable or fails, it falls back to the local parser/scanner logic.

- Use `--no-profilex-cli` to force fallback scanner mode.
- Set `PROFILEX_UI_SKIP_PROFILEX_CLI=1` to skip the bridge.

It writes:

- `public/local-unified-usage.json`

You can run a broader home-directory scan with:

```bash
pnpm generate:local:deep
```

On app boot, the UI checks for `public/local-unified-usage.json`:

- If present: it auto-loads events and profile mappings.
- If missing: it stays in manual upload mode and shows a command hint.

### Multi-machine aggregation (work laptop + desktop)

1. On each machine, run:

```bash
profilex usage export --out ./local-unified-usage.<machine>.json --deep
```

2. Move those JSON files to your main machine.
3. In ProfileX-UI, use **Import ProfileX usage bundle(s) (.json)** and select all of them.

The UI merges events and profile metadata across bundles.

### ProfileX state

Upload `~/.profilex/state.json` (or `PROFILEX_HOME/state.json`) so the UI can map events to named profiles.

### Claude usage files

Typically under:

- `~/.config/claude/projects/**/*.jsonl`
- `~/.claude/projects/**/*.jsonl`
- or profile-specific `CLAUDE_CONFIG_DIR/projects/**/*.jsonl`

### Codex usage files

Typically under:

- `~/.codex/sessions/**/*.jsonl`
- or profile-specific `CODEX_HOME/sessions/**/*.jsonl`

---

## Notes

- Pricing source: LiteLLM model pricing catalog.
- Browser sandbox means path matching depends on uploaded filenames/relative paths.
- For strongest profile mapping, upload files with meaningful relative paths (e.g. from profile directories).

---

## License

MIT
