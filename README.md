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
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

---

## Build

```bash
npm run build
npm run preview
```

---

## Data input guidance

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
