# Phase 7 — Deployment (Free Tier)

## Architecture
| Service | Platform | Cost |
|---|---|---|
| Frontend (Next.js) | Vercel | Free |
| Backend (Node.js + Socket.io) | Render | Free |
| Database | Supabase | Free |

> ⚠️ **Render Free Tier caveat:** The backend service spins down after
> 15 minutes of inactivity and takes ~30–50s to cold start on the next
> request. For a game app used with real players this is fine — the first
> person to open the room wakes the server, and it stays warm during play.
> If you need zero cold start later, upgrade to Render's $7/mo Starter plan.

---

## Step 7.1 — Prepare for Production

### Backend (`apps/server`)

Add a `render.yaml` at project root:

```yaml
# render.yaml
services:
  - type: web
    name: ipl-auction-server
    runtime: node
    rootDir: apps/server
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SUPABASE_URL
        sync: false          # fill in Render dashboard
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false          # fill in Render dashboard
      - key: CLIENT_URL
        sync: false          # your Vercel frontend URL
      - key: PORT
        value: 10000         # Render assigns this automatically
```

Update `apps/server/src/index.ts` to use the correct port:

```ts
const PORT = process.env.PORT || 4000;
```

Update CORS in the server to accept your Vercel domain:

```ts
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});
```

Add a `build` script to `apps/server/package.json`:

```json
"scripts": {
  "build": "tsc",
  "start": "node dist/index.js",
  "dev": "nodemon src/index.ts"
}
```

### Frontend (`apps/web`)

Update `apps/web/.env.production`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SOCKET_URL=https://ipl-auction-server.onrender.com
```

---

## Step 7.2 — Deploy Backend to Render

1. Push your project to GitHub (public or private repo)

2. Go to [render.com](https://render.com) → Sign up (free) → **New → Web Service**

3. Connect your GitHub repo

4. Fill in settings:
   - **Name:** `ipl-auction-server`
   - **Root Directory:** `apps/server`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

5. Under **Environment Variables**, add:
   - `SUPABASE_URL` → your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` → your service role key
   - `CLIENT_URL` → your Vercel URL (add this after Step 7.3)
   - `NODE_ENV` → `production`

6. Click **Create Web Service** — Render builds and deploys automatically

7. Copy your Render URL (e.g. `https://ipl-auction-server.onrender.com`)

8. Verify it's live:
   ```bash
   curl https://ipl-auction-server.onrender.com/health
   # Should return: { "status": "ok" }
   ```

---

## Step 7.3 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up (free) → **Add New Project**

2. Import your GitHub repo

3. Fill in settings:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `apps/web`

4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your anon key
   - `NEXT_PUBLIC_SOCKET_URL` → your Render URL from Step 7.2

5. Click **Deploy**

6. Copy your Vercel URL (e.g. `https://ipl-auction.vercel.app`)

---

## Step 7.4 — Wire Frontend URL back into Render

1. Go to Render dashboard → your `ipl-auction-server` service
2. Environment → update `CLIENT_URL` to your Vercel URL
3. Render will redeploy automatically

---

## Step 7.5 — Verify Full Deployment

Run these checks after both are deployed:

- [ ] Open `https://ipl-auction.vercel.app` — landing page loads
- [ ] Create a room → room code appears
- [ ] Open a second browser tab → join with the room code
- [ ] Host starts auction → both tabs see the player card appear
- [ ] Place a bid from tab 2 → tab 1 shows bid update in real-time
- [ ] Timer expires → player sold, budget deducted on both tabs
- [ ] Check Supabase dashboard → `auction_log` table has the sale record

---

## Step 7.6 — Keep Render Alive (Optional)

Since Render free tier sleeps after 15 min inactivity, add a simple ping
to prevent cold starts during a live game session. Add this to your
`apps/server/src/index.ts`:

```ts
// Keep-alive ping endpoint (hit this before starting a game)
app.get('/ping', (req, res) => res.json({ alive: true }));
```

Or use a free uptime monitor like [UptimeRobot](https://uptimerobot.com)
to ping `/health` every 14 minutes — this keeps Render warm at zero cost.

---

## Deployment Checklist

- [ ] `render.yaml` committed to repo
- [ ] `.env.production` committed (without secret values — use `.env.example`)
- [ ] `.gitignore` includes `.env`, `.env.local`, `.env.production`
- [ ] Render service deployed and `/health` returns 200
- [ ] Vercel project deployed and loads correctly
- [ ] `CLIENT_URL` on Render updated to Vercel domain
- [ ] `NEXT_PUBLIC_SOCKET_URL` on Vercel updated to Render domain
- [ ] End-to-end multiplayer test passed on production URLs
- [ ] Commit: `[Phase7] Production deployment on Vercel + Render`
- [ ] Merge `phase/7-deploy` → `main`
