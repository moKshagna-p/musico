import { expect, test } from 'bun:test'

import { parseBillboard200Albums } from './charts'

const savedChart = await Bun.file(new URL('./fixtures/billboard-200.html', import.meta.url)).text()

test('parses saved chart rows even when row and field classes gain extra tokens', () => {
  const expected = [
    { rank: 1, name: 'Bass Persuades', artist: 'Miley' },
    { rank: 2, name: 'Dandelion', artist: 'Ella Langley' },
    { rank: 3, name: "That's Just Me", artist: 'Riley Green' },
  ]
  expect(parseBillboard200Albums(savedChart)).toEqual(expected)
  for (const quote of ['"', "'"]) {
    for (const [before, after] of [['', ' highlighted'], ['layout ', ''], ['layout\t', '\n highlighted']]) {
      const html = savedChart.replace(/class="(chart-item(?:-position|-headline|-subheadline)?)"/g,
        (_, className) => `class = ${quote}${before}${className}${after}${quote}`)
      expect(parseBillboard200Albums(html)).toEqual(expected)
    }
  }
})

test('class name substrings and data attributes do not count as chart classes', () => {
  const fakeRow = row(1, 'Wrong album', 'Wrong artist', 1).replace('class="chart-item"', 'class="chart-item-wrapper"')
  const fakeField = row(2, 'Wrong album', 'Wrong artist', 1).replace('class="chart-item-headline"', 'data-class="chart-item-headline"')
  const prefixedField = row(3, 'Wrong album', 'Wrong artist', 1).replace('class="chart-item-headline"', 'class="other-chart-item-headline"')
  expect(parseBillboard200Albums(fakeRow + fakeField + prefixedField + row(4, 'Album', 'Artist', 10))).toEqual([
    { rank: 4, name: 'Album', artist: 'Artist' },
  ])
})

const row = (rank: number, name: string, artist: string, weeks: number) => `
  <div class="chart-item" id="song-${rank}">
    <div class="chart-item-position">${rank}</div>
    <h2 class="chart-item-headline">${name}</h2>
    <h3 class="chart-item-subheadline">${artist}</h3>
    <div class="chart-item-last-week">2</div>
    <div class="chart-item-peak-pos">1</div>
    <div class="chart-item-weeks-on">${weeks}</div>
  </div>`

test('chart ranks come from row positions rather than historical statistics', () => {
  const html = row(1, 'Dandelion', 'Ella Langley', 24)
    + row(2, 'That&#39;s Just Me', 'Riley Green', 71)
    + row(3, '21', 'Adele', 15)
  expect(parseBillboard200Albums(html)).toEqual([
    { rank: 1, name: 'Dandelion', artist: 'Ella Langley' },
    { rank: 2, name: "That's Just Me", artist: 'Riley Green' },
    { rank: 3, name: '21', artist: 'Adele' },
  ])
  expect(parseBillboard200Albums(html, 2)).toHaveLength(2)
})

test('an incomplete chart response fails instead of producing unrelated page text', () => {
  expect(() => parseBillboard200Albums('<div>1</div><h2>News</h2><h3>Author</h3>')).toThrow()
  expect(() => parseBillboard200Albums('<div class="chart-item"><div class="chart-item-position">1</div></div>')).toThrow()
})
