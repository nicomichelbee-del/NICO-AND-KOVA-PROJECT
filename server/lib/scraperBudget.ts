import * as fs from 'fs'

type Tier = 'below-soft' | 'between' | 'over-hard'
interface BudgetState { spendUsd: number; entries: Array<{ at: string; tag: string; usd: number }> }

export class BudgetExceededError extends Error {}

export class ScraperBudget {
  constructor(private path: string, private caps: { soft: number; hard: number }) {}

  private load(): BudgetState {
    if (!fs.existsSync(this.path)) return { spendUsd: 0, entries: [] }
    return this.withRetry(() => JSON.parse(fs.readFileSync(this.path, 'utf8')))
  }

  private save(state: BudgetState) {
    const json = JSON.stringify(state, null, 2)
    const tmp = this.path + '.tmp'
    this.withRetry(() => {
      fs.writeFileSync(tmp, json)
      fs.renameSync(tmp, this.path)
    })
  }

  // Windows holds short exclusive locks on rename/open. Retry on EBUSY/EPERM.
  private withRetry<T>(fn: () => T, attempts = 12): T {
    let lastErr: unknown
    for (let i = 0; i < attempts; i++) {
      try { return fn() } catch (e: any) {
        const code = e?.code
        if (code !== 'EBUSY' && code !== 'EPERM' && code !== 'EACCES' && code !== 'ENOENT') throw e
        lastErr = e
        const wait = 20 * (i + 1)
        const end = Date.now() + wait
        while (Date.now() < end) { /* busy-wait — sync API has no async sleep */ }
      }
    }
    throw lastErr
  }

  totalSpent(): number {
    return this.load().spendUsd
  }

  tier(): Tier {
    const s = this.totalSpent()
    if (s >= this.caps.hard) return 'over-hard'
    if (s >= this.caps.soft) return 'between'
    return 'below-soft'
  }

  record(tag: string, usd: number) {
    const state = this.load()
    state.spendUsd += usd
    state.entries.push({ at: new Date().toISOString(), tag, usd })
    this.save(state)
  }

  assertCanSpend(estUsd: number) {
    if (this.totalSpent() + estUsd > this.caps.hard) {
      throw new BudgetExceededError(
        `Would push spend past hard cap $${this.caps.hard} (current $${this.totalSpent().toFixed(2)} + est $${estUsd.toFixed(2)})`
      )
    }
  }
}
