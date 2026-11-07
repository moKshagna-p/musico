// The few Cloudflare Workers types worker.ts and discLabels.ts use. @cloudflare/workers-types redeclares
// fetch, Request and Response, which clashes with Bun's types used everywhere else.
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

interface ScheduledController {
  readonly scheduledTime: number
  readonly cron: string
  noRetry(): void
}

declare module 'cloudflare:workers' {
  export function waitUntil(promise: Promise<unknown>): void
}
