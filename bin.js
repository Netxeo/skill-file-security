#!/usr/bin/env node

import { main } from './install.js'

main().catch(err => {
  console.error('  ❌ Installation failed:', err.message)
  process.exit(1)
})
