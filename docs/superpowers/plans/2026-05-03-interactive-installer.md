# Interactive Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DevSecOps-first interactive setup mode to `@netxeo/security-skill` that interviews the developer about their project and installs only the relevant security categories.

**Architecture:** A new `interactive.js` module handles the interview flow and calls `runInstall(targetDir, sourceDir, config)` with a curated `InstallConfig`. `install.js` stays as the pure engine. `main()` routes to interactive mode when a real TTY is detected and `--yes` is absent; CI/CD always hits the silent full-install path.

**Tech Stack:** Node.js ESM, `@inquirer/prompts` (checkbox, select), Vitest + `vi.mock` for prompt testing.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `install.js` | Modify | Add `config` param to `runInstall`; add `shouldUseInteractive()`; make `main()` async |
| `interactive.js` | Create | Stack scan, 5-question interview, category mapping, prompt confirmations, orchestration |
| `tests/install.test.js` | Modify | Add `await` to `main()` tests; add `runInstall(config)` tests; add routing tests |
| `tests/interactive.test.js` | Create | Full test coverage of `interactive.js` with mocked `@inquirer/prompts` |
| `package.json` | Modify | Add `@inquirer/prompts` to `dependencies` |
| `vitest.config.js` | Modify | Expand `coverage.include` to both source files |

---

## Task 1: Install dependency + expand coverage gate

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.js`

- [ ] **Step 1: Add `@inquirer/prompts` to `package.json` dependencies**

Edit `package.json` — change the `dependencies` block:
```json
"dependencies": {
  "@inquirer/prompts": "^6.0.0"
},
```

- [ ] **Step 2: Expand coverage include in `vitest.config.js`**

Edit `vitest.config.js` — change `coverage.include`:
```js
include: ['install.js', 'interactive.js'],
```

- [ ] **Step 3: Install the new dependency**

```bash
npm install
```

Expected: `added N packages` with `@inquirer/prompts` listed.

- [ ] **Step 4: Verify existing tests still pass**

```bash
npm test
```

Expected: `87 passed`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js
git commit -m "chore: add @inquirer/prompts dep and expand coverage gate to interactive.js"
```

---

## Task 2: Update `runInstall` for selective category + AI tool installation

**Files:**
- Modify: `install.js` lines around `copyDir(instructions)` and the AI config block
- Modify: `tests/install.test.js`

- [ ] **Step 1: Write failing tests for `runInstall` with `config.categories`**

Add to `tests/install.test.js` inside `describe('runInstall', ...)`:

```js
it('installs only specified categories when config.categories is provided', () => {
  runInstall(testDir, PACKAGE_ROOT, { categories: ['01-secrets-management', '05-cryptography'] })
  expect(existsSync(join(testDir, '.skills', 'security', 'instructions', '01-secrets-management.md'))).toBe(true)
  expect(existsSync(join(testDir, '.skills', 'security', 'instructions', '05-cryptography.md'))).toBe(true)
  expect(existsSync(join(testDir, '.skills', 'security', 'instructions', '07-database-security.md'))).toBe(false)
})

it('installs all categories when config.categories is undefined', () => {
  runInstall(testDir, PACKAGE_ROOT, {})
  expect(existsSync(join(testDir, '.skills', 'security', 'instructions', '07-database-security.md'))).toBe(true)
})

it('skips non-selected AI tools when config.aiTools is provided', () => {
  runInstall(testDir, PACKAGE_ROOT, { aiTools: ['antigravity'] })
  expect(existsSync(join(testDir, 'CLAUDE.md'))).toBe(true)
  expect(existsSync(join(testDir, '.cursorrules'))).toBe(false)
  expect(existsSync(join(testDir, '.windsurfrules'))).toBe(false)
})

it('configures all AI tools when config.aiTools is undefined', () => {
  runInstall(testDir, PACKAGE_ROOT, {})
  expect(existsSync(join(testDir, 'CLAUDE.md'))).toBe(true)
  expect(existsSync(join(testDir, '.cursorrules'))).toBe(true)
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|✗|×"
```

Expected: 4 new tests fail.

- [ ] **Step 3: Update `runInstall` in `install.js` — add `config` param and selective category copy**

Change the function signature and the `copyDir(instructions)` block:

```js
export function runInstall(targetDir = process.cwd(), sourceDir = __dirname, config = {}) {
  const SKILL_DIR = join(targetDir, '.skills', 'security')

  mkdirSync(SKILL_DIR, { recursive: true })

  // Selective or full category copy
  if (config.categories) {
    mkdirSync(join(SKILL_DIR, 'instructions'), { recursive: true })
    for (const stem of config.categories) {
      copyFileSync(
        join(sourceDir, 'instructions', `${stem}.md`),
        join(SKILL_DIR, 'instructions', `${stem}.md`)
      )
    }
  } else {
    copyDir(join(sourceDir, 'instructions'), join(SKILL_DIR, 'instructions'))
  }

  copyDir(join(sourceDir, 'templates'), join(SKILL_DIR, 'templates'))
  copyDir(join(sourceDir, 'checklists'), join(SKILL_DIR, 'checklists'))
  copyFileSync(join(sourceDir, 'skill.md'), join(SKILL_DIR, 'skill.md'))
  console.log(c('green', '  ✅ Skill files installed → .skills/security/'))
```

- [ ] **Step 4: Add `shouldConfigureAI` helper and wrap all AI config calls**

Add the helper just before `runInstall`:

```js
function shouldConfigureAI(tool, config) {
  return !config.aiTools || config.aiTools.includes(tool)
}
```

Then wrap every `writeAIConfig` call in the AI config block of `runInstall`:

```js
  if (shouldConfigureAI('antigravity', config))
    writeAIConfig(targetDir, 'CLAUDE.md', skillRef, 'CLAUDE.md (Claude / Antigravity)')

  if (shouldConfigureAI('codex', config))
    writeAIConfig(targetDir, 'AGENTS.md', skillRef, 'AGENTS.md (OpenAI Codex CLI)')

  if (shouldConfigureAI('gemini', config))
    writeAIConfig(targetDir, 'GEMINI.md', skillRef, 'GEMINI.md (Gemini Code Assist)')

  if (shouldConfigureAI('cursor', config)) {
    writeAIConfig(targetDir, '.cursorrules', skillRef, '.cursorrules (Cursor legacy)')
    mkdirSync(join(targetDir, '.cursor', 'rules'), { recursive: true })
    const mdcContent = `---\ndescription: Security Skill — enterprise security engineering\nglobs: ["**/*"]\nalwaysApply: true\n---\n\n${skillRef}`
    writeAIConfig(targetDir, '.cursor/rules/security.mdc', mdcContent, '.cursor/rules/security.mdc (Cursor MDC)')
  }

  if (shouldConfigureAI('windsurf', config))
    writeAIConfig(targetDir, '.windsurfrules', skillRef, '.windsurfrules (Windsurf)')

  if (shouldConfigureAI('cline', config))
    writeAIConfig(targetDir, '.clinerules', skillRef, '.clinerules (Cline)')

  if (shouldConfigureAI('copilot', config)) {
    mkdirSync(join(targetDir, '.github', 'instructions'), { recursive: true })
    writeAIConfig(targetDir, '.github/copilot-instructions.md', skillRef, '.github/copilot-instructions.md (GitHub Copilot)')
    const copilotPathInstruction = `---\napplyTo: "**"\n---\n\n${skillRef}`
    writeAIConfig(targetDir, '.github/instructions/security.instructions.md', copilotPathInstruction, '.github/instructions/security.instructions.md (Copilot path-specific)')
  }

  const configureAider = config.aiTools
    ? config.aiTools.includes('aider')
    : (detectedAIs.includes('aider') || existsSync(join(targetDir, '.aider.conf.yml')))
  if (configureAider)
    writeAIConfig(targetDir, '.aider.conf.yml', `# security-skill\nread:\n  - .skills/security/skill.md\n  - memory-security.md\n`, '.aider.conf.yml (Aider)')

  if (shouldConfigureAI('continue', config)) {
    mkdirSync(join(targetDir, '.continue'), { recursive: true })
    const continueContent = `# security-skill\nrules:\n  - name: "Security Skill"\n    rule: |\n      ${skillRef.replace(/\n/g, '\n      ')}\n`
    writeAIConfig(targetDir, '.continue/config.yaml', continueContent, '.continue/config.yaml (Continue.dev)')
  }
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test
```

Expected: `91 passed` (87 existing + 4 new).

- [ ] **Step 6: Commit**

```bash
git add install.js tests/install.test.js
git commit -m "feat: runInstall accepts optional config for selective category + AI tool installation"
```

---

## Task 3: Add `shouldUseInteractive` + async `main()` routing

**Files:**
- Modify: `install.js`
- Modify: `tests/install.test.js`

- [ ] **Step 1: Write failing tests for routing logic and async `main()`**

Add to `tests/install.test.js`:

```js
import { shouldUseInteractive, main } from '../install.js'

describe('shouldUseInteractive()', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns false when --yes is in argv', () => {
    vi.stubGlobal('process', { ...process, argv: ['node', 'install.js', '--yes'], stdout: { isTTY: true } })
    expect(shouldUseInteractive()).toBe(false)
  })

  it('returns false when -y is in argv', () => {
    vi.stubGlobal('process', { ...process, argv: ['node', 'install.js', '-y'], stdout: { isTTY: true } })
    expect(shouldUseInteractive()).toBe(false)
  })

  it('returns false when stdout is not a TTY', () => {
    vi.stubGlobal('process', { ...process, argv: ['node', 'install.js'], stdout: { isTTY: false } })
    expect(shouldUseInteractive()).toBe(false)
  })

  it('returns false when stdout.isTTY is undefined', () => {
    vi.stubGlobal('process', { ...process, argv: ['node', 'install.js'], stdout: {} })
    expect(shouldUseInteractive()).toBe(false)
  })

  it('returns true when TTY and no --yes flag', () => {
    vi.stubGlobal('process', { ...process, argv: ['node', 'install.js'], stdout: { isTTY: true } })
    expect(shouldUseInteractive()).toBe(true)
  })
})

describe('main() async', () => {
  it('runs non-interactively and creates install output', async () => {
    await main(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.skills', 'security'))).toBe(true)
  })

  it('prints Installation complete on success', async () => {
    await main(testDir, PACKAGE_ROOT)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Installation complete'))
  })

  it('calls process.exit(1) and logs error on failure', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {})
    await main(testDir, '/nonexistent-bad-source-12345')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Installation failed'), expect.any(String))
    expect(mockExit).toHaveBeenCalledWith(1)
  })
})
```

Also update **all existing** `main()` tests that were synchronous — add `async` and `await`:

```js
// Change every:  it('...', () => { main(...)  ... })
// To:            it('...', async () => { await main(...)  ... })
```

- [ ] **Step 2: Run tests — confirm new tests fail, existing `main()` tests fail due to missing `await`**

```bash
npm test 2>&1 | tail -20
```

Expected: failures on the new routing tests and possibly on main() tests due to async mismatch.

- [ ] **Step 3: Export `shouldUseInteractive` and make `main()` async in `install.js`**

Add after the `isMain` constant:

```js
export function shouldUseInteractive() {
  return Boolean(process.stdout.isTTY) &&
    !process.argv.includes('--yes') &&
    !process.argv.includes('-y')
}
```

Change `main()` declaration:

```js
export async function main(targetDir = process.cwd(), sourceDir = __dirname) {
  if (shouldUseInteractive()) {
    const { runInteractive } = await import('./interactive.js')
    await runInteractive(targetDir, sourceDir)
    return
  }

  // Non-interactive path (existing banner + install + success messages)
  console.log('')
  console.log(c('bold', c('cyan', '╔══════════════════════════════════════════════╗')))
  console.log(c('bold', c('cyan', '║        🔐  SECURITY SKILL  v1.0.0            ║')))
  console.log(c('bold', c('cyan', '║   100% Code Security for Any Project          ║')))
  console.log(c('bold', c('cyan', '╚══════════════════════════════════════════════╝')))
  console.log('')
  console.log(c('dim', '  Covers: CWE Top 25 · OWASP Top 10 · ASVS L1-3'))
  console.log(c('dim', '  Works with: Claude · Cursor · Copilot · Windsurf · Cline · Codex · Aider · Gemini'))
  console.log('')
  console.log('📦 Installing security-skill...')
  console.log('')

  try {
    runInstall(targetDir, sourceDir)

    console.log('')
    console.log(c('bold', c('green', '  ✅ Installation complete!')))
    console.log('')
    console.log(c('cyan', '  ──────────────────────────────────────────'))
    console.log(c('bold', '  Available commands:'))
    console.log(c('dim', '  /security-scan    → Quick security scan'))
    console.log(c('dim', '  /security-audit   → Full audit + score /100'))
    console.log(c('dim', '  /security-fix     → Apply fixes'))
    console.log(c('dim', '  /security-status  → View current score'))
    console.log(c('cyan', '  ──────────────────────────────────────────'))
    console.log('')
    console.log(c('dim', '  Compatible with:'))
    console.log(c('dim', '  Claude · Cursor · Copilot · Windsurf · Cline · Codex CLI · Aider · Continue · Gemini'))
    console.log('')
    console.log(c('bold', c('yellow', '  ⚡ Run /security-scan in your AI to get started!')))
    console.log('')
  } catch (error) {
    console.error(c('red', '  ❌ Installation failed:'), error.message)
    process.exit(1)
  }
}
```

Update `isMain` entry point to await:

```js
if (isMain) {
  main().catch(err => {
    console.error(c('red', '  ❌ Installation failed:'), err.message)
    process.exit(1)
  })
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: All tests pass. If `main()` tests fail due to `async`, verify all `main()` tests in `tests/install.test.js` have been updated to use `async/await`.

- [ ] **Step 5: Commit**

```bash
git add install.js tests/install.test.js
git commit -m "feat: shouldUseInteractive() routing + async main() for interactive mode delegation"
```

---

## Task 4: Create `interactive.js` — constants, stack scan, interview mapping

**Files:**
- Create: `interactive.js`
- Create: `tests/interactive.test.js`

- [ ] **Step 1: Write failing tests for `scanStack` and `mapAnswersToCategories`**

Create `tests/interactive.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, mkdtempSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let testDir

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'security-skill-interactive-'))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

// ── scanStack ──────────────────────────────────────────────────────────────

describe('scanStack', () => {
  it('returns unknown language for empty directory', async () => {
    const { scanStack } = await import('../interactive.js')
    const info = scanStack(testDir)
    expect(info.language).toBe('Unknown')
    expect(info.framework).toBeNull()
    expect(info.database).toBeNull()
    expect(info.deployment).toBeNull()
    expect(info.aiTools).toEqual([])
  })

  it('detects TypeScript from tsconfig.json', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'tsconfig.json'), '{}')
    const info = scanStack(testDir)
    expect(info.language).toContain('TypeScript')
  })

  it('detects Next.js from package.json dependencies', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({
      dependencies: { next: '^14.0.0' }
    }))
    const info = scanStack(testDir)
    expect(info.framework).toContain('Next.js')
  })

  it('detects Supabase from supabase/ directory', async () => {
    const { scanStack } = await import('../interactive.js')
    mkdirSync(join(testDir, 'supabase'))
    const info = scanStack(testDir)
    expect(info.database).toBe('Supabase')
  })

  it('detects Vercel from vercel.json', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'vercel.json'), '{}')
    const info = scanStack(testDir)
    expect(info.deployment).toBe('Vercel')
  })

  it('detects Docker from Dockerfile', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'Dockerfile'), 'FROM node:20')
    const info = scanStack(testDir)
    expect(info.deployment).toBe('Docker')
  })
})

// ── mapAnswersToCategories ─────────────────────────────────────────────────

describe('mapAnswersToCategories', () => {
  it('always includes all 10 core baseline categories', async () => {
    const { mapAnswersToCategories } = await import('../interactive.js')
    const ALWAYS_ON = [
      '00-stack-detection', '01-secrets-management', '05-cryptography',
      '08-deployment-security', '12-injections', '21-source-code-analysis',
      '25-modern-security', '26-scoring-system', '27-incident-response', '28-memory-system'
    ]
    const result = mapAnswersToCategories({ projectType: 'cli', infrastructure: [], features: [], compliance: [], hardening: [] })
    for (const cat of ALWAYS_ON) {
      expect(result).toContain(cat)
    }
  })

  it('adds web categories for web project type', async () => {
    const { mapAnswersToCategories } = await import('../interactive.js')
    const result = mapAnswersToCategories({ projectType: 'web', infrastructure: [], features: [], compliance: [], hardening: [] })
    expect(result).toContain('02-network-protection')
    expect(result).toContain('03-security-headers')
    expect(result).toContain('04-auth-sessions')
  })

  it('adds docker category when docker infrastructure selected', async () => {
    const { mapAnswersToCategories } = await import('../interactive.js')
    const result = mapAnswersToCategories({ projectType: 'cli', infrastructure: ['docker'], features: [], compliance: [], hardening: [] })
    expect(result).toContain('09-docker-security')
  })

  it('adds serverless category when serverless selected', async () => {
    const { mapAnswersToCategories } = await import('../interactive.js')
    const result = mapAnswersToCategories({ projectType: 'web', infrastructure: ['serverless'], features: [], compliance: [], hardening: [] })
    expect(result).toContain('20-serverless-edge')
  })

  it('adds database categories when database feature selected', async () => {
    const { mapAnswersToCategories } = await import('../interactive.js')
    const result = mapAnswersToCategories({ projectType: 'web', infrastructure: [], features: ['database'], compliance: [], hardening: [] })
    expect(result).toContain('07-database-security')
    expect(result).toContain('13-race-conditions')
  })

  it('adds AI/LLM category when ai feature selected', async () => {
    const { mapAnswersToCategories } = await import('../interactive.js')
    const result = mapAnswersToCategories({ projectType: 'web', infrastructure: [], features: ['ai'], compliance: [], hardening: [] })
    expect(result).toContain('22-ai-llm-security')
  })

  it('adds GDPR category when gdpr compliance selected', async () => {
    const { mapAnswersToCategories } = await import('../interactive.js')
    const result = mapAnswersToCategories({ projectType: 'web', infrastructure: [], features: [], compliance: ['gdpr'], hardening: [] })
    expect(result).toContain('18-compliance-gdpr')
  })

  it('deduplicates overlapping category activations', async () => {
    const { mapAnswersToCategories } = await import('../interactive.js')
    // auth in Q1 (web) AND auth in Q3 both activate 04-auth-sessions
    const result = mapAnswersToCategories({ projectType: 'web', infrastructure: [], features: ['auth'], compliance: [], hardening: [] })
    expect(result.filter(c => c === '04-auth-sessions')).toHaveLength(1)
  })

  it('returns sorted array', async () => {
    const { mapAnswersToCategories } = await import('../interactive.js')
    const result = mapAnswersToCategories({ projectType: 'web', infrastructure: ['docker', 'serverless'], features: ['database', 'auth', 'ai'], compliance: ['gdpr'], hardening: ['supplyChain'] })
    expect(result).toEqual([...result].sort())
  })

  it('mobile project type activates mobile-security', async () => {
    const { mapAnswersToCategories } = await import('../interactive.js')
    const result = mapAnswersToCategories({ projectType: 'mobile', infrastructure: [], features: [], compliance: [], hardening: [] })
    expect(result).toContain('17-mobile-security')
  })
})
```

- [ ] **Step 2: Run tests — confirm they all fail with "Cannot find module"**

```bash
npm test -- tests/interactive.test.js 2>&1 | tail -5
```

Expected: `Cannot find module '../interactive.js'`

- [ ] **Step 3: Create `interactive.js` with constants + `scanStack` + `mapAnswersToCategories`**

Create `interactive.js`:

```js
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { detectAI } from './install.js'

// ── Constants ────────────────────────────────────────────────────────────────

export const ALWAYS_ON = [
  '00-stack-detection',
  '01-secrets-management',
  '05-cryptography',
  '08-deployment-security',
  '12-injections',
  '21-source-code-analysis',
  '25-modern-security',
]

export const ALWAYS_SILENT = [
  '26-scoring-system',
  '27-incident-response',
  '28-memory-system',
]

export const ALL_CATEGORIES = [
  '00-stack-detection', '01-secrets-management', '02-network-protection',
  '03-security-headers', '04-auth-sessions', '05-cryptography',
  '06-jwt-security', '07-database-security', '08-deployment-security',
  '09-docker-security', '10-protocols', '11-advanced-attacks',
  '12-injections', '13-race-conditions', '14-file-upload',
  '15-dns-email', '16-supply-chain', '17-mobile-security',
  '18-compliance-gdpr', '19-monitoring-detection', '20-serverless-edge',
  '21-source-code-analysis', '22-ai-llm-security', '23-bot-ddos',
  '24-browser-apis', '25-modern-security',
]

export const CATEGORY_REASONS = {
  '00-stack-detection':      'stack-aware security checks',
  '01-secrets-management':   'always required',
  '02-network-protection':   'web application',
  '03-security-headers':     'web application',
  '04-auth-sessions':        'user authentication',
  '05-cryptography':         'always required',
  '06-jwt-security':         'user authentication / payments',
  '07-database-security':    'database detected',
  '08-deployment-security':  'always required',
  '09-docker-security':      'Docker selected',
  '10-protocols':            'GraphQL / WebSockets selected',
  '11-advanced-attacks':     'external API calls',
  '12-injections':           'always required',
  '13-race-conditions':      'database / payments present',
  '14-file-upload':          'file upload selected',
  '15-dns-email':            'web application',
  '16-supply-chain':         'selected in hardening',
  '17-mobile-security':      'mobile project',
  '18-compliance-gdpr':      'compliance selected',
  '19-monitoring-detection': 'selected in hardening',
  '20-serverless-edge':      'serverless / edge selected',
  '21-source-code-analysis': 'always required',
  '22-ai-llm-security':      'AI / LLM selected',
  '23-bot-ddos':             'selected in hardening',
  '24-browser-apis':         'browser APIs selected',
  '25-modern-security':      'always required',
}

export const ALL_AI_TOOLS = [
  'antigravity', 'cursor', 'copilot', 'windsurf',
  'cline', 'codex', 'gemini', 'continue', 'aider',
]

export const TOOL_LABELS = {
  antigravity: 'antigravity / Claude (CLAUDE.md)',
  cursor:      'Cursor (.cursorrules + .cursor/rules/)',
  copilot:     'GitHub Copilot (.github/copilot-instructions.md)',
  windsurf:    'Windsurf (.windsurfrules)',
  cline:       'Cline (.clinerules)',
  codex:       'OpenAI Codex CLI (AGENTS.md)',
  gemini:      'Gemini Code Assist (GEMINI.md)',
  continue:    'Continue.dev (.continue/config.yaml)',
  aider:       'Aider (.aider.conf.yml)',
}

const QUESTION_MAPPINGS = {
  projectType: {
    web:    ['02-network-protection', '03-security-headers', '04-auth-sessions', '06-jwt-security', '15-dns-email'],
    static: ['03-security-headers', '15-dns-email'],
    cli:    [],
    mobile: ['02-network-protection', '17-mobile-security'],
  },
  infrastructure: {
    docker:     ['09-docker-security'],
    serverless: ['20-serverless-edge'],
    kubernetes: ['09-docker-security'],
  },
  features: {
    auth:        ['04-auth-sessions', '06-jwt-security'],
    database:    ['07-database-security', '13-race-conditions'],
    fileUpload:  ['14-file-upload'],
    payments:    ['06-jwt-security', '07-database-security', '13-race-conditions'],
    externalApis:['02-network-protection', '11-advanced-attacks'],
    graphql:     ['10-protocols'],
    ai:          ['22-ai-llm-security'],
    browserApis: ['24-browser-apis'],
  },
  compliance: {
    gdpr:  ['18-compliance-gdpr'],
    hipaa: ['18-compliance-gdpr'],
    pci:   ['18-compliance-gdpr', '06-jwt-security', '07-database-security'],
  },
  hardening: {
    supplyChain:    ['16-supply-chain'],
    botDdos:        ['23-bot-ddos'],
    monitoring:     ['19-monitoring-detection'],
    advancedAttacks:['11-advanced-attacks'],
    dnsEmail:       ['15-dns-email'],
  },
}

// ── scanStack ────────────────────────────────────────────────────────────────

export function scanStack(targetDir) {
  const info = { language: 'Unknown', framework: null, database: null, deployment: null, aiTools: [] }

  const pkgPath = join(targetDir, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      info.language = deps.typescript || deps['ts-node'] || existsSync(join(targetDir, 'tsconfig.json'))
        ? 'TypeScript / Node.js'
        : 'JavaScript / Node.js'
      if (deps.next)        info.framework = `Next.js ${(deps.next || '').replace(/[\^~>=<]/, '')}`
      else if (deps.nuxt)   info.framework = 'Nuxt.js'
      else if (deps['@sveltejs/kit']) info.framework = 'SvelteKit'
      else if (deps.astro)  info.framework = 'Astro'
      else if (deps.express) info.framework = 'Express'
      else if (deps.fastify) info.framework = 'Fastify'
      if (deps['@supabase/supabase-js'] || existsSync(join(targetDir, 'supabase')))
        info.database = 'Supabase'
      else if (existsSync(join(targetDir, 'prisma'))) info.database = 'Prisma ORM'
      else if (deps.mongoose) info.database = 'MongoDB (Mongoose)'
    } catch { /* malformed package.json — skip */ }
  }

  if (existsSync(join(targetDir, 'vercel.json')))   info.deployment = 'Vercel'
  else if (existsSync(join(targetDir, 'netlify.toml'))) info.deployment = 'Netlify'
  else if (existsSync(join(targetDir, 'Dockerfile'))) info.deployment = 'Docker'
  else if (existsSync(join(targetDir, 'wrangler.toml'))) info.deployment = 'Cloudflare Workers'

  info.aiTools = detectAI(targetDir)
  return info
}

// ── mapAnswersToCategories ───────────────────────────────────────────────────

export function mapAnswersToCategories(answers) {
  const cats = new Set([...ALWAYS_ON, ...ALWAYS_SILENT])

  const add = (list) => list?.forEach(c => cats.add(c))

  add(QUESTION_MAPPINGS.projectType[answers.projectType])
  for (const key of answers.infrastructure ?? []) add(QUESTION_MAPPINGS.infrastructure[key])
  for (const key of answers.features       ?? []) add(QUESTION_MAPPINGS.features[key])
  for (const key of answers.compliance     ?? []) add(QUESTION_MAPPINGS.compliance[key])
  for (const key of answers.hardening      ?? []) add(QUESTION_MAPPINGS.hardening[key])

  return [...cats].sort()
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/interactive.test.js
```

Expected: All `scanStack` and `mapAnswersToCategories` tests pass.

- [ ] **Step 5: Commit**

```bash
git add interactive.js tests/interactive.test.js
git commit -m "feat: interactive.js — scanStack + mapAnswersToCategories with full category mapping"
```

---

## Task 5: Add `promptCategories` + `promptAITools` to `interactive.js`

**Files:**
- Modify: `interactive.js`
- Modify: `tests/interactive.test.js`

- [ ] **Step 1: Write failing tests for `promptCategories` and `promptAITools`**

Add to `tests/interactive.test.js` (after the existing describe blocks):

```js
// ── promptCategories ───────────────────────────────────────────────────────

vi.mock('@inquirer/prompts', () => ({
  select:   vi.fn(),
  checkbox: vi.fn(),
}))

describe('promptCategories', () => {
  it('always includes ALWAYS_ON and ALWAYS_SILENT in returned list regardless of user selection', async () => {
    const { checkbox } = await import('@inquirer/prompts')
    const { promptCategories, ALWAYS_ON, ALWAYS_SILENT } = await import('../interactive.js')
    vi.mocked(checkbox).mockResolvedValue(['02-network-protection'])
    const result = await promptCategories(['01-secrets-management', '02-network-protection'])
    for (const cat of [...ALWAYS_ON, ...ALWAYS_SILENT]) {
      expect(result).toContain(cat)
    }
  })

  it('includes user-selected optional categories', async () => {
    const { checkbox } = await import('@inquirer/prompts')
    const { promptCategories } = await import('../interactive.js')
    vi.mocked(checkbox).mockResolvedValue(['09-docker-security', '22-ai-llm-security'])
    const result = await promptCategories(['09-docker-security'])
    expect(result).toContain('09-docker-security')
    expect(result).toContain('22-ai-llm-security')
  })

  it('returns sorted array', async () => {
    const { checkbox } = await import('@inquirer/prompts')
    const { promptCategories } = await import('../interactive.js')
    vi.mocked(checkbox).mockResolvedValue(['09-docker-security'])
    const result = await promptCategories(['09-docker-security'])
    expect(result).toEqual([...result].sort())
  })

  it('calls checkbox with always-on items marked disabled', async () => {
    const { checkbox } = await import('@inquirer/prompts')
    const { promptCategories, ALWAYS_ON } = await import('../interactive.js')
    vi.mocked(checkbox).mockResolvedValue([])
    await promptCategories([])
    const call = vi.mocked(checkbox).mock.calls[0][0]
    const disabledChoices = call.choices.filter(ch => ch.disabled)
    for (const cat of ALWAYS_ON) {
      expect(disabledChoices.some(ch => ch.value === cat)).toBe(true)
    }
  })
})

describe('promptAITools', () => {
  it('returns the tools the user selected', async () => {
    const { checkbox } = await import('@inquirer/prompts')
    const { promptAITools } = await import('../interactive.js')
    vi.mocked(checkbox).mockResolvedValue(['cursor', 'antigravity'])
    const result = await promptAITools(['cursor', 'antigravity'])
    expect(result).toEqual(['cursor', 'antigravity'])
  })

  it('pre-checks detected tools', async () => {
    const { checkbox } = await import('@inquirer/prompts')
    const { promptAITools } = await import('../interactive.js')
    vi.mocked(checkbox).mockResolvedValue([])
    await promptAITools(['cursor'])
    const call = vi.mocked(checkbox).mock.calls[0][0]
    const cursorChoice = call.choices.find(ch => ch.value === 'cursor')
    expect(cursorChoice.checked).toBe(true)
    const geminiChoice = call.choices.find(ch => ch.value === 'gemini')
    expect(geminiChoice.checked).toBe(false)
  })

  it('returns empty array when nothing selected', async () => {
    const { checkbox } = await import('@inquirer/prompts')
    const { promptAITools } = await import('../interactive.js')
    vi.mocked(checkbox).mockResolvedValue([])
    const result = await promptAITools([])
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests — confirm new tests fail**

```bash
npm test -- tests/interactive.test.js 2>&1 | grep -E "FAIL|✗|×" | head -10
```

Expected: `promptCategories` and `promptAITools` tests fail with "not a function".

- [ ] **Step 3: Add `promptCategories` and `promptAITools` to `interactive.js`**

Append to `interactive.js`:

```js
// ── promptCategories ─────────────────────────────────────────────────────────

export async function promptCategories(suggested) {
  const { checkbox } = await import('@inquirer/prompts')

  const choices = ALL_CATEGORIES.map(cat => ({
    value:    cat,
    name:     `${cat.padEnd(30)} ${CATEGORY_REASONS[cat] ?? ''}`,
    checked:  suggested.includes(cat),
    disabled: ALWAYS_ON.includes(cat) ? 'always required' : false,
  }))

  const userSelected = await checkbox({
    message: '📋 Confirm security categories  (space to toggle · enter to confirm)',
    choices,
    pageSize: 20,
  })

  return [...new Set([...ALWAYS_ON, ...ALWAYS_SILENT, ...userSelected])].sort()
}

// ── promptAITools ─────────────────────────────────────────────────────────────

export async function promptAITools(detected) {
  const { checkbox } = await import('@inquirer/prompts')

  const choices = ALL_AI_TOOLS.map(tool => ({
    value:   tool,
    name:    TOOL_LABELS[tool],
    checked: detected.includes(tool),
  }))

  return checkbox({
    message: '🤖 Configure AI tools?  (detected tools are pre-selected)',
    choices,
  })
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/interactive.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add interactive.js tests/interactive.test.js
git commit -m "feat: promptCategories + promptAITools with @inquirer/prompts"
```

---

## Task 6: Add `buildInstallConfig` + `runInteractive` to `interactive.js`

**Files:**
- Modify: `interactive.js`
- Modify: `tests/interactive.test.js`

- [ ] **Step 1: Write failing tests for `buildInstallConfig` and `runInteractive`**

Add to `tests/interactive.test.js`:

```js
// ── buildInstallConfig ────────────────────────────────────────────────────

describe('buildInstallConfig', () => {
  it('returns an array containing all always-on categories', async () => {
    const { select, checkbox } = await import('@inquirer/prompts')
    const { buildInstallConfig, ALWAYS_ON, ALWAYS_SILENT } = await import('../interactive.js')
    vi.mocked(select).mockResolvedValue('cli')
    vi.mocked(checkbox)
      .mockResolvedValueOnce([])   // Q2 infrastructure
      .mockResolvedValueOnce([])   // Q3 features
      .mockResolvedValueOnce([])   // Q4 compliance
      .mockResolvedValueOnce([])   // Q5 hardening
    const result = await buildInstallConfig(testDir)
    for (const cat of [...ALWAYS_ON, ...ALWAYS_SILENT]) {
      expect(result).toContain(cat)
    }
  })

  it('activates docker category when docker is selected in Q2', async () => {
    const { select, checkbox } = await import('@inquirer/prompts')
    const { buildInstallConfig } = await import('../interactive.js')
    vi.mocked(select).mockResolvedValue('web')
    vi.mocked(checkbox)
      .mockResolvedValueOnce(['docker'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    const result = await buildInstallConfig(testDir)
    expect(result).toContain('09-docker-security')
  })

  it('activates AI/LLM category when ai is selected in Q3', async () => {
    const { select, checkbox } = await import('@inquirer/prompts')
    const { buildInstallConfig } = await import('../interactive.js')
    vi.mocked(select).mockResolvedValue('web')
    vi.mocked(checkbox)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['ai'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    const result = await buildInstallConfig(testDir)
    expect(result).toContain('22-ai-llm-security')
  })
})

// ── runInteractive ────────────────────────────────────────────────────────

describe('runInteractive', () => {
  it('calls runInstall with selected config', async () => {
    const { select, checkbox } = await import('@inquirer/prompts')
    const { runInteractive } = await import('../interactive.js')
    const { runInstall } = await import('../install.js')

    vi.mocked(select).mockResolvedValue('cli')
    vi.mocked(checkbox)
      .mockResolvedValueOnce([])            // Q2 infrastructure
      .mockResolvedValueOnce([])            // Q3 features
      .mockResolvedValueOnce([])            // Q4 compliance
      .mockResolvedValueOnce([])            // Q5 hardening
      .mockResolvedValueOnce([])            // promptCategories user toggle
      .mockResolvedValueOnce(['antigravity']) // promptAITools

    const installSpy = vi.spyOn(
      await import('../install.js'), 'runInstall'
    ).mockImplementation(() => {})

    const PACKAGE_ROOT_HERE = join(__dirname, '..')
    await runInteractive(testDir, PACKAGE_ROOT_HERE)

    expect(installSpy).toHaveBeenCalledWith(
      testDir,
      PACKAGE_ROOT_HERE,
      expect.objectContaining({ categories: expect.any(Array), aiTools: expect.any(Array) })
    )
  })

  it('exits 0 without calling runInstall when ExitPromptError thrown', async () => {
    const { select } = await import('@inquirer/prompts')
    const { runInteractive } = await import('../interactive.js')

    const ExitError = class extends Error { constructor() { super(); this.name = 'ExitPromptError' } }
    vi.mocked(select).mockRejectedValue(new ExitError())

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {})
    await runInteractive(testDir, join(__dirname, '..'))
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('exits 0 when user confirms zero categories', async () => {
    const { select, checkbox } = await import('@inquirer/prompts')
    const { runInteractive } = await import('../interactive.js')

    vi.mocked(select).mockResolvedValue('cli')
    vi.mocked(checkbox)
      .mockResolvedValueOnce([]) // Q2
      .mockResolvedValueOnce([]) // Q3
      .mockResolvedValueOnce([]) // Q4
      .mockResolvedValueOnce([]) // Q5
      .mockResolvedValueOnce([]) // promptCategories — user deselects everything
      // Note: ALWAYS_ON + ALWAYS_SILENT are re-added by promptCategories, so
      // zero-category is effectively impossible via normal flow.
      // Test the guard by mocking promptCategories directly to return [].

    const mod = await import('../interactive.js')
    const origPrompt = mod.promptCategories
    vi.spyOn(mod, 'promptCategories').mockResolvedValue([])

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {})
    await runInteractive(testDir, join(__dirname, '..'))
    expect(mockExit).toHaveBeenCalledWith(0)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('nothing to install'))
  })
})
```

- [ ] **Step 2: Run tests — confirm new tests fail**

```bash
npm test -- tests/interactive.test.js 2>&1 | grep -E "FAIL|✗|×" | head -10
```

Expected: `buildInstallConfig` and `runInteractive` tests fail.

- [ ] **Step 3: Add `buildInstallConfig` and `runInteractive` to `interactive.js`**

Append to `interactive.js`:

```js
// ── buildInstallConfig ────────────────────────────────────────────────────────

export async function buildInstallConfig(targetDir) {
  const { select, checkbox } = await import('@inquirer/prompts')

  const projectType = await select({
    message: 'What type of project is this?',
    choices: [
      { value: 'web',    name: 'Web application / API' },
      { value: 'static', name: 'Static website / docs site' },
      { value: 'cli',    name: 'CLI tool / library' },
      { value: 'mobile', name: 'Mobile app' },
    ],
  })

  const infrastructure = await checkbox({
    message: 'What infrastructure does it run on?',
    choices: [
      { value: 'hosting',    name: 'Standard hosting / cloud VM' },
      { value: 'docker',     name: 'Docker / containers' },
      { value: 'serverless', name: 'Serverless / edge  (Lambda, Vercel Functions, CF Workers)' },
      { value: 'kubernetes', name: 'Kubernetes' },
    ],
  })

  const features = await checkbox({
    message: 'What features does it include?',
    choices: [
      { value: 'auth',         name: 'User authentication / login' },
      { value: 'database',     name: 'Database  (SQL or NoSQL)' },
      { value: 'fileUpload',   name: 'File uploads' },
      { value: 'payments',     name: 'Payment processing' },
      { value: 'externalApis', name: 'External API calls' },
      { value: 'graphql',      name: 'GraphQL / WebSockets / real-time' },
      { value: 'ai',           name: 'AI / LLM integration' },
      { value: 'browserApis',  name: 'Browser APIs  (localStorage, ServiceWorker, WebCrypto)' },
    ],
  })

  const compliance = await checkbox({
    message: 'Any compliance or data requirements?',
    choices: [
      { value: 'gdpr',  name: 'EU users / GDPR' },
      { value: 'hipaa', name: 'Healthcare data  (HIPAA)' },
      { value: 'pci',   name: 'Payment data  (PCI-DSS)' },
    ],
  })

  const hardening = await checkbox({
    message: 'Additional security hardening?',
    choices: [
      { value: 'supplyChain',     name: 'Supply chain / dependency security' },
      { value: 'botDdos',         name: 'Bot / DDoS protection' },
      { value: 'monitoring',      name: 'Monitoring & honeytokens' },
      { value: 'advancedAttacks', name: 'Advanced attacks  (SSRF, XXE, deserialization)' },
      { value: 'dnsEmail',        name: 'DNS & email security  (SPF/DKIM/DMARC)' },
    ],
  })

  return mapAnswersToCategories({ projectType, infrastructure, features, compliance, hardening })
}

// ── runInteractive ────────────────────────────────────────────────────────────

export async function runInteractive(targetDir, sourceDir) {
  const { runInstall, detectAI, c } = await import('./install.js')

  try {
    console.log('')
    console.log(c('bold', c('cyan', '╔══════════════════════════════════════════════╗')))
    console.log(c('bold', c('cyan', '║   🔐  SECURITY SKILL — Interactive Setup     ║')))
    console.log(c('bold', c('cyan', '╚══════════════════════════════════════════════╝')))
    console.log('')

    const stack = scanStack(targetDir)
    if (stack.language !== 'Unknown') console.log(c('dim', `   Language   : ${stack.language}`))
    if (stack.framework)  console.log(c('dim', `   Framework  : ${stack.framework}`))
    if (stack.database)   console.log(c('dim', `   Database   : ${stack.database}`))
    if (stack.deployment) console.log(c('dim', `   Deployment : ${stack.deployment}`))
    if (stack.aiTools.length) console.log(c('dim', `   AI tools   : ${stack.aiTools.join(', ')}`))
    console.log('')
    console.log(c('dim', "Let's tailor security coverage to your project. (~60 seconds)"))
    console.log('')

    const suggested   = await buildInstallConfig(targetDir)
    const categories  = await promptCategories(suggested)

    if (categories.length === 0) {
      console.log('\nNo categories selected — nothing to install.')
      process.exit(0)
    }

    const aiTools = await promptAITools(detectAI(targetDir))

    console.log('')
    console.log('📦 Installing...')
    console.log('')

    runInstall(targetDir, sourceDir, { categories, aiTools })

    console.log('')
    console.log(c('bold', c('green', '  ✅ Installation complete!')))
    console.log(c('bold', c('yellow', '  ⚡ Run /security-scan in your AI to get started!')))
    console.log('')

  } catch (err) {
    if (err.name === 'ExitPromptError') {
      console.log('\nInstallation cancelled.')
      process.exit(0)
    }
    throw err
  }
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: All tests pass (100+ total).

- [ ] **Step 5: Run coverage**

```bash
npm run test:coverage
```

Expected: Both `install.js` and `interactive.js` meet the 80% threshold. Coverage report shows both files.

- [ ] **Step 6: Commit**

```bash
git add interactive.js tests/interactive.test.js
git commit -m "feat: buildInstallConfig (5-question interview) + runInteractive orchestration"
```

---

## Task 7: Smoke test + final push

**Files:** None changed — verification only.

- [ ] **Step 1: Run the full test suite with coverage one final time**

```bash
npm run test:coverage
```

Expected output:
```
Test Files  1 passed
Tests       100+ passed
install.js  | 98%+ stmts | 90%+ branches | 100% funcs
interactive.js | 80%+ stmts | 80%+ branches | 80%+ funcs
```

- [ ] **Step 2: Verify the non-interactive path still works**

```bash
node install.js --yes
```

Expected: Installs into current directory silently with the original banner. No prompts.

- [ ] **Step 3: Verify Ctrl+C in interactive mode exits cleanly**

```bash
node install.js
# (press Ctrl+C during the first question)
```

Expected: `Installation cancelled.` printed, exits 0.

- [ ] **Step 4: Push branch and update the PR**

```bash
git push origin feat/test-infrastructure-and-refactor
git push origin feat/test-infrastructure-and-refactor
```

- [ ] **Step 5: Update both PRs with final summary comment**

```bash
gh pr comment 1 --repo Netxeo/skill-file-security --body "Interactive mode implemented. \`npm run test:coverage\` passing. Smoke tested."
gh pr comment 1 --repo Dutch2005/skill-file-security --body "Interactive mode implemented. \`npm run test:coverage\` passing. Smoke tested."
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Approach 1 architecture (install.js engine + interactive.js module) — Tasks 2–6
- [x] `@inquirer/prompts` dependency — Task 1
- [x] `runInstall(config)` with `categories` + `aiTools` — Task 2
- [x] `shouldConfigureAI` helper — Task 2
- [x] TTY detection + `--yes`/`-y` flag — Task 3
- [x] Async `main()` routing to `runInteractive` — Task 3
- [x] `scanStack` informational output — Task 4
- [x] All 5 interview questions with correct mappings — Task 4 + 6
- [x] Deduplication via Set — Task 4
- [x] `promptCategories` with disabled always-on items, re-adds silent categories — Task 5
- [x] `promptAITools` with detected pre-checked — Task 5
- [x] `runInteractive` orchestration — Task 6
- [x] ExitPromptError → exit 0 — Task 6
- [x] Zero-category guard → exit 0 — Task 6
- [x] `vitest.config.js` expanded to include `interactive.js` — Task 1
- [x] Existing 87 tests untouched (only `await` added to `main()` tests) — Task 3

**No placeholders found.**

**Type consistency:** `mapAnswersToCategories(answers)` defined in Task 4 and used in Task 6. `ALWAYS_ON`, `ALWAYS_SILENT` constants defined in Task 4 and used in Tasks 5–6. `runInstall(targetDir, sourceDir, config)` updated in Task 2, called in Task 6.
