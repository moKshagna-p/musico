import assert from 'node:assert/strict'
import test from 'node:test'
import { checkPr } from './check-pr.mjs'

const body = '## Summary\n- Retry follow buttons after a network error.\n\n## Testing\n- `bun run test`: 83 pass.\n'

test('accepts a conventional title and a filled-in template', () => {
  assert.deepEqual(checkPr({ title: 'fix(mobile): retry follow buttons', body }), [])
  assert.deepEqual(checkPr({ title: 'feat!: drop the v1 API', body: `<!-- hint -->\n${body}` }), [])
})

test('rejects titles that break the convention', () => {
  for (const title of ['Faster releases and E2E', 'fix: Retry buttons', 'fix: retry buttons.', `feat: ${'a'.repeat(70)}`, 'feature: x']) {
    assert.ok(checkPr({ title, body }).length, title)
  }
})

test('rejects missing, empty, or oversized sections', () => {
  const title = 'docs: tidy readme'
  assert.ok(checkPr({ title, body: '' }).some((e) => e.includes('## Summary')))
  assert.ok(checkPr({ title, body: '## Summary\n- x\n\n## Testing\n-\n' }).some((e) => e.includes('Fill in the "## Testing"')))
  assert.ok(checkPr({ title, body: '## Summary\n<!-- hint -->\n-\n\n## Testing\n- ok' }).some((e) => e.includes('Fill in the "## Summary"')))
  assert.ok(checkPr({ title, body: `${body}${'x'.repeat(1500)}` }).some((e) => e.includes('keep it to 1500')))
})

test('a comment that only remains after stripping another is still removed', () => {
  const nested = '## Summary\n<!<!---->-- hint -->\n\n## Testing\n- ok'
  assert.ok(checkPr({ title: 'docs: tidy readme', body: nested }).some((e) => e.includes('Fill in the "## Summary"')))
})
