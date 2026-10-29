import { expect, test } from 'bun:test'

import { findStreamingLinks, pickStreamingLinks } from './streamingLinks'

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })

test('keeps only album pages, one per platform, with Apple links free of a storefront', () => {
  expect(pickStreamingLinks([
    'https://shop.spotify.com/en-US/artist/1/product/vinyl',
    'https://itunes.apple.com/us/album/id1031530545',
    'https://open.spotify.com/album/7EGY16IWSHpPdoWazUyL9R',
    'https://open.spotify.com/album/second',
    'https://music.apple.com/gb/album/ok-computer/1097861387',
    'https://www.youtube.com/playlist?list=OLAK5uy_nc6afxSnmK8OFML8dF9q_0D1MBMXsGnL4',
    'https://www.amazon.com/gp/product/B071DTQH43',
    'https://music.amazon.com/albums/B071SGTLJ4',
    'https://www.deezer.com/album/11129996',
  ])).toEqual({
    spotify: 'https://open.spotify.com/album/7EGY16IWSHpPdoWazUyL9R',
    appleMusic: 'https://music.apple.com/album/1031530545',
    youtubeMusic: 'https://music.youtube.com/playlist?list=OLAK5uy_nc6afxSnmK8OFML8dF9q_0D1MBMXsGnL4',
    amazonMusic: 'https://music.amazon.com/albums/B071SGTLJ4',
  })
})

test('reads links from the album release group, not a same-titled single or tribute', async () => {
  const requested: string[] = []
  const fetcher = async (url: string) => {
    requested.push(url)
    if (url.includes('/release-group/?query=')) {
      return json({ 'release-groups': [
        { id: 'tribute', title: 'Rodeo', 'primary-type': 'Album', 'artist-credit': [{ name: 'Travis Scott Tribute' }] },
        { id: 'single', title: 'Rodeo', 'primary-type': 'Single', 'artist-credit': [{ name: 'Travis Scott' }] },
        { id: 'album', title: 'Rodeo (Expanded)', 'primary-type': 'Album', 'artist-credit': [{ name: 'Travis Scott' }] },
      ] })
    }
    if (url.includes('release-group=album')) {
      return json({ releases: [{ relations: [{ url: { resource: 'https://open.spotify.com/album/abc' } }] }, { relations: [] }] })
    }
    return new Response('not found', { status: 404 })
  }

  expect(await findStreamingLinks('Travis Scott', 'Rodeo', fetcher)).toEqual({ spotify: 'https://open.spotify.com/album/abc' })
  // A second visit is served from memory.
  expect(await findStreamingLinks('Travis Scott', 'Rodeo', fetcher)).toEqual({ spotify: 'https://open.spotify.com/album/abc' })
  expect(requested).toHaveLength(2)
})
