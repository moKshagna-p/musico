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
  const quote = artistQuotes[0]

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
