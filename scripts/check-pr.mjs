#!/usr/bin/env node
// Checks a PR title and body against the style in .github/pull_request_template.md.
// Titles become commit subjects on main, and generate-release-notes.mjs groups them by type.
import { fileURLToPath } from 'node:url'

const TYPES = ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'ci', 'build', 'chore', 'revert']
const TITLE = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9-]+\\))?!?: \\S`)
const MAX_TITLE = 72
const MAX_BODY = 1500
const SECTIONS = ['Summary', 'Testing']

export const checkPr = ({ title = '', body = '' }) => {
  const errors = []
  title = title.trim()

  if (!TITLE.test(title)) errors.push(`Title must be "type(scope): subject", type one of: ${TYPES.join(', ')}.`)
  if (title.length > MAX_TITLE) errors.push(`Title is ${title.length} characters; keep it to ${MAX_TITLE}.`)
  if (/\.$/.test(title)) errors.push('Title must not end with a period.')
  if (/^[^:]+: [A-Z][a-z]/.test(title)) errors.push('Start the subject in lowercase.')

  const text = body.replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n/g, '\n').trim()
  if (text.length > MAX_BODY) errors.push(`Description is ${text.length} characters; keep it to ${MAX_BODY}.`)

  for (const name of SECTIONS) {
    const match = text.match(new RegExp(`^## ${name}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'))
    const content = match?.[1].replace(/^\s*-\s*$/gm, '').trim()
    if (!match) errors.push(`Add a "## ${name}" section.`)
    else if (!content) errors.push(`Fill in the "## ${name}" section.`)
  }

  return errors
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const errors = checkPr({ title: process.env.PR_TITLE, body: process.env.PR_BODY })
  for (const error of errors) console.log(`::error::${error}`)
  if (errors.length) process.exit(1)
  console.log('PR title and description follow the style.')
}
