import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

import { createApp } from './index'

export default createApp({
  adapter: CloudflareAdapter,
}).compile()
