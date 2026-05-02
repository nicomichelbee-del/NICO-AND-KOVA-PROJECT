import type { Region } from '../types'

const STATE_REGION: Record<string, Exclude<Region, 'any'>> = {
  ME: 'Northeast', NH: 'Northeast', VT: 'Northeast', MA: 'Northeast',
  RI: 'Northeast', CT: 'Northeast', NY: 'Northeast', NJ: 'Northeast',
  PA: 'Northeast', MD: 'Northeast', DE: 'Northeast', DC: 'Northeast', WV: 'Northeast',
  VA: 'Southeast', NC: 'Southeast', SC: 'Southeast', GA: 'Southeast',
  FL: 'Southeast', AL: 'Southeast', MS: 'Southeast', TN: 'Southeast',
  KY: 'Southeast', AR: 'Southeast', LA: 'Southeast',
  OH: 'Midwest', IN: 'Midwest', IL: 'Midwest', MI: 'Midwest',
  WI: 'Midwest', MN: 'Midwest', IA: 'Midwest', MO: 'Midwest',
  ND: 'Midwest', SD: 'Midwest', NE: 'Midwest', KS: 'Midwest',
  TX: 'Southwest', OK: 'Southwest', NM: 'Southwest', AZ: 'Southwest',
  CO: 'Southwest', NV: 'Southwest', UT: 'Southwest',
  CA: 'West', OR: 'West', WA: 'West', ID: 'West',
  MT: 'West', WY: 'West', AK: 'West', HI: 'West',
}

export const REGIONS: Region[] = ['any', 'Northeast', 'Southeast', 'Midwest', 'Southwest', 'West']

/** Parse "City, ST" or "City, ST (extra)" → Region */
export function regionFromLocation(location: string): Exclude<Region, 'any'> | null {
  const m = location.match(/,\s*([A-Z]{2})/)
  return m ? (STATE_REGION[m[1]] ?? null) : null
}
