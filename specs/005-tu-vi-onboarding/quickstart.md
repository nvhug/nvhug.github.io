# Quickstart: Horoscope Onboarding (Tử Vi Onboarding)

Manual validation scenarios proving the feature works end-to-end. See [data-model.md](./data-model.md) for the exact field shapes and [spec.md](./spec.md) for the full acceptance scenarios.

## Prerequisites

- Dev server running: `npm run dev`
- A logged-in test account with **no** `horoscope` key yet under its `user_profiles.profile_data` (fresh account, or manually clear the key in Supabase for an existing one)

## Scenario 1 — First-time onboarding (User Story 1, SC-001)

1. Log in and navigate to `/tu-vi`.
2. Expect the onboarding form: birth date (via `<DatePicker>`), birth time (via `<TimePicker>` + "Không rõ giờ sinh" checkbox), gender.
3. Enter a valid birth date, select a gender, leave birth time as unknown.
4. Submit.
5. **Expected**: redirected to `/tu-vi/overview`; in Supabase, `user_profiles.profile_data.horoscope` for this user now has `birthDateSolar`, an auto-computed `birthDateLunar`, `birthTimeUnknown: true`, `birthTime: null`, and the selected `gender`.

## Scenario 2 — Returning user skips onboarding (User Story 2, SC-003)

1. As the same user from Scenario 1, navigate to `/tu-vi` again.
2. **Expected**: no onboarding form is shown; the user lands directly on `/tu-vi/overview`.

## Scenario 3 — Edit saved birth info (User Story 3, SC-004)

1. Navigate to `/tu-vi/edit`.
2. **Expected**: form is pre-filled with the values saved in Scenario 1.
3. Change the birth time to an explicit value (uncheck "Không rõ giờ sinh", pick a time) and submit.
4. **Expected**: save succeeds; re-opening `/tu-vi/edit` shows the new birth time; `birthDateSolar`/`gender` are unchanged; `updatedAt` has advanced.

## Scenario 4 — Validation (SC-002, Edge Cases)

1. On `/tu-vi` (fresh account) or `/tu-vi/edit`, enter a birth date in the future (or an impossible date if the picker allows raw entry) and submit.
2. **Expected**: inline error shown, nothing saved, previously entered gender/time values remain in the form.
3. Leave gender unselected and submit.
4. **Expected**: inline error shown, submission blocked.

## Scenario 5 — Unauthenticated access

1. Log out, then navigate directly to `/tu-vi` or `/tu-vi/edit`.
2. **Expected**: redirected to sign-in before seeing the form (FR-001).
