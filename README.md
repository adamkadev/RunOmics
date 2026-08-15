# RunOmics

A self-hosted running dashboard: it turns a Garmin Connect history into training-load
trends, route maps, race predictions and per-run analysis. Built with Next.js 16,
TypeScript, and a Python sync pipeline.

Clone it and it runs immediately on a generated demo dataset - no Garmin account, no
API key, no database.

> **Live demo:** TODO - a demo-only deployment will be linked here.

## Quick start (demo mode)

```bash
git clone https://github.com/adamkadev/RunOmics.git
cd RunOmics
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run dev` first runs `npm run prepare:data`, which finds no private data source and
generates a **deterministic synthetic dataset** into `data/` instead
(`scripts/generate_demo_data.mjs`): 18 months of runs for a fictional "Demo Runner",
procedurally-generated GPS routes over open water, invented shoes, races and goals.
Every page renders with real-looking content. Nothing in it comes from anyone's actual
training history.

The same hook runs before `dev`, `build`, `lint`, `typecheck` and `test`, and is a no-op
once `data/` exists - so a fresh clone can lint, typecheck, test and build with zero
configuration.

```bash
npm run lint        # ESLint (next/core-web-vitals + TS)
npm run typecheck   # tsc --noEmit
npm test            # Vitest: usecases, lib helpers, component tests (RTL), a11y smoke (axe-core)
npm run build       # production build
```

Python-side tests need their own dependencies:

```bash
pip install -r scripts/requirements-dev.txt
python -m pytest scripts/tests/ -q
```

## Features

- **Dashboard** - training status banner, today's hero card, week snapshot, and the
  fitness / fatigue / form trio (CTL / ATL / TSB) over a training-load chart
- **Activity detail** - GPS route map cross-linked to HR, pace and elevation charts,
  running dynamics, similar runs, and a shareable PNG card
- **Analytics** - four tabs answering one question each: am I fit, am I getting faster,
  how much am I running, is my training healthy
- **Goals** - annual distance goal with an ahead / on-track / behind projection from a
  rolling 8-week rate, plus season races and per-distance targets
- **Records** - all-time bests detected from FIT files, form at the time of each PB,
  Riegel race predictions, and distance milestones
- **Plan** - planned workouts, week purpose, training-status calendar, next race
- **Shoes** - per-pair mileage and wear alerts
- **Map** - MapLibre route-density heatmap across the whole history
- **Dark mode** - system preference + manual toggle, with several accent palettes

## Architecture

```
src/
  domain/                      Model + pure rules, no I/O
  application/usecases/        Pure data computation, one file per query
  infrastructure/repositories/ Read data/* (server-only); Firestore for cached AI insights
  app/                         Routes: server components fetch via usecases,
                               render client components for charts/interactivity
  i18n/                        Every user-facing string (en + fr)
  lib/                         Formatters, colors, math, hooks
scripts/                       Python Garmin sync pipeline + Node data/build helpers
```

Data flow at render time:

```
data/*.json  ->  getXxx() usecase  ->  page.tsx (server)  ->  *Client.tsx (browser)
```

There is no database. Every page is prerendered with ISR (`revalidate = 3600`).

### Where the data lives

`data/` sits at the repository root, deliberately **outside `public/`**: nothing in it is
reachable over HTTP, and only server-side code reads it (through
`src/infrastructure/dataPath.ts`, marked `server-only`). It is never committed - see
`.gitignore`.

`scripts/prepare-data.mjs` populates it before every dev/build:

| `RUNOMICS_DATA_REPO_URL` | What happens |
|---|---|
| unset (default) | A deterministic synthetic dataset is generated. This is what a clone gets. |
| set | The real dataset is cloned from that private repository into `data/`. |

That is the whole privacy design: **a personal deployment keeps its real Garmin history
in a separate private repository and pulls it in at build time, so the application
repository can be public without ever containing a run.**

Activities are stored one JSON file per month (`data/activities/2026-07.json`, plus an
`index.json` listing the available months), so a sync rewrites only the months it
touched instead of one large file.

---

## Personal deployment: Garmin sync

Everything below is **optional**. Skip it entirely if you only want to run or read the
project - demo mode covers that.

### Prerequisites

- Node.js >= 20, Python >= 3.11
- A Garmin Connect account
- A second, **private** GitHub repository to hold your dataset (e.g. `your-username/runomics-data`)
- A [MapTiler](https://www.maptiler.com/) key if you want route maps (free tier is enough)

### 1. Python dependencies and a Garmin token

```bash
pip install -r scripts/requirements.txt
python scripts/get_secret.py
```

`get_secret.py` authenticates with Garmin Connect through
[garth](https://github.com/matin/garth) and prints a `GARMIN_SECRET` string (a base64
OAuth token) to put in your environment.

> **Note on garth's deprecation**: garth is [no longer maintained](https://github.com/matin/garth/discussions/222)
> because Garmin keeps breaking its *login* flow. This project only uses that flow here,
> once, to mint the token - `sync.py` merely loads and refreshes the existing OAuth
> token, which continues to work (the underlying OAuth1 token lasts ~1 year). No
> migration is planned while this holds: the community alternatives are
> browser-automation or TLS-impersonation workarounds in an ongoing cat-and-mouse game,
> i.e. no more future-proof than staying put. If `get_secret.py` stops working when your
> token expires, check that discussion for the current workaround before switching
> libraries.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in what you need. Every value in
`.env.example` is a placeholder. The variables that matter:

| Variable | Used for |
|---|---|
| `GARMIN_SECRET` | `scripts/sync.py` only - never needed by the web app |
| `PRIVACY_ZONES`, `PRIVACY_RADIUS_M` | Crops GPS traces near the listed `[lon, lat]` points before anything is stored |
| `RUNOMICS_DATA_REPO_URL`, `RUNOMICS_DATA_REPO_TOKEN` | Your private dataset repository and a fine-grained PAT scoped to it |
| `NEXT_PUBLIC_MAPTILER_TOKEN` | Route maps |
| `NEXT_PUBLIC_FIREBASE_*` | Client-side sign-in, activity notes, push notification tokens |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Server-side notification state and push delivery |
| `NEXT_PUBLIC_OWNER_EMAIL` | The Google account allowed to edit notes/settings |
| `INTERNAL_NOTIFY_SECRET` | Authenticates the GitHub Actions calls to `/api/internal/*` |
| `NEXT_PUBLIC_LOCALE` | UI language, `en` (default) or `fr`, applied at build time |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional AI-written verdicts; without a key the cards keep their rules-based copy |

`.env.local` is gitignored. Never commit real values.

**Set `PRIVACY_ZONES` before your first sync.** `scripts/processing/privacy.py` refuses to
process real routes without it, so a home address cannot silently end up in the dataset.

### 3. Sync

```bash
node scripts/fetch_private_data.mjs public/data   # hydrate the sync workspace
python scripts/sync.py                            # fetch from Garmin, parse FIT, write JSON
node scripts/push_private_data.mjs public/data    # push to the private data repository
```

`public/data/` here is only the pipeline's scratch workspace - `prepare-data.mjs` moves it
into the server-only `data/` before the app is built, and it is gitignored either way.
The first run may take several minutes.

```bash
python scripts/sync.py --limit 10     # only the last 10 new activities
python scripts/sync.py --force        # re-sync everything
python scripts/sync.py --all-types    # include non-running activities
python scripts/reprocess.py           # re-parse cached FIT files after a parser change
```

Tokens are passed to git through `GIT_ASKPASS` and read from the process environment
only, so a PAT never lands in `ps`, in `.git/config`, or in a build log.

### 4. Deploy

Import the repository on [Vercel](https://vercel.com/new) with the default Next.js
settings and set the variables above as project env vars - except `GARMIN_SECRET`, which
never runs there. Add `APP_URL`, `INTERNAL_NOTIFY_SECRET` and the `RUNOMICS_DATA_REPO_*`
pair as **GitHub Actions repository secrets** as well, for the sync workflow.

`.github/workflows/sync.yml` runs the whole pipeline on a runner: hydrate, sync,
push to the private data repository, trigger a redeploy, then poke the post-sync check
endpoints. It is **`workflow_dispatch`-only in this repository** and fails fast when the
secrets are absent, so a fork never runs a red job every night. Add your own `schedule:`
block once a manual run has succeeded - the cron that suits a personal deployment is
commented at the top of the file. `daily-session-reminder.yml`, `weekly-reminder.yml` and
`stale-sync-check.yml` are manual-only for the same reason.

---

## Configuration files

Goals, official PBs and the athlete profile are plain JSON in `data/` - in a personal
deployment they live in the private dataset repository and are edited by hand. The
snippets below use values from the generated demo dataset.

```json
// data/goals.json
{
  "years": [
    {
      "year": 2026,
      "annualDistanceKm": 1200,
      "targets": [
        { "distance": "5K",            "target": "19:30" },
        { "distance": "10K",           "target": "40:30" },
        { "distance": "Half-Marathon", "target": "1:30:00" },
        { "distance": "Marathon",      "target": null }
      ]
    }
  ]
}
```

`target` is `"mm:ss"` or `"h:mm:ss"` (`null` = no target set).

```json
// data/pbs.json - official race times (chip time). Take priority over the
// best efforts auto-detected from FIT files in the Records section.
{
  "years": [
    {
      "year": 2026,
      "entries": [
        { "distance": "5K",            "time": "19:05",   "activityId": "90000161" },
        { "distance": "Half-Marathon", "time": "1:27:44", "activityId": "90000199" }
      ]
    }
  ]
}
```

Valid `distance` values: `"1K"`, `"5K"`, `"10K"`, `"Half-Marathon"`, `"Marathon"`.
`activityId` is optional and links the card to that activity's detail page.

```json
// data/athlete.json - training zones used across Analytics and Profile
{
  "displayName": "Demo Runner",
  "thresholdPowerWatts": null,
  "lthrBpm": 172,
  "thresholdPaceSecPerKm": 258,
  "hrZoneBoundsBpm": [128, 145, 160, 172, 182],
  "restingHrBpm": 50,
  "maxHrBpm": 189,
  "vmaKmh": 17.5,
  "deviceName": "Forerunner 265",
  "deviceSince": "2025-01-15"
}
```

Every field except `displayName` and `thresholdPowerWatts` is fetched from Garmin
Connect and merged in by each `scripts/sync.py` run (see `scripts/garmin/athlete.py`):
existing values survive a failed fetch, and `maxHrBpm` only ever ratchets up. Set any
field to `null` to clear it - the app falls back to a population-average default where
one exists.

### `public/events/` - race photos

Drop a photo named `{activityId}.jpg` (or `.png`, `.webp`) into `public/events/` and it
becomes the cover image on that activity's PB card. The directory is gitignored: photos
stay local to a deployment.

---

## Tests & quality

CI (`.github/workflows/ci.yml`) runs pytest, a production-dependency audit
(`npm audit --omit=dev --audit-level=high`), lint, typecheck and the Vitest suite on every
push and PR. It needs **no secrets** and builds against the generated demo dataset.

```bash
npm run test:coverage  # Vitest with a v8 coverage report (text + lcov)
npm run test:e2e       # Playwright against a real production build
npm run screenshots    # Playwright screenshot audit into screenshots/output/
npm run analyze        # production build with @next/bundle-analyzer treemaps
```

`.env.e2e` carries a placeholder Firebase client config - the app needs one to boot, and
the current specs cover read-only pages built from `data/*.json`, so no real project is
involved. Sign-in-gated flows (Settings, note editing) are not covered yet: Google's
OAuth popup needs a test-only auth bypass first.

`scripts/verify_no_private_data.mjs` is a pre-publication check: it scans the tracked
tree for data directories, env files, FIT binaries and credential shapes that must never
ship. Run it before making any fork of this project public.

```bash
node scripts/verify_no_private_data.mjs
```

The improvement backlog lives in
[`docs/product-improvement-todolist.md`](docs/product-improvement-todolist.md).

### Monitoring

`GET /api/internal/health` (authenticated with `x-internal-secret`) reports the last
synced activity date and flags the data as `stale` after 7 days without one - point an
uptime monitor at it to catch a silently broken sync.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, SSG + ISR) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Charts | [Recharts](https://recharts.org/) |
| Maps | [MapLibre GL](https://maplibre.org/) + [MapTiler](https://www.maptiler.com/) |
| Icons | [Lucide](https://lucide.dev/) |
| Dark mode | [next-themes](https://github.com/pacocoursey/next-themes) |
| Tests | [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/), [axe-core](https://github.com/dequelabs/axe-core), [pytest](https://docs.pytest.org/) |
| Garmin auth | [garth](https://github.com/matin/garth) |
| FIT parsing | [garmin-fit-sdk](https://pypi.org/project/garmin-fit-sdk/) |
| Weather | [Open-Meteo](https://open-meteo.com/) (no key) |
