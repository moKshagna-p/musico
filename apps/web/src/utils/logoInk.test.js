import assert from 'node:assert/strict'
import test from 'node:test'

import { inkLogo } from './logoInk.js'

const pixels = (...colors) => new Uint8ClampedArray(colors.flat())
const alphas = (data) => [...data].filter((_, i) => i % 4 === 3)

test('two-tone logos keep their light letters and drop the dark outlines', () => {
  // White letter, black outline, a soft black edge, transparent background.
  const data = inkLogo(pixels([255, 255, 255, 255], [0, 0, 0, 255], [0, 0, 0, 255], [10, 10, 10, 90], [0, 0, 0, 0]))
  assert.deepEqual(alphas(data), [255, 0, 0, 0, 0])
  assert.deepEqual([...data.slice(0, 3)], [238, 234, 227])
})

test('drop shadows are dropped and colored ink keeps its shape', () => {
  // Yellow letters with a soft black shadow, like Nirvana's.
  assert.deepEqual(alphas(inkLogo(pixels([255, 230, 0, 255], [255, 230, 0, 200], [0, 0, 0, 100]))), [255, 200, 0])
})

test('all-black logos become a paper silhouette', () => {
  assert.deepEqual(alphas(inkLogo(pixels([0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 120], [0, 0, 0, 0]))), [255, 255, 120, 0])
})
