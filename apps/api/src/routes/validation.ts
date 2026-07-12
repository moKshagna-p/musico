const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

export const MAX_IDENTIFIER_LENGTH = 128
export const MAX_SEARCH_QUERY_LENGTH = 120

type IntegerBounds = {
  defaultValue: number
  min: number
  max: number
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const readBoundedText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (text.length > maxLength || CONTROL_CHARACTERS.test(text)) return null
  return text
}

export const readIdentifier = (value: unknown) => {
  const identifier = readBoundedText(value, MAX_IDENTIFIER_LENGTH)
  return identifier || null
}

export const readOptionalText = (value: unknown, maxLength: number) => {
  if (value === undefined) return undefined
  return readBoundedText(value, maxLength)
}

export const readBoundedInteger = (value: unknown, { defaultValue, min, max }: IntegerBounds) => {
  if (value === undefined || value === null || value === '') return defaultValue

  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN

  if (!Number.isSafeInteger(numeric) || numeric < min || numeric > max) return null
  return numeric
}

export const readTimestamp = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN

  if (!Number.isSafeInteger(numeric) || numeric < 0 || !Number.isFinite(new Date(numeric).getTime())) return undefined
  return numeric
}

export const readBoolean = (value: unknown) => (typeof value === 'boolean' ? value : null)

export const readRating = (value: unknown) => {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)
        ? Number(value)
        : Number.NaN
  return Number.isFinite(numeric) ? numeric : null
}

export const readArtists = (value: unknown) => {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 10) return null

  const artists: string[] = []
  for (const artist of value) {
    const normalized = readBoundedText(artist, 120)
    if (normalized === null) return null
    if (normalized) artists.push(normalized)
  }
  return artists.slice(0, 3)
}

export const readReleaseYear = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  const numeric = readBoundedInteger(value, { defaultValue: 0, min: 1, max: 3000 })
  return numeric === null ? null : numeric
}
