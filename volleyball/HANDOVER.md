# Volleyball migration handover

## Objective
Independent Vite / vanilla-JS module app for BGSU Volleyball, built from `../originals/volleyball.html` (behavioral oracle, ignored by Git, never modify). Architecture, shell, feature runtime and test harness were copied from the verified Hockey app (`../hockey`, commit 02ae4e6) and re-extracted from the Volleyball original. No cross-sport imports; Hockey is untouched.

## Status (this checkpoint)
- 11/11 original sidebar features extracted and auto-registered via `import.meta.glob`: dashboard, roster, profile, jumping, forceplate, readiness, workload, leaderboard, position, compare, audit. (Volleyball has no Progress page; Hockey's 12th feature does not exist here.)
- 33 modules: 11 features + services (scoring, data, import, export, authentication, photos, persistence). Volleyball sources: VALD, Kinexon (not Firstbeat), Teambuildr, approach-vert, custom CSV. No XLSX and no password-reset flow exist in the original.
- Fixed (was an original defect): `renderWLHistory` wrote to `#wl-focus-label` when there is no Kinexon data, but that element is absent from the page, so Workload threw in the empty-data case. It now falls back to `#wl-cal-label`; covered by `tests/regression-empty-data.test.js`.
- Hand edit after extraction: `features/workload/workload.js` `initWL` returns its promise and checks `context.signal` (same fix as Hockey). `tools/extract-reference.mjs` overwrites this; do not rerun it.

## Layout
Same as Hockey (see README.md): `src/layout/` shell/runtime/events/loader, `src/features/<id>/{registration,feature,<id>}.js|html|css|test.js`, `src/services/**`, `reference-manifest.json` (SHA-256 + symbol ownership), `tests/`.
Config: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_VOLLEYBALL_NICKNAME_ALIASES` (JSON) in ignored `.env.local`. None is configured; the extractor does not generate `.env.local` (athlete-name aliases from the original are intentionally not materialized, so alias-dependent name matching is not reproduced locally).

## Tests (run from volleyball/, PowerShell: use npm.cmd)
    npm ci; npm test; npm run build; npm run test:browser
Last actual results: `npm test` 13/13 pass (incl. 1,479 synthetic composite cases vs the original, tiers/ACWR/outlier/radar/team-readiness vs original, DB mapping/dedup/roster, custom/VALD/Teambuildr import parsing vs original, session auth gating, 1000-row pagination, mocked sign-in, loader isolation, both originals' hashes, source privacy). `npm run build` passes (large Chart.js bundle warning only). `npm run test:browser` passes 11/11 features (text + chart data vs original), interactions, CSV import preview, CSV export equality, readiness report markup equality, failure/slow-import isolation, built-app startup, 0 Supabase requests.
Unverified: live Supabase sign-in/RLS/realtime/storage, production data, Kinexon/approach-vert/VALD vendor-file variants beyond the synthetic rows, pixel fidelity, real print.

## Git
Branch `refactor/volleyball-vite-modules` from Hockey commit 02ae4e6. Git needs `-c safe.directory=C:/Users/soter/Downloads/dash/dash` (ownership mismatch); do not edit global config. Never stage `originals/`, `.env*`, `dist/`, `test-results/`, `node_modules/`.

## Next steps
1. Optional: add synthetic Kinexon/approach-vert import tests in `tests/data.test.js`.
2. Human-run authorized environment acceptance (auth, RLS, persistence).
3. Add a feature: create `src/features/<id>/` with registration.js (literal metadata only) and feature.js; no layout edit needed.

## Supabase configuration (no secrets)
Browser-safe URL/key come from ignored `volleyball/.env.local` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY), copied from the original HTML. Built app shows sign-in without a missing-config error. A real coach login has not been verified. See ../HANDOVER.md for Auth redirect notes.

## Demo Mode (synthetic data)
- **Entry/exit:** login screen "Explore Demo" sets `#demo` and reloads; the banner "DEMO — SYNTHETIC DATA" has "Exit demo" (also the sign-out button) which clears the fragment and reloads to the login screen. Browser Back/Forward across modes reloads too (hashchange listener), so the previous mode's heap, timers and in-flight requests are discarded. Coach sign-out reloads to the login screen and never enters demo.
- **Design:** `src/services/demo/` = `demo-backend.js` (in-memory stand-in for the Supabase client: select/insert/update/upsert/delete/eq/in/ilike/is/not/order/range, a no-op realtime channel, storage and auth that return "Disabled in Demo Mode"; no fetch/WebSocket/storage/cookies), `demo-data.js` (seeded, deterministic synthetic tables with dates relative to today), `demo.js` (mode detection, banner, startup). In demo the real client is never created (`initSupabase`/`bootSupabase` return early; `config` has no URL/key/aliases/former-player lists), so the existing services run unchanged against `context.api.sb`; session-persistence/import writes go only to the in-memory tables; photo upload is refused with a message. No forged session exists (`getSession` is always null). Production `.env.local` values are not read in demo.
- **Data:** placeholder names only ("Demo ..."), sport-specific positions/metrics/session shapes, several testing dates, session history, workload + readiness rows, and deliberately incomplete athletes to exercise missing-data paths.
- **Fixes surfaced by demo data:** missing-measurement guards in Profile/Compare (see earlier section); Profile ACWR tile shows a dash when ACWR is NaN.
- **Tests:** `npm run test:demo` (browser: every sidebar feature renders with no errors/NaN, charts present, sparse athletes, no backend URL/websocket/storage/cookie, demo<->login transitions, Back/Forward, refresh), `tests/demo.test.js` (unit: data shape, in-memory client, no real client in demo, normal flow unchanged).
- **Add demo fixtures for a new sport:** copy `src/services/demo/`; rewrite `demo-data.js` to return `{athletes, test_sessions, ...}` in that app's *database column shape* (see `DB_FIELDS` in `persistence.js` and the columns its sessions consumers read); register `services/demo/demo` in `services/modules.js`; add the three guards in `authentication.js` (`initSupabase`, `bootSupabase`, `doSignOut` check `context.api.demoMode`) and the `isDemoRequested` config switch in `application.js`; add the login-screen button and Sports Home links; copy `tests/demo-check.js` with the sport's feature count and sparse-athlete names.
- **Limitations:** edits made in demo are in memory and lost on reload; photo upload/storage are disabled; imports run locally but nothing leaves the page; not verified in non-Chrome browsers or against real Supabase.

## Invalid dates and import wording
- `isValidTestDate` (`services/scoring/outliers.js`) defines a usable `test_date`. `loadAllSessions` (`services/data/sessions.js`) skips other rows with a warning + toast; `_isOutlierUncached` skips only the rolling-window check for a malformed reference date. Covered by `tests/regression-invalid-dates.test.js`.
- The import dialog footer (`#imp-save-note`) keeps its production wording; `openImport` replaces it with an explicit "temporary, synthetic" message only in Demo Mode.

## Password recovery
Coaches can use "Forgot password?" on the sign-in screen (`services/authentication`). The reset email returns to the app's own route (`window.location.origin + pathname`, so localhost and GitHub Pages both work) and Supabase starts a short-lived recovery session; the app shows a Set New Password screen and never loads data on that session. After a successful change the recovery session is ended and the coach signs in again. Expired, invalid or already-used links show a message on the sign-in screen. The request always answers the same way whether or not the email belongs to a coach.
**Supabase setting required:** this project's Authentication → URL Configuration must allow `https://simeonkommathoty.github.io/bgsu-athletics/volleyball/` (and `http://localhost:5171/**` etc. for local use), otherwise reset links fall back to the Site URL. Tests: `tests/password-recovery.test.js`. This code is independent of Hockey's.
