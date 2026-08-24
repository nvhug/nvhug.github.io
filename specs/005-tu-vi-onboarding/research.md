# Research: Horoscope Onboarding (Tử Vi Onboarding)

No `[NEEDS CLARIFICATION]` markers remained in the Technical Context — the decisions below were resolved by reading the existing codebase rather than by open web research, since the project already has an established pattern for exactly this kind of feature.

## Decision 1: Storage — reuse `user_profiles.profile_data` vs. a new table

- **Decision**: Store the horoscope profile as a `horoscope` key inside the existing `user_profiles.profile_data` JSONB column.
- **Rationale**: `app/profile/page.tsx` already stores free-form, per-user profile fields (`tagline`, `bio`, `skills`, `interests`) in this exact column, RLS-scoped to `id = auth.uid()` via `sql/phase1_auth_rls.sql`. Adding a `horoscope` key follows the same pattern with zero schema migration, zero new RLS policy, and no risk to the "only additive schema changes" constitution rule — because nothing changes at the schema level at all.
- **Alternatives considered**: A dedicated `horoscope_profiles` table. Rejected for this feature: it would require a new migration + new RLS policy for a 1:1-with-user, low-cardinality bundle of fields that the existing JSONB column already exists to hold. A dedicated table becomes worth it later only if the data needs to be queried/joined at the SQL level (e.g., for a future "compare two people" feature) — noted here so a later feature can revisit this, not decided now.

## Decision 2: Solar → lunar calendar conversion

- **Decision**: Implement a pure, synchronous TypeScript function (no network call) that converts a Gregorian date to its Vietnamese lunar-calendar equivalent (day/month/year/leap-month flag).
- **Rationale**: The conversion is a deterministic date-math algorithm (no external state), so it is unit-testable and matches CLAUDE.md §7's requirement to test pure functions. It also avoids adding a new external dependency or API key for a single date computation, keeping the feature's "Primary Dependencies" list unchanged.
- **Alternatives considered**: Calling a third-party lunar-calendar API. Rejected — adds a network dependency and failure mode for a well-understood, offline-computable conversion; would also violate "no error handling for scenarios that can't happen" by forcing new API-failure handling that a local function doesn't need.

## Decision 3: Route placement

- **Decision**: New top-level route group `app/tu-vi/` (`page.tsx`, `edit/page.tsx`, `overview/page.tsx`), independent of `/notes` (the finance/health/habits dashboard) and `/profile` (account-level bio fields).
- **Rationale**: The horoscope feature is its own product surface per the original brief (daily fortune, AI Q&A, compatibility, etc.), not a sub-feature of the finance/habit dashboard or the account bio page — it deserves its own route namespace so future sibling features (daily fortune, compatibility) have an obvious home (`/tu-vi/...`).
- **Alternatives considered**: Nesting under `/notes/tu-vi`. Rejected — `/notes` is scoped to finance/health/goal tracking per `docs/PROJECT_OVERVIEW.md`; the horoscope feature is a distinct product area for a different (if overlapping) use case.
