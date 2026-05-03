import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdtempSync,
} from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { detectAI, writeAIConfig, copyDir, mergeGitignore, runInstall, main, c, colors } from '../install.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PACKAGE_ROOT = join(__dirname, '..')

// ─── shared fixture ──────────────────────────────────────────────────────────

let testDir

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'security-skill-test-'))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

// ─── color helpers ───────────────────────────────────────────────────────────

describe('color utilities', () => {
  it('colors object has all expected keys', () => {
    expect(colors).toHaveProperty('reset')
    expect(colors).toHaveProperty('green')
    expect(colors).toHaveProperty('red')
    expect(colors).toHaveProperty('yellow')
    expect(colors).toHaveProperty('cyan')
    expect(colors).toHaveProperty('bold')
    expect(colors).toHaveProperty('dim')
  })

  it('c() wraps text with ANSI codes', () => {
    const result = c('green', 'hello')
    expect(result).toContain('hello')
    expect(result).toContain(colors.green)
    expect(result).toContain(colors.reset)
  })

  it('c() supports nesting', () => {
    const inner = c('green', 'inner')
    const outer = c('bold', inner)
    expect(outer).toContain('inner')
    expect(outer).toContain(colors.bold)
  })
})

// ─── detectAI ────────────────────────────────────────────────────────────────

describe('detectAI', () => {
  it('returns empty array when directory has no AI config files', () => {
    expect(detectAI(testDir)).toEqual([])
  })

  it.each([
    ['.cursorrules',   'cursor'],
    ['.cursorignore',  'cursor'],
    ['.windsurfrules', 'windsurf'],
    ['.clinerules',    'cline'],
    ['AGENTS.md',      'codex'],
    ['GEMINI.md',      'gemini'],
    ['CLAUDE.md',      'antigravity'],
    ['memory.md',      'antigravity'],
  ])('detects %s as %s', (file, expectedAI) => {
    writeFileSync(join(testDir, file), '')
    expect(detectAI(testDir)).toContain(expectedAI)
  })

  it('detects cursor from .cursor/ directory', () => {
    mkdirSync(join(testDir, '.cursor'))
    expect(detectAI(testDir)).toContain('cursor')
  })

  it('detects continue from .continue/ directory', () => {
    mkdirSync(join(testDir, '.continue'))
    expect(detectAI(testDir)).toContain('continue')
  })

  it('detects continue from .continue/config.yaml', () => {
    mkdirSync(join(testDir, '.continue'), { recursive: true })
    writeFileSync(join(testDir, '.continue', 'config.yaml'), '')
    expect(detectAI(testDir)).toContain('continue')
  })

  it('detects continue from .continue/config.json', () => {
    mkdirSync(join(testDir, '.continue'), { recursive: true })
    writeFileSync(join(testDir, '.continue', 'config.json'), '')
    expect(detectAI(testDir)).toContain('continue')
  })

  it('detects aider from .aider.conf.yml', () => {
    writeFileSync(join(testDir, '.aider.conf.yml'), '')
    expect(detectAI(testDir)).toContain('aider')
  })

  it('detects aider from .aider.conf.yaml', () => {
    writeFileSync(join(testDir, '.aider.conf.yaml'), '')
    expect(detectAI(testDir)).toContain('aider')
  })

  it('detects codex from .codex/ directory', () => {
    mkdirSync(join(testDir, '.codex'))
    expect(detectAI(testDir)).toContain('codex')
  })

  it('detects gemini from .gemini/ directory', () => {
    mkdirSync(join(testDir, '.gemini'))
    expect(detectAI(testDir)).toContain('gemini')
  })

  it('detects copilot from .github/copilot-instructions.md', () => {
    mkdirSync(join(testDir, '.github'), { recursive: true })
    writeFileSync(join(testDir, '.github', 'copilot-instructions.md'), '')
    expect(detectAI(testDir)).toContain('copilot')
  })

  it('detects multiple AI tools simultaneously', () => {
    writeFileSync(join(testDir, '.cursorrules'), '')
    writeFileSync(join(testDir, 'CLAUDE.md'), '')
    writeFileSync(join(testDir, 'GEMINI.md'), '')
    writeFileSync(join(testDir, '.windsurfrules'), '')
    const detected = detectAI(testDir)
    expect(detected).toContain('cursor')
    expect(detected).toContain('antigravity')
    expect(detected).toContain('gemini')
    expect(detected).toContain('windsurf')
  })

  it('returns each AI at most once even with multiple matching files', () => {
    writeFileSync(join(testDir, '.cursorrules'), '')
    mkdirSync(join(testDir, '.cursor'))
    const detected = detectAI(testDir)
    expect(detected.filter(ai => ai === 'cursor')).toHaveLength(1)
  })
})

// ─── writeAIConfig ───────────────────────────────────────────────────────────

describe('writeAIConfig', () => {
  it('creates file when it does not exist', () => {
    writeAIConfig(testDir, 'test.md', 'content here', 'Test')
    expect(existsSync(join(testDir, 'test.md'))).toBe(true)
    expect(readFileSync(join(testDir, 'test.md'), 'utf8')).toBe('content here')
  })

  it('logs created message for new file', () => {
    writeAIConfig(testDir, 'new.md', 'content', 'My Label')
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('My Label'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('created'))
  })

  it('appends to existing file that lacks security-skill', () => {
    writeFileSync(join(testDir, 'test.md'), 'existing content')
    writeAIConfig(testDir, 'test.md', 'security-skill config', 'Test')
    const result = readFileSync(join(testDir, 'test.md'), 'utf8')
    expect(result).toContain('existing content')
    expect(result).toContain('security-skill config')
  })

  it('logs updated message when appending to existing file', () => {
    writeFileSync(join(testDir, 'existing.md'), 'some content')
    writeAIConfig(testDir, 'existing.md', 'security-skill stuff', 'My Label')
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('updated'))
  })

  it('does not modify file that already contains security-skill', () => {
    const original = 'already has security-skill configured here'
    writeFileSync(join(testDir, 'configured.md'), original)
    writeAIConfig(testDir, 'configured.md', 'new content', 'Configured')
    expect(readFileSync(join(testDir, 'configured.md'), 'utf8')).toBe(original)
  })

  it('logs already-configured message when file has security-skill', () => {
    writeFileSync(join(testDir, 'configured.md'), 'security-skill is here')
    writeAIConfig(testDir, 'configured.md', 'new content', 'Configured')
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('already configured'))
  })

  it('creates subdirectory when dirPath is provided', () => {
    writeAIConfig(testDir, 'subdir/test.md', 'content', 'Test', 'subdir')
    expect(existsSync(join(testDir, 'subdir'))).toBe(true)
    expect(readFileSync(join(testDir, 'subdir', 'test.md'), 'utf8')).toBe('content')
  })

  it('works without dirPath param (no directory creation)', () => {
    writeAIConfig(testDir, 'flat.md', 'flat content', 'Flat')
    expect(readFileSync(join(testDir, 'flat.md'), 'utf8')).toBe('flat content')
  })

  it('appended content is separated from original by double newline', () => {
    writeFileSync(join(testDir, 'test.md'), 'original')
    writeAIConfig(testDir, 'test.md', 'security-skill extra', 'Test')
    const result = readFileSync(join(testDir, 'test.md'), 'utf8')
    expect(result).toMatch(/original\n\nsecurity-skill extra/)
  })
})

// ─── copyDir ─────────────────────────────────────────────────────────────────

describe('copyDir', () => {
  let srcDir

  beforeEach(() => {
    srcDir = mkdtempSync(join(tmpdir(), 'security-skill-src-'))
  })

  afterEach(() => {
    rmSync(srcDir, { recursive: true, force: true })
  })

  it('copies a file from source to destination', () => {
    writeFileSync(join(srcDir, 'file.txt'), 'hello world')
    copyDir(srcDir, join(testDir, 'dest'))
    expect(readFileSync(join(testDir, 'dest', 'file.txt'), 'utf8')).toBe('hello world')
  })

  it('creates destination directory when it does not exist', () => {
    const dest = join(testDir, 'new-dest')
    expect(existsSync(dest)).toBe(false)
    copyDir(srcDir, dest)
    expect(existsSync(dest)).toBe(true)
  })

  it('handles empty source directory', () => {
    const dest = join(testDir, 'empty-dest')
    copyDir(srcDir, dest)
    expect(existsSync(dest)).toBe(true)
  })

  it('copies multiple files', () => {
    writeFileSync(join(srcDir, 'a.txt'), 'a content')
    writeFileSync(join(srcDir, 'b.txt'), 'b content')
    copyDir(srcDir, join(testDir, 'dest'))
    expect(readFileSync(join(testDir, 'dest', 'a.txt'), 'utf8')).toBe('a content')
    expect(readFileSync(join(testDir, 'dest', 'b.txt'), 'utf8')).toBe('b content')
  })

  it('copies nested directories recursively', () => {
    mkdirSync(join(srcDir, 'nested', 'deep'), { recursive: true })
    writeFileSync(join(srcDir, 'nested', 'mid.txt'), 'mid')
    writeFileSync(join(srcDir, 'nested', 'deep', 'bottom.txt'), 'bottom')
    copyDir(srcDir, join(testDir, 'dest'))
    expect(readFileSync(join(testDir, 'dest', 'nested', 'mid.txt'), 'utf8')).toBe('mid')
    expect(readFileSync(join(testDir, 'dest', 'nested', 'deep', 'bottom.txt'), 'utf8')).toBe('bottom')
  })

  it('creates nested destination directories automatically', () => {
    mkdirSync(join(srcDir, 'sub'), { recursive: true })
    writeFileSync(join(srcDir, 'sub', 'nested.txt'), 'nested')
    copyDir(srcDir, join(testDir, 'a', 'b', 'dest'))
    expect(existsSync(join(testDir, 'a', 'b', 'dest'))).toBe(true)
  })

  it('preserves file content exactly', () => {
    const content = '{"key":"value","arr":[1,2,3]}\n# comment\n  indented'
    writeFileSync(join(srcDir, 'data.json'), content)
    copyDir(srcDir, join(testDir, 'dest'))
    expect(readFileSync(join(testDir, 'dest', 'data.json'), 'utf8')).toBe(content)
  })
})

// ─── mergeGitignore ──────────────────────────────────────────────────────────

describe('mergeGitignore', () => {
  it('creates .gitignore with all entries when none exists', () => {
    const count = mergeGitignore(testDir, ['.env', '*.key', 'secrets/'])
    expect(count).toBe(3)
    const content = readFileSync(join(testDir, '.gitignore'), 'utf8')
    expect(content).toContain('.env')
    expect(content).toContain('*.key')
    expect(content).toContain('secrets/')
  })

  it('returns 0 when all entries already present', () => {
    writeFileSync(join(testDir, '.gitignore'), '.env\n*.key\nsecrets/\n')
    const count = mergeGitignore(testDir, ['.env', '*.key', 'secrets/'])
    expect(count).toBe(0)
  })

  it('does not modify file when returning 0', () => {
    const original = '.env\n*.key\n'
    writeFileSync(join(testDir, '.gitignore'), original)
    mergeGitignore(testDir, ['.env', '*.key'])
    expect(readFileSync(join(testDir, '.gitignore'), 'utf8')).toBe(original)
  })

  it('adds only missing entries to existing .gitignore', () => {
    writeFileSync(join(testDir, '.gitignore'), '.env\n')
    const count = mergeGitignore(testDir, ['.env', '*.key', '*.pem'])
    expect(count).toBe(2)
    const content = readFileSync(join(testDir, '.gitignore'), 'utf8')
    expect(content).toContain('*.key')
    expect(content).toContain('*.pem')
  })

  it('returns count of added entries', () => {
    writeFileSync(join(testDir, '.gitignore'), '.env\n')
    const count = mergeGitignore(testDir, ['.env', 'a', 'b', 'c'])
    expect(count).toBe(3)
  })

  it('preserves existing content when adding entries', () => {
    writeFileSync(join(testDir, '.gitignore'), 'node_modules/\ndist/\n')
    mergeGitignore(testDir, ['.env'])
    const content = readFileSync(join(testDir, '.gitignore'), 'utf8')
    expect(content).toContain('node_modules/')
    expect(content).toContain('dist/')
    expect(content).toContain('.env')
  })

  it('includes the security-skill section header in additions', () => {
    mergeGitignore(testDir, ['.env'])
    const content = readFileSync(join(testDir, '.gitignore'), 'utf8')
    expect(content).toContain('Added by security-skill')
  })

  it('handles empty entries array', () => {
    const count = mergeGitignore(testDir, [])
    expect(count).toBe(0)
  })
})

// ─── runInstall (integration) ─────────────────────────────────────────────────

describe('runInstall', () => {
  it('creates .skills/security directory', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.skills', 'security'))).toBe(true)
  })

  it('copies skill.md into .skills/security/', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.skills', 'security', 'skill.md'))).toBe(true)
  })

  it('copies instructions/ directory', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.skills', 'security', 'instructions'))).toBe(true)
  })

  it('copies templates/ directory', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.skills', 'security', 'templates'))).toBe(true)
  })

  it('copies checklists/ directory', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.skills', 'security', 'checklists'))).toBe(true)
  })

  it('creates memory-security.md when absent', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, 'memory-security.md'))).toBe(true)
  })

  it('preserves existing memory-security.md content', () => {
    writeFileSync(join(testDir, 'memory-security.md'), 'my custom tracking data')
    runInstall(testDir, PACKAGE_ROOT)
    expect(readFileSync(join(testDir, 'memory-security.md'), 'utf8')).toBe('my custom tracking data')
  })

  it('creates .gitignore with required security entries', () => {
    runInstall(testDir, PACKAGE_ROOT)
    const content = readFileSync(join(testDir, '.gitignore'), 'utf8')
    expect(content).toContain('.env')
    expect(content).toContain('.env.local')
    expect(content).toContain('.env.*')
    expect(content).toContain('*.key')
    expect(content).toContain('*.pem')
    expect(content).toContain('secrets/')
  })

  it('logs already-secure when .gitignore has all entries', () => {
    writeFileSync(join(testDir, '.gitignore'), '.env\n.env.local\n.env.*\n*.key\n*.pem\nsecrets/\n')
    runInstall(testDir, PACKAGE_ROOT)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('already secure'))
  })

  it('logs gitignore update count when entries are added', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('security entries added'))
  })

  it('creates CLAUDE.md', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, 'CLAUDE.md'))).toBe(true)
    expect(readFileSync(join(testDir, 'CLAUDE.md'), 'utf8')).toContain('security-skill')
  })

  it('creates AGENTS.md', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, 'AGENTS.md'))).toBe(true)
  })

  it('creates GEMINI.md', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, 'GEMINI.md'))).toBe(true)
  })

  it('creates .cursorrules', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.cursorrules'))).toBe(true)
  })

  it('creates .cursor/rules/security.mdc', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.cursor', 'rules', 'security.mdc'))).toBe(true)
  })

  it('.cursor/rules/security.mdc has MDC frontmatter', () => {
    runInstall(testDir, PACKAGE_ROOT)
    const content = readFileSync(join(testDir, '.cursor', 'rules', 'security.mdc'), 'utf8')
    expect(content).toContain('alwaysApply: true')
    expect(content).toContain('security-skill')
  })

  it('creates .windsurfrules', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.windsurfrules'))).toBe(true)
  })

  it('creates .clinerules', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.clinerules'))).toBe(true)
  })

  it('creates .github/copilot-instructions.md', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.github', 'copilot-instructions.md'))).toBe(true)
  })

  it('creates .github/instructions/security.instructions.md', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.github', 'instructions', 'security.instructions.md'))).toBe(true)
  })

  it('.github/instructions/security.instructions.md has applyTo frontmatter', () => {
    runInstall(testDir, PACKAGE_ROOT)
    const content = readFileSync(join(testDir, '.github', 'instructions', 'security.instructions.md'), 'utf8')
    expect(content).toContain('applyTo')
  })

  it('creates .continue/config.yaml', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.continue', 'config.yaml'))).toBe(true)
  })

  it('.continue/config.yaml references security-skill', () => {
    runInstall(testDir, PACKAGE_ROOT)
    const content = readFileSync(join(testDir, '.continue', 'config.yaml'), 'utf8')
    expect(content).toContain('security-skill')
    expect(content).toContain('Security Skill')
  })

  it('creates aider config when .aider.conf.yml already exists', () => {
    writeFileSync(join(testDir, '.aider.conf.yml'), '# existing aider config\n')
    runInstall(testDir, PACKAGE_ROOT)
    const content = readFileSync(join(testDir, '.aider.conf.yml'), 'utf8')
    expect(content).toContain('security-skill')
  })

  it('does not create .aider.conf.yml when aider is not present', () => {
    runInstall(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.aider.conf.yml'))).toBe(false)
  })

  it('does not overwrite AI config files that already contain security-skill', () => {
    const original = 'security-skill already configured here, do not touch'
    writeFileSync(join(testDir, 'CLAUDE.md'), original)
    runInstall(testDir, PACKAGE_ROOT)
    expect(readFileSync(join(testDir, 'CLAUDE.md'), 'utf8')).toBe(original)
  })

  it('appends to existing AI config that lacks security-skill', () => {
    writeFileSync(join(testDir, 'CLAUDE.md'), '# Existing project instructions\n')
    runInstall(testDir, PACKAGE_ROOT)
    const content = readFileSync(join(testDir, 'CLAUDE.md'), 'utf8')
    expect(content).toContain('Existing project instructions')
    expect(content).toContain('security-skill')
  })

  it('reports detected AI tools in log', () => {
    writeFileSync(join(testDir, '.cursorrules'), '')
    writeFileSync(join(testDir, 'CLAUDE.md'), 'existing content without the key phrase')
    runInstall(testDir, PACKAGE_ROOT)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('antigravity'))
  })

  it('does not log detected tools when none are present before install', () => {
    runInstall(testDir, PACKAGE_ROOT)
    const calls = vi.mocked(console.log).mock.calls.map(args => args[0])
    expect(calls.some(msg => typeof msg === 'string' && msg.includes('Detected existing AI tools'))).toBe(false)
  })

  it('is idempotent — second run does not duplicate .gitignore entries', () => {
    runInstall(testDir, PACKAGE_ROOT)
    runInstall(testDir, PACKAGE_ROOT)
    const content = readFileSync(join(testDir, '.gitignore'), 'utf8')
    const envMatches = content.match(/^\.env$/gm) || []
    expect(envMatches.length).toBe(1)
  })

  it('throws when sourceDir does not contain expected skill files', () => {
    const badSource = join(testDir, 'nonexistent-source')
    expect(() => runInstall(testDir, badSource)).toThrow()
  })

  it('logs memory-security.md already-exists warning on re-run', () => {
    runInstall(testDir, PACKAGE_ROOT)
    vi.mocked(console.log).mockClear()
    runInstall(testDir, PACKAGE_ROOT)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('already exists'))
  })
})

// ─── main() ──────────────────────────────────────────────────────────────────

describe('main()', () => {
  it('prints the ASCII banner header', () => {
    main(testDir, PACKAGE_ROOT)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('SECURITY SKILL'))
  })

  it('prints coverage tag line', () => {
    main(testDir, PACKAGE_ROOT)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('CWE Top 25'))
  })

  it('prints the installing progress line', () => {
    main(testDir, PACKAGE_ROOT)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Installing security-skill'))
  })

  it('runs a full install and creates .skills/security/', () => {
    main(testDir, PACKAGE_ROOT)
    expect(existsSync(join(testDir, '.skills', 'security'))).toBe(true)
  })

  it('prints Installation complete on success', () => {
    main(testDir, PACKAGE_ROOT)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Installation complete'))
  })

  it('prints available command list after success', () => {
    main(testDir, PACKAGE_ROOT)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('/security-scan'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('/security-audit'))
  })

  it('prints compatible AI tools list after success', () => {
    main(testDir, PACKAGE_ROOT)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Claude'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Cursor'))
  })

  it('calls process.exit(1) and logs error when install throws', () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {})
    main(testDir, '/nonexistent-source-that-does-not-exist-12345')
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Installation failed'),
      expect.any(String),
    )
    expect(mockExit).toHaveBeenCalledWith(1)
  })
})
