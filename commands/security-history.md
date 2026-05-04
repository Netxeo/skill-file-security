---
description: Generate a before/after comparison table from past audits to show progress.
---

Activate the **file-security** skill and produce a history comparison.

**Goal:** Show the user how their security posture has changed over time using existing audit records.

**Steps:**
1. Read `memory-security.md` and any prior `security-report.md` (or archived versions) the user can point to.
2. If fewer than 2 audits exist, say so and suggest running `/security-audit` again at a later date.
3. If 2+ audits exist, build a table with one row per audit:
   - Date · Total score · Δ from prior · Critical count · High count · Medium count
4. Highlight the categories that improved most and any that regressed.
5. End with a short narrative paragraph — what the trend says and what to focus on next.

**Strict rules:**
- Read-only. Do not modify any audit history.
- If the user wants a fresh audit to extend the history, point them to `/security-audit`.
