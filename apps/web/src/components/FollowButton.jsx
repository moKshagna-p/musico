import { useState } from 'react'

import { toggleFollow } from '../services/socialService.js'

const FollowButton = ({ username, initialFollowing = false, onToggle }) => {
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading) return
    setLoading(true)

    // Optimistic update
    const prev = following
    setFollowing(!prev)

    try {
      const result = await toggleFollow(username)
      setFollowing(result.following)
      onToggle?.(result.following)
    } catch {
      setFollowing(prev)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-60 ${
        following
          ? 'border border-outline bg-transparent text-muted hover:border-red-400/50 hover:text-red-400'
          : 'bg-white text-canvas hover:opacity-90'
      }`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}

export default FollowButton
