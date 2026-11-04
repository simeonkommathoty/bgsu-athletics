# BGSU Athletics Portal

A small Vite + vanilla JS landing page that lists the independent sport dashboards (Hockey, Volleyball) and links to them. Each sport remains its own app (`hockey/`, `volleyball/`) with its own dependencies, tests, build and Supabase sign-in. The portal contains no authentication and no athlete data: choosing a card only navigates to `<sport>/`, where that sport's login screen applies.

## Run locally (one command, one port)

```powershell
npm.cmd run install:all   # root + hockey + volleyball dependencies (npm ci)
npm.cmd run dev           # http://127.0.0.1:5170/  (PORT=... to change)
```

The dev tool mounts each sport's own Vite dev server at `/hockey/` and `/volleyball/` and the portal at `/`. Sport-specific `.env.local` files (Supabase URL/anon key) are read from each sport folder as usual.

## Build and preview for deployment

```powershell
npm.cmd run build         # dist/ (portal) + dist/hockey/ + dist/volleyball/
npm.cmd run preview       # serves dist/ at http://127.0.0.1:5171/
```

`dist/` is a static site; host it at any path. All asset URLs are relative (`base: './'`), so no ports or hostnames are hardcoded. Each sport still builds alone with `npm run build` inside its folder.

## How navigation works

Cards are plain links with registry-relative paths (`hockey/`), so direct URLs, refresh and back/forward are ordinary browser behavior. On load the portal fetches each enabled sport's path and shows the card only if an HTML application (not the portal itself) answers there; otherwise the card is hidden and a console warning names the sport.

## Add a sport

1. Create the independent app folder at the repo root (e.g. `basketball/` with `index.html`, `package.json`, Vite config using `base: './'`).
2. Add one entry to `src/sports.js` (`id, name, description, icon (inline SVG), path: 'basketball/', enabled, order`).
3. Done: dev, build and the card list read the registry. Set `enabled: false` to hide it. Add `npm ci --prefix basketball` to `install:all` in `package.json`.

## Tests

```powershell
npm.cmd test               # registry, filtering, synthetic third sport, missing paths
npm.cmd run build
npm.cmd run test:browser   # needs Chrome (BGSU_BROWSER to override); runs against dist/ and the dev server
npm.cmd run test:all       # everything plus both sport suites
```

## Production configuration still required

- Per-sport Supabase URL and anon key (build-time `VITE_SUPABASE_*` in each sport's environment). None is committed.
- Host `dist/` and confirm Supabase auth redirect/allowed-origin settings for the final URL.
- Optional future SSO: the portal is independent of auth; an SSO gate can wrap `startPortal` in `src/main.js` without changing the cards.

## Sports Home and Demo Mode

Each sport shows a **Sports Home** link (login screen and dashboard) that is a plain relative link (`../`), so it returns to the portal in local dev (`/hockey/` -> `/`) and when the site is hosted under any sub-directory, with no hostnames in code.

Each sport also has an **Explore Demo** button on its login screen that opens the full dashboard from synthetic, in-memory data (URL fragment `#demo`). Demo Mode needs no credentials or network, creates no Supabase client, and is separate from Coach Login. See `hockey/HANDOVER.md` / `volleyball/HANDOVER.md` ("Demo Mode") for details and for how a new sport adds its own demo fixtures.

## GitHub Pages deployment

- **Site:** https://simeonkommathoty.github.io/bgsu-athletics/ (Hockey `/hockey/`, Volleyball `/volleyball/`; Demo: append `#demo`)
- **Repo:** https://github.com/simeonkommathoty/bgsu-athletics, deploys from the `main` branch via `.github/workflows/deploy-pages.yml` (Settings > Pages > Source: GitHub Actions).
- **Publish an update:** commit, then `git push origin main`. The workflow installs from lockfiles, runs unit tests, builds the portal and both sports, runs `tests/pages-check.js` (serves `dist/` under `/bgsu-athletics/` and drives all 23 features in Demo Mode), then deploys. It can also be run manually from the Actions tab.
- **Local:** `npm run install:all`, `npm run dev`, `npm run build`, `npm run preview`, `node tests/pages-check.js` (needs Chrome; `BGSU_BROWSER` overrides the path). All asset URLs are relative (`base: './'`), so no base-path config is needed.
- **Supabase (optional; without it the site is demo-only):** add repository **variables** (Settings > Secrets and variables > Actions > Variables) `HOCKEY_SUPABASE_URL`, `HOCKEY_SUPABASE_ANON_KEY`, `VOLLEYBALL_SUPABASE_URL`, `VOLLEYBALL_SUPABASE_ANON_KEY`. The workflow writes them to each sport's own `.env.production`. These are public browser values; never use a service-role key. Hockey's `VITE_HOCKEY_NICKNAME_ALIASES` / `VITE_HOCKEY_FORMER_PLAYERS` contain athlete names and are intentionally not set in CI.
- **Auth redirects (per Supabase project, Auth > URL Configuration):** Hockey: add `https://simeonkommathoty.github.io/bgsu-athletics/hockey/`; Volleyball: add `https://simeonkommathoty.github.io/bgsu-athletics/volleyball/`; set Site URL to the matching one. Live login on the hosted site has not been verified.
- **Troubleshooting:** open the failed run in the Actions tab; the failing step names the cause (tests, build output, browser check). Blank page: check the Network tab for 404s on assets.
- **Roll back:** `git revert <bad-commit>` and push (never force-push), or re-run an earlier successful workflow run from the Actions tab.
