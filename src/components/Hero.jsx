import { useMemo } from 'react'
import { Link } from 'react-router-dom'

const artistQuotes = [
  { quote: 'Music is life itself.', artist: 'Louis Armstrong' },
  { quote: 'One good thing about music, when it hits you, you feel no pain.', artist: 'Bob Marley' },
  { quote: 'Music can change the world because it can change people.', artist: 'Bono' },
  { quote: 'Music is the strongest form of magic.', artist: 'Marilyn Manson' },
  { quote: "I don't make music for eyes. I make music for ears.", artist: 'Adele' },
  { quote: 'If everything was perfect, you would never learn and you would never grow.', artist: 'Beyoncé' },
  { quote: 'Lose yourself in the music, the moment.', artist: 'Eminem' },
  { quote: 'Music is like a dream. One that I cannot hear.', artist: 'Ludwig van Beethoven' }
]

const Hero = () => {
  const randomQuote = useMemo(() => artistQuotes[Math.floor(Math.random() * artistQuotes.length)], [])

  return (
    <section className="rounded-3xl border border-outline bg-panel px-6 py-14 shadow-panel tablet:px-10">
      <p className="text-xs uppercase tracking-[0.4em] text-muted">Listening Room</p>
      <h1 className="mt-4 font-display text-4xl text-white laptop:text-5xl">
        &ldquo;{randomQuote.quote}&rdquo;
      </h1>
      <p className="mt-2 text-sm uppercase tracking-[0.4em] text-muted">— {randomQuote.artist}</p>
      <div className="mt-6 flex gap-4 text-xs uppercase tracking-[0.4em]">
        <Link
          to="/discover"
          className="rounded-full border border-outline px-6 py-3 text-white transition hover:bg-white/5"
        >
          Discover
        </Link>
        <Link
          to="/discover?sort=rating"
          className="rounded-full border border-outline px-6 py-3 text-muted transition hover:text-white"
        >
          Highest Rated
        </Link>
      </div>
    </section>
  )
}

export default Hero
