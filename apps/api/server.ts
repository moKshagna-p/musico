import { app, env, log } from './index'

app.listen(env.PORT)

log('info', 'server.started', {
  port: app.server?.port ?? env.PORT,
  url: env.BETTER_AUTH_URL,
})

const shutdown = async (signal: string) => {
  log('warn', 'server.shutdown_started', { signal })
  try {
    await app.stop()
    log('info', 'server.shutdown_completed', { signal })
    process.exit(0)
  } catch (error) {
    log('error', 'server.shutdown_failed', {
      signal,
      message: error instanceof Error ? error.message : 'Unknown shutdown error',
    })
    process.exit(1)
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
