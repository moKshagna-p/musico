import { useEffect, useState } from 'react'

const artistQuotes = [
  { quote: 'Music is life itself.', artist: 'Louis Armstrong' },
  { quote: 'One good thing about music, when it hits you, you feel no pain.', artist: 'Bob Marley' },
  { quote: 'Music can change the world because it can change people.', artist: 'Bono' },
  { quote: 'A problem is a chance for you to do your best.', artist: 'Duke Ellington' },
  { quote: "I don't make music for eyes. I make music for ears.", artist: 'Adele' },
  { quote: 'If everything was perfect, you would never learn and you would never grow.', artist: 'Beyonce' },
  { quote: 'Lose yourself in the music, the moment.', artist: 'Eminem' },
  { quote: 'Music is like a dream. One that I cannot hear.', artist: 'Ludwig van Beethoven' },
  { quote: "Do not fear mistakes. There are none.", artist: 'Miles Davis' },
  { quote: 'If I cannot fly, let me sing.', artist: 'Stephen Sondheim' },
  { quote: 'Music can name the unnameable and communicate the unknowable.', artist: 'Leonard Bernstein' },
  { quote: "Music is enough for a lifetime, but a lifetime is not enough for music.", artist: 'Sergei Rachmaninoff' },
]

const Hero = () => {
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * artistQuotes.length))

  useEffect(() => {
    const interval = window.setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % artistQuotes.length)
    }, 7000)

    return () => window.clearInterval(interval)
  }, [])

  const quote = artistQuotes[quoteIndex]

  return (
    <section className="rounded-3xl border border-outline bg-panel px-5 py-10 shadow-panel tablet:px-10 tablet:py-14">
      <p className="text-xs uppercase tracking-[0.4em] text-muted">Listening Room</p>
      <h1 className="mt-4 font-display text-3xl leading-tight text-white tablet:text-4xl laptop:text-5xl">
        &ldquo;{quote.quote}&rdquo;
      </h1>
      <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted tablet:text-sm tablet:tracking-[0.4em]">— {quote.artist}</p>
    </section>
  )
}

export default Hero
