const COACH_KEYWORDS = [
  'soccer', 'recruiting', 'recruit', 'camp', 'roster',
  'scholarship', 'visit', 'tryout', 'athletic',
]

export function isCoachEmail(senderEmail: string, subject: string): boolean {
  if (senderEmail.toLowerCase().endsWith('.edu')) return true
  const lower = subject.toLowerCase()
  return COACH_KEYWORDS.some((kw) => lower.includes(kw))
}

export function decodeMessageBody(payload: any): string {
  if (!payload) return ''
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8')
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8').replace(/<[^>]*>/g, '')
      }
    }
  }
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  }
  return ''
}
