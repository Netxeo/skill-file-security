#!/usr/bin/env node
// Security Skill — CLI Installer
// Usage: npx skill-file-security

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

const c = (color, text) => `${colors[color]}${text}${colors.reset}`

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

const TARGET_DIR = process.cwd()
const SKILL_DIR = join(TARGET_DIR, '.skills', 'security')
const SOURCE_DIR = __dirname

// Detect AI assistant by project indicators
function detectAI() {
  const aiFiles = {
    cursor:    ['.cursorrules', '.cursorignore', '.cursor/'],
    windsurf:  ['.windsurfrules'],
    cline:     ['.clinerules'],
    copilot:   ['.github/copilot-instructions.md'],
    aider:     ['.aider.conf.yml', '.aider.conf.yaml'],
    continue:  ['.continue/', '.continue/config.yaml', '.continue/config.json'],
    codex:     ['AGENTS.md', '.codex/'],
    gemini:    ['GEMINI.md', '.gemini/'],
    antigravity: ['CLAUDE.md', 'memory.md'],
  }
  const detected = []
  for (const [ai, files] of Object.entries(aiFiles)) {
    if (files.some(f => existsSync(join(TARGET_DIR, f)))) {
      detected.push(ai)
    }
  }
  return detected
}

// Helper: write config file if not already containing security-skill
function writeAIConfig(filePath, content, label, dirPath = null) {
  if (dirPath) mkdirSync(join(TARGET_DIR, dirPath), { recursive: true })
  const fullPath = join(TARGET_DIR, filePath)
  if (!existsSync(fullPath)) {
    writeFileSync(fullPath, content)
    console.log(c('green', `  ✅ ${label} created`))
  } else if (!readFileSync(fullPath, 'utf8').includes('security-skill')) {
    writeFileSync(fullPath, readFileSync(fullPath, 'utf8') + '\n\n' + content)
    console.log(c('green', `  ✅ ${label} updated`))
  } else {
    console.log(c('yellow', `  ⚠️  ${label} already configured`))
  }
}

// Copy directory recursively
function copyDir(src, dest) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
  const items = readdirSync(src)
  for (const item of items) {
    const srcPath = join(src, item)
    const destPath = join(dest, item)
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

// Merge .gitignore
function mergeGitignore(securityEntries) {
  const gitignorePath = join(TARGET_DIR, '.gitignore')
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : ''
  const lines = existing.split('\n')
  const missing = securityEntries.filter(e => !lines.includes(e))
  if (missing.length > 0) {
    const addition = '\n# === Added by security-skill ===\n' + missing.join('\n') + '\n'
    writeFileSync(gitignorePath, existing + addition)
    return missing.length
  }
  return 0
}

// Main install
try {
  // 1. Create .skills/security directory
  mkdirSync(SKILL_DIR, { recursive: true })

  // 2. Copy all skill files
  copyDir(join(SOURCE_DIR, 'instructions'), join(SKILL_DIR, 'instructions'))
  copyDir(join(SOURCE_DIR, 'templates'), join(SKILL_DIR, 'templates'))
  copyDir(join(SOURCE_DIR, 'checklists'), join(SKILL_DIR, 'checklists'))
  copyFileSync(join(SOURCE_DIR, 'skill.md'), join(SKILL_DIR, 'skill.md'))
  console.log(c('green', '  ✅ Skill files installed → .skills/security/'))

  // 3. Create memory-security.md if not exists
  const memoryPath = join(TARGET_DIR, 'memory-security.md')
  if (!existsSync(memoryPath)) {
    copyFileSync(join(SOURCE_DIR, 'templates', 'memory-security.md'), memoryPath)
    console.log(c('green', '  ✅ memory-security.md created'))
  } else {
    console.log(c('yellow', '  ⚠️  memory-security.md already exists (not overwritten)'))
  }

  // 4. Update .gitignore
  const securityGitignoreEntries = ['.env', '.env.local', '.env.*', '*.key', '*.pem', 'secrets/']
  const addedLines = mergeGitignore(securityGitignoreEntries)
  if (addedLines > 0) {
    console.log(c('green', `  ✅ .gitignore updated (${addedLines} security entries added)`))
  } else {
    console.log(c('green', '  ✅ .gitignore already secure'))
  }

  // 5. Create AI config files for all supported assistants
  const detectedAIs = detectAI()
  const skillRef = `## 🔐 Security Skill Active

This project uses security-skill for automated security engineering.

**At the start of every session:**
1. Read \`.skills/security/skill.md\` — security engineering instructions (25 categories)
2. Read \`memory-security.md\` — project security state and history
3. Be ready for: \`/security-scan\`, \`/security-audit\`, \`/security-fix\`, \`/security-status\`, \`/security-incident\`

You are acting as both a developer assistant AND a security engineer.
Proactively flag security issues in all code you write or review.
`

  console.log('')
  console.log(c('dim', '  Configuring AI assistants...'))

  // ── Claude / Antigravity ──
  writeAIConfig('CLAUDE.md', skillRef, 'CLAUDE.md (Claude / Antigravity)')

  // ── OpenAI Codex CLI (AGENTS.md) ──
  writeAIConfig('AGENTS.md', skillRef, 'AGENTS.md (OpenAI Codex CLI)')

  // ── Gemini Code Assist ──
  writeAIConfig('GEMINI.md', skillRef, 'GEMINI.md (Gemini Code Assist)')

  // ── Cursor (legacy .cursorrules) ──
  writeAIConfig('.cursorrules', skillRef, '.cursorrules (Cursor legacy)')

  // ── Cursor (new MDC format) ──
  mkdirSync(join(TARGET_DIR, '.cursor', 'rules'), { recursive: true })
  const mdcContent = `---\ndescription: Security Skill — enterprise security engineering\nglobs: ["**/*"]\nalwaysApply: true\n---\n\n${skillRef}`
  writeAIConfig('.cursor/rules/security.mdc', mdcContent, '.cursor/rules/security.mdc (Cursor MDC)')

  // ── Windsurf ──
  writeAIConfig('.windsurfrules', skillRef, '.windsurfrules (Windsurf)')

  // ── Cline ──
  writeAIConfig('.clinerules', skillRef, '.clinerules (Cline)')

  // ── GitHub Copilot ──
  mkdirSync(join(TARGET_DIR, '.github', 'instructions'), { recursive: true })
  writeAIConfig('.github/copilot-instructions.md', skillRef, '.github/copilot-instructions.md (GitHub Copilot)')
  // Copilot path-specific instruction (applies to all files)
  const copilotPathInstruction = `---\napplyTo: "**"\n---\n\n${skillRef}`
  writeAIConfig('.github/instructions/security.instructions.md', copilotPathInstruction, '.github/instructions/security.instructions.md (Copilot path-specific)')

  // ── Aider ──
  if (detectedAIs.includes('aider') || existsSync(join(TARGET_DIR, '.aider.conf.yml'))) {
    writeAIConfig('.aider.conf.yml', `# security-skill\nread:\n  - .skills/security/skill.md\n  - memory-security.md\n`, '.aider.conf.yml (Aider)')
  }

  // ── Continue.dev ──
  mkdirSync(join(TARGET_DIR, '.continue'), { recursive: true })
  const continueContent = `# security-skill\nrules:\n  - name: "Security Skill"\n    rule: |\n      ${skillRef.replace(/\n/g, '\n      ')}\n`
  writeAIConfig('.continue/config.yaml', continueContent, '.continue/config.yaml (Continue.dev)')

  if (detectedAIs.length > 0) {
    console.log(c('green', `  ✅ Detected existing AI tools: ${detectedAIs.join(', ')}`))
  }

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
