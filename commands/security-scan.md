---
description: Quick security scan (~30s) — surface critical issues only, output in chat.
---

Activate the **file-security** skill and run a quick scan of the current project.

**Goal:** ~30 second pass to surface only **Critical** and **High** severity issues. Do not produce a full audit report — that's `/security-audit`.

**Steps:**
1. Auto-detect the stack (see `instructions/00-stack-detection.md`).
2. Load only the most critical instruction files for the detected stack — at minimum:
   - `instructions/01-secrets-management.md`
   - `instructions/04-auth-sessions.md`
   - `instructions/12-injections.md`
   - `instructions/16-supply-chain.md`
   - Plus stack-specific (e.g. `instructions/07-database-security.md` if Firebase/Supabase detected).
3. Scan for the highest-impact issues only — secrets in code, missing rate limits on auth/OTP endpoints, SQL injection, exposed `allow all` DB rules, hardcoded credentials.
4. Output findings inline in chat. **Do not write any files.**

**Strict rules:**
- Honor the project-file discipline in SKILL.md — no creating `CLAUDE.md`, `.cursorrules`, `.skills/`, etc.
- If memory-security.md exists, read it for past findings; do not create it.
- Educate, don't just patch. Explain *why* each finding is risky.

End with a one-line summary: count of Critical / High issues + suggestion to run `/security-audit` if anything was found.
