---
description: Explain why a specific security rule exists, in plain language. Usage: /security-explain [rule-name-or-CWE-id]
---

Activate the **file-security** skill and explain a single security rule.

**Goal:** Educate the user on *why* a specific check or rule matters — not just *what* it is.

**Input:** The user provides a rule name, CWE ID, OWASP category, or topic (e.g. "rate limiting", "CWE-79", "session fixation", "PFS").

**Steps:**
1. Identify the relevant instruction file(s) in `instructions/` based on the topic. The 28 instruction files cover: secrets, network, headers, auth, crypto, JWT, DB, deployment, Docker, protocols, advanced attacks, injections, race conditions, file upload, DNS/email, supply chain, mobile, compliance, monitoring, serverless, source-code, AI/LLM, bot/DDoS, browser APIs, modern security, scoring, incident response, memory.
2. Pull the rule's substance from those files.
3. Explain in this structure:
   - **What it is** (1-2 sentences)
   - **Why it matters** — concrete attack scenario, including a brief story or example of an exploit
   - **How attackers exploit it** (specific technique)
   - **How to fix / prevent** (concrete code or config example, ideally for the user's stack if detectable)
   - **Cross-references** — related CWEs, OWASP entries, ASVS requirements
4. If the rule is in the "AI Blind Spot" category from SKILL.md (rate limiting, subtle session fixation), call that out explicitly.

**Strict rules:**
- Read-only. Do not modify any files.
- Use plain language; avoid security jargon without defining it.
- If the topic isn't covered by any instruction file, say so honestly and offer the closest match.
