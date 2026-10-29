import { Elysia } from 'elysia'
import { activityRoutes } from './activity'
import { adminRoutes } from './admin'
import { albumRoutes } from './albums'
import { artistRoutes } from './artists'
import { cronRoutes } from './cron'
import { listRoutes } from './lists'
import { meRoutes } from './me'
import { mediaRoutes } from './media'
import { reviewRoutes } from './reviews'
import { searchRoutes } from './search'
import { userRoutes } from './users'

export const apiRoutes = new Elysia()
  .use(activityRoutes)
  .use(adminRoutes)
  .use(albumRoutes)
  .use(artistRoutes)
  .use(cronRoutes)
  .use(listRoutes)
  .use(meRoutes)
  .use(mediaRoutes)
  .use(reviewRoutes)
  .use(searchRoutes)
  .use(userRoutes)
