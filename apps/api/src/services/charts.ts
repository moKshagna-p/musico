const BILLBOARD_200_URL = 'https://ca.billboard.com/charts/billboard-200'

export interface ChartAlbum {
  rank: number
  name: string
  artist: string
}

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

const normalizeWhitespace = (value = '') => value.replace(/\s+/g, ' ').trim()

const isNumericLine = (value: string) => /^\d+$/.test(value)

const isChartMetaLine = (value: string) => {
  const normalized = value.toLowerCase()
  return (
    !normalized ||
    normalized === 'new' ||
    normalized === '-' ||
    normalized === 'awards' ||
    normalized === 'this' ||
    normalized === 'week' ||
    normalized === 'last' ||
    normalized === 'peak' ||
    normalized === 'pos.' ||
    normalized === 'pos' ||
    normalized === 'wks on' ||
    normalized === 'chart' ||
    normalized === 'see full chart here' ||
    normalized === 'advertisement' ||
    isNumericLine(value)
  )
}

const sanitizeChartLine = (value: string) => normalizeWhitespace(decodeHtmlEntities(value))

const extractTextLines = (html: string) =>
  decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|section|article|li|tr|td|h1|h2|h3|h4|h5|h6)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .split('\n')
    .map(sanitizeChartLine)
    .filter(Boolean)

const findChartStartIndex = (lines: string[]) => {
  const wksOnChartIndex = lines.findIndex((line, index) => line === 'WKS ON' && lines[index + 1] === 'CHART')
  if (wksOnChartIndex >= 0) return wksOnChartIndex + 2

  const billboardIndex = lines.findIndex((line) => line === 'Billboard 200')
  if (billboardIndex >= 0) {
    const firstRankIndex = lines.findIndex((line, index) => index > billboardIndex && line === '1')
    if (firstRankIndex >= 0) return firstRankIndex
  }

  return lines.findIndex((line) => line === '1')
}

export const fetchBillboard200Albums = async (limit = 12) => {
  const response = await fetch(BILLBOARD_200_URL, {
    headers: {
      'User-Agent': 'musico/1.0 (+https://musico.local)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`Billboard chart request failed: ${response.status}`)
  }

  const html = await response.text()
  const lines = extractTextLines(html)
  const startIndex = findChartStartIndex(lines)

  if (startIndex < 0) {
    throw new Error('Unable to parse Billboard 200 chart entries.')
  }

  const entries: ChartAlbum[] = []
  const seenRanks = new Set<number>()

  for (let index = startIndex; index < lines.length && entries.length < limit; index += 1) {
    const line = lines[index]
    if (!isNumericLine(line)) continue

    const rank = Number.parseInt(line, 10)
    if (!Number.isFinite(rank) || rank < 1 || rank > 200 || seenRanks.has(rank)) continue

    let cursor = index + 1
    while (cursor < lines.length && isChartMetaLine(lines[cursor])) cursor += 1

    const name = lines[cursor]
    if (!name || isChartMetaLine(name)) continue

    cursor += 1
    while (cursor < lines.length && isChartMetaLine(lines[cursor])) cursor += 1

    const artist = lines[cursor]
    if (!artist || isChartMetaLine(artist)) continue

    entries.push({
      rank,
      name,
      artist,
    })
    seenRanks.add(rank)
    index = cursor
  }

  if (!entries.length) {
    throw new Error('Billboard 200 chart returned no parsable albums.')
  }

  return entries
}
