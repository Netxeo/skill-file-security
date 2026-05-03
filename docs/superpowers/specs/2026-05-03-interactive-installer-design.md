# Interactive Installer Design
**Date:** 2026-05-03  
**Status:** Approved  
**Feature:** `interactive.js` — DevSecOps-first interactive setup mode for `@netxeo/security-skill`

---

## 1. Problem Statement

The current `npx @netxeo/security-skill` installer is fully automatic: it copies all 29 security instruction files and configures every AI assistant it detects. This is correct for CI/CD pipelines, but it misses an opportunity when a developer runs it interactively. Without context about the project, the tool can't:

- Explain *why* specific security categories matter for this stack
- Skip irrelevant categories (e.g. Docker hardening on a mobile app)
- Let the developer push back, ask questions, or learn as they configure

The goal is a DevSecOps-first interactive mode that turns installation into a brief security interview — the developer understands what they're installing and why.

---

## 2. Decisions

| # | Question | Decision |
|---|---|---|
| Q1 | Interaction model | Combined flow: scan → interview → confirm categories → confirm AI tools → install |
| Q2 | Dependency policy | Add `@inquirer/prompts` as a runtime dependency |
| Q3 | CI/CD compatibility | Option C: auto-detect `!process.stdout.isTTY` + honour `--yes` / `-y` flag |
| Q4 | What the interview controls | A required (security categories) + B optional (AI tool selection at end) |
| Q5 | Architecture | Approach 1: dedicated `interactive.js` module; `install.js` stays as pure engine |

---

## 3. Architecture

### 3.1 File layout

```
install.js          ← install engine (existing; gains optional config param)
interactive.js      ← interview flow, prompt logic, builds InstallConfig (new)
```

Dependency direction is one-way: `interactive.js` imports from `install.js`. `install.js` has no knowledge of prompts.

### 3.2 `install.js` change — optional `config` parameter

```js
// Unchanged signature for CI / no-TTY path:
runInstall(targetDir, sourceDir)

// Interactive path passes config:
runInstall(targetDir, sourceDir, config)
```

`config` shape:
```js
/**
 * @typedef {Object} InstallConfig
 * @property {string[]} [categories]  stems of instruction files to install
 *                                    e.g. ['01-secrets-management', '07-database-security']
 *                                    undefined = install all 29
 * @property {string[]} [aiTools]     AI tool keys to configure
 *                                    e.g. ['cursor', 'antigravity']
 *                                    undefined = configure all detected
 */
```

When `config.categories` is defined, `runInstall` copies only the listed `.md` files from `instructions/` instead of the whole directory. Category stems map 1:1 to filenames (`01-secrets-management` → `01-secrets-management.md`).

All 87 existing tests continue to pass — the third parameter defaults to `{}` and existing calls with two arguments are unaffected.

### 3.3 `interactive.js` exports

```js
buildInstallConfig(targetDir)         // runs interview, returns InstallConfig
promptCategories(suggested)           // checkbox to confirm/modify category list
promptAITools(detected)               // optional checkbox to confirm AI tool list
runInteractive(targetDir, sourceDir)  // orchestrates: interview → confirm → runInstall
```

### 3.4 `main()` routing in `install.js`

```
Has --yes/-y in process.argv  OR  !process.stdout.isTTY ?
  YES → runInstall(targetDir, sourceDir)          ← silent full install (CI-safe)
  NO  → import interactive.js → runInteractive()  ← interactive path
```

---

## 4. Interview Questions + Category Mapping

### 4.1 Always-on core (never prompted, always installed)

`00-stack-detection` `01-secrets-management` `05-cryptography` `08-deployment-security`  
`12-injections` `21-source-code-analysis` `25-modern-security` `26-scoring-system`  
`27-incident-response` `28-memory-system`

These 10 categories are baseline for any project. They appear in the confirmation screen pre-checked with the reason "always required" but their checkbox is **disabled** — the user can read why they're included but cannot deselect them. Categories 26–28 (scoring, incident response, memory system) are always installed silently and not shown in the list at all, to keep the list focused on actionable security instruction files.

### 4.2 Five interview questions

**Q1 — Project type** (single-select)

| Answer | Activates |
|---|---|
| Web application / API | 02, 03, 04, 06, 15 |
| Static website / docs | 03, 15 |
| CLI tool / library | *(baseline only)* |
| Mobile app | 02, 17 |

**Q2 — Infrastructure** (multi-select)

| Answer | Activates |
|---|---|
| Standard hosting / cloud VM | 08 *(already core)* |
| Docker / containers | 09 |
| Serverless / edge (Lambda, Vercel, CF Workers) | 20 |
| Kubernetes | 09 |

**Q3 — Features** (multi-select)

| Answer | Activates |
|---|---|
| User authentication / login | 04, 06 |
| Database (SQL or NoSQL) | 07, 13 |
| File uploads | 14 |
| Payment processing | 06, 07, 13 |
| External API calls | 02, 11 |
| GraphQL / WebSockets / real-time | 10 |
| AI / LLM integration | 22 |
| Browser APIs (localStorage, SW, WebCrypto) | 24 |

**Q4 — Compliance** (multi-select)

| Answer | Activates |
|---|---|
| EU users / GDPR | 18 |
| Healthcare data (HIPAA) | 18 |
| Payment data (PCI-DSS) | 18, 06, 07 |
| None | *(nothing extra)* |

**Q5 — Additional hardening** (multi-select)

| Answer | Activates |
|---|---|
| Supply chain / dependency security | 16 |
| Bot / DDoS protection | 23 |
| Monitoring & honeytokens | 19 |
| Advanced attacks (SSRF, XXE, deserialization) | 11 |
| DNS & email security (SPF/DKIM/DMARC) | 15 |

### 4.3 Deduplication

Answers may activate the same category from multiple questions (e.g. `06-jwt-security` from both Q1 web-app and Q3 auth). The `buildInstallConfig` function deduplicates with a `Set` before returning.

---

## 5. UX Flow

```
╔══════════════════════════════════════════════╗
║   🔐  SECURITY SKILL — Interactive Setup     ║
╚══════════════════════════════════════════════╝

🔍 Scanning project...
   Language    : TypeScript / Node.js
   Framework   : Next.js 14 (App Router)
   Database    : Supabase detected
   Deployment  : vercel.json detected
   AI tools    : cursor, antigravity

Let's tailor security coverage to your project. (~60 seconds)

────────────────────────────────────────────────

? What type of project is this?
  ❯ Web application / API

? What infrastructure does it run on?
  ◉ Standard hosting / cloud
  ◉ Serverless / edge (Vercel, Lambda, CF Workers)
  ○ Docker containers
  ○ Kubernetes

? What features does it include?
  ◉ User authentication / login
  ◉ Database (SQL or NoSQL)
  ○ File uploads
  ◉ External API calls
  ○ Payments
  ○ GraphQL / WebSockets
  ○ AI / LLM integration
  ○ Browser APIs

? Any compliance or data requirements?
  ◉ EU users / GDPR
  ○ Healthcare (HIPAA)
  ○ Payment data (PCI-DSS)
  ○ None

? Additional security hardening?
  ◉ Supply chain / dependency security
  ○ Bot / DDoS protection
  ○ Monitoring & honeytokens
  ○ Advanced attacks (SSRF, XXE)
  ○ DNS & email security

────────────────────────────────────────────────

📋 Recommended: 22 of 29 security categories
   Space to toggle · Enter to confirm

  ◉ 01-secrets-management     always required
  ◉ 02-network-protection     web application
  ◉ 03-security-headers       web application
  ◉ 04-auth-sessions          user authentication
  ◉ 05-cryptography           always required
  ◉ 06-jwt-security           user authentication
  ◉ 07-database-security      Supabase detected
  ◉ 08-deployment-security    always required
  ○ 09-docker-security        Docker not detected
  ○ 10-protocols              no GraphQL/WS selected
  ◉ 11-advanced-attacks       external API calls
  ◉ 12-injections             always required
  ◉ 13-race-conditions        database present
  ○ 14-file-upload            not selected
  ◉ 15-dns-email              web application
  ◉ 16-supply-chain           selected in Q5
  ○ 17-mobile-security        web project
  ◉ 18-compliance-gdpr        GDPR selected
  ○ 19-monitoring-detection   not selected
  ◉ 20-serverless-edge        Vercel detected
  ◉ 21-source-code-analysis   always required
  ○ 22-ai-llm-security        not selected
  ○ 23-bot-ddos               not selected
  ○ 24-browser-apis           not selected
  ◉ 25-modern-security        always required
  [26–28 always-on, not shown in list]

────────────────────────────────────────────────

? Configure AI tools? (detected: cursor, antigravity)
  ◉ cursor
  ◉ antigravity (Claude)
  ○ windsurf  ○ cline  ○ copilot  ○ codex  ○ gemini  ○ continue  ○ aider

────────────────────────────────────────────────

📦 Installing...

  ✅ 22 security categories → .skills/security/instructions/
  ✅ templates + checklists → .skills/security/
  ✅ memory-security.md created
  ✅ .gitignore hardened (6 entries)
  ✅ CLAUDE.md created
  ✅ .cursorrules created

⚡ Run /security-scan in your AI to get started!
```

---

## 6. CI/CD and Error Handling

| Condition | Behaviour |
|---|---|
| `--yes` or `-y` in `process.argv` | Skip all prompts → full silent install (all 29 categories, all detected AI tools) |
| `!process.stdout.isTTY` (pipe, CI runner, Docker build) | Same as `--yes` — full silent install |
| User presses Ctrl+C mid-interview | Catch `ExitPromptError` from `@inquirer/prompts` → print "Installation cancelled." → `process.exit(0)` |
| Zero categories confirmed | Print "No categories selected — nothing to install." → `process.exit(0)` |
| Install fails after prompts | Existing `main()` try/catch → error message + `process.exit(1)` |
| `@inquirer/prompts` import fails (rare edge case) | Catch at top of `runInteractive`, fall back to full silent install with warning |

---

## 7. Testing Strategy

### 7.1 `install.js` — existing 87 tests unchanged

`runInstall` with a `config` parameter gets new test cases:
- `config.categories` provided → only listed files are copied
- `config.aiTools` provided → only listed tools are configured
- `config = {}` → installs everything (regression guard)

### 7.2 `interactive.js` — new test file `tests/interactive.test.js`

`@inquirer/prompts` is mocked at module level using `vi.mock`. Tests are organised by exported function:

| Function | Key test cases |
|---|---|
| `buildInstallConfig` | all five Q combinations; always-on categories present in every result; deduplication of overlapping answers; empty optional selections return only core baseline |
| `promptCategories` | pre-selection matches suggested set; toggle adds/removes; confirm returns final array |
| `promptAITools` | detected tools pre-checked; deselect works; empty selection returns `[]` |
| `runInteractive` | full happy-path: mocked answers → verify `runInstall` called with correct config; Ctrl+C exits 0 without calling `runInstall`; zero-category path exits 0 |
| TTY / `--yes` routing | `!isTTY` → `runInstall` called with no config; `--yes` flag → same |

Coverage target: **80%+ on `interactive.js`**. As part of this feature, `vitest.config.js` must be updated to change `coverage.include` from `['install.js']` to `['install.js', 'interactive.js']` so the threshold gate applies to both files independently. The existing 80% thresholds and `autoUpdate: false` are unchanged.

---

## 8. New Runtime Dependency

```json
"dependencies": {
  "@inquirer/prompts": "^7.0.0"
}
```

`@inquirer/prompts` v7 is ESM-native, actively maintained, and the official successor to `inquirer`. It provides `select`, `checkbox`, and `confirm` — the only three prompt types needed. No transitive dependencies that introduce security surface beyond what npm audit already covers.

The `files` array in `package.json` stays unchanged — `interactive.js` is included implicitly as it lives in the package root.

---

## 9. Out of Scope

- Saving the interview answers to a config file for re-runs (future: could be stored in `memory-security.md`)
- A `--categories` CLI flag for non-interactive partial installs (future)
- Internationalisation of interview questions (future)
- A TUI dashboard replacing the current text output (future)
