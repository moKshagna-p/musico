import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

type CloudflareEnv = Record<string, string | undefined>

type WorkerApp = {
  fetch: (request: Request, env: CloudflareEnv, context: ExecutionContext) => Response | Promise<Response>
}

let app: WorkerApp | null = null

export default {
  async fetch(request: Request, env: CloudflareEnv, context: ExecutionContext) {
    ;(globalThis as unknown as { __MUSICO_WORKER_ENV__?: CloudflareEnv }).__MUSICO_WORKER_ENV__ = env

    if (!app) {
      const { createApp } = await import('./index')
      app = createApp({
        adapter: CloudflareAdapter,
      }).compile()
    }

    return app.fetch(request, env, context)
  },
}
