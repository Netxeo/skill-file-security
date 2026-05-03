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

  it('hosting infrastructure selection adds no extra categories beyond baseline', async () => {
    const { mapAnswersToCategories } = await import('../interactive.js')
    const resultWith = mapAnswersToCategories({ projectType: 'cli', infrastructure: ['hosting'], features: [], compliance: [], hardening: [] })
    const resultWithout = mapAnswersToCategories({ projectType: 'cli', infrastructure: [], features: [], compliance: [], hardening: [] })
    expect(resultWith).toEqual(resultWithout)
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

// ── Additional scanStack branch coverage (fixes branch coverage gap) ───────

describe('scanStack — additional branches', () => {
  it('detects TypeScript from typescript in package.json deps', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({
      devDependencies: { typescript: '^5.0.0' }
    }))
    const info = scanStack(testDir)
    expect(info.language).toContain('TypeScript')
  })

  it('detects Nuxt.js from package.json deps', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({
      dependencies: { nuxt: '^3.0.0' }
    }))
    const info = scanStack(testDir)
    expect(info.framework).toBe('Nuxt.js')
  })

  it('detects Express from package.json deps', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({
      dependencies: { express: '^4.0.0' }
    }))
    const info = scanStack(testDir)
    expect(info.framework).toBe('Express')
  })

  it('detects Netlify from netlify.toml', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'netlify.toml'), '[build]')
    const info = scanStack(testDir)
    expect(info.deployment).toBe('Netlify')
  })

  it('detects Cloudflare Workers from wrangler.toml', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'wrangler.toml'), 'name = "my-worker"')
    const info = scanStack(testDir)
    expect(info.deployment).toBe('Cloudflare Workers')
  })

  it('detects Prisma from prisma/ directory', async () => {
    const { scanStack } = await import('../interactive.js')
    mkdirSync(join(testDir, 'prisma'))
    const info = scanStack(testDir)
    expect(info.database).toBe('Prisma ORM')
  })

  it('detects Supabase from @supabase/supabase-js in package.json', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({
      dependencies: { '@supabase/supabase-js': '^2.0.0' }
    }))
    const info = scanStack(testDir)
    expect(info.database).toBe('Supabase')
  })

  it('detects SvelteKit', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({ dependencies: { '@sveltejs/kit': '^2.0.0' } }))
    expect(scanStack(testDir).framework).toBe('SvelteKit')
  })

  it('detects Astro', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({ dependencies: { astro: '^4.0.0' } }))
    expect(scanStack(testDir).framework).toBe('Astro')
  })

  it('detects Fastify', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({ dependencies: { fastify: '^4.0.0' } }))
    expect(scanStack(testDir).framework).toBe('Fastify')
  })

  it('detects MongoDB from mongoose dep', async () => {
    const { scanStack } = await import('../interactive.js')
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({ dependencies: { mongoose: '^8.0.0' } }))
    expect(scanStack(testDir).database).toBe('MongoDB (Mongoose)')
  })
})

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
    const result = await buildInstallConfig()
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
    const result = await buildInstallConfig()
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
    const result = await buildInstallConfig()
    expect(result).toContain('22-ai-llm-security')
  })
})

// ── runInteractive ────────────────────────────────────────────────────────

describe('runInteractive', () => {
  it('calls runInstall with selected config', async () => {
    const { select, checkbox } = await import('@inquirer/prompts')
    const { runInteractive } = await import('../interactive.js')
    const installModule = await import('../install.js')

    vi.mocked(select).mockResolvedValue('cli')
    vi.mocked(checkbox)
      .mockResolvedValueOnce([]) // Q2
      .mockResolvedValueOnce([]) // Q3
      .mockResolvedValueOnce([]) // Q4
      .mockResolvedValueOnce([]) // Q5

    const mockPromptCats = vi.fn().mockResolvedValue(['01-secrets-management'])
    const mockPromptTools = vi.fn().mockResolvedValue(['antigravity'])
    const installSpy = vi.spyOn(installModule, 'runInstall').mockImplementation(() => {})
    const PACKAGE_ROOT_HERE = join(__dirname, '..')

    await runInteractive(testDir, PACKAGE_ROOT_HERE, {
      _promptCategories: mockPromptCats,
      _promptAITools: mockPromptTools,
    })

    expect(installSpy).toHaveBeenCalledWith(
      testDir,
      PACKAGE_ROOT_HERE,
      expect.objectContaining({ categories: expect.any(Array), aiTools: expect.any(Array) })
    )
  })

  it('exits 0 without calling runInstall when ExitPromptError thrown', async () => {
    const { select } = await import('@inquirer/prompts')
    const { runInteractive } = await import('../interactive.js')

    class ExitPromptError extends Error {
      constructor() { super('User force closed the prompt'); this.name = 'ExitPromptError' }
    }
    vi.mocked(select).mockRejectedValue(new ExitPromptError())

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {})
    await runInteractive(testDir, join(__dirname, '..'))
    expect(mockExit).toHaveBeenCalledWith(0)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('cancelled'))
  })

  it('exits 0 and prints nothing-to-install when promptCategories returns empty array', async () => {
    const { select, checkbox } = await import('@inquirer/prompts')
    const interactiveModule = await import('../interactive.js')

    vi.mocked(select).mockResolvedValue('cli')
    vi.mocked(checkbox)
      .mockResolvedValueOnce([]) // Q2
      .mockResolvedValueOnce([]) // Q3
      .mockResolvedValueOnce([]) // Q4
      .mockResolvedValueOnce([]) // Q5

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {})
    await interactiveModule.runInteractive(testDir, join(__dirname, '..'), {
      _promptCategories: vi.fn().mockResolvedValue([]),
    })
    expect(mockExit).toHaveBeenCalledWith(0)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('nothing to install'))
  })

  it('rethrows non-ExitPromptError errors', async () => {
    const { select } = await import('@inquirer/prompts')
    const { runInteractive } = await import('../interactive.js')

    const networkError = new Error('Network failure')
    vi.mocked(select).mockRejectedValue(networkError)

    await expect(runInteractive(testDir, join(__dirname, '..'))).rejects.toThrow('Network failure')
  })

  it('prints detected stack info in banner when stack is detected', async () => {
    const { select, checkbox } = await import('@inquirer/prompts')
    const interactiveModule = await import('../interactive.js')
    const installModule = await import('../install.js')

    writeFileSync(join(testDir, 'tsconfig.json'), '{}')
    writeFileSync(join(testDir, 'vercel.json'), '{}')

    vi.mocked(select).mockResolvedValue('web')
    vi.mocked(checkbox)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const installSpy = vi.spyOn(installModule, 'runInstall').mockImplementation(() => {})

    await interactiveModule.runInteractive(testDir, join(__dirname, '..'), {
      _promptCategories: vi.fn().mockResolvedValue(['01-secrets-management']),
      _promptAITools: vi.fn().mockResolvedValue([]),
    })

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('TypeScript'))
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Vercel'))
  })
})
