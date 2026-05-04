---
description: Launch the incident response playbook when a leak or active vulnerability has been detected.
---

Activate the **file-security** skill and walk through incident response.

**Goal:** Contain a confirmed or suspected security incident. Generate `incident-report.md` documenting the response.

**Trigger conditions** (any one is enough):
- Active secret/key found in code or git history
- Database rules set to `allow all`
- Credentials leaked in environment variables logged
- Public storage bucket with sensitive data
- User explicitly invoked `/security-incident` after seeing something suspicious

**Steps:**
1. Load `instructions/27-incident-response.md`.
2. Identify and contain — what was leaked, where, when, who has access.
3. Walk through the playbook with the user, asking for confirmation at each rotation step (rotate the secret, revoke the key, change the password, redeploy, etc.).
4. **Ask before writing** `incident-report.md` to the project root; once confirmed, write it documenting:
   - Timeline of events
   - What was leaked
   - What was rotated/revoked
   - Outstanding actions
   - Lessons learned
5. Recommend longer-term hardening based on `instructions/01-secrets-management.md`, `instructions/19-monitoring-detection.md`.

**Strict rules:**
- Never log the leaked secret value in chat or in any file.
- Never run destructive git commands (force-push, rewrite history) without explicit user confirmation, even when they're standard incident response steps — describe them first, let the user run them.
- Honor project-file discipline: only `incident-report.md` and updates to existing `memory-security.md`.
