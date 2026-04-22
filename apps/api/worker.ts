import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

type CloudflareEnv = Record<string, string | undefined>

type WorkerApp = {
  fetch: (request: Request, env: CloudflareEnv, context: ExecutionContext) => Response | Promise<Response>
}

let app: WorkerApp | null = null

const applyBindingsToProcessEnv = (bindings: CloudflareEnv) => {
  const processEnv = process.env as Record<string, string | undefined>
  Object.entries(bindings).forEach(([key, value]) => {
    if (typeof value === 'string') processEnv[key] = value
  })
}

export default {
  async fetch(request: Request, env: CloudflareEnv, context: ExecutionContext) {
    applyBindingsToProcessEnv(env)

    if (!app) {
      const { createApp } = await import('./index')
      app = createApp({
        adapter: CloudflareAdapter,
      }).compile()
    }

    return app.fetch(request, env, context)
  },
}
