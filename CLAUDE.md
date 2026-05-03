# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`@netxeo/security-skill` is a zero-dependency Node.js CLI package published to npm. Running `npx @netxeo/security-skill` in any project installs 29 Markdown security-instruction files into `.skills/security/` and creates AI-assistant config files for Claude, Cursor, Copilot, Windsurf, Cline, Codex, Aider, Continue.dev, and Gemini. There is **no build step** — the package ships raw files.

## Commands

```bash
# Run the installer locally (simulates what npx does)
node install.js

# Publish to npm
npm publish --access public
```

There are no tests, no lint config, and no dev dependencies. The only runtime dependency surface is Node.js ≥ 18 built-ins (`fs`, `path`, `url`).

## Architecture

```
install.js          ← single CLI entry point; all install logic lives here
skill.md            ← master skill file (identity, commands, intervention levels)
instructions/       ← 29 Markdown files (00-stack-detection.md … 28-memory-system.md)
templates/          ← ready-to-copy config files for every AI assistant and tool
checklists/         ← audit checklists per platform (Docker, Firebase, Supabase, etc.)
examples/           ← good-practices.md / bad-practices.md reference docs
```

### How `install.js` works

1. Copies `instructions/`, `templates/`, `checklists/`, and `skill.md` into the target project's `.skills/security/`.
2. Creates `memory-security.md` in the project root (tracks audit score history; never overwritten if it already exists).
3. Merges security entries into `.gitignore`.
4. Writes AI config files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursorrules`, `.cursor/rules/security.mdc`, `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`, `.continue/config.yaml`) — appending to existing files rather than overwriting them if they already contain `security-skill`.

### Skill command contract (defined in `skill.md`)

The AI commands (`/security-scan`, `/security-audit`, `/security-fix`, `/security-status`, `/security-incident`) are **not code** — they are natural-language instructions read by the AI at runtime. The intervention-level ladder (INFO → CREATE → APPEND → MODIFY → BLOCKING) governs how aggressively the AI may touch files.

### Content files (instructions/*)

Each numbered file covers one security category. `00-stack-detection.md` runs first; it auto-detects stack from root files so subsequent checks load only the relevant categories. Editing these files is the primary contribution path — no build or compile step required.

## Key conventions

- **ESM only** — `package.json` has `"type": "module"`; use `import`/`export` and `fileURLToPath` for `__dirname`.
- **No external dependencies** — keep it that way; the package must install instantly without a network hit.
- **Idempotent installs** — every write operation checks whether the target already contains `security-skill` before touching it.
- **Non-destructive** — never overwrite files the user already has; always merge or append.
