// Ratings are half-star steps from 0.5 to 5, so bucket i holds ratings of (i + 1) / 2.
export const ratingSpread = (ratings) => {
  const counts = Array(10).fill(0)
  for (const { rating } of ratings) {
    const step = Math.round(Number(rating) * 2)
    if (step >= 1 && step <= 10) counts[step - 1] += 1
  }
  return counts
}

const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

// Local-time calendar of the last 53 weeks: Sunday-first columns, the last one ending today.
// Steps with setDate rather than adding 24h so DST changes never skip or repeat a day.
export const listeningDiary = (ratings, now = new Date()) => {
  const perDay = new Map()
  for (const { timestamp } of ratings) {
    if (!timestamp) continue
    const key = dayKey(new Date(timestamp))
    perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = new Date(today)
  day.setDate(day.getDate() - day.getDay() - 52 * 7)

  const weeks = []
  let total = 0
  let activeDays = 0
  let streak = 0
  let longestStreak = 0
  for (; day <= today; day.setDate(day.getDate() + 1)) {
    if (day.getDay() === 0) weeks.push([])
    const count = perDay.get(dayKey(day)) ?? 0
    weeks.at(-1).push({ date: new Date(day), count })
    total += count
    if (count) activeDays += 1
    streak = count ? streak + 1 : 0
    longestStreak = Math.max(longestStreak, streak)
  }

  return { weeks, total, activeDays, longestStreak }
}
