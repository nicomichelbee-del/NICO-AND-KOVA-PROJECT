# Coach Scraper Failure Audit

_Generated 2026-05-02T21:39:31.201Z_

Total cache entries: 1510
Schools in DB:       755 (× 2 genders = 1510 expected entries)

## Status totals

| Status | Count |
|---|---|
| failed | 739 |
| success | 689 |
| email-inferred | 71 |
| partial | 11 |

## By division

| Division | Total | ✅ Success | 🟡 Partial | 📧 Inferred | ❌ Failed | Fail % |
|---|---:|---:|---:|---:|---:|---:|
| D1 | 616 | 407 | 10 | 60 | 139 | 22.6% |
| D2 | 250 | 99 | 0 | 2 | 149 | 59.6% |
| D3 | 326 | 147 | 1 | 8 | 170 | 52.1% |
| NAIA | 134 | 32 | 0 | 0 | 102 | 76.1% |
| JUCO | 184 | 4 | 0 | 1 | 179 | 97.3% |

## Domain mapping coverage of failures

Whether `ATHLETICS_DOMAINS[schoolId]` is populated for each failed entry. Failures with no domain mapping rely entirely on DuckDuckGo discovery, which is the weakest part of the pipeline. These are the easiest wins for Phase 2 (add domain mappings).

| Division | Failed | With domain | No domain | No-domain % of failures |
|---|---:|---:|---:|---:|
| D1 | 139 | 139 | 0 | 0.0% |
| D2 | 149 | 149 | 0 | 0.0% |
| D3 | 170 | 170 | 0 | 0.0% |
| NAIA | 102 | 102 | 0 | 0.0% |
| JUCO | 179 | 179 | 0 | 0.0% |

## Failure reasons

The `reason` string written by the scraper. "no URL pattern returned a parseable head-coach card" means a domain was known but every candidate URL either 404'd, redirected to the opposite gender, or returned a page the parser couldn't extract from. "no domain mapping and search discovery failed" means we didn't even know which site to hit and DDG returned nothing usable.

| Reason | Count |
|---|---:|
| no URL pattern returned a parseable head-coach card | 739 |

## Top 20 conferences by failure count

Conferences clustered together usually share a CMS — fixing one URL pattern often clears a whole conference at once.

| Division • Conference | Failures |
|---|---:|
| JUCO • KJCCC | 28 |
| NAIA • Heart of America Athletic Conference (Heart) | 20 |
| JUCO • CCCAA - South | 20 |
| D2 • PSAC | 17 |
| D2 • GSC | 14 |
| D3 • Wisconsin Intercollegiate Athletic Conference (WIAC) | 14 |
| D3 • Northwest Conference (NWC) | 14 |
| JUCO • NJCAA Region 4 | 14 |
| JUCO • NJCAA Region 14 | 14 |
| D2 • CCAA | 14 |
| JUCO • NJCAA Region 1 | 12 |
| D1 • SEC | 11 |
| D2 • SAC | 10 |
| D2 • RMAC | 10 |
| JUCO • NJCAA Region 15 | 10 |
| D1 • SWAC | 10 |
| JUCO • CCCAA - Big 8 | 9 |
| D1 • Summit League | 9 |
| D1 • MEAC | 9 |
| D2 • LSC | 8 |

## Schools where BOTH genders failed

351 schools failed both mens and womens. These are pure pipeline failures (not "school doesn't have this program") and are the highest-leverage targets — one fix wins two entries.

### D1 — 53 schools (53 with mapped domain, 0 without)

- **Abilene Christian University** `abilene-christian` → acuwildcats.com
- **Alabama A&M University** `alabama-am` → aamuathletics.com
- **Bethune-Cookman University** `bethune-cookman` → bcu-wildcats.com
- **Boston University** `boston-university` → terriersports.com
- **California State University, Long Beach** `csulb` → golongbeach.com
- **Colgate University** `colgate` → gocolgate.com
- **College of Charleston** `charleston` → cofcathletics.com
- **Coppin State University** `coppin-state` → coppinstateAthletics.com
- **East Tennessee State University** `etsu` → etsusports.com
- **Florida A&M University** `florida-am` → famuathletics.com
- **Fordham University** `fordham` → fordhamrams.com
- **Gardner-Webb University** `gardner-webb` → gwuathletics.com
- **Georgia Institute of Technology** `georgia-tech` → ramblinwreck.com
- **Georgia Southern University** `georgia-southern` → georgiasoutherneagles.com
- **Grambling State University** `grambling-state` → gramblingstatesports.com
- **Hofstra University** `hofstra` → hofstraathletics.com
- **Jackson State University** `jackson-state` → jsusports.com
- **Jacksonville State University** `jacksonville-state` → jsugamecocksathletics.com
- **Jacksonville University** `jacksonville` → gojusports.com
- **Le Moyne College** `lemoyne` → gldolphins.com
- **Liberty University** `liberty` → liberty.edu
- **Manhattan College** `manhattan` → manhattanjaspers.com
- **Merrimack College** `merrimack` → merrimackwarriors.com
- **Morgan State University** `morgan-state` → morganstatebears.com
- **New Mexico State University** `new-mexico-state` → nmsuaggies.com
- **Norfolk State University** `norfolk-state` → nsuspartans.com
- **North Carolina Central University** `nccu` → nccu.edu
- **Oral Roberts University** `oral-roberts` → orugoldeagles.com
- **Presbyterian College** `presbyterian` → pcbluehose.com
- **Quinnipiac University** `quinnipiac` → quinnipiacbobcats.com
- _… and 23 more_

### D2 — 73 schools (73 with mapped domain, 0 without)

- **Adams State University** `adams-state` → adamsstategrizzlies.com
- **Adelphi University** `adelphi` → adelphipanthers.com
- **Anderson University** `anderson-sc` → andersonathletics.com
- **Auburn University at Montgomery** `auburn-montgomery` → aumwarhawks.com
- **Azusa Pacific University** `azusa-pacific` → azusapacificathletics.com
- **Barry University** `barry` → bucathletics.com
- **Bemidji State University** `bemidji-state` → athletics.bemidjistate.edu
- **California State University, Dominguez Hills** `cal-state-dominguez` → athletics.csudh.edu
- **California State University, East Bay** `cal-state-east-bay` → athletics.csueastbay.edu
- **California State University, Los Angeles** `cal-state-la` → athletics.calstatela.edu
- **California State University, Monterey Bay** `cal-state-monterey-bay` → otters.csumb.edu
- **California State University, San Bernardino** `cal-state-san-bernardino` → coyotesathletics.com
- **California State University, San Marcos** `cal-state-san-marcos` → csusmathletics.com
- **Carson-Newman University** `carsonNewman` → cneaglesports.com
- **Christian Brothers University** `christian-brothers` → cbuathletics.com
- **Colorado State University Pueblo** `csu-pueblo` → csupuebloathletics.com
- **Commonwealth University of Pennsylvania** `commonwealth-pa` → commonwealthathletics.com
- **Concord University** `concord` → concordathletics.com
- **Davenport University** `davenport` → dpuathletics.com
- **Delta State University** `delta-state` → deltastateathletics.com
- **Dominican University of California** `dominican-ca` → dominicandons.com
- **East Stroudsburg University** `east-stroudsburg` → esuathletics.com
- **Eastern New Mexico University** `enmu` → gohoundogs.com
- **Eckerd College** `eckerd` → eckerd.edu
- **Fairmont State University** `fairmont-state` → fsuflyingfalcons.com
- **Flagler College** `flagler` → flaglersaints.com
- **Florida Institute of Technology** `florida-tech` → floridatechathletics.com
- **Florida Southern College** `floridasouthern` → mocathletics.com
- **Fort Hays State University** `fort-hays-state` → fhsutiger.com
- **Fort Lewis College** `fortlewis` → skayhawks.com
- _… and 43 more_

### D3 — 85 schools (85 with mapped domain, 0 without)

- **Adrian College** `adrian-college` → adrianathletics.com
- **Albion College** `albion-college` → albionbritons.com
- **Albright College** `albright-college` → albrightlions.com
- **Alfred University** `alfred-university` → alfredathletics.com
- **Augustana College** `augustana-college-il` → augustanaviking.com
- **Austin College** `austin-college` → athletics.austincollege.edu
- **Berry College** `berry-college` → berryathletics.com
- **Bethel University** `bethel-university-mn` → royalsathletics.com
- **Brandeis University** `brandeis` → gojudges.com
- **Bridgewater College** `bridgewater-college-va` → bceaglesports.com
- **Capital University** `capital-university` → capitalathletics.com
- **Central College** `central-college-ia` → dutchsports.com
- **Centre College** `centre-college` → athletics.centre.edu
- **Claremont-Mudd-Scripps** `cms` → cmsathletics.com
- **Clark University** `clark-university` → athletics.clarku.edu
- **Colorado College** `colorado-college` → cctiger.com
- **Concordia College** `concordia-college-mn` → concordiacobbers.com
- **Connecticut College** `conncoll` → conncollcamels.com
- **Dickinson College** `dickinson` → godickinsonred.com
- **Drew University** `drew-university` → drewrockets.com
- **Eastern Connecticut State University** `eastern-connecticut-state` → athletics.easternct.edu
- **Elizabethtown College** `elizabethtown-college` → jays.etown.edu
- **George Fox University** `george-fox-university` → gfuathletics.com
- **Gordon College** `gordon-college` → gordonscottish.com
- **Goucher College** `goucher-college` → goucherpanthers.com
- **Guilford College** `guilford-college` → guilfordathletics.com
- **Hamline University** `hamline-university` → hamlinepiathletics.com
- **Hartwick College** `hartwick-college` → hartwickathletics.com
- **Heidelberg University** `heidelberg-university` → heidelbergathletics.com
- **Illinois Wesleyan University** `illinois-wesleyan-university` → iwutitans.com
- _… and 55 more_

### NAIA — 51 schools (51 with mapped domain, 0 without)

- **Benedictine College** `benedictine-college` → bcathletics.com
- **Bethany College** `bethany-college-ks` → bethanylarkspurs.com
- **Briar Cliff University** `briarCliff` → bcucharger.com
- **Carroll College** `carroll-college-mt` → carrollfightingsaints.com
- **Columbia College (MO)** `columbiamoNAIA` → athletics.ccis.edu
- **Concordia University (NE)** `concordiaNE` → cunebulldogs.com
- **Concordia University Ann Arbor** `concordia-ann-arbor` → cuaacardinals.com
- **Cornerstone University** `cornerstone-university` → cornerstonegoldenathletics.com
- **Cumberland University** `cumberland-university` → athletics.cumberland.edu
- **Doane University** `doane` → doanetigers.com
- **Eastern Oregon University** `eastern-oregon-university` → eoumountaineers.com
- **Freed-Hardeman University** `freed-hardeman-university` → fhu.edu
- **Friends University** `friendsU` → friendsfalcons.com
- **Georgia Gwinnett College** `georgia-gwinnett-college` → ggcgrizzlies.com
- **Grace College** `grace-college` → gracelancers.com
- **Graceland University** `graceland-university` → gracelandyellowjackets.com
- **Hastings College** `hastings-college` → hastingsathletics.com
- **Huntingdon College** `huntingdon-college` → hcathletics.com
- **Huntington University** `huntington-university` → huntingtonforesters.com
- **Keiser University** `keiser` → keisersuncoasts.com
- **Lindsey Wilson College** `lindseywilson` → athletics.lindsey.edu
- **Marian University** `marian-university-in` → marianathletics.com
- **MidAmerica Nazarene University** `midamerica-nazarene-university` → mnuathletics.com
- **Midland University** `midland-university` → midlandwarriors.com
- **Missouri Baptist University** `missouri-baptist-university` → mbuathletics.com
- **Missouri Valley College** `missouri-valley-college` → movalleyathletics.com
- **Morningside University** `morningside` → morningsidemustangs.com
- **Mount Mercy University** `mount-mercy-university` → mmumustangs.com
- **Oklahoma City University** `okcu` → okcustars.com
- **Oregon Institute of Technology** `oregon-tech` → othathletics.com
- _… and 21 more_

### JUCO — 89 schools (89 with mapped domain, 0 without)

- **Allen Community College** `allen-cc` → allencc.edu
- **American River College** `american-river-college` → athletics.arc.losrios.edu
- **Arizona Western College** `arizona-western-college` → athletics.azwestern.edu
- **Bakersfield College** `bakersfield-college` → athletics.bakersfieldcollege.edu
- **Barton County Community College** `bartonCounty` → bartonathletics.com
- **Blinn College** `blinn-college` → blinn.edu
- **Brookdale Community College** `brookdale-cc` → brookdalecc.edu
- **Butler Community College** `butler-cc` → butlercc.edu
- **Cecil College** `cecil-college` → athletics.cecil.edu
- **Chandler-Gilbert Community College** `chandler-gilbert-cc` → athletics.cgc.edu
- **Cisco College** `cisco-college` → athletics.cisco.edu
- **Cloud County Community College** `cloudcounty` → cloudcc.edu
- **Coffeyville Community College** `coffeyville-cc` → athletics.coffeyville.edu
- **College of DuPage** `college-of-dupage` → cod.edu
- **College of the Canyons** `college-of-the-canyons` → athletics.canyons.edu
- **College of the Sequoias** `college-of-the-sequoias` → athletics.cos.edu
- **Contra Costa College** `contra-costa-college` → athletics.contracosta.edu
- **Cosumnes River College** `cosumnes-river-college` → athletics.crc.losrios.edu
- **County College of Morris** `county-college-of-morris` → ccm.edu
- **Cowley College** `cowley` → cowleycollege.edu
- **Des Moines Area Community College** `des-moines-area-cc` → dmacc.edu
- **Diablo Valley College** `diablo-valley-college` → athletics.dvc.edu
- **Dodge City Community College** `dodge-city-cc` → dc3athletics.com
- **Dutchess Community College** `dutchess-cc` → sunydutchess.edu
- **Eastern Arizona College** `eastern-arizona-college` → athletics.eac.edu
- **El Camino College** `el-camino-college` → elcamino.edu
- **Elgin Community College** `elgin-cc` → athletics.elgin.edu
- **Fresno City College** `fresno-city-college` → athletics.fresnocitycollege.edu
- **Fullerton College** `fullerton-college` → athletics.fullcoll.edu
- **Garden City Community College** `garden-city-cc` → athletics.gcccks.edu
- _… and 59 more_

## Schools where ONE gender succeeded but the other failed

37 entries. These usually mean the school genuinely lacks one program (common at JUCO/NAIA) OR the parser's gender filter was too strict on a shared staff page. Worth a sample check before assuming "no program".

## Athletics-domain TLD distribution within failures

Mapped-domain failures grouped by TLD. `.com` failures are mostly SIDEARM-or-similar commercial vendors; `.edu` failures are almost always WordPress/Site Improve installs that need new URL patterns. Phase 2 should target the `.edu` slice first.

| TLD | Failures with this TLD |
|---|---:|
| .com | 499 |
| .edu | 239 |
| .net | 1 |

## Recommended ordering for the next pass

Based on the buckets above:

1. **Add domain mappings.** 0 failures have no `ATHLETICS_DOMAINS` entry, so they only get DDG discovery. Even rough domain mappings unlock the URL-pattern engine for them.
2. **Add non-SIDEARM URL patterns.** `.edu` failures (mostly D3/NAIA WordPress) are the largest mapped-but-failing slice — Phase 2 of the brief.
3. **Improve search fallback.** DDG-only / top-1-result is brittle for small schools (Phase 3).
4. **Persist `urlAttempts` into the cache.** This audit can't currently see HTTP status per pattern — add it to scrapeCoaches.ts so the next audit can show "404 vs redirect vs 200-but-empty" splits.
