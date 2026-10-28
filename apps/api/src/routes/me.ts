import { Elysia } from 'elysia'
import { ensureAuthenticated, isAdminIdentity } from '../core/utils'
import { loadMyLists } from './lists'
import { loadMyRatings } from './users'

// Startup data for a signed-in user behind one session lookup, instead of one
// per /me/ratings, /me/lists and /admin/me.
export const meRoutes = new Elysia({ prefix: '/api' })
  .get('/me/bootstrap', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const [ratings, lists, isAdmin] = await Promise.all([
      loadMyRatings(authUser.id),
      loadMyLists(authUser.id),
      isAdminIdentity({ id: authUser.id }),
    ])

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data: { userId: authUser.id, ratings, lists, isAdmin } }
  })
