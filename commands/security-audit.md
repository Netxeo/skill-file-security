---
description: Full security audit — score out of 100 across 25 categories, save detailed report to security-report.md.
---

Activate the **file-security** skill and run a full audit of the current project.

**Goal:** Comprehensive review across all 25 weighted categories, produce a complete `security-report.md` at the project root.

**Steps:**
1. Auto-detect the stack (`instructions/00-stack-detection.md`).
2. Load every instruction file relevant to the detected stack(s) — see the full table in SKILL.md.
3. Audit each of the 25 categories with the weights and severity penalties from SKILL.md.
4. Compute the score out of 100.
5. **Ask before writing the report file.** Confirm with the user that you should write `security-report.md` to the project root before doing so. Once confirmed, write it in the format defined in SKILL.md (Critical → High → Medium → Low → What's Secure → Next Steps).
6. If the prior memory file `memory-security.md` exists, append the new audit's score + date there; do not overwrite past entries. If it does not exist, ask before creating it.

**Output to chat:** the score banner, top 3 critical findings, and a pointer to the report file.

**Strict rules:**
- Honor project-file discipline. The only files you may write are `security-report.md` and (with permission) `memory-security.md`.
- Do not create `.skills/`, `CLAUDE.md`, `.cursorrules`, etc.
- Be highly selective on Low/Info findings — signal over noise.

If a critical incident-class finding is detected (active secret in code, public bucket, allow-all DB rules), recommend running `/security-incident` rather than handling it in the audit flow.
