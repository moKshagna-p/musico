#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const categoryDefinitions = [
  ['Security', /security|auth|session|permission|authorization|vulnerab|dependenc|credential|admin|rate.?limit|header|csp/i],
  ['Features', /^feat(\(.+\))?:/i],
  ['Reliability', /^(fix|perf)(\(.+\))?:|bug|reliab|stabil|error|cache/i],
  ['Maintenance', /^(chore|docs|refactor|test|ci|build)(\(.+\))?:/i],
]

const stripPrefix = (subject) => subject.replace(/^[a-z]+(\(.+\))?:\s*/i, '')

const compactSubjects = (commits) => {
  const subjects = [...new Set(commits.map(({ subject }) => stripPrefix(subject)))].filter(Boolean)
  const visible = subjects.slice(0, 2)
  const remaining = subjects.length - visible.length
  const summary = visible.join('; ')

  return remaining > 0 ? `${summary}; plus ${remaining} related change${remaining === 1 ? '' : 's'}` : summary
}

export const buildReleaseNotes = ({ base, head = 'HEAD', commits }) => {
  const releaseCommits = commits.filter(({ subject }) => !/^Merge (pull request|branch)\b/i.test(subject))
  const categories = new Map(categoryDefinitions.map(([name]) => [name, []]))
  const other = []

  for (const commit of releaseCommits) {
    const category = categoryDefinitions.find(([, pattern]) => pattern.test(commit.subject))?.[0]
    if (category) {
      categories.get(category).push(commit)
    } else {
      other.push(commit)
    }
  }

  const summaries = []

  for (const [category, entries] of categories) {
    if (entries.length) {
      summaries.push([category, entries])
    }
  }

  if (other.length) {
    summaries.push(['Additional updates', other])
  }

  while (summaries.length > 4) {
    const overflow = summaries.splice(3)
    summaries.push(['Additional updates', overflow.flatMap(([, entries]) => entries)])
  }

  const lines = [
    `## Release Summary - ${releaseCommits.length} commit${releaseCommits.length === 1 ? '' : 's'} since ${base || 'the previous commit'}`,
    '',
  ]

  if (summaries.length) {
    lines.push(...summaries.map(([category, entries]) => `- ${category}: ${compactSubjects(entries)}.`))
  } else {
    lines.push('- No code changes were detected for this release.')
  }

  // Keep generated notes to a heading plus no more than four scan-friendly bullets.
  return `${lines.join('\n')}\n`
}

const runGit = (gitArgs, fallback = '') => {
  try {
    return execFileSync('git', gitArgs, { encoding: 'utf8' }).trim()
  } catch {
    return fallback
  }
}

const parseArgs = () => {
  const args = new Map()
  for (let index = 2; index < process.argv.length; index += 2) {
    args.set(process.argv[index], process.argv[index + 1])
  }
  return args
}

const main = () => {
  const args = parseArgs()
  const base = args.get('--base')?.trim()
  const head = args.get('--head')?.trim() || 'HEAD'
  const out = args.get('--out')?.trim() || 'release-notes.md'
  const range = base ? `${base}..${head}` : `${head}^..${head}`
  const log = runGit(['log', '--pretty=format:%H%x09%s', range])
  const commits = log
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split('\t')
      return { hash, subject }
    })

  writeFileSync(out, buildReleaseNotes({ base, head, commits }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
