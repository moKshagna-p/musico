import { expect, test } from 'bun:test'

import {
  MAX_IDENTIFIER_LENGTH,
  readBoolean,
  readBoundedInteger,
  readIdentifier,
  readRating,
} from './validation'

test('readIdentifier rejects oversized and control-character identifiers', () => {
  expect(readIdentifier('r:123')).toBe('r:123')
  expect(readIdentifier(`r:${'1'.repeat(MAX_IDENTIFIER_LENGTH)}`)).toBeNull()
  expect(readIdentifier('r:\u0000123')).toBeNull()
})

test('readBoundedInteger only accepts integers within its declared bounds', () => {
  const bounds = { defaultValue: 20, min: 1, max: 50 }
  expect(readBoundedInteger(undefined, bounds)).toBe(20)
  expect(readBoundedInteger('24', bounds)).toBe(24)
  expect(readBoundedInteger('24.5', bounds)).toBeNull()
  expect(readBoundedInteger(51, bounds)).toBeNull()
})

test('request primitives do not coerce boolean or rating values', () => {
  expect(readBoolean(false)).toBe(false)
  expect(readBoolean('false')).toBeNull()
  expect(readRating(4.5)).toBe(4.5)
  expect(readRating('4.5')).toBe(4.5)
  expect(readRating({ value: 4.5 })).toBeNull()
})
