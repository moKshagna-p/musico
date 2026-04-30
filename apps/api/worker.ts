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
          message: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      )
    }
  },
}
