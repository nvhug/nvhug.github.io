# Release Notes: Horoscope Onboarding (Tử Vi Onboarding)

**What shipped**: The first step of the "Xem tử vi" (horoscope) feature — a logged-in user enters their birth date (solar calendar), gender, and optional birth time; the system converts the date to its lunar-calendar equivalent automatically and saves it as a personal horoscope profile. Returning users skip straight to a placeholder fortune-overview page; users can edit their saved info at any time. No fortune scoring, AI Q&A, or compatibility matching yet — those are separate future features.

**Risk level**: Low.
- No schema change — reuses the existing `user_profiles.profile_data` JSONB column, no migration.
- Auth: reuses the existing session check, no new auth path.
- New surface: 3 new client-side routes (`/tu-vi`, `/tu-vi/edit`, `/tu-vi/overview`) behind the existing login redirect, invisible to users who don't navigate to them.

**Post-release addendum**: real user feedback caught that the shared `<DatePicker>`'s month-by-month-only navigation made entering a birth year (decades in the past) require hundreds of clicks. Fixed in the shared component itself (added a direct month/year jump), not a one-off fork — benefits every other far-past/far-future use of the picker across the app. Also used as the trigger to add a durable "Interaction range check" step to rocket-core's DESIGN gate checklist, and to install the official Anthropic `frontend-design` plugin for future genuinely-new UI screens.

**What was verified**:
- 193/193 unit tests pass, including a solar→lunar conversion validated against 4 independently-known Vietnamese Lunar New Year dates (2023–2026) and a UTC+7 timezone-boundary regression test.
- `npm run build`, `tsc --noEmit`, `eslint` all clean.
- 3 rounds of code review (JSONB-overwrite bug, timezone bug, missing-profile-check bug, and 2 rounds of follow-on fixes) — final round: 0 findings.
- All 5 spec acceptance scenarios traced against the implementation (see `qa-report.md`); no browser tool was available in this environment, so this was a build/dev-server/code-trace pass, not an interactive click-through — disclosed rather than silently skipped.
