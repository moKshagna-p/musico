export interface Track {
  id: string
  name: string
  duration_ms: number
  track_number: number
}

export interface Release {
  id: string
  name: string
  artists: string[]
  releaseDate: string | null
  releaseYear: number | null
  cover: string
  totalTracks: number
  albumType: string
  label?: string
  popularity: number
  external_urls: {
    discogs?: string
  }
  genres: string[]
  communityRating: number
  reviewCount: number
  tracks: Track[]
}
