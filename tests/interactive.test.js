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

// ── Mock @inquirer/prompts ─────────────────────────────────────────────────
// vi.mock is hoisted by Vitest, so this runs before imports regardless of position.

vi.mock('@inquirer/prompts', () => ({
  select:   vi.fn(),
  checkbox: vi.fn(),
}))

// ── promptCategories ───────────────────────────────────────────────────────

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
