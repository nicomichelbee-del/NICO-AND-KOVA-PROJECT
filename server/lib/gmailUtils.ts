const COACH_KEYWORDS = [
  'soccer', 'recruiting', 'recruit', 'camp', 'roster',
  'scholarship', 'visit', 'tryout', 'athletic',
]

export function isCoachEmail(senderEmail: string, subject: string): boolean {
  if (senderEmail.toLowerCase().endsWith('.edu')) return true
  const lower = subject.toLowerCase()
  return COACH_KEYWORDS.some((kw) => lower.includes(kw))
}

function decodeBase64(data: string): string {
  // Handle both standard base64 and base64url variants
  // Convert base64url chars to standard base64, then decode
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(normalized, 'base64').toString('utf-8')
}

export function decodeMessageBody(payload: any): string {
  if (!payload) return ''
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64(part.body.data)
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64(part.body.data).replace(/<[^>]*>/g, '')
      }
    }
  }
  if (payload.body?.data) {
    return decodeBase64(payload.body.data)
  }
  return ''
}
