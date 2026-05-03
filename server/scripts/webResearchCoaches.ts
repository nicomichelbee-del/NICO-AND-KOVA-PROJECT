/**
 * Web-search-grounded coach researcher — accuracy edition.
 * claude-sonnet-4-6 + web_search + exponential backoff + .edu-only email filter.
 *
 * Usage:
 *   npx tsx server/scripts/webResearchCoaches.ts
 *   npx tsx server/scripts/webResearchCoaches.ts --limit=20
 *   npx tsx server/scripts/webResearchCoaches.ts --school=unc
 *   npx tsx server/scripts/webResearchCoaches.ts --concurrency=3
 *   npx tsx server/scripts/webResearchCoaches.ts --resume   # skip already-resolved
 */
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const CACHE_PATH = path.join(__dirname, '..', 'data', 'coachesScraped.json')
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k,v]=a.replace(/^--/,'').split('='); return [k,v??'true'] }))
const DRY_RUN   = args['dry-run']==='true'
const ARG_LIMIT = args.limit ? parseInt(args.limit,10) : Infinity
const ARG_SCHOOL= args.school as string|undefined
const ARG_CONC  = args.concurrency ? parseInt(args.concurrency,10) : 3
const ARG_RESUME= args.resume==='true'

interface ScrapedCoach {
  schoolId:string; schoolName:string; gender:'mens'|'womens'
  coachName:string; coachTitle:string; coachEmail:string
  sourceUrl:string; scrapedAt:string; status:string; reason?:string
}
type Cache = Record<string,ScrapedCoach>
const loadCache=():Cache=>JSON.parse(fs.readFileSync(CACHE_PATH,'utf8'))
const saveCache=(c:Cache)=>fs.writeFileSync(CACHE_PATH,JSON.stringify(c,null,2))

const FREE_RE=/^(gmail|yahoo|hotmail|outlook|aol|icloud|msn|protonmail|ymail|live|me|mac)\.(com|net)$/i
function isInstitutional(email:string):boolean {
  const m=email.toLowerCase().match(/@([^@\s>]+)\s*$/)
  if(!m)return false
  const d=m[1]
  if(FREE_RE.test(d))return false
  return /\.(edu|gov|mil)$/.test(d)||/\.ac\.[a-z]{2}$/.test(d)
}

const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY??''})

async function withRetry<T>(fn:()=>Promise<T>,max=5):Promise<T> {
  let delay=15000
  for(let i=0;i<=max;i++){
    try{return await fn()}catch(e:any){
      const is429=e?.status===429||String(e?.message).includes('429')||String(e?.message).toLowerCase().includes('rate_limit')
      if(is429&&i<max){
        const wait=delay*(1+0.2*Math.random())
        console.log(`  ⏳ rate limit — waiting ${Math.round(wait/1000)}s (attempt ${i+1}/${max})`)
        await new Promise(r=>setTimeout(r,wait))
        delay=Math.min(delay*2,120000)
        continue
      }
      throw e
    }
  }
  throw new Error('unreachable')
}

async function researchOne(school:string,gender:'mens'|'womens') {
  const gl=gender==='mens'?"men's":"women's"
  const prompt=`Find the CURRENT head coach of the ${gl} soccer program at ${school}.
Search the official athletic department page (.edu or official athletics domain).
Extract: head coach full name, email (ONLY if printed on the official page, must end in .edu), page URL.
If no ${gl} varsity soccer program exists: return coachName="NO_PROGRAM".
Return ONLY JSON: {"coachName":"Full Name","coachEmail":"coach@school.edu","sourceUrl":"https://...","reason":"one sentence"}`
  try {
    const resp=await withRetry(()=>client.messages.create({
      model:'claude-sonnet-4-6',max_tokens:1024,
      tools:[{type:'web_search_20250305' as any,name:'web_search',max_uses:5}],
      messages:[{role:'user',content:prompt}],
    }))
    let txt=''; for(const b of resp.content)if(b.type==='text')txt=b.text
    if(!txt)return{coachName:'',coachEmail:'',sourceUrl:'',reason:'no text'}
    const c=txt.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim()
    const m=c.match(/\{[\s\S]*\}/)
    if(!m)return{coachName:'',coachEmail:'',sourceUrl:'',reason:'no JSON'}
    const p=JSON.parse(m[0])
    const raw=typeof p.coachEmail==='string'?p.coachEmail.trim():''
    const email=raw&&isInstitutional(raw)?raw:''
    const note=raw&&!email?` (email "${raw}" rejected)`:''
    return{
      coachName: typeof p.coachName==='string'?p.coachName.trim():'',
      coachEmail: email,
      sourceUrl: typeof p.sourceUrl==='string'?p.sourceUrl.trim():'',
      reason: (typeof p.reason==='string'?p.reason.trim():'')+note,
    }
  }catch(e){return{coachName:'',coachEmail:'',sourceUrl:'',reason:`error: ${(e as Error).message?.slice(0,100)}`}}
}

async function runWithLimit<T,U>(items:T[],limit:number,fn:(item:T,i:number)=>Promise<U>):Promise<U[]> {
  const results:(U|undefined)[]=new Array(items.length); let cursor=0
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(cursor<items.length){const i=cursor++;results[i]=await fn(items[i],i)}
  })); return results as U[]
}

async function main() {
  const cache=loadCache()
  const RESOLVED=new Set(['success','web-verified','web-name-only','email-inferred','no-program'])
  const queue:Array<{key:string;entry:ScrapedCoach}>=[]
  for(const[key,entry]of Object.entries(cache)){
    if(ARG_SCHOOL&&entry.schoolId!==ARG_SCHOOL)continue
    if(ARG_RESUME&&RESOLVED.has(entry.status))continue
    if(entry.status!=='failed')continue
    queue.push({key,entry})
  }
  const limited=queue.slice(0,ARG_LIMIT)
  console.log(`══ WEB RESEARCH (Sonnet) ══\nEntries: ${limited.length}  Concurrency: ${ARG_CONC}`)
  if(DRY_RUN){console.log('Dry run.'); limited.slice(0,10).forEach(({key})=>console.log(' ',key)); return}
  console.log()
  let verified=0,nameOnly=0,noProgram=0,stillFailed=0,errors=0,counter=0
  await runWithLimit(limited,ARG_CONC,async({key,entry})=>{
    const r=await researchOne(entry.schoolName,entry.gender); counter++
    let status:string
    if(r.coachName==='NO_PROGRAM')     {status='no-program';noProgram++}
    else if(r.coachName&&r.coachEmail) {status='web-verified';verified++}
    else if(r.coachName)               {status='web-name-only';nameOnly++}
    else if(r.reason.startsWith('error:')){status='failed';errors++}
    else                               {status='failed';stillFailed++}
    if(status!=='failed'){
      cache[key]={...entry,coachName:status==='no-program'?'':r.coachName,coachTitle:entry.coachTitle||'Head Coach',
        coachEmail:status==='no-program'?'':r.coachEmail,sourceUrl:r.sourceUrl||entry.sourceUrl,
        scrapedAt:new Date().toISOString(),status,reason:r.reason}
    }else{cache[key]={...entry,scrapedAt:new Date().toISOString(),reason:r.reason}}
    const tag=status==='web-verified'?'🌐✅':status==='web-name-only'?'🌐🟡':status==='no-program'?'⛔':'❌'
    console.log(`[${counter}/${limited.length}] ${tag} ${entry.schoolId}:${entry.gender}  ${r.coachName||'(no name)'}  ${r.coachEmail||'(no email)'}  — ${r.reason.slice(0,90)}`)
    if(counter%10===0)saveCache(cache)
  })
  saveCache(cache)
  console.log(`\n══ DONE ══\n✅ verified:${verified}  🟡 name-only:${nameOnly}  ⛔ no-program:${noProgram}  ❌ failed:${stillFailed}  💥 errors:${errors}`)
  console.log('\nNext: npx tsx server/scripts/finishPipeline.ts')
}
main().catch(e=>{console.error('CRASHED:',e);process.exit(1)})
