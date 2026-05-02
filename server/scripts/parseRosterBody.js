// Plain JavaScript (NOT TypeScript). Loaded as a string and evaluated in the
// Puppeteer page context. Returns:
//   { players: [{ name, position, classYear }], rosterPage: boolean }
// or null if no recognizable roster found.
//
// Strategies tried in order:
//   1. SIDEARM-style cards with class="sidearm-roster-player-*"
//   2. .s-person-card / .person-card grids (newer SIDEARM)
//   3. <table> with column headers including "Year" or "Class"
//   4. Generic any-element with role/position + class-year text
// First strategy that yields ≥6 players wins. Fewer = probably not a roster.

(function parseRoster() {
  // ── helpers ──────────────────────────────────────────────────────────────

  var POSITION_NORMALIZE = {
    // Normalizes positions to: 'GK' | 'D' | 'M' | 'F' | 'U'
    gk: 'GK', goalkeeper: 'GK', keeper: 'GK', goalie: 'GK',
    d: 'D', def: 'D', defender: 'D', cb: 'D', fb: 'D',
    'center back': 'D', 'centre back': 'D',
    'right back': 'D', 'left back': 'D',
    'fullback': 'D', 'outside back': 'D',
    'wing back': 'D', 'wingback': 'D', wb: 'D',
    m: 'M', mid: 'M', midfielder: 'M', cm: 'M', dm: 'M', am: 'M', cdm: 'M', cam: 'M',
    'central mid': 'M', 'central midfielder': 'M',
    'attacking mid': 'M', 'defensive mid': 'M',
    f: 'F', fwd: 'F', forward: 'F', striker: 'F', cf: 'F',
    winger: 'F', wing: 'F', lw: 'F', rw: 'F',
    'left wing': 'F', 'right wing': 'F',
    df: 'D', mf: 'M', // common abbreviations
  }

  function normalizePosition(raw) {
    if (!raw) return 'U'
    var s = String(raw).toLowerCase().trim()
      .replace(/[\/,\-]+/g, ' ')   // "F/M" → "F M", "midfielder/forward" → ...
      .replace(/\s+/g, ' ')
    // Try full token match first (for "central mid"), then first token.
    if (POSITION_NORMALIZE[s]) return POSITION_NORMALIZE[s]
    var first = s.split(' ')[0]
    return POSITION_NORMALIZE[first] || 'U'
  }

  var CLASS_YEAR_NORMALIZE = {
    fr: 'Fr', freshman: 'Fr', 'fr.': 'Fr',
    so: 'So', sophomore: 'So', 'so.': 'So',
    jr: 'Jr', junior: 'Jr', 'jr.': 'Jr',
    sr: 'Sr', senior: 'Sr', 'sr.': 'Sr',
    gr: 'Gr', graduate: 'Gr', grad: 'Gr', 'gr.': 'Gr',
    rfr: 'Fr', rso: 'So', rjr: 'Jr', rsr: 'Sr', // redshirt — count as their on-field year
    'r-fr': 'Fr', 'r-so': 'So', 'r-jr': 'Jr', 'r-sr': 'Sr',
    'redshirt freshman': 'Fr', 'redshirt sophomore': 'So',
    'redshirt junior': 'Jr', 'redshirt senior': 'Sr',
    'fifth year': 'Gr', '5th year': 'Gr', 'fifth-year': 'Gr',
  }

  function normalizeClassYear(raw) {
    if (!raw) return ''
    var s = String(raw).toLowerCase().trim().replace(/\./g, '').replace(/\s+/g, ' ')
    if (CLASS_YEAR_NORMALIZE[s]) return CLASS_YEAR_NORMALIZE[s]
    // Sometimes shows as a 4-digit year ("Class of 2027"); we don't try to
    // resolve that here — leave as raw and the matcher can interpret.
    var yr = s.match(/\b(20\d\d)\b/)
    if (yr) return yr[1]
    return ''
  }

  function textOf(el) {
    if (!el) return ''
    return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  }

  function makePlayer(name, position, classYear) {
    if (!name) return null
    name = String(name).replace(/\s+/g, ' ').trim()
    if (name.length < 3 || name.length > 60) return null
    // Reject obvious non-player rows (headers, nav, etc.)
    if (/^(roster|year|position|name|height|number|player)$/i.test(name)) return null
    return {
      name: name,
      position: normalizePosition(position),
      classYear: normalizeClassYear(classYear),
    }
  }

  // ── Strategy 1: SIDEARM v1 (.sidearm-roster-player-*) ───────────────────

  function strategySidearmV1() {
    var cards = document.querySelectorAll(
      '.sidearm-roster-player, [class*="roster-player-card"], [class*="roster-list-player"]'
    )
    if (!cards.length) return []
    var players = []
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i]
      var name = textOf(card.querySelector('.sidearm-roster-player-name, [class*="player-name"], a[href*="roster"]'))
      var position = textOf(card.querySelector('.sidearm-roster-player-position, [class*="player-position"]'))
      var classYear = textOf(card.querySelector('.sidearm-roster-player-academic-year, [class*="player-year"], [class*="academic-year"], [class*="class-year"]'))
      var p = makePlayer(name, position, classYear)
      if (p) players.push(p)
    }
    return players
  }

  // ── Strategy 2: Generic person-card grid (.s-person-card, .person-card) ─

  function strategyPersonCards() {
    var cards = document.querySelectorAll('.s-person-card, .person-card, [class*="player-card"]')
    if (cards.length < 6) return []
    var players = []
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i]
      var name = textOf(card.querySelector('.s-person-card__content__person__name, [class*="card__person__name"], [class*="person-name"], [class*="card-name"]'))
      var details = textOf(card.querySelector('.s-person-card__content__person__details, [class*="card__person__details"], [class*="person-details"]'))
      // Details often look like "Forward · Junior · Atlanta, GA"
      var parts = details.split(/[•·|,]/).map(function (s) { return s.trim() }).filter(Boolean)
      var position = parts[0] || ''
      var classYear = parts[1] || ''
      var p = makePlayer(name, position, classYear)
      if (p) players.push(p)
    }
    return players
  }

  // ── Strategy 3: Table-based roster ───────────────────────────────────────

  function strategyTable() {
    var tables = document.querySelectorAll('table')
    var best = []
    for (var t = 0; t < tables.length; t++) {
      var table = tables[t]
      // Collect header cells in priority order:
      //   1. <thead th> if present
      //   2. else first <tr> th
      //   3. else first <tr> td (some sites use td headers)
      // CRITICAL: never combine these — combining lets the first body row
      // leak in (when both thead AND tr:first-child resolve), which inflates
      // headers.length and causes every real data row to fail the column-
      // count guard below.
      var headerEls = table.querySelectorAll('thead th')
      if (!headerEls.length) {
        var firstRow = table.querySelector('tr')
        if (firstRow) {
          headerEls = firstRow.querySelectorAll('th')
          if (!headerEls.length) headerEls = firstRow.querySelectorAll('td')
        }
      }
      var headers = Array.prototype.slice.call(headerEls)
        .map(function (th) { return textOf(th).toLowerCase() })
      if (!headers.length) continue
      // Identify Name, Position, Year columns by header text. Allow the
      // keyword anywhere in the header — "Full Name" and "Academic Year"
      // need to match too. Reject "previous school" / "hometown" via word-
      // boundary check on the keyword.
      var nameCol = headers.findIndex(function (h) {
        // Avoid catching "previous school", "hometown", or "high school"
        // — none of those should be the player-name column. "school" alone
        // is not a name field.
        if (/previous|hometown|high\s+school|prev\.?\s+school/.test(h)) return false
        return /\b(name|player)\b/.test(h)
      })
      var posCol = headers.findIndex(function (h) { return /\b(pos|position)\b/.test(h) })
      var yrCol = headers.findIndex(function (h) { return /\b(yr|year|class)\b/.test(h) })
      if (nameCol < 0 || (posCol < 0 && yrCol < 0)) continue
      // Body rows: prefer tbody, but fall back to all tr if no tbody (some
      // sites skip it). When using tr (no tbody), skip the first row since
      // it's the header.
      var rows = table.querySelectorAll('tbody tr')
      if (!rows.length) {
        var allTr = table.querySelectorAll('tr')
        rows = Array.prototype.slice.call(allTr, 1)
      }
      var players = []
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].querySelectorAll('td')
        // Need at least the columns we identified — not full header parity.
        var maxCol = Math.max(nameCol, posCol, yrCol)
        if (cells.length <= maxCol) continue
        var p = makePlayer(
          textOf(cells[nameCol]),
          posCol >= 0 ? textOf(cells[posCol]) : '',
          yrCol >= 0 ? textOf(cells[yrCol]) : ''
        )
        if (p) players.push(p)
      }
      if (players.length > best.length) best = players
    }
    return best
  }

  // ── Strategy 4: Stanford/Virginia-style "roster-players-cards-item" ──────
  // These custom React-rendered sites don't use SIDEARM markup. Per-player
  // text follows a repeating shape:
  //   "#1\nNAME\nGK\n5'10\"Junior\nHometown..."  (Virginia)
  //   "1\nGOALKEEPER\nNAME\n5'11\"Sophomore\nHometown" (Stanford)
  // Strategy: find repeating elements whose className looks player-scoped,
  // and parse inner text for name + position + class year.

  function strategyCustomCards() {
    var YEAR_RE = /\b(freshman|sophomore|junior|senior|graduate|fifth\s*year|fr\.?|so\.?|jr\.?|sr\.?|gr\.?)\b/i
    // Try a few selectors known to scope per-player on custom CMSes.
    var selectors = [
      '[class*="roster-players-cards-item"]',
      '[class*="roster-card-item"]',  // Virginia
      '[class*="roster-card"]',
      '[class*="roster__card"]',
      '[class*="player-row"]',
      '[class*="rosterpage__card"]',
      '[class*="rosterpage__player"]',
    ]
    for (var s = 0; s < selectors.length; s++) {
      var els = document.querySelectorAll(selectors[s])
      if (els.length < 6) continue
      var players = []
      for (var i = 0; i < els.length; i++) {
        // Use innerText directly (NOT textOf) so newlines are preserved —
        // we need to split on them to extract name/position/year as lines.
        var raw = (els[i].innerText || els[i].textContent || '').trim()
        if (!raw || !YEAR_RE.test(raw)) continue
        // Split into lines; pick a name (longest line of 2+ words that looks
        // like a person's name), a position (short token GK/D/M/F/MF/...),
        // and a year keyword.
        var lines = raw.split('\n').map(function (l) { return l.trim() }).filter(Boolean)
        var name = ''
        var position = ''
        var classYear = ''
        for (var j = 0; j < lines.length; j++) {
          var ln = lines[j]
          if (!classYear) {
            var ym = ln.match(YEAR_RE)
            if (ym) classYear = ym[1]
          }
          if (!position) {
            // Position lines are short and contain a known abbrev/word.
            if (/^(GK|D|MF?|F|FW|DF|FR|FB|CB|CM|CDM|CAM|LW|RW|ST|CF|GOALKEEPER|DEFENDER|MIDFIELDER|FORWARD|STRIKER|WINGER|FULLBACK|BACK)\s*$/i.test(ln)) {
              position = ln
            }
          }
          if (!name) {
            // Name: 2-4 words, mostly letters, not a label, not a known noise word.
            if (/^[A-Z][A-Za-z'’\-]+(?:\s+[A-Z][A-Za-z'’\-]+){1,3}$/.test(ln)
                && !/jersey|position|year|height|hometown|number|previous|class/i.test(ln)) {
              name = ln
            }
          }
        }
        var p = makePlayer(name, position, classYear)
        if (p) players.push(p)
      }
      // Dedupe by name — sub-element selectors can match the same player
      // multiple times (e.g., roster-card-item AND roster-card-item__info).
      var seen = {}
      var deduped = []
      for (var d = 0; d < players.length; d++) {
        if (seen[players[d].name]) continue
        seen[players[d].name] = 1
        deduped.push(players[d])
      }
      if (deduped.length >= 6) return deduped
    }
    return []
  }

  // ── Run strategies in order ──────────────────────────────────────────────

  // Sanity gate: page must be a roster (URL or h1 contains "roster")
  var url = (location.pathname || '').toLowerCase()
  var headerText = ''
  var hs = document.querySelectorAll('h1, h2')
  for (var i = 0; i < hs.length; i++) headerText += ' ' + textOf(hs[i]).toLowerCase()
  var looksLikeRoster = url.indexOf('roster') >= 0 || /roster/i.test(headerText)

  var attempts = [strategySidearmV1, strategyPersonCards, strategyTable, strategyCustomCards]
  var result = []
  for (var s = 0; s < attempts.length; s++) {
    try {
      var players = attempts[s]()
      // Need a meaningful number of players. <6 = probably staff or noise.
      if (players.length >= 6 && players.length > result.length) {
        result = players
      }
    } catch (e) { /* try next strategy */ }
  }

  if (result.length === 0) return null
  return { players: result, rosterPage: looksLikeRoster }
})()
