# KickrIQ deployment runbook

End-to-end steps to launch KickrIQ to a production domain. **Stack:** Vercel (frontend) + Railway (Express API) + Supabase + Cloudflare (DNS) + your domain registrar.

---

## Day 1 — accounts & domain (~45 min)

### 1. Buy the domain
- Use **Cloudflare Registrar** ($10.44/yr — at-cost pricing, no markup): [https://dash.cloudflare.com/?to=/:account/registrar/register](https://dash.cloudflare.com/?to=/:account/registrar/register)
- Search `kickriq.com`. As of last check, all `kickriq.*` extensions are available.
- Default DNS lives in Cloudflare — no extra step needed.

### 2. Create accounts
- **Vercel:** [https://vercel.com/signup](https://vercel.com/signup) — sign in with GitHub. Free tier is fine.
- **Railway:** [https://railway.com/login](https://railway.com/login) — sign in with GitHub. Free tier dies after $5; switch to Hobby ($5/mo) before launch so the API doesn't sleep.
- **Supabase:** you already have a project at `lawfuewnkglwabtykzqi.supabase.co`. Confirm this is the *production* project; if not, create a new one and run migrations there.

### 3. Push your repo to GitHub
```bash
git status                          # confirm working tree clean
git push origin main
```
(If you don't have a GitHub remote yet, create a private repo on github.com and `git remote add origin ...`.)

---

## Day 2 — deploy & wire (~2 hr)

### 4. Deploy the Express API to Railway
1. Railway dashboard → "New Project" → "Deploy from GitHub repo" → pick this repo.
2. Railway auto-detects Node. The included [`railway.json`](railway.json) tells it to run `npm run start:server`.
3. **Set environment variables** (Railway → Variables tab). Copy every var from [`.env.example`](.env.example) except the `VITE_*` ones (those go to Vercel). Use real values:
   - `ANTHROPIC_API_KEY` — your real key
   - `SUPABASE_SERVICE_KEY` — your real service-role key
   - `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — yes, the server reads these too (it constructs a Supabase client)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — your real values
   - `GOOGLE_REDIRECT_URI=https://api.kickriq.com/api/gmail/callback` (use the API subdomain you'll set up below)
   - `CLIENT_URL=https://kickriq.com`
   - `PUBLIC_BASE_URL=https://kickriq.com`
   - **Don't set `PORT`** — Railway injects it automatically.
4. Deploy. Railway will give you a URL like `kickriq-production.up.railway.app`. Verify it works:
   ```
   https://kickriq-production.up.railway.app/api/public/health
   → should return {"status":"ok",...}
   ```

### 5. Point a subdomain at Railway
Railway → Settings → Networking → "Generate Domain" → also "+ Custom Domain" → enter `api.kickriq.com`. Railway shows a CNAME target.
In Cloudflare DNS for `kickriq.com`, add:
```
Type: CNAME   Name: api   Target: <railway-cname-target>   Proxy: DNS only (grey cloud)
```
(Set proxy to "DNS only" — Cloudflare proxy can break the SSL handshake to Railway.)

### 6. Update [`vercel.json`](vercel.json) with the API URL
Replace `REPLACE-WITH-RAILWAY-URL` with `api.kickriq.com` (no `https://`, no path):
```json
{ "source": "/api/:path*", "destination": "https://api.kickriq.com/api/:path*" },
{ "source": "/sitemap.xml", "destination": "https://api.kickriq.com/sitemap.xml" }
```
Commit and push.

### 7. Deploy the frontend to Vercel
1. Vercel dashboard → "Add New Project" → import the GitHub repo.
2. Vercel auto-detects the [`vercel.json`](vercel.json) and Vite. Confirm:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
3. **Environment variables** — only the `VITE_*` ones:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Vercel gives you `kickriq.vercel.app`. Verify:
   - Landing page loads
   - Click "Sign up" — Supabase auth page appears
   - The signup network call goes through `/api/...` (DevTools → Network) and returns 200, not 404

### 8. Point the apex domain at Vercel
Vercel project → Settings → Domains → Add `kickriq.com` and `www.kickriq.com`. Vercel will show DNS instructions.
In Cloudflare DNS:
```
Type: A      Name: @     Target: 76.76.21.21        Proxy: DNS only (grey cloud)
Type: CNAME  Name: www   Target: cname.vercel-dns.com  Proxy: DNS only (grey cloud)
```
(Vercel issues SSL certs automatically — propagation usually 2–10 minutes.)

### 9. Update Supabase Auth URLs
Supabase dashboard → Authentication → URL Configuration:
- **Site URL:** `https://kickriq.com`
- **Redirect URLs:** add `https://kickriq.com/auth/callback` and `https://www.kickriq.com/auth/callback`

### 10. Update Google OAuth redirect URI
[https://console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → your OAuth 2.0 Client ID → Authorized redirect URIs → add `https://api.kickriq.com/api/gmail/callback`. Keep the localhost one for dev.

### 11. Smoke test on the live domain
- `https://kickriq.com` — landing loads
- Sign up with a test email — auth flow completes
- Onboarding profile saves
- Dashboard renders all 11 pages without errors
- DevTools → Network → no failed requests

---

## Day 3 — polish & soft launch (~1 day)

### 12. Polish pass
- Loading states on every async page
- Error toasts (not console.error)
- Mobile pass: open every page on a real phone — fix anything that overflows or has bad tap targets
- Copy pass: search the rendered site for `Lorem`, `TODO`, `FIXME`, dev-y placeholders

### 13. Final security check
- Run `/cso` (gstack OWASP/STRIDE audit)
- Verify Supabase RLS by attempting a cross-user read with another account's session token in Postman — should 403
- Confirm `.env` not in git: `git log --all -- .env` returns nothing

### 14. Soft launch
- Post in 1 trusted parent group / club coach Slack
- Watch Vercel + Railway logs for errors for the first 24 hr
- Have a hot-fix branch ready

---

## Costs
| Service | Monthly |
|---|---|
| Cloudflare Registrar | $0.87 (~$10.44/yr) |
| Vercel | $0 (Hobby tier) |
| Railway | $5 (Hobby) |
| Supabase | $0 (Free tier good for first 500 users) |
| Anthropic API | varies, est. $20–50 at low volume |
| **Total** | **~$25–55/mo** until traction |

---

## Troubleshooting
- **API calls 404:** check vercel.json rewrite has the correct Railway URL
- **CORS errors:** confirm `CLIENT_URL` on Railway matches your Vercel domain exactly (no trailing slash)
- **Supabase 401 in prod:** Site URL or Redirect URLs not updated
- **Gmail OAuth fails:** redirect URI mismatch in Google Cloud Console
- **Sitemap shows wrong host:** set `PUBLIC_BASE_URL` on Railway
