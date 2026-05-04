import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { ScraperBudget, BudgetExceededError } from './scraperBudget'

const TEST_FILE = path.join(__dirname, '..', 'data', '.scraperBudget.test.json')

describe('ScraperBudget', () => {
  beforeEach(() => { if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE) })
  afterEach(()  => { if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE) })

  it('starts at zero spend', () => {
    const b = new ScraperBudget(TEST_FILE, { soft: 18, hard: 20 })
    expect(b.totalSpent()).toBe(0)
  })

  it('records spend and persists across instances', () => {
    const b1 = new ScraperBudget(TEST_FILE, { soft: 18, hard: 20 })
    b1.record('haiku', 0.002)
    const b2 = new ScraperBudget(TEST_FILE, { soft: 18, hard: 20 })
    expect(b2.totalSpent()).toBeCloseTo(0.002, 4)
  })

  it('reports below-soft / between / over correctly', () => {
    const b = new ScraperBudget(TEST_FILE, { soft: 5, hard: 10 })
    b.record('sonnet', 4)
    expect(b.tier()).toBe('below-soft')
    b.record('sonnet', 2)
    expect(b.tier()).toBe('between')
    b.record('sonnet', 5)
    expect(b.tier()).toBe('over-hard')
  })

  it('throws BudgetExceededError when assertCanSpend would push past hard cap', () => {
    const b = new ScraperBudget(TEST_FILE, { soft: 5, hard: 10 })
    b.record('sonnet', 9)
    expect(() => b.assertCanSpend(2)).toThrow(BudgetExceededError)
  })
})
