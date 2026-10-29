// CD faces (TheAudioDB, fanart.tv) are transparent PNGs of the whole disc: scaled up a touch to crop the clear outer
// rim, on black so the clear hub reads as the spindle hole. Their hosts block cross-origin reads, so no color sampling.
export const isCdArt = (url) => /\/cdart\//.test(url ?? '')
export const CD_ART_CLASS = 'scale-[1.04] bg-black'
