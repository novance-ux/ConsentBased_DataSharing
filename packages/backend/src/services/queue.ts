type JobHandler<T> = (data: T) => Promise<void>

interface Job<T> {
  id: string
  data: T
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
}

export class InMemoryQueue<T> {
  private jobs: Map<string, Job<T>> = new Map()
  private handler: JobHandler<T> | null = null
  private processing = false
  private counter = 0

  async add(data: T): Promise<string> {
    const id = `job_${++this.counter}_${Date.now()}`
    this.jobs.set(id, { id, data, status: 'pending' })
    this.processNext()
    return id
  }

  process(handler: JobHandler<T>): void {
    this.handler = handler
    this.processNext()
  }

  private async processNext(): Promise<void> {
    if (this.processing || !this.handler) return

    const pendingJob = Array.from(this.jobs.values()).find(j => j.status === 'pending')
    if (!pendingJob) return

    this.processing = true
    pendingJob.status = 'processing'

    try {
      await this.handler(pendingJob.data)
      pendingJob.status = 'completed'
    } catch (err) {
      pendingJob.status = 'failed'
      pendingJob.error = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      this.processing = false
      this.processNext()
    }
  }
}
