import { useEffect, useState } from 'react'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { FiCheck } from 'react-icons/fi'

import { toggleFollow } from '../../services/socialService.js'

const FollowButton = ({ username, initialFollowing = false, onToggle }) => {
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  // Sync with parent prop when it changes (e.g. after search re-fetch)
  useEffect(() => {
    setFollowing(initialFollowing)
  }, [initialFollowing])

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
    <Motion.button
      type="button"
      onClick={handleClick}
      disabled={loading}
      whileTap={{ scale: 0.94 }}
      aria-label={following ? `Unfollow ${username}` : `Follow ${username}`}
      className={`relative inline-flex items-center gap-2 overflow-hidden rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-60 ${
        following
          ? 'border border-white/15 bg-transparent text-paper/80 hover:border-red-400/50 hover:text-red-300'
          : 'bg-paper text-black hover:opacity-90'
      }`}
    >
      {/* The optimistic state shows right away; the label slides up to it. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <Motion.span
          key={following ? 'following' : 'follow'}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-1.5"
        >
          {following && <FiCheck aria-hidden="true" className="h-3.5 w-3.5" />}
          {following ? 'Following' : 'Follow'}
        </Motion.span>
      </AnimatePresence>
    </Motion.button>
  )
}

export default FollowButton
