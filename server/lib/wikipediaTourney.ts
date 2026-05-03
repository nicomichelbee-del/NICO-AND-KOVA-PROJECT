export function extractTourneyAppearances(wikitext: string): Record<number, string> {
  const result: Record<number, string> = {}
  const idx = wikitext.toLowerCase().indexOf('ncaa tournament')
  if (idx === -1) return result
  const slice = wikitext.slice(idx)
  const rowRe = /\|\s*(\d{4})\s*\|\|\s*([^\n|]+)/g
  let m: RegExpExecArray | null
  while ((m = rowRe.exec(slice)) !== null) {
    const year = parseInt(m[1], 10)
    const round = m[2].trim()
    if (year >= 1950 && year <= 2100 && round) result[year] = round
  }
  return result
}

export async function fetchWikipediaWikitext(pageTitle: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json&formatversion=2`
  const res = await fetch(url, { headers: { 'User-Agent': 'KickrIo/1.0 (info@fahga.org)' } })
  if (!res.ok) return null
  const json = await res.json() as any
  return json?.parse?.wikitext ?? null
}
