import { describe, expect, it, vi } from 'vitest'
import { createRateLimitedFetch } from './live-utils.js'

describe('createRateLimitedFetch', () => {
  it('serializes concurrent requests and preserves the configured gap', async () => {
    const starts: number[] = []
    let inFlight = 0
    let maximumInFlight = 0
    const fetchImpl = vi.fn(async () => {
      starts.push(Date.now())
      inFlight++
      maximumInFlight = Math.max(maximumInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 2))
      inFlight--
      return new Response('{}')
    })
    const fetch = createRateLimitedFetch(fetchImpl as typeof fetch, 10)

    await Promise.all([fetch('https://example.test/one'), fetch('https://example.test/two')])

    expect(maximumInFlight).toBe(1)
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(9)
  })
})
