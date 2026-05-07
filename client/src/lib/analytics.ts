// Thin PostHog wrapper. Centralizing here means components don't import
// posthog-js directly — they call track()/identify() and we control what
// actually fires (or no-ops when the key isn't configured, e.g. in dev).

import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com'

let initialized = false

export function initAnalytics() {
  if (initialized || !KEY) return
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: 'history_change',
    person_profiles: 'identified_only',
  })
  initialized = true
}

export function identify(userId: string, traits?: Record<string, unknown>) {
  if (!initialized) return
  posthog.identify(userId, traits)
}

export function resetAnalytics() {
  if (!initialized) return
  posthog.reset()
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!initialized) return
  posthog.capture(event, props)
}
