#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const result = spawnSync('bun', ['--version'], { stdio: 'ignore' })
if (result.status === 0) process.exit(0)

console.error('Bun is required for API runtime and monorepo tasks.')
console.error('Install Bun from https://bun.sh and retry the command.')
process.exit(1)
