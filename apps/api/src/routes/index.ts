import { Elysia } from 'elysia'
import { activityRoutes } from './activity'
import { adminRoutes } from './admin'
import { albumRoutes } from './albums'
import { cronRoutes } from './cron'
import { listRoutes } from './lists'
import { reviewRoutes } from './reviews'
import { searchRoutes } from './search'
import { userRoutes } from './users'

export const apiRoutes = new Elysia()
  .use(activityRoutes)
  .use(adminRoutes)
  .use(albumRoutes)
  .use(cronRoutes)
  .use(listRoutes)
  .use(reviewRoutes)
  .use(searchRoutes)
  .use(userRoutes)

export {
  activityRoutes,
  adminRoutes,
  albumRoutes,
  cronRoutes,
  listRoutes,
  reviewRoutes,
  searchRoutes,
  userRoutes,
}
