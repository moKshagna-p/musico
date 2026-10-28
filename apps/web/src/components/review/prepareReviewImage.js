// Shrinks a picked photo before upload so a 12MP phone shot becomes a few hundred KB.
// GIFs go up untouched to keep their animation.
const MAX_EDGE = 2048
const MAX_BYTES = 5 * 1024 * 1024

const toBlob = (canvas, type) => new Promise((resolve) => canvas.toBlob(resolve, type, 0.85))

export const prepareReviewImage = async (file) => {
  if (!file?.type?.startsWith('image/')) throw new Error('That file is not an image.')

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Unable to read that image.')
  })
  const { width, height } = bitmap

  if (file.type === 'image/gif') {
    bitmap.close()
    if (file.size > MAX_BYTES) throw new Error('GIFs can be up to 5MB.')
    return { blob: file, width, height }
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  // Safari can't encode WebP and hands back a PNG instead; JPEG keeps that small.
  let blob = await toBlob(canvas, 'image/webp')
  if (blob?.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg')
  if (!blob) throw new Error('Unable to read that image.')
  if (blob.size > MAX_BYTES) throw new Error('That image is too large.')
  return { blob, width: canvas.width, height: canvas.height }
}
