# Portal handover

Scope: root-level sport selection portal only. Sport apps (`hockey/`, `volleyball/`) are untouched and have their own HANDOVER.md files.

## Design
- `src/sports.js` registry -> `src/portal.js` renders cards (filters enabled + order + availability probe) -> `src/portal.css`.
- Unified strategy: relative-base builds. `tools/build.mjs` builds portal to `dist/` and each sport to `dist/<folder>/`; `tools/dev.mjs` mounts each sport's Vite dev server at `/<folder>/` under one port; `tools/preview.mjs` serves `dist/`. `tools/sports.mjs` reads the registry and skips sports lacking `index.html`+`package.json`.
- No auth in the portal; sports keep Supabase login. No SSO implemented.

## Verified (actually executed)
- `npm test` (6 portal unit tests) pass; `npm run build` builds portal + both sports; `tests/browser-check.js` against dist (cards, navigation to both sports' sign-in, refresh, direct URL, back, hidden unavailable sport, mobile 390px no overflow/stacked cards, no Supabase requests); `tests/dev-check.js` (dev server paths); hockey `npm test` 13/13 and volleyball `npm test` 13/13 still pass.
- Not verified: hosted deployment, real Supabase auth through the portal, non-Chrome browsers.

## Git
Branch `feature/sport-portal` from `refactor/volleyball-vite-modules`. Git needs `-c safe.directory=C:/Users/soter/Downloads/dash/dash`. Never stage `originals/`, `.env*`, `dist/`, `node_modules/`, `test-results/`.

## Next
Choose hosting for `dist/`, set per-sport Supabase env, confirm auth redirect URLs; optional SSO wrapper.

## Supabase configuration status (no secrets recorded)
- Hockey and Volleyball use **different** Supabase projects (different URL and key in the originals). Each sport reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from its own ignored `<sport>/.env.local`; both files are populated from the originals' browser-safe values (Hockey: publishable key; Volleyball: anon-role JWT). Vite loads env per sport root, so the portal dev server and `npm run build` keep them separate; verified the Hockey bundle contains only the Hockey project and the Volleyball bundle only its own.
- Verified (executed): both built apps show the sign-in screen with no missing-configuration error, with 12 and 11 features registered; no network calls beyond fonts at boot. NOT verified: a real coach login, RLS, realtime, storage (no credentials used).
- Manual dashboard steps, per project: Auth > URL Configuration. Add the deployed URLs to Redirect URLs. Password reset uses `redirectTo = window.location.origin` (sport code), so recovery emails return to the site ROOT, which is the portal, not `/hockey/` or `/volleyball/`; the recovery link would land on the portal and the sport's reset screen would not open. Either change that redirect in each sport's authentication service to include the sport path (small, deliberate change, not done here) or serve each sport on its own origin. Also set the Site URL, and confirm email templates.
- The deployed `dist/` contains the public key inside bundles (normal for browser-safe keys); set per-sport env in the build environment, since `.env.local` is not committed.

## Password-reset redirect fix
Hockey's `doForgotPassword` now uses `redirectTo = origin + pathname` (e.g. `/hockey/` in dev, `/<base>/hockey/` when deployed under a sub-path; query/hash excluded), so recovery links return to the sport, not the portal root. Volleyball's original has no password-recovery flow (no reset call, overlay or PASSWORD_RECOVERY handler), so there was nothing to redirect; a test guards that. Tests: hockey `npm test` 14/14 (both base paths + PASSWORD_RECOVERY overlay), volleyball 14/14. Manual: add `<deployed-origin>/hockey/` to the Hockey Supabase project's Redirect URLs (the old root-URL entry is no longer used by Hockey). A real recovery email was not sent or tested.

## Sports Home + Demo Mode
- Both sports have a "Sports Home" link (`<a href="../">`) in the login overlay and in the sidebar footer; `tests/browser-check.js` clicks it from login and from the demo dashboard in both sports, checks browser Back, and checks the relative link resolves under a sub-directory.
- "Explore Demo" (login screen) switches a sport to synthetic data via `#demo`; mode changes always reload the page, so no live or demo state crosses modes. Per-sport design and test details live in each sport's HANDOVER.md.
