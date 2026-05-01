// Plain JavaScript (NOT TypeScript). This file is loaded as a raw string and
// evaluated inside the Puppeteer page context. Keep it pure browser-runnable
// JS — no type annotations, no `__name` helpers, no class declarations.
// Returns either { coachName, coachTitle, coachEmail } or null.

(function parseHeadCoach() {
  // The scraper sets window.__TARGET_GENDER__ to 'mens' | 'womens' before
  // evaluating. When set, we require any matched title to be specific to that
  // gender (rejects "Head Coach • Men's Soccer" when scraping for women's).
  var TARGET_GENDER = (typeof window !== 'undefined' && window.__TARGET_GENDER__) || ''
  var requireMens = TARGET_GENDER === 'mens'
  var requireWomens = TARGET_GENDER === 'womens'

  // Page-level sanity checks — many sites silently serve the opposite-gender
  // OR a generic athletics page at sport-specific URLs (e.g., FSU has no
  // men's program; /sports/mens-soccer/staff returns the all-sports directory).
  // Check title + all headings + nav for "soccer".
  var headingText = Array.prototype.slice
    .call(document.querySelectorAll('h1,h2,h3,nav,[class*="breadcrumb"]'))
    .map(function (el) { return el.innerText || '' })
    .join(' ')
  var pageHeader = ((document.title || '') + ' ' + headingText).toLowerCase()
  var pageMens = /\bmen'?s\s+soccer\b/.test(pageHeader)
  var pageWomens = /\bwomen'?s\s+soccer\b/.test(pageHeader)
  // 1. Reject if the page is clearly the opposite gender.
  if (requireMens && pageWomens && !pageMens) return null
  if (requireWomens && pageMens && !pageWomens) return null
  // 2. Reject if the page has no soccer content at all (safety net for silent
  //    URL→generic-page substitutions, e.g. FSU's generic staff directory).
  if (TARGET_GENDER && !/\bsoccer\b/.test(pageHeader)) return null

  // ── helpers ───────────────────────────────────────────────────────────────

  var titleMatchesGender = function (title) {
    if (!title) return true
    var t = title.toLowerCase()
    var hasMens = /\bmen'?s\b/i.test(t)
    var hasWomens = /\bwomen'?s\b/i.test(t)
    if (requireMens && hasWomens && !hasMens) return false
    if (requireWomens && hasMens && !hasWomens) return false
    return true
  }

  // Matches any "top-of-staff" title. Wider than bare "Head Coach" to cover:
  //   "Head Soccer Coach", "Head Women's Soccer Coach",
  //   "Director of Women's Soccer", "Director of Soccer", etc.
  // Associate / interim / assistant titles are excluded at the call site.
  var isHeadCoachTitle = function (s) {
    if (!s) return false
    // "Head ... Coach" — catches "Head Coach", "Head Soccer Coach",
    // "Head Men's/Women's Soccer Coach", "Head Men's/Women's Coach"
    if (/\bhead\b.*\bcoach\b/i.test(s)) return true
    // "Director of [Women's/Men's/] Soccer" — used by some top programs
    // (e.g., Stanford "The Knowles Family Director of Women's Soccer")
    if (/\bdirector\b.*\bsoccer\b/i.test(s)) return true
    return false
  }

  var clean = function (s) {
    return (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim()
  }
  var emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

  // Accept "Firstname [particle] Lastname" — at least 2 words, first and last
  // tokens must start uppercase; middle tokens may be lowercase if short
  // (common name particles: da, de, del, van, von, la, le, di, dos, der, op).
  // Rejects section headings, sport names, role labels, and column headers.
  var NAME_BLOCKLIST = /^(NAME|TITLE|PHONE|EMAIL(?: ADDRESS)?|ALMA MATER|YEAR|HOMETOWN|POSITION|MEN'S|WOMEN'S|SOCCER|HEAD|COACH|STAFF|COACHING|ROSTER|DIRECTORY|SUPPORT|VIEW|BIO|READ|MORE|FULL|INFO|SEE|SHOW|CLICK|CONTACT|PROFILE|ABOUT|TOGGLE|EXPAND|CLOSE|OPEN|HIDE|LEARN|VISIT|FIND|GET|FOLLOW|SHARE|SEND|SUBMIT)\b/i
  var SPORT_OR_ROLE_WORDS = /\b(SOCCER|FOOTBALL|BASEBALL|BASKETBALL|HOCKEY|LACROSSE|TENNIS|GOLF|VOLLEYBALL|SWIMMING|TRACK|RUGBY|WRESTLING|CRICKET|FENCING|GYMNASTICS|ROWING|CHEERLEADING|COACH|STAFF|DIRECTORY|MANAGER|COORDINATOR|TRAINER|DEPARTMENT|PROGRAM|ATHLETIC|ATHLETICS|SPORTS|SPORT|TEAM|OVERSIGHT|OPERATIONS|COMPLIANCE|COMMUNICATIONS|DEVELOPMENT)\b/i
  var isPersonName = function (s) {
    if (!s || typeof s !== 'string') return false
    if (s.length < 4 || s.length > 60) return false
    var tokens = s.split(/\s+/).filter(Boolean)
    if (tokens.length < 2 || tokens.length > 6) return false
    // First and last tokens must start with a capital letter.
    if (!/^[A-Z]/.test(tokens[0])) return false
    if (!/^[A-Z]/.test(tokens[tokens.length - 1])) return false
    // Any lowercase-starting middle tokens must be short (≤4 chars) —
    // common particles: da, de, del, van, von, la, le, di, dos, der, op.
    for (var ti = 1; ti < tokens.length - 1; ti++) {
      var tok = tokens[ti]
      if (/^[a-z]/.test(tok) && tok.length > 4) return false
    }
    // Each token must look like a word (letters, apostrophes, dots, hyphens).
    if (!/^[A-Za-z][a-zA-Z'.\-]+(?:\s+[A-Za-z][a-zA-Z'.\-]*){1,5}$/.test(s)) return false
    if (NAME_BLOCKLIST.test(s)) return false
    if (SPORT_OR_ROLE_WORDS.test(s)) return false
    return true
  }
  var fullText = (document.body && document.body.innerText) || ''

  // ── Strategy 1: SIDEARM-style tab/multi-space row: Name <TAB> Head Coach ──

  var lines = fullText.split('\n')
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (!isHeadCoachTitle(line)) continue
    if (/former|assistant|associate|emerit|interim|previous|deputy/i.test(line)) continue

    var cols = line.split('\t').map(function (c) { return c.trim() }).filter(Boolean)
    if (cols.length < 2) {
      cols = line.split(/ {2,}/).map(function (c) { return c.trim() }).filter(Boolean)
    }
    if (cols.length < 2) continue

    var name = cols[0]
    if (!isPersonName(name)) continue

    var titleCol = cols.reduce(function (best, col) {
      return isHeadCoachTitle(col) ? col : best
    }, 'Head Coach')
    var emailCol = ''
    for (var j = 0; j < cols.length; j++) {
      if (emailRegex.test(cols[j])) emailCol = cols[j]
    }
    if (!titleMatchesGender(titleCol)) continue
    var emailMatch = emailCol.match(emailRegex)
    var email = emailMatch ? emailMatch[0].toLowerCase() : ''
    return { coachName: name, coachTitle: titleCol, coachEmail: email }
  }

  // ── Strategy 2: name → head-coach title within next 4 lines ──────────────
  // Handles modern SIDEARM roster cards where the name renders above the role.

  for (var i2 = 0; i2 < lines.length - 4; i2++) {
    var a = lines[i2].trim()
    if (!isPersonName(a)) continue

    var titleLine = ''
    var sectionCrossed = false
    for (var p = 1; p <= 4; p++) {
      var candidate = (lines[i2 + p] || '').trim()
      // Crossing a section boundary means the name and title are in different
      // sections of the page (e.g., player roster → coaching staff).
      if (/\b(coaching\s+staff|support\s+staff|soccer\s+coaching|roster\s+staff)\b/i.test(candidate)) {
        sectionCrossed = true; break
      }
      if (isHeadCoachTitle(candidate)) { titleLine = candidate; break }
      // Stop at the next person-name (next staff entry) to avoid cross-card matches.
      if (p > 1 && isPersonName(candidate)) break
    }
    if (sectionCrossed) continue
    if (!titleLine) continue
    if (/former|assistant|associate|emerit|interim|deputy/i.test(titleLine)) continue
    if (!titleMatchesGender(titleLine)) continue
    // On generic staff directories (multiple sports on one page) require
    // "soccer" in a nearby window to avoid cross-sport matches.
    var nearbyText = (lines.slice(Math.max(0, i2 - 5), i2 + 8) || []).join(' ')
    var looksGeneric = /\b(rugby|baseball|football|basketball|lacrosse|hockey|tennis|swimming|wrestling|track|volleyball|golf)\b/i.test(nearbyText)
    if (looksGeneric && !/soccer/i.test(titleLine + nearbyText)) continue

    var email2 = ''
    for (var k = i2 + 1; k < Math.min(i2 + 8, lines.length); k++) {
      var m2 = lines[k].match(emailRegex)
      if (m2) { email2 = m2[0].toLowerCase(); break }
    }
    return { coachName: a, coachTitle: titleLine, coachEmail: email2 }
  }

  // ── Strategy 3: head-coach title → name within next 3 lines ──────────────
  // Handles roster cards (Penn State, Stanford) that render the role first,
  // then the coach's name directly below.

  for (var i3 = 0; i3 < lines.length - 3; i3++) {
    var tl = lines[i3].trim()
    if (!isHeadCoachTitle(tl)) continue
    if (/former|assistant|associate|emerit|interim|deputy/i.test(tl)) continue
    if (!titleMatchesGender(tl)) continue

    var name3 = ''
    var email3inline = ''
    for (var p3 = 1; p3 <= 3; p3++) {
      var cn = (lines[i3 + p3] || '').trim()
      if (isPersonName(cn)) { name3 = cn; break }
      // Handle tab-separated "Name\t\tEmail" on one line (e.g., Maryland coaches page).
      var cnParts = cn.split(/\t+| {3,}/).map(function (s) { return s.trim() }).filter(Boolean)
      if (cnParts.length >= 1 && isPersonName(cnParts[0])) {
        name3 = cnParts[0]
        var inlineMatch = cn.match(emailRegex)
        if (inlineMatch) email3inline = inlineMatch[0].toLowerCase()
        break
      }
    }
    if (!name3) continue

    // Generic-directory guard (same as Strategy 2).
    var nearby3 = (lines.slice(Math.max(0, i3 - 5), i3 + 8) || []).join(' ')
    var looksGeneric3 = /\b(rugby|baseball|football|basketball|lacrosse|hockey|tennis|swimming|wrestling|track|volleyball|golf)\b/i.test(nearby3)
    if (looksGeneric3 && !/soccer/i.test(tl + nearby3)) continue

    var email3 = email3inline
    if (!email3) {
      for (var k3 = i3 - 3; k3 < Math.min(i3 + 8, lines.length); k3++) {
        var m3 = (lines[k3] || '').match(emailRegex)
        if (m3) { email3 = m3[0].toLowerCase(); break }
      }
    }
    return { coachName: name3, coachTitle: tl, coachEmail: email3 }
  }

  // ── Strategy 4: CSS card selectors ────────────────────────────────────────
  // SIDEARM sites render staff in typed components with predictable class names.
  // s-person-card / staff-list-item are the two most common variants.

  var cards = document.querySelectorAll([
    '.sidearm-staff-member',
    '.staff-member',
    '.coach-card',
    '.person',
    '.s-person-card',
    '[class*="staff-card"]',
    '[class*="staff-list-item"]',
    '[class*="person-card"]',
    '[class*="person-details"]',
    '.roster-staff-members__block',
  ].join(', '))
  for (var c = 0; c < cards.length; c++) {
    var card = cards[c]
    var text = clean(card.innerText)
    if (!isHeadCoachTitle(text)) continue
    if (/former|assistant|associate|emerit|interim/i.test(text)) continue

    var cardLines = text.split('\n').map(clean).filter(Boolean)
    var foundName = null
    for (var L = 0; L < cardLines.length; L++) {
      if (isPersonName(cardLines[L])) { foundName = cardLines[L]; break }
    }
    if (!foundName) continue
    if (!titleMatchesGender(text)) continue

    var email4 = ''
    var cardMailto = card.querySelector('a[href^="mailto:"]')
    if (cardMailto) {
      email4 = cardMailto.href.replace(/^mailto:/, '').split('?')[0].toLowerCase()
    } else {
      var m4 = text.match(emailRegex)
      if (m4) email4 = m4[0].toLowerCase()
    }
    return { coachName: foundName, coachTitle: 'Head Coach', coachEmail: email4 }
  }

  // ── Strategy 5: mailto: proximity DOM walk ────────────────────────────────
  // Many SIDEARM roster pages have <a href="mailto:"> links next to each coach.
  // Walk up the DOM from every mailto link looking for a container that also
  // contains a head-coach title and a person name.

  var mailtoLinks = document.querySelectorAll('a[href^="mailto:"]')
  for (var mi = 0; mi < mailtoLinks.length; mi++) {
    var link = mailtoLinks[mi]
    var email5 = link.href.replace(/^mailto:/, '').split('?')[0].toLowerCase()
    var el = link.parentElement
    for (var depth = 0; depth < 7 && el; depth++) {
      var elText = clean(el.innerText || '')
      if (
        isHeadCoachTitle(elText) &&
        !/former|assistant|associate|emerit|interim/i.test(elText) &&
        titleMatchesGender(elText)
      ) {
        var elLines = elText.split('\n').map(clean).filter(Boolean)
        var foundName5 = null
        for (var LL = 0; LL < elLines.length; LL++) {
          if (isPersonName(elLines[LL])) { foundName5 = elLines[LL]; break }
        }
        if (foundName5) {
          return { coachName: foundName5, coachTitle: 'Head Coach', coachEmail: email5 }
        }
      }
      el = el.parentElement
    }
  }

  return null
})()
