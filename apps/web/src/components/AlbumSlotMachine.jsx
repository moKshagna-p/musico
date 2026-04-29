import { useEffect, useRef, useState } from 'react'
import { FiArrowRight, FiShuffle } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'

import CoverImage from './CoverImage.jsx'

const VISIBLE_ALBUM_COUNT = 8

const getAlbumAt = (albums, index) => {
  if (!albums.length) return null
  const normalizedIndex = ((index % albums.length) + albums.length) % albums.length
  return albums[normalizedIndex]
}

const AlbumSlotMachine = ({ albums = [] }) => {
  const navigate = useNavigate()
  const spinIntervalRef = useRef(null)
  const spinTimeoutRef = useRef(null)
  const safeAlbums = albums.filter((album) => album?.id)
  const [reelIndex, setReelIndex] = useState(0)
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [isSpinning, setIsSpinning] = useState(false)

  useEffect(
    () => () => {
      window.clearInterval(spinIntervalRef.current)
      window.clearTimeout(spinTimeoutRef.current)
    },
    [],
  )

  if (!safeAlbums.length) return null

  const currentAlbum = selectedAlbum && safeAlbums.some((album) => album.id === selectedAlbum.id)
    ? selectedAlbum
    : getAlbumAt(safeAlbums, reelIndex)
  const wheelSize = Math.min(VISIBLE_ALBUM_COUNT, safeAlbums.length)
  const wheelAlbums = Array.from({ length: wheelSize }, (_, index) => getAlbumAt(safeAlbums, reelIndex + index))
    .filter(Boolean)
  const artistName = currentAlbum?.artists?.[0] ?? 'Listen Later'

  const handleSpin = () => {
    if (isSpinning) return

    window.clearInterval(spinIntervalRef.current)
    window.clearTimeout(spinTimeoutRef.current)

    setSelectedAlbum(null)
    setIsSpinning(true)
    spinIntervalRef.current = window.setInterval(() => {
      setReelIndex((current) => current + 1)
    }, 72)

    const targetIndex = Math.floor(Math.random() * safeAlbums.length)
    spinTimeoutRef.current = window.setTimeout(() => {
      window.clearInterval(spinIntervalRef.current)
      setReelIndex(targetIndex)
      setSelectedAlbum(safeAlbums[targetIndex])
      setIsSpinning(false)
    }, 1280)
  }

  const handleOpenAlbum = () => {
    if (!currentAlbum?.id) return
    navigate(`/album/${currentAlbum.id}`)
  }

  return (
    <section className="relative isolate mt-14 overflow-hidden border-y border-outline/60 py-8 tablet:mt-16 tablet:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_34%_50%,rgba(255,255,255,0.08),rgba(0,0,0,0)_30%),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:auto,5rem_5rem]" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />

      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col gap-2 tablet:mb-6 tablet:flex-row tablet:items-end tablet:justify-between">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.46em] text-muted">Listen Later</p>
            <h2 className="mt-1 font-display text-3xl font-bold leading-none text-white tablet:text-5xl">
              The Listening Wheel
            </h2>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-muted">{safeAlbums.length} saved records</p>
        </div>

        <div className="grid items-center gap-5 overflow-hidden rounded-[2rem] border border-outline/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.012)_42%,rgba(0,0,0,0.36))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.42)] tablet:grid-cols-[20rem_1fr] tablet:p-5 desktop:grid-cols-[24rem_1fr]">
          <div className="relative h-[18.5rem] overflow-hidden rounded-[1.55rem] border border-white/10 bg-black/50 tablet:h-[20rem] desktop:h-[23rem]">
            <div className="absolute left-1/2 top-1/2 h-[14.25rem] w-[14.25rem] -translate-x-1/2 -translate-y-1/2 tablet:h-[15.75rem] tablet:w-[15.75rem] desktop:h-[18rem] desktop:w-[18rem]">
              <div className={`h-full w-full rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(255,255,255,0.26)_0_1px,transparent_2px_10px,rgba(255,255,255,0.1)_11px_12px,transparent_13px_24px,rgba(255,255,255,0.07)_25px_26px,transparent_27px_40px),conic-gradient(from_22deg,rgba(255,255,255,0.12),rgba(255,255,255,0.015)_14%,rgba(255,255,255,0.1)_28%,rgba(0,0,0,0)_52%,rgba(255,255,255,0.08)_72%,rgba(0,0,0,0)_100%)] shadow-[inset_0_0_60px_rgba(255,255,255,0.05),inset_0_0_0_1px_rgba(255,255,255,0.05),0_28px_72px_rgba(0,0,0,0.55)] transition duration-500 ${isSpinning ? 'animate-spin [animation-duration:0.78s]' : ''}`} />
            </div>
            <div className="absolute left-1/2 top-1/2 h-[9.5rem] w-[9.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(255,255,255,0.08)_0_1px,transparent_2px_18px),rgba(5,5,5,0.9)] tablet:h-[10.25rem] tablet:w-[10.25rem] desktop:h-[12rem] desktop:w-[12rem]" />
            <div className="pointer-events-none absolute right-8 top-7 z-50 h-28 w-px origin-top rotate-[35deg] bg-gradient-to-b from-white/55 to-transparent" />
            <div className="pointer-events-none absolute right-[4.15rem] top-[7rem] z-50 h-3 w-10 rotate-[35deg] rounded-full bg-white/15" />

            <div className={`absolute inset-0 transition duration-500 ${isSpinning ? 'animate-spin [animation-duration:0.95s]' : ''}`}>
              {wheelAlbums.map((album, index) => {
                const angle = ((index / wheelAlbums.length) * 360) - 90
                const radians = (angle * Math.PI) / 180
                const left = 50 + Math.cos(radians) * 34
                const top = 50 + Math.sin(radians) * 34

                return (
                  <button
                    key={`${album.id}-${index}`}
                    type="button"
                    onClick={() => {
                      setSelectedAlbum(album)
                      setReelIndex((current) => current + index)
                    }}
                    className={`absolute z-20 aspect-square h-[3.9rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-black p-0 shadow-[0_14px_34px_rgba(0,0,0,0.58)] transition duration-300 hover:z-30 hover:scale-110 hover:border-white/50 tablet:h-[4.45rem] desktop:h-[5.2rem] ${
                      album.id === currentAlbum?.id ? 'border-white/70 opacity-100' : 'border-white/12 opacity-70'
                    } ${isSpinning ? 'blur-[0.5px]' : 'blur-0'}`}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    aria-label={`Pick ${album.name}`}
                  >
                    <CoverImage src={album.cover} alt={album.name} className="block h-full w-full object-cover" />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
                  </button>
                )
              })}
            </div>

            <div className="absolute left-1/2 top-1/2 z-40 flex h-[7.8rem] w-[7.8rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black shadow-[0_0_0_0.65rem_rgba(255,255,255,0.035),0_22px_60px_rgba(0,0,0,0.65)] tablet:h-[8.5rem] tablet:w-[8.5rem] desktop:h-[9.8rem] desktop:w-[9.8rem]">
              <CoverImage
                src={currentAlbum?.cover}
                alt={currentAlbum?.name}
                className={`absolute inset-0 block h-full w-full object-cover opacity-[0.88] transition duration-500 ${isSpinning ? 'scale-[1.12] blur-[0.75px]' : 'scale-100 blur-0'}`}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_0_27%,rgba(0,0,0,0.2)_28%,rgba(0,0,0,0.72)_66%)]" />
              <span className="relative h-5 w-5 rounded-full border border-white/30 bg-black shadow-[0_0_22px_rgba(255,255,255,0.28)]" />
            </div>

            <button
              type="button"
              onClick={handleSpin}
              disabled={isSpinning}
              className="absolute bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/75 px-4 py-2.5 text-[0.62rem] font-bold uppercase tracking-[0.24em] text-white shadow-[0_16px_35px_rgba(0,0,0,0.45)] backdrop-blur transition hover:border-white/40 hover:bg-white hover:text-canvas disabled:cursor-wait disabled:opacity-60"
              aria-label="Spin listen later albums"
            >
              <FiShuffle className={isSpinning ? 'animate-spin' : ''} aria-hidden="true" />
              {isSpinning ? 'Picking' : 'Spin'}
            </button>

            <div className="pointer-events-none absolute bottom-4 right-4 z-50 rounded-full border border-white/10 bg-black/55 px-3 py-2 text-[0.6rem] font-bold uppercase tracking-[0.22em] text-muted backdrop-blur">
              <span className="text-white">{wheelSize}</span>
              <span className="mx-1">/</span>
              <span>{safeAlbums.length}</span>
            </div>
          </div>

          <div className="relative flex min-h-[15rem] flex-col justify-end overflow-hidden rounded-[1.55rem] border border-white/10 bg-black/48 p-5 tablet:min-h-[20rem] tablet:p-7 desktop:min-h-[23rem]">
            <CoverImage
              src={currentAlbum?.cover}
              alt=""
              className="absolute inset-0 block h-full w-full scale-110 object-cover opacity-[0.18] blur-2xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/86 to-black/25" />
            <div className="relative">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.42em] text-muted">Current Pull</p>
              <h3 className="mt-3 line-clamp-2 font-display text-3xl font-bold leading-[0.96] text-white tablet:text-5xl">
                {currentAlbum?.name ?? 'Waiting for a pick'}
              </h3>
              <p className="mt-3 line-clamp-1 text-sm text-muted tablet:text-base">{artistName}</p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleOpenAlbum}
                  disabled={!currentAlbum?.id || isSpinning}
                  className="inline-flex items-center gap-2 rounded-full border border-outline px-4 py-2.5 text-[0.65rem] uppercase tracking-[0.22em] text-muted transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Open Album
                  <FiArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AlbumSlotMachine
