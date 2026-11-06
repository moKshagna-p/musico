import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

// The same maths as the web profile, shared rather than copied.
import { listeningDiary, pickTopArtist, ratingSpread } from '../../../web/src/services/ratingInsights.js'
import { ArtistName, Display, Muted, T } from './kit'
import { useReveal } from './scroll'
import { colors, display } from './theme'

type Rated = { albumId: string; rating: number; timestamp: number; artists?: string[]; genres?: string[] }

const SectionTitle = ({ title, note }: { title: string; note: string }) => (
  <View>
    <Display size={30}>{title}</Display>
    <Muted style={{ marginTop: 8, minHeight: 20 }}>{note}</Muted>
  </View>
)

// Albums rated, average, and the artist your recent ratings liked most, set in their wordmark when there is one.
export const Stats = ({ recent, totalRated, averageRating }: { recent: Rated[]; totalRated: number; averageRating: number }) => {
  const top = useMemo(() => pickTopArtist(recent) ?? 'N/A', [recent])
  const items = [
    { label: 'Albums rated', value: String(totalRated) },
    { label: 'Average rating', value: averageRating.toFixed(2) },
    { label: 'Recent top artist', value: top },
  ]
  return (
    <View style={styles.stats}>
      {items.map((item, index) => (
        <View key={item.label} style={[styles.stat, index > 0 && styles.statDivider]}>
          {item.label === 'Recent top artist' && top !== 'N/A' ? (
            <ArtistName artists={[top]} logoHeight={48} style={display(48)} />
          ) : (
            <T numberOfLines={1} adjustsFontSizeToFit style={display(48)}>{item.value}</T>
          )}
          <Muted style={{ marginTop: 8 }}>{item.label}</Muted>
        </View>
      ))}
    </View>
  )
}

const GenreBar = ({ share, shown }: { share: number; shown: SharedValue<number> }) => {
  const fill = useAnimatedStyle(() => ({ width: `${share * 100 * shown.value}%` }))
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fill]} />
    </View>
  )
}

export const TopGenres = ({ recent }: { recent: Rated[] }) => {
  const { shown, ref, onLayout } = useReveal(800)
  const top = useMemo(() => {
    const counts: Record<string, number> = {}
    recent.forEach((album) => (album.genres ?? []).forEach((genre) => (counts[genre] = (counts[genre] ?? 0) + 1)))
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5)
  }, [recent])
  const max = top[0]?.[1] ?? 1
  return (
    <View ref={ref} onLayout={onLayout} style={{ marginVertical: 56, gap: 24 }}>
      <SectionTitle title="Recent Top Genres" note="From your latest ratings." />
      <View style={{ gap: 12 }}>
        {top.map(([genre, count]) => (
          <View key={genre} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <T numberOfLines={1} style={{ width: 120, fontSize: 14 }}>{genre}</T>
            <GenreBar share={count / max} shown={shown} />
            <Muted style={{ width: 24, textAlign: 'right' }}>{count}</Muted>
          </View>
        ))}
        {!top.length ? <Muted>No genres yet. Rate a few albums to see your mix.</Muted> : null}
      </View>
    </View>
  )
}

const LABELS = ['½', '1', '1½', '2', '2½', '3', '3½', '4', '4½', '5']
const stars = (index: number) => `${LABELS[index]} ${index > 1 ? 'stars' : 'star'}`
const verdictFor = (average: number) => (average >= 4 ? 'Easy to please.' : average >= 3 ? 'Fair, but firm.' : 'Hard to impress.')

// Bars grow up from the baseline, staggered, the first time they scroll in. Tapping a bar pins its count.
const SpreadBar = ({ height, index, active, shown }: { height: number; index: number; active: boolean; shown: SharedValue<number> }) => {
  const grow = useAnimatedStyle(() => {
    const local = Math.min(1, Math.max(0, (shown.value * 1.4 - index * 0.04) / 1))
    return { transform: [{ scaleY: local }] }
  })
  return (
    <View style={styles.barBox}>
      <Animated.View style={[styles.bar, { height: `${height * 100}%`, backgroundColor: active ? colors.paper : 'rgba(238,234,227,0.2)', transformOrigin: 'bottom' }, grow]} />
    </View>
  )
}

export const RatingSpread = ({ ratings, averageRating }: { ratings: Rated[]; averageRating: number }) => {
  const { shown, ref, onLayout } = useReveal(900)
  const counts: number[] = useMemo(() => ratingSpread(ratings), [ratings])
  const total = counts.reduce((sum, count) => sum + count, 0)
  const max = Math.max(...counts)
  const mode = max ? counts.indexOf(max) : -1
  const [pinned, setPinned] = useState<number | null>(null)
  const active = pinned ?? mode

  let note = 'Rate a few albums to see how you score.'
  if (total && pinned === null) note = `${verdictFor(averageRating)} Mostly ${stars(mode)}.`
  else if (total) note = `${counts[active]} ${counts[active] === 1 ? 'album' : 'albums'} at ${stars(active)}, ${Math.round((counts[active] / total) * 100)}% of your ratings.`

  return (
    <View ref={ref} onLayout={onLayout} style={{ marginVertical: 56, gap: 24 }}>
      <SectionTitle title="Rating Spread" note={note} />
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {counts.map((count, index) => {
          const isActive = total > 0 && index === active
          return (
            <Pressable
              key={LABELS[index]}
              disabled={!total}
              onPress={() => setPinned((current) => (current === index ? null : index))}
              accessibilityLabel={`${stars(index)}: ${count} ${count === 1 ? 'album' : 'albums'}`}
              style={{ flex: 1, alignItems: 'center', gap: 8 }}
            >
              <T style={{ height: 16, fontSize: 12, color: isActive ? colors.paper : 'transparent' }}>{count}</T>
              <SpreadBar height={max ? count / max : 0} index={index} active={isActive} shown={shown} />
              <T style={{ fontSize: 12, color: isActive ? colors.paper : colors.muted }}>{LABELS[index]}</T>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const LEVELS = ['rgba(255,255,255,0.06)', 'rgba(238,234,227,0.25)', 'rgba(238,234,227,0.5)', 'rgba(238,234,227,0.75)', colors.paper]
// Phones show the last half year so each day stays big enough to tap, as on the web.
const PHONE_WEEKS = 26
const monthFormat = new Intl.DateTimeFormat('en', { month: 'short' })
const dayFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

export const ListeningDiary = ({ ratings }: { ratings: Rated[] }) => {
  const diary = useMemo(() => listeningDiary(ratings), [ratings])
  const weeks: { date: Date; count: number }[][] = diary.weeks.slice(-PHONE_WEEKS)
  const today = weeks.at(-1)?.at(-1)
  const [pinned, setPinned] = useState<{ date: Date; count: number } | null>(null)
  const label = pinned ? `${pinned.count ? `${pinned.count} ${pinned.count === 1 ? 'rating' : 'ratings'}` : 'No ratings'}${pinned === today ? ' today' : ` on ${dayFormat.format(pinned.date)}`}` : 'Tap a day to see what you rated.'

  return (
    <View style={{ marginTop: 96, gap: 24 }}>
      <View>
        <Display size={30}>Listening Diary</Display>
        <Muted style={{ marginTop: 8 }}>{diary.total === 1 ? '1 record' : `${diary.total} records`} rated in the past year.</Muted>
        <View style={{ marginTop: 24, flexDirection: 'row', gap: 32 }}>
          {[{ label: 'Active days', value: diary.activeDays }, { label: 'Longest streak', value: diary.longestStreak }].map((figure) => (
            <View key={figure.label}>
              <T style={display(36)}>{figure.value}</T>
              <Muted style={{ marginTop: 4, fontSize: 12 }}>{figure.label}</Muted>
            </View>
          ))}
        </View>
      </View>
      <View>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {weeks.map((week, weekIndex) => (
            <View key={week[0].date.getTime()} style={{ flex: 1, gap: 3 }}>
              <T numberOfLines={1} style={{ height: 16, fontSize: 9, color: colors.muted, width: 40 }}>
                {week[0].date.getDate() <= 7 && weekIndex < weeks.length - 2 ? monthFormat.format(week[0].date) : ''}
              </T>
              {week.map((entry, dayIndex) => (
                <Pressable
                  key={dayIndex}
                  onPress={() => setPinned((current) => (current === entry ? null : entry))}
                  accessibilityLabel={`${entry.date.toDateString()}: ${entry.count} ratings`}
                  style={[
                    styles.day,
                    { backgroundColor: LEVELS[Math.min(entry.count, 4)] },
                    entry === pinned ? styles.dayPinned : entry === today ? styles.dayToday : null,
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
        <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Animated.View key={label} entering={FadeIn.duration(200)} style={{ flex: 1 }}>
            <Muted style={{ fontSize: 12, color: pinned ? colors.paper : colors.muted }}>{label}</Muted>
          </Animated.View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Muted style={{ fontSize: 10 }}>Less</Muted>
            {LEVELS.map((level) => <View key={level} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: level }} />)}
            <Muted style={{ fontSize: 10 }}>More</Muted>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stats: { marginVertical: 56, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  stat: { paddingVertical: 32, paddingHorizontal: 4 },
  statDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: 'rgba(238,234,227,0.8)' },
  barBox: { width: '100%', height: 128, justifyContent: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  day: { aspectRatio: 1, width: '100%', borderRadius: 3 },
  dayToday: { borderWidth: 1, borderColor: 'rgba(238,234,227,0.4)' },
  dayPinned: { borderWidth: 1, borderColor: colors.paper },
})
