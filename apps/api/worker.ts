type CloudflareEnv = Record<string, string | undefined>

type WorkerApp = {
  fetch: (request: Request, env: CloudflareEnv, context: ExecutionContext) => Response | Promise<Response>
}

let app: WorkerApp | null = null

export default {
  async fetch(request: Request, env: CloudflareEnv, context: ExecutionContext) {
    try {
      ;(globalThis as unknown as { __MUSICO_WORKER_ENV__?: CloudflareEnv }).__MUSICO_WORKER_ENV__ = env

      if (!app) {
        const { createApp } = await import('./src/index')
        app = createApp({
          aot: false,
        }).compile()
      }

      return app.fetch(request, env, context)
    } catch (error) {
      console.error('[worker] unhandled', error)
      return Response.json(
        {
          error: 'Worker startup failed.',
        },
        { status: 500 },
      )
    }
  },

  async scheduled(_controller: ScheduledController, env: CloudflareEnv, context: ExecutionContext) {
    ;(globalThis as unknown as { __MUSICO_WORKER_ENV__?: CloudflareEnv }).__MUSICO_WORKER_ENV__ = env

    context.waitUntil(
      (async () => {
        const { refreshStoredHomeAlbums } = await import('./src/services/trending')
        await refreshStoredHomeAlbums({ happeningLimit: 24, recentLimit: 24 })
      })().catch((error) => {
        console.error('[worker.scheduled] homepage refresh failed', error)
      }),
    )
  },
}
