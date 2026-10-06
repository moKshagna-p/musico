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

const sanitizeChartLine = (value: string) =>
  normalizeWhitespace(decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')))

const chartElementPattern = (tag: string, className: string, captureContent = false) => {
  // HTML classes are whitespace-separated tokens, not substrings or exact attribute values.
  const space = '[\\t\\n\\f\\r ]'
  const classes = `(?:"(?:[^"]*${space})?${className}(?:${space}[^"]*)?"|'(?:[^']*${space})?${className}(?:${space}[^']*)?')`
  const openingTag = `<${tag}\\b[^>]*${space}class\\s*=\\s*${classes}[^>]*>`
  return new RegExp(openingTag + (captureContent ? `([\\s\\S]*?)<\\/${tag}>` : ''), 'i')
}

const rowPattern = chartElementPattern('div', 'chart-item')
const positionPattern = chartElementPattern('div', 'chart-item-position', true)
const headlinePattern = chartElementPattern('h2', 'chart-item-headline', true)
const subheadlinePattern = chartElementPattern('h3', 'chart-item-subheadline', true)

export const parseBillboard200Albums = (html: string, limit = 12): ChartAlbum[] => {
  // Scope fields to a chart row: historical positions and weeks are also numbers.
  const rows = html.split(rowPattern).slice(1)
  const entries: ChartAlbum[] = []
  const seenRanks = new Set<number>()

  for (const row of rows) {
    const position = row.match(positionPattern)?.[1]
    const headline = row.match(headlinePattern)?.[1]
    const subheadline = row.match(subheadlinePattern)?.[1]
    const rank = Number(position?.trim())
    const name = sanitizeChartLine(headline ?? '')
    const artist = sanitizeChartLine(subheadline ?? '')
    if (!Number.isInteger(rank) || rank < 1 || rank > 200 || seenRanks.has(rank) || !name || !artist) continue
    entries.push({ rank, name, artist })
    seenRanks.add(rank)
  }

  if (!entries.length) throw new Error('Billboard 200 chart returned no parsable albums.')
  return entries.sort((a, b) => a.rank - b.rank).slice(0, limit)
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
  return parseBillboard200Albums(html, limit)
}
