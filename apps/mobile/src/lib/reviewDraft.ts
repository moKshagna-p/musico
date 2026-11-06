// The composer's state, and how an existing review becomes it. The API keeps one review per person per album and a
// save replaces it (text and attachments), so editing has to start from what is already saved.
export type Gif = { id: string; url: string; preview: string; width: number; height: number; title?: string }
export type Picked = { localId: string; uri: string; width: number; height: number; id?: string; status: 'uploading' | 'done' | 'error'; error?: string }
export type SavedMedia = { id?: string; kind?: string; url: string; width?: number; height?: number; alt?: string }
export type Draft = { content: string; images: Picked[]; gif: Gif | null }

export const EMPTY_DRAFT: Draft = { content: '', images: [], gif: null }

export const toDraft = (review: { content?: string | null; media?: SavedMedia[] } | null | undefined): Draft => {
  if (!review) return EMPTY_DRAFT
  const media = review.media ?? []
  // Saved images are already uploaded, so they go back as done with their ids and keep their place on save.
  const images: Picked[] = media
    .filter((item) => item.kind === 'image' && item.id)
    .map((item) => ({ localId: item.id!, id: item.id, uri: item.url, width: item.width ?? 1, height: item.height ?? 1, status: 'done' }))
  const saved = media.find((item) => item.kind === 'gif')
  const gif = saved ? { id: saved.id ?? saved.url, url: saved.url, preview: saved.url, width: saved.width ?? 1, height: saved.height ?? 1, title: saved.alt } : null
  return { content: review.content ?? '', images, gif }
}
