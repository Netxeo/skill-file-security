---
description: Show the current security score and last audit date from memory.
---

Activate the **file-security** skill and report current security status.

**Goal:** A quick read of past audit history. No new scanning.

**Steps:**
1. Look for `memory-security.md` and `security-report.md` in the project root.
2. If neither exists → say "no audit history found, run `/security-scan` or `/security-audit` to get started" and stop.
3. If `security-report.md` exists, extract:
   - Current score (X/100)
   - Date of the audit
   - Count of issues by severity (Critical / High / Medium / Low)
4. If `memory-security.md` exists, also show:
   - Previous score
   - Trend (improved / stayed / regressed)
5. Output a compact status block — score banner, severity summary, last-audit date, trend.

**Strict rules:**
- Read-only. Do not modify any files.
- Do not run a fresh scan — that's `/security-scan` or `/security-audit`.
