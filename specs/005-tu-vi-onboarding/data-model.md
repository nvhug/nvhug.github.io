# Data Model: Horoscope Onboarding (Tử Vi Onboarding)

## Entity: Horoscope Profile

Stored under the existing `user_profiles` table, as a `horoscope` key inside the existing `profile_data` JSONB column (see [research.md](./research.md#decision-1-storage--reuse-user_profilesprofile_data-vs-a-new-table) for why no new table is introduced). One `user_profiles` row already exists per authenticated user (`id = auth.uid()`), so this key is 1:1 with the user by construction — no separate uniqueness rule is needed.

```ts
type HoroscopeProfile = {
  birthDateSolar: string        // ISO "YYYY-MM-DD", Gregorian calendar, as entered by the user (FR-002)
  birthDateLunar: {              // auto-derived from birthDateSolar, never directly edited by the user (FR-004a)
    day: number                 // 1-30
    month: number                // 1-12
    year: number
    isLeapMonth: boolean
  }
  birthTime: string | null      // "HH:MM", or null when the user marks it unknown (FR-003)
  birthTimeUnknown: boolean     // true when the user explicitly checked "Không rõ giờ sinh"
  gender: 'nam' | 'nu' | 'khac' // required (FR-002)
  updatedAt: string             // ISO datetime, set on every save
}
```

## Validation rules (from Functional Requirements)

- `birthDateSolar` MUST parse as a real calendar date and MUST NOT be later than today (FR-004). Rejecting this must not clear the other fields already entered (FR-005).
- `gender` MUST be one of `'nam' | 'nu' | 'khac'` — required, no default (FR-002).
- `birthTime` MUST be `null` when `birthTimeUnknown` is `true`; when `birthTimeUnknown` is `false`, `birthTime` MUST be a valid `HH:MM` string (FR-003).
- `birthDateLunar` is never accepted from client input — it is always recomputed server/client-side from `birthDateSolar` at save time (FR-004a), so it cannot drift out of sync with the solar date.

## State transitions

- **Create**: no `horoscope` key present under `profile_data` → user completes the onboarding form → key is written (User Story 1).
- **Read (skip-onboarding check)**: on visiting `/tu-vi`, presence of the `horoscope` key is the signal used to decide "show onboarding form" vs. "redirect to `/tu-vi/overview`" (FR-008, User Story 2).
- **Update**: `horoscope` key already present → user opens `/tu-vi/edit` → form is pre-filled from the existing values → save overwrites the key in place, recomputing `birthDateLunar` and `updatedAt` (FR-009, User Story 3).

There is no delete transition in scope for this feature.
