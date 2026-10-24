import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { userProfileQueryOptions } from '../../queries/userProfile.js'

// Links to a user's profile and starts loading it on hover, focus or touch, so it usually opens from cache.
const ProfileLink = ({ username, className = '', onClick, children }) => {
  const queryClient = useQueryClient()
  if (!username) return <span className={className}>{children}</span>

  const prefetch = () => {
    void queryClient.prefetchQuery(userProfileQueryOptions(username))
  }

  return (
    <Link
      to={`/profile/${username}`}
      className={className}
      onClick={onClick}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
    >
      {children}
    </Link>
  )
}

export default ProfileLink
