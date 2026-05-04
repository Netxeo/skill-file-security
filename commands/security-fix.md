---
description: Apply fixes from the most recent /security-audit, with confirmation before any risky change.
---

Activate the **file-security** skill and apply fixes from the most recent audit.

**Goal:** Resolve issues identified in the last `security-report.md` while strictly honoring the No-Break Rule.

**Steps:**
1. Read `security-report.md` from the project root. If it doesn't exist, tell the user to run `/security-audit` first and stop.
2. For each issue, classify the fix using the Intervention Levels in SKILL.md:
   - **Level 2 (CREATE)** new file → apply directly, then explain.
   - **Level 3 (APPEND)** missing rules to existing file → apply directly. Never delete existing content.
   - **Level 4 (MODIFY)** existing logic → show the exact diff, explain impact, **wait for explicit approval** before applying.
   - **Level 5 (BLOCKING)** → describe the problem and propose a solution; the user applies it themselves.
3. Group fixes by severity, ask which ones to apply, and apply only those.
4. After each batch, run a quick re-check on the touched files and report what's now resolved.

**Strict rules:**
- Never touch UI/design or business logic without explicit approval.
- Never modify deployment-affecting files (CI configs, IaC, deployment manifests) without approval.
- Never write `CLAUDE.md`, `.cursorrules`, `.skills/`, or other AI-assistant config files into the project.
- Update `memory-security.md` with what was fixed only if it already exists.

If an applied fix breaks the project (verify by running existing tests/linters when available), revert immediately and escalate to Level 4 disclosure.
