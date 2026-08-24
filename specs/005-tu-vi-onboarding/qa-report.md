# QA Report: Horoscope Onboarding (Tử Vi Onboarding)

**Method note**: this environment has no browser/screenshot tool available, so this QA pass is `npm run build` + dev-server HTTP smoke checks + unit tests + a manual code-level trace of every acceptance scenario against the actual implementation — not an interactive click-through in a real browser. Flagged explicitly per project convention (don't claim UI verification that wasn't actually done).

## Automated checks

| Check | Result |
|---|---|
| `npm run build` (production build, all 3 new routes) | ✅ Pass — `/tu-vi`, `/tu-vi/edit`, `/tu-vi/overview` all compile and statically prerender |
| `npx tsc --noEmit` | ✅ Pass |
| `npx eslint` on all changed files | ✅ Pass, 0 warnings |
| `npx vitest run` (full suite) | ✅ 193/193 pass |
| Dev server smoke test: `GET /tu-vi`, `/tu-vi/edit`, `/tu-vi/overview` | ✅ All return 200, render the expected initial loading state (`Đang tải`) — confirms no server-side crash. Full auth-redirect behavior is client-side JS and was verified by code trace below, not by an actual browser session. |

## Acceptance scenarios (from spec.md), verified by code trace

**Scenario 1 — First-time onboarding**
- `app/tu-vi/page.tsx`: `useRequireAuth()` redirects to `/login` if unauthenticated (FR-001) → confirmed in code and by the `/login` 200 smoke check.
- No existing `horoscope` key → renders `HoroscopeOnboardingForm` with `DatePicker`/gender buttons/`TimePicker` + "Không rõ giờ sinh" checkbox (FR-002, FR-003) → confirmed by reading the component.
- Submit → `isValidSolarBirthDate` + gender-required check run first (FR-004, FR-002) → `buildHoroscopeProfile` derives `birthDateLunar` via `solarToLunar` (FR-004a, unit-tested against 4 known Tết dates) → fetch-merge-write to `profile_data` (FR-006) → `router.replace('/tu-vi/overview')` (FR-007). All confirmed by reading `HoroscopeOnboardingForm.tsx` + `app/tu-vi/page.tsx`.

**Scenario 2 — Returning user skips onboarding**
- `app/tu-vi/page.tsx` fetches via `fetchHoroscopeProfile`; if a profile exists, redirects to `/tu-vi/overview` before rendering the form (FR-008) → confirmed by code trace.

**Scenario 3 — Edit saved birth info**
- `app/tu-vi/edit/page.tsx` fetches the existing profile and passes it as `initialProfile`; `HoroscopeOnboardingForm` seeds all fields from it (FR-009) → confirmed by code trace. Re-saving overwrites the `horoscope` key in place via the same fetch-merge-write path.

**Scenario 4 — Validation**
- Future date / non-existent calendar date → `isValidSolarBirthDate` returns `false`, submit is blocked, `dateError` shown inline, no write occurs (FR-004, FR-005) → unit-tested directly (`horoscope-profile.test.ts`, including the UTC+7 boundary regression test).
- Missing gender → `genderError` shown, submit blocked (FR-002) → confirmed by code trace.
- Both checks run independently before any state mutation, so a rejected submit never discards already-entered values (FR-005) — confirmed: `handleSubmit` only calls `setSaving`/writes after both checks pass.

**Scenario 5 — Unauthenticated access**
- Covered by `useRequireAuth()` on all three pages; confirmed in code and by the dev-server smoke check.

## Not covered by this pass

- Real Supabase read/write against a live `user_profiles` row (would need a seeded test account + browser session) — the write path was verified by code review (round 1–3) instead, including the fetch-merge-write fix for the JSONB-overwrite bug.
- Visual/responsive check of the actual rendered form (colors, spacing, mobile layout) — DESIGN.md's decisions were followed in code but not visually confirmed in a browser.

## Verdict

Pass, with the scope limitation above disclosed rather than silently skipped.
