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
    auth:         ['04-auth-sessions', '06-jwt-security'],
    database:     ['07-database-security', '13-race-conditions'],
    fileUpload:   ['14-file-upload'],
    payments:     ['06-jwt-security', '07-database-security', '13-race-conditions'],
    externalApis: ['02-network-protection', '11-advanced-attacks'],
    graphql:      ['10-protocols'],
    ai:           ['22-ai-llm-security'],
    browserApis:  ['24-browser-apis'],
  },
  compliance: {
    gdpr:  ['18-compliance-gdpr'],
    hipaa: ['18-compliance-gdpr'],
    pci:   ['18-compliance-gdpr', '06-jwt-security', '07-database-security'],
  },
  hardening: {
    supplyChain:     ['16-supply-chain'],
    botDdos:         ['23-bot-ddos'],
    monitoring:      ['19-monitoring-detection'],
    advancedAttacks: ['11-advanced-attacks'],
    dnsEmail:        ['15-dns-email'],
  },
}

// ── scanStack ────────────────────────────────────────────────────────────────

export function scanStack(targetDir) {
  const info = { language: 'Unknown', framework: null, database: null, deployment: null, aiTools: [] }

  // Detect language from tsconfig.json independent of package.json
  if (existsSync(join(targetDir, 'tsconfig.json'))) {
    info.language = 'TypeScript / Node.js'
  }

  const pkgPath = join(targetDir, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (deps.typescript || deps['ts-node']) {
        info.language = 'TypeScript / Node.js'
      } else if (info.language === 'Unknown') {
        info.language = 'JavaScript / Node.js'
      }
      if (deps.next)               info.framework = `Next.js ${(deps.next || '').replace(/^[\^~>=<\s]+/, '')}`
      else if (deps.nuxt)          info.framework = 'Nuxt.js'
      else if (deps['@sveltejs/kit']) info.framework = 'SvelteKit'
      else if (deps.astro)         info.framework = 'Astro'
      else if (deps.express)       info.framework = 'Express'
      else if (deps.fastify)       info.framework = 'Fastify'
      if (deps['@supabase/supabase-js']) info.database = 'Supabase'
      else if (deps.mongoose)      info.database = 'MongoDB (Mongoose)'
    } catch { /* malformed package.json — skip */ }
  }

  // Detect database from directory markers independent of package.json
  if (!info.database) {
    if (existsSync(join(targetDir, 'supabase')))   info.database = 'Supabase'
    else if (existsSync(join(targetDir, 'prisma'))) info.database = 'Prisma ORM'
  }

  if (existsSync(join(targetDir, 'vercel.json')))       info.deployment = 'Vercel'
  else if (existsSync(join(targetDir, 'netlify.toml')))  info.deployment = 'Netlify'
  else if (existsSync(join(targetDir, 'Dockerfile')))    info.deployment = 'Docker'
  else if (existsSync(join(targetDir, 'wrangler.toml'))) info.deployment = 'Cloudflare Workers'

  info.aiTools = detectAI(targetDir)
  return info
}

// ── mapAnswersToCategories ───────────────────────────────────────────────────

export function mapAnswersToCategories(answers) {
  const cats = new Set([...ALWAYS_ON, ...ALWAYS_SILENT])

  const add = (list) => list?.forEach(cat => cats.add(cat))

  add(QUESTION_MAPPINGS.projectType[answers.projectType])
  for (const key of answers.infrastructure ?? []) add(QUESTION_MAPPINGS.infrastructure[key])
  for (const key of answers.features       ?? []) add(QUESTION_MAPPINGS.features[key])
  for (const key of answers.compliance     ?? []) add(QUESTION_MAPPINGS.compliance[key])
  for (const key of answers.hardening      ?? []) add(QUESTION_MAPPINGS.hardening[key])

  return [...cats].sort()
}

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

  return await checkbox({
    message: '🤖 Configure AI tools?  (detected tools are pre-selected)',
    choices,
  })
}

// ── buildInstallConfig ────────────────────────────────────────────────────────

export async function buildInstallConfig() {
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
      { value: 'hosting',    name: 'Standard hosting / cloud VM' }, // maps to baseline only — no extra categories
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

export async function runInteractive(
  targetDir,
  sourceDir,
  { _promptCategories = promptCategories, _promptAITools = promptAITools } = {},
) {
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

    const suggested  = await buildInstallConfig()
    const categories = await _promptCategories(suggested)

    // Defensive guard: in normal flow promptCategories always returns ≥10 categories.
    // This can only be reached if promptCategories is replaced via the injection parameter.
    if (categories.length === 0) {
      console.log('\nNo categories selected — nothing to install.')
      process.exit(0)
      return
    }

    const aiTools = await _promptAITools(detectAI(targetDir))

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
      return
    }
    throw err
  }
}
