#!/usr/bin/env node
// Security Skill — CLI Installer
// Usage: npx @netxeo/security-skill

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const _require = createRequire(import.meta.url)
const { version } = _require('./package.json')

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

export const c = (color, text) => `${colors[color]}${text}${colors.reset}`

// Detect AI assistant by project indicators
export function detectAI(targetDir) {
  const aiFiles = {
    cursor:       ['.cursorrules', '.cursorignore', '.cursor/'],
    windsurf:     ['.windsurfrules'],
    cline:        ['.clinerules'],
    copilot:      ['.github/copilot-instructions.md'],
    aider:        ['.aider.conf.yml', '.aider.conf.yaml'],
    continue:     ['.continue/', '.continue/config.yaml', '.continue/config.json'],
    codex:        ['AGENTS.md', '.codex/'],
    gemini:       ['GEMINI.md', '.gemini/'],
    antigravity:  ['CLAUDE.md', 'memory.md'],
  }
  const detected = []
  for (const [ai, files] of Object.entries(aiFiles)) {
    if (files.some(f => existsSync(join(targetDir, f)))) {
      detected.push(ai)
    }
  }
  return detected
}

// Write config file if not already containing security-skill
export function writeAIConfig(targetDir, filePath, content, label, dirPath = null) {
  if (dirPath) mkdirSync(join(targetDir, dirPath), { recursive: true })
  const fullPath = join(targetDir, filePath)
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
export function copyDir(src, dest) {
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

// Merge .gitignore — adds only missing entries, returns count added
export function mergeGitignore(targetDir, securityEntries) {
  const gitignorePath = join(targetDir, '.gitignore')
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

function shouldConfigureAI(tool, config) {
  return !config.aiTools || config.aiTools.includes(tool)
}

export function runInstall(targetDir = process.cwd(), sourceDir = __dirname, config = {}) {
  const SKILL_DIR = join(targetDir, '.skills', 'security')

  // 1. Create .skills/security directory
  mkdirSync(SKILL_DIR, { recursive: true })

  // 2. Copy all skill files
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

  // 3. Create memory-security.md if not exists
  const memoryPath = join(targetDir, 'memory-security.md')
  if (!existsSync(memoryPath)) {
    copyFileSync(join(sourceDir, 'templates', 'memory-security.md'), memoryPath)
    console.log(c('green', '  ✅ memory-security.md created'))
  } else {
    console.log(c('yellow', '  ⚠️  memory-security.md already exists (not overwritten)'))
  }

  // 4. Update .gitignore
  const securityGitignoreEntries = ['.env', '.env.local', '.env.*', '*.key', '*.pem', 'secrets/']
  const addedLines = mergeGitignore(targetDir, securityGitignoreEntries)
  if (addedLines > 0) {
    console.log(c('green', `  ✅ .gitignore updated (${addedLines} security entries added)`))
  } else {
    console.log(c('green', '  ✅ .gitignore already secure'))
  }

  // 5. Create AI config files for all supported assistants
  const detectedAIs = detectAI(targetDir)
  const skillRef = \`## 🔐 Security Skill Active\n\nThis project uses security-skill for automated security engineering.\n\n**At the start of every session:**\n1. Read \`.skills/security/skill.md\` — security engineering instructions (25 categories)\n2. Read \`memory-security.md\` — project security state and history\n3. Be ready for: \`/security-scan\`, \`/security-audit\`, \`/security-fix\`, \`/security-status\`, \`/security-incident\`, \`/security-history\`\n\nYou are acting as both a developer assistant AND a security engineer.\nProactively flag security issues in all code you write or review.\n\`

  console.log('')
  console.log(c('dim', '  Configuring AI assistants...'))

  if (shouldConfigureAI('antigravity', config))
    writeAIConfig(targetDir, 'CLAUDE.md', skillRef, 'CLAUDE.md (Claude / Antigravity)')

  if (shouldConfigureAI('codex', config))
    writeAIConfig(targetDir, 'AGENTS.md', skillRef, 'AGENTS.md (OpenAI Codex CLI)')

  if (shouldConfigureAI('gemini', config))
    writeAIConfig(targetDir, 'GEMINI.md', skillRef, 'GEMINI.md (Gemini Code Assist)')

  if (shouldConfigureAI('cursor', config)) {
    writeAIConfig(targetDir, '.cursorrules', skillRef, '.cursorrules (Cursor legacy)')
    mkdirSync(join(targetDir, '.cursor', 'rules'), { recursive: true })
    const mdcContent = \`---\ndescription: Security Skill — enterprise security engineering\nglobs: ["**/*"]\nalwaysApply: true\n---\n\n\${skillRef}\`
    writeAIConfig(targetDir, '.cursor/rules/security.mdc', mdcContent, '.cursor/rules/security.mdc (Cursor MDC)')
  }

  if (shouldConfigureAI('windsurf', config))
    writeAIConfig(targetDir, '.windsurfrules', skillRef, '.windsurfrules (Windsurf)')

  if (shouldConfigureAI('cline', config))
    writeAIConfig(targetDir, '.clinerules', skillRef, '.clinerules (Cline)')

  if (shouldConfigureAI('copilot', config)) {
    mkdirSync(join(targetDir, '.github', 'instructions'), { recursive: true })
    writeAIConfig(targetDir, '.github/copilot-instructions.md', skillRef, '.github/copilot-instructions.md (GitHub Copilot)')
    const copilotPathInstruction = \`---\napplyTo: "**"\n---\n\n\${skillRef}\`
    writeAIConfig(targetDir, '.github/instructions/security.instructions.md', copilotPathInstruction, '.github/instructions/security.instructions.md (Copilot path-specific)')
  }

  // Aider is opt-in when no config is provided: only configure when already detected.
  // All other tools default to on (shouldConfigureAI returns true when config.aiTools is undefined).
  // This asymmetry is intentional — auto-creating .aider.conf.yml in an unrelated project is invasive.
  const configureAider = config.aiTools
    ? config.aiTools.includes('aider')
    : detectedAIs.includes('aider')
  if (configureAider)
    writeAIConfig(targetDir, '.aider.conf.yml', \`# security-skill\nread:\n  - .skills/security/skill.md\n  - memory-security.md\n\`, '.aider.conf.yml (Aider)')

  if (shouldConfigureAI('continue', config)) {
    mkdirSync(join(targetDir, '.continue'), { recursive: true })
    const continueContent = \`# security-skill\nrules:\n  - name: "Security Skill"\n    rule: |\n      \${skillRef.replace(/\\n/g, '\\n      ')}\n\`
    writeAIConfig(targetDir, '.continue/config.yaml', continueContent, '.continue/config.yaml (Continue.dev)')
  }

  if (detectedAIs.length > 0) {
    console.log(c('green', \`  ✅ Detected existing AI tools: \${detectedAIs.join(', ')}\`))
  }
}

// Exported so it can be tested in-process without subprocess overhead.
export async function main(targetDir = process.cwd(), sourceDir = __dirname) {
  try {
    if (shouldUseInteractive()) {
      const { runInteractive } = await import('./interactive.js')
      await runInteractive(targetDir, sourceDir)
      return
    }

    // Non-interactive path
    console.log('')
    console.log(c('bold', c('cyan', '╔══════════════════════════════════════════════╗')))
    console.log(c('bold', c('cyan', \`║        🔐  SECURITY SKILL  v\${version.padEnd(16)}║\`)))
    console.log(c('bold', c('cyan', '║   100% Code Security for Any Project          ║')))
    console.log(c('bold', c('cyan', '╚══════════════════════════════════════════════╝')))
    console.log('')
    console.log(c('dim', '  Covers: CWE Top 25 · OWASP Top 10 · ASVS L1-3'))
    console.log(c('dim', '  Works with: Claude · Cursor · Copilot · Windsurf · Cline · Codex · Aider · Gemini'))
    console.log('')
    console.log('📦 Installing security-skill...')
    console.log('')

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
    console.log(c('dim', '  /security-history → View audit history'))
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

export function shouldUseInteractive(
  argv = process.argv,
  isTTY = Boolean(process.stdout?.isTTY),
) {
  return isTTY && !argv.includes('--yes') && !argv.includes('-y') && !argv.includes('--all')
}

// ── CLI entry point ──────────────────────────────────────────────────────────
// isMain is true only when executed directly (node install.js / npx).
// When imported by tests, isMain is false and main() is never called here.
const isMain = process.argv[1]
  ? resolve(process.argv[1]).toLowerCase() === resolve(__filename).toLowerCase()
  : false

if (isMain) {
  main().catch(err => {
    console.error(c('red', '  ❌ Installation failed:'), err.message)
    process.exit(1)
  })
}

