import * as fs from 'fs'

type Tier = 'below-soft' | 'between' | 'over-hard'
interface BudgetState { spendUsd: number; entries: Array<{ at: string; tag: string; usd: number }> }

export class BudgetExceededError extends Error {}

export class ScraperBudget {
  constructor(private path: string, private caps: { soft: number; hard: number }) {}

  private load(): BudgetState {
    if (!fs.existsSync(this.path)) return { spendUsd: 0, entries: [] }
    return JSON.parse(fs.readFileSync(this.path, 'utf8'))
  }

  private save(state: BudgetState) {
    fs.writeFileSync(this.path, JSON.stringify(state, null, 2))
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
