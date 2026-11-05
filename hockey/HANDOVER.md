# Hockey migration handover

## A. PROJECT OBJECTIVE
Convert the authoritative ../originals/hockey.html into an independent Vite / vanilla JavaScript ES module application, with a stable shell and automatically discovered features. Overall target: six hours, preserving working checkpoints for immediate autonomous Claude Code continuation.

Non-negotiable: preserve design, all sidebar features, calculations, charts, validation, imports/exports, readiness PDF, authentication and authorized persistence. Never modify either original or Volleyball. No React, TypeScript, redesign, placeholders, shared code outside Hockey, production-connected automated tests, committed credentials or athlete records.

## B. CURRENT STATUS
All 12 original sidebar features are extracted: dashboard, roster, profile, jumping, forceplate, readiness, workload, leaderboard, position, progress, compare, audit. Each has registration, lazy entry, original HTML, logic, scoped CSS and a colocated browser scenario. No feature extraction remains pending. There are 12 feature and 22 service factories.

Completed services: composite/readiness/outlier/radar scoring; Supabase authentication/password recovery; all original import code (CSV/XLSX/custom/VALD/Firstbeat/Teambuildr/long-term/single-test); CSV and readiness print exports; identity/dedup/active roster; session/history pagination and writes; database mapping, debounced saves and realtime; photos; formatting, metric availability and chart management.

Shell discovery, contract checks, lazy loading, recovery and cleanup are implemented. Slow pending imports/mounts can be abandoned. Cleanup removes feature API registrations, destroys charts, clears timers/frames and aborts delegated handlers. Workload/Progress await their initialization and check cancellation before rendering.

The initial workspace contained only the two original HTML files: no prior tests, historical fixtures or local Git metadata. The reported historical 1,479-case suite is NOT present. Supabase is intentionally unconfigured; no environment blocker remains for local synthetic checks.

Last verified implementation checkpoint: cae3b3f. Expanded checks passed subsequently: 13 Node tests and all 12 browser reference/interaction scenarios with 18 chart configurations, actual CSV/XLSX previews, CSV/PDF report comparisons, failure recovery and built startup. FINAL exact-tree repeat (Claude Code, 2026-11-03): npm test PASS 13/13; npm run build PASS (only the nonfatal large-chunk warning); npm run test:browser PASS 12/12 features, 0 backend attempts. Originals: hockey.html SHA-256 matches reference-manifest.json; originals/ is git-ignored so volleyball.html cannot be diffed via Git (hash 3d0f5e2b...a0b0 recorded now). Secret/identity scan of tracked source found no credentials or athlete data; no TODO/FIXME in src (remaining "placeholder" strings are original app content).

## C. FILE MAP
- src/main.js and application.js: startup, overlays, dependency composition, Vite globs, auth boot.
- src/layout/layout.js, shell.html, layout.css: sidebar/topbar/main container, navigation, recoverable lifecycle. No feature calculations.
- src/layout/feature-loader.js: metadata validation/discovery and lazy implementation contracts.
- src/layout/feature-runtime.js and dom-scope.js: feature-local DOM/styles, cached UI state, timers/charts/handlers, cancellation and app-context isolation.
- src/layout/error-handler.js and events.js: labeled errors and compatibility event dispatch.
- src/features/<id>/: registration.js, feature.js, <id>.html, <id>.js, <id>.css and <id>.test.js.
- src/services/context.js and modules.js: explicit per-app dependency composition/getter-setter API.
- src/services/authentication/: login/reset/session logic and overlays.
- src/services/data/: identity, roster, mapping/persistence, sessions/history, enrichment, photos, formatting and UI helpers.
- src/services/scoring/: original composite, decline, readiness, PR, outlier and radar calculations.
- src/services/import/ and export/: original data ingestion/validation and CSV/readiness print outputs.
- src/styles/reference.css: original common theme/primitives. Profile/workload/position sections moved to feature CSS; inline styles remain with original feature UI.
- reference-manifest.json: Hockey SHA-256, extraction symbol ownership and dependencies. Logic comments identify original line numbers.
- tests/fixtures.js and support.js: synthetic inputs, isolated services and original-script oracle.
- tests/*.test.js: scoring, data/auth, loader, integrity and source-privacy checks.
- tests/browser-check.js and browser-harness.*: actual local Chrome comparisons; synthetic test hook excluded from production.
- tools/: historical extraction/inspection and comment sanitization. NOT normal runtime/build steps.
- .env.local (ignored): reference identity rules; no backend configuration. Preserve locally, never commit.
- dist/ and test-results/ (ignored): generated build and browser report/screenshot.

## D. IMPLEMENTATION DETAILS
application.js uses import.meta.glob('./features/*/registration.js') and a separate lazy feature.js glob. Metadata modules export literals only; tests enforce no startup logic/imports. The loader validates each entry, matches folder/id, sorts it and defers feature code until activation. Adding a valid folder requires no layout edit.

feature.js exports id/title/icon/order/mount(container, context)/unmount(). Existing features use createFeature and open ShadowRoots. Local DOM/selection state is cached across navigation. Failed factory creation can be retried fresh; a different application context resets the feature cache.

State lives in service/feature closures. context.api provides explicit dependencies with getters/setters. Features register actions only while mounted, with collision detection. No application globals are placed on window. A feature document adapter searches only its own ShadowRoot; its window adapter exposes no shell DOM. Trusted services can find active-feature nodes for shared controls/reports.

Original inline handlers became inert data-on... attributes. events.js uses Acorn to interpret their small call/assignment/conditional language without runtime eval. It exposes known actions, event, this and scoped document. New code may use normal listeners with lifecycle cleanup.

Shell navigation catches import/contract/mount/cleanup errors and provides Retry while retaining sidebar navigation. Superseding navigation releases pending imports/mounts. Timer, interaction, runtime and async errors have [Hockey:<scope>] labels. Chart cleanup failures are contained. Shadow DOM/ES modules are not a sandbox for arbitrary code, loops, memory exhaustion or third-party global failures; authenticated service requests may finish after cancellation.

Backend URL/public key were removed from source. Identity aliases/former-player exclusions moved to ignored .env.local, and reference identity examples were scrubbed from comments. Original data matching needs those local rules preserved. openAth now awaits profile mounting instead of assuming lazy loading completes in 60ms. Scoring arithmetic is unchanged.

## E. TESTS: EXACT COMMANDS AND RESULTS
Run from C:/Users/soter/Downloads/dash/dash/hockey:

    npm.cmd ci
    npm.cmd test
    npm.cmd run build
    npm.cmd run test:browser

Latest completed npm.cmd test: PASS 13/13. Includes executable original baseline; 1,479 NEW deterministic synthetic composite cases; decline/goalie/missing-metric cases; readiness/outliers/radar; CSV/custom/VALD/Teambuildr characterization; mapping/null photo removal/dedup/active roster; auth gates/password recovery mocks; 1000-row pagination; loader failures; metadata-only convention; both original hashes; source exclusion of backend/identity literals. This is NOT the unavailable historical corpus.

Latest build (exact final tree): PASS. Nonfatal large-bundle warning remains for Chart.js/XLSX.

Latest completed browser suite: PASS all 12 feature text/chart-input comparisons and colocated interaction scenarios against identical synthetic inputs; 18 chart configurations including populated Progress. Also passed dynamic row-to-profile navigation, sort/chips, modal tabs, actual CSV/XLSX FileReader previews, CSV output equality, exact readiness report HTML/print cleanup, import/mount/cleanup failure isolation, slow-import cancellation, no detached chart instances, built startup/sign-in screen/no test hook, zero Supabase requests and no unexpected page errors. Re-run on the exact final tree: PASS 12/12.

Individual feature in PowerShell: set $env:HOCKEY_FEATURE='profile', run npm.cmd run test:browser, then Remove-Item Env:HOCKEY_FEATURE. Its scenario plus shared recovery/export checks run. Build first for production smoke coverage. Use installed Chrome at C:/Program Files/Google/Chrome/Application/chrome.exe or HOCKEY_BROWSER. Tests use loopback 5178/5179, block external traffic, disable HMR reloads and close owned browsers/servers. Results are ignored.

Unverified: historical fixtures, exhaustive vendor spreadsheet variants, pixel-perfect rendering (fonts blocked), physical print-dialog/printer output, live sign-in/RLS, real two-coach realtime, storage upload and production datasets. Do not automate against production. The inherited profile renderer assumes displayed metrics exist; incomplete profiles can still fail there, with the new shell retaining navigation. No fabricated metric filling was introduced.

## F. GIT
Branch: refactor/hockey-vite-modules. Isolated local repository; parent C:/Users/soter/.git was not modified/configured. No remote.
Baseline documentation commit: d268e76. Verified extraction checkpoint: cae3b3f. This replaces an unpublished local checkpoint after comment-only identity cleanup; runtime expressions were unchanged in that amendment.
Current uncommitted work: expanded feature/browser/data/integrity tests, lifecycle/cancellation fixes, owned CSS, dependency dev classification, README/AGENTS/HANDOVER and sanitizer. All are intentional; preserve them. Committed after final checks (see git log).
Never stage or overwrite originals/, hockey/.env.local, node_modules/, dist/, test-results/. Originals and local identity config are needed for continuation. Git index writes and Node realpath resolution need narrow sandbox escalation here; use relevant approved npm commands. Do not change ownership, parent Git config or PowerShell execution policy.

## G. EXACT NEXT ACTION
1. DONE (see B). Previously: run npm.cmd run build, then npm.cmd run test:browser, plus npm.cmd test for the exact final tree. Last post-pass edits reset cached features for a fresh app context, retry failed factories, and disable Vite's blocking overlay.
2. Inspect test-results/dashboard.png; record actual final results and visual limits here.
3. Review diff/staging, confirm no ignored/private input is included, commit verified milestone and record hash/clean-tree status.
4. If broadening acceptance, next file to edit: tests/data.test.js. Add synthetic Firstbeat/long-term/single-test/vendor variants, then run npm.cmd test. No feature awaits extraction.

Pitfalls: never rerun tools/extract-reference.mjs over hand edits; it overwrites later lifecycle/CSS changes. Action names must be unique. Preserve historical metric meanings (approachJump=broad jump, standVert=Goal to Blue) and fixed standards. Missing profile fields are an inherited limitation. Browser module-evaluation failures may require full reload after repair.

## H. CLAUDE CODE HANDOFF
Read this file, AGENTS.md and README.md; inspect Git state. Continue autonomously on this branch, preserving originals/local config and existing verified work. Do not restart/rewrite the migration. If allowance ended before final commit, perform G in order. Update this document after meaningful checkpoints and make verified commits.

Remaining priorities: final exact-tree checks/commit; broader synthetic vendor-import coverage if needed; separate human authorized environment acceptance; optional further import-file subdivision/library chunk optimization only when justified.

Definition of done: independent Vite startup; all original automatically registered features; navigable shell during recoverable failures; unchanged scoring/data/report behavior supported by actual tests; passing build/browser/regression checks; clear human ownership/debugging/add-feature docs; unchanged originals/Volleyball; no committed private inputs; accurate handover. Exhaustive production-data parity and live backend behavior remain unverified until separately demonstrated.

## Supabase configuration (no secrets)
Browser-safe URL/key come from ignored `hockey/.env.local` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY), copied from the original HTML. Built app shows sign-in without a missing-config error. A real coach login has not been verified. See ../HANDOVER.md for Auth redirect notes.

## Profile / Compare runtime fixes (real-data errors)
Root causes (both inherited from the original, exposed by real Supabase data; stack traces from the live app were not available, so causes were established from the code and reproduced with synthetic records):
- Profile `toFixed` of undefined: the all-metrics grid called `m.fmt(val)` (and `Math.round`, percentile, bar width) on measurements an athlete lacks. Fixed in `src/features/profile/profile.js`: missing values show "—", zero-width bar, no percentile; Fixed-Plate detail tiles use "—"; Pos Avg averages only athletes that have the metric (no zero fill). Profile also looked athletes up by array position (`ATHLETES[id]`, falling back silently to athlete 0) although dropdown values are athlete ids; now looked up by id, with an empty-roster guard.
- Compare `_canonicalName` of undefined: dropdown values are athlete ids but `renderCompare` indexed `ATHLETES[parseInt(value)]` and `initCmp` hard-coded '0'/'1'. When ids are not contiguous array positions (dedup/merge/archive, realtime updates) the lookup returns undefined. Fixed in `src/features/compare/compare.js`: lookup by id, default selection = first two listed athletes, unknown/removed selections are skipped, empty selection clears the view; missing metrics render "—".
Scoring, norms and valid-data output unchanged. Regression: `tests/browser-check.js` ("partial athlete records and non-contiguous ids") fails on the old code and passes now. Results: `npm test` 13/13, `npm run test:browser` 12/12, build OK. Not verified: live data (no live calls made).

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
