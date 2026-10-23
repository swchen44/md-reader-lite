export interface MermaidJob {
  id: string
  source: string
  style: 'original' | 'anthropic-blog'
  theme: 'light' | 'dark'
  isCurrent(): boolean
}

export type MermaidResult =
  | { status: 'ready'; svg: string }
  | { status: 'error'; error: string }
  | { status: 'stale' }

export function createMermaidQueue(
  render: (job: MermaidJob) => Promise<string>,
) {
  let tail: Promise<unknown> = Promise.resolve()
  return {
    run(job: MermaidJob): Promise<MermaidResult> {
      const next = tail.then(async (): Promise<MermaidResult> => {
        if (!job.isCurrent()) return { status: 'stale' }
        try {
          const svg = await render(job)
          return job.isCurrent()
            ? { status: 'ready', svg }
            : { status: 'stale' }
        } catch (error) {
          return job.isCurrent()
            ? {
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
              }
            : { status: 'stale' }
        }
      })
      tail = next.catch(() => {})
      return next
    },
  }
}
