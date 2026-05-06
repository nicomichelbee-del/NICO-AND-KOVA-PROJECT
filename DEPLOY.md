# KickrIQ deployment runbook (free tier)

End-to-end steps to launch KickrIQ to **kickriq.com** on free tiers. Stripe billing is intentionally off — Pro features sit behind a waitlist gate, no payments today.

**Stack:** Vercel (frontend) + Render free (Express API) + Supabase + Cloudflare Registrar/DNS

> Domain registrar: Cloudflare (purchased 2026-05-05). DNS already lives in Cloudflare — no nameserver change needed.

---

## Phase 1 — accounts (~10 min)

### 1. Create accounts (sign in with GitHub on both)
- **Vercel:** [https://vercel.com/signup](https://vercel.com/signup) — free tier, never expires
- **Render:** [https://render.com/register](https://render.com/register) — free web service (sleeps after 15 min idle, ~30s cold start; fine for soft launch)
- **Supabase:** you already have a project at `lawfuewnkglwabtykzqi.supabase.co`. Confirm this is the *production* project. If not, create a new one and re-run migrations there.

### 2. Push the repo to GitHub
If it's not already on GitHub:
```bash
git status                # confirm working tree clean
git push origin main
```
If you don't have a remote: create a private repo on github.com and `git remote add origin <url>` first.

---

## Phase 2 — deploy & wire (~1.5 hr)

### 3. Deploy the Express API to Render
1. Render dashboard → **New +** → **Web Service** → **Build and deploy from a Git repository** → pick this repo.
2. Render auto-detects [`render.yaml`](render.yaml) — it sets build/start commands, the health check, and the public env vars (`CLIENT_URL`, `PUBLIC_BASE_URL`, `GOOGLE_REDIRECT_URI`).
3. **Set the secret env vars** (the `sync: false` ones in `render.yaml`). Render will prompt for these on first deploy:
   - `ANTHROPIC_API_KEY` — your real key
   - `SUPABASE_SERVICE_KEY` — your real service-role key (Supabase → Settings → API → "Reveal")
   - `VITE_SUPABASE_URL` — yes, the server reads these too
   - `VITE_SUPABASE_ANON_KEY`
   - `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — leave empty if Gmail OAuth isn't set up yet (the app falls back gracefully)
4. **Plan: Free.** **Don't** set `PORT` — Render injects it.
5. Deploy. You'll get a URL like `kickriq-api.onrender.com`. Verify:
   ```
   https://kickriq-api.onrender.com/api/public/health
   → {"status":"ok",...}
   ```
   First hit may take 30s (cold start); subsequent hits are fast.

### 4. Point `api.kickriq.com` at Render
Render → your service → **Settings** → **Custom Domains** → **Add Custom Domain** → enter `api.kickriq.com`. Render shows a CNAME target (something like `kickriq-api.onrender.com`).

In Cloudflare → kickriq.com → **DNS → Records** → **Add record**:
```
Type: CNAME    Name: api    Target: <render-cname-target>    Proxy status: DNS only (grey cloud)
```
> Set proxy to **DNS only** — the Cloudflare orange-cloud proxy can break Render's auto-SSL handshake.

Render auto-issues a Let's Encrypt cert in 2–10 min. When green, verify:
```
https://api.kickriq.com/api/public/health → {"status":"ok",...}
```

### 5. Deploy the frontend to Vercel
1. Vercel dashboard → **Add New Project** → import the GitHub repo.
2. Vercel auto-detects [`vercel.json`](vercel.json) and Vite. Confirm:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
3. **Environment variables** — only the public `VITE_*` ones:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. You'll get `kickriq.vercel.app`. Verify:
   - Landing page loads
   - `/api/public/health` works on the Vercel URL too (the rewrite in `vercel.json` proxies `/api/*` to `api.kickriq.com`)

> [`vercel.json`](vercel.json) is already wired to `https://api.kickriq.com` — no manual edit needed.

### 6. Point the apex + www at Vercel
Vercel project → **Settings → Domains** → add `kickriq.com` and `www.kickriq.com`. Vercel will show DNS instructions.

In Cloudflare DNS:
```
Type: A       Name: @      Target: 76.76.21.21               Proxy: DNS only (grey cloud)
Type: CNAME   Name: www    Target: cname.vercel-dns.com      Proxy: DNS only (grey cloud)
```
Vercel issues SSL certs automatically (2–10 min). When green:
```
https://kickriq.com → landing page
https://www.kickriq.com → redirects to apex
```

### 7. Update Supabase Auth URLs
Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://kickriq.com`
- **Redirect URLs (additional):**
  - `https://kickriq.com/auth/callback`
  - `https://www.kickriq.com/auth/callback`
  - keep `http://localhost:5173/auth/callback` for dev

### 8. (Optional) Update Google OAuth redirect URI
Only if Gmail-connected outreach is on. [https://console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services → Credentials** → your OAuth 2.0 Client ID → **Authorized redirect URIs** → add:
```
https://api.kickriq.com/api/gmail/callback
```
Keep the localhost one for dev.

### 9. Smoke test on the live domain
- `https://kickriq.com` — landing renders
- Sign up with a test email — auth flow completes (check inbox + Supabase `auth.users`)
- Onboarding profile saves
- All 11 dashboard pages render without errors
- DevTools → Network: no 404s, no CORS errors
- First API call after 15 min idle takes ~30s (cold start). Subsequent calls are fast.

---

## Phase 3 — soft launch

### 10. Polish pass
- Loading states on every async page
- Error toasts (not console.error)
- Mobile pass on a real phone — fix overflows + tap targets
- Search the rendered site for `Lorem`, `TODO`, `FIXME`, dev placeholders

### 11. Security check
- Run `/cso` (gstack OWASP/STRIDE audit)
- Verify Supabase RLS by attempting a cross-user read with another account's token in Postman — should 403
- Confirm `.env` not in git: `git log --all -- .env` returns nothing

### 12. Soft launch
- Post in 1 trusted parent group / club coach Slack
- Watch Vercel + Render logs for 24 hr
- Hot-fix branch ready

---

## Costs (free path)
| Service | Monthly |
|---|---|
| Cloudflare Registrar | ~$0.87 (~$10.44/yr — already paid) |
| Cloudflare DNS | $0 |
| Vercel | $0 (Hobby) |
| Render | $0 (Free web service, sleeps after 15 min idle) |
| Supabase | $0 (Free tier — good for first ~500 users) |
| Anthropic API | varies, est. $20–50/mo at low volume (pay-as-you-go) |
| Stripe | $0 (off — Pro features behind waitlist) |
| **Total** | **~$20–50/mo** (just Anthropic) |

When you outgrow free tiers (mostly: cold starts annoy users, or you hit Supabase 500 MAU): upgrade Render to Starter ($7/mo, no sleep) and consider Supabase Pro ($25/mo).

---

## Troubleshooting
- **API calls 404 on the live site:** Render service is asleep (first hit is slow) OR `vercel.json` rewrite doesn't match. Hit `https://api.kickriq.com/api/public/health` directly — should return `{status:"ok"}`.
- **CORS errors:** `CLIENT_URL` env var on Render must exactly match the Vercel domain (no trailing slash). Set in Render Settings → Environment.
- **Supabase 401 in prod:** Site URL or Redirect URLs not updated to kickriq.com.
- **Gmail OAuth fails:** redirect URI mismatch in Google Cloud Console — must match `GOOGLE_REDIRECT_URI` on Render exactly.
- **Sitemap shows wrong host:** `PUBLIC_BASE_URL` not set on Render.
- **Cloudflare orange cloud breaks SSL:** flip the proxy toggle to grey cloud (DNS only) on `api`, `@`, and `www` records.
- **Render free service won't wake up:** free tier sleeps aggressively. The first request after 15 min idle takes ~30s. To eliminate, upgrade to Starter ($7/mo).
