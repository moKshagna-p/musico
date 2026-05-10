#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1])
}

const base = args.get('--base')?.trim()
const head = args.get('--head')?.trim() || 'HEAD'
const out = args.get('--out')?.trim() || 'release-notes.md'

const runGit = (gitArgs, fallback = '') => {
  try {
    return execFileSync('git', gitArgs, { encoding: 'utf8' }).trim()
  } catch {
    return fallback
  }
}

const range = base ? `${base}..${head}` : `${head}^..${head}`
const log = runGit(['log', '--pretty=format:%H%x09%s%x09%an', range])
const changedFiles = runGit(['diff', '--name-only', range])
const commits = log
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [hash, subject, author] = line.split('\t')
    return { hash, subject, author }
  })

const groups = [
  ['Features', /^feat(\(.+\))?:/i],
  ['Fixes', /^fix(\(.+\))?:/i],
  ['Performance', /^perf(\(.+\))?:/i],
  ['Maintenance', /^(chore|docs|refactor|test|ci|build)(\(.+\))?:/i],
]

const stripPrefix = (subject) => subject.replace(/^[a-z]+(\(.+\))?:\s*/i, '')
const sectionFor = (commit) => groups.find(([, pattern]) => pattern.test(commit.subject))?.[0] ?? 'Other'
const bySection = new Map(groups.map(([label]) => [label, []]))
bySection.set('Other', [])

for (const commit of commits) {
  bySection.get(sectionFor(commit)).push(commit)
}

const fileList = changedFiles
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

const lines = [
  '## What Changed',
  '',
]

for (const [section, entries] of bySection.entries()) {
  if (!entries.length) continue
  lines.push(`### ${section}`, '')
  for (const entry of entries) {
    lines.push(`- ${stripPrefix(entry.subject)} (${entry.hash.slice(0, 7)}, ${entry.author})`)
  }
  lines.push('')
}

if (!commits.length) {
  lines.push('- No commit changes were detected for this release.', '')
}

if (fileList.length) {
  lines.push('## Files Changed', '')
  for (const file of fileList.slice(0, 30)) {
    lines.push(`- \`${file}\``)
  }
  if (fileList.length > 30) {
    lines.push(`- ...and ${fileList.length - 30} more files`)
  }
  lines.push('')
}

lines.push('## Compare Range', '')
lines.push(`\`${range}\``)
lines.push('')

writeFileSync(out, `${lines.join('\n').trim()}\n`)
