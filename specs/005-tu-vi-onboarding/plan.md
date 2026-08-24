# Implementation Plan: Horoscope Onboarding (Tử Vi Onboarding)

**Branch**: `005-tu-vi-onboarding` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-tu-vi-onboarding/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A logged-in user without a saved horoscope profile is asked for birth date (solar calendar), optional birth time, and gender; the system derives the lunar-calendar equivalent automatically and stores it. A returning user with a saved profile skips straight to the fortune-overview destination (a placeholder page for now). The technical approach reuses the project's existing generic `user_profiles.profile_data` JSONB column (already used by `app/profile/page.tsx` for other free-form profile fields) instead of introducing a new table — no schema migration is required. A small pure-function module performs solar→lunar conversion so it can be unit tested in isolation.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), Next.js 16 (App Router), React 19

**Primary Dependencies**: `@supabase/ssr` / `@supabase/supabase-js` (existing `getSupabaseBrowserClient()` helper), React Hook Form + Zod (form validation, per constitution), existing `<DatePicker>` / `<TimePicker>` components, `sonner` (`toast.error`), `lucide-react`

**Storage**: Supabase PostgreSQL — reuses the existing `user_profiles` table's `profile_data` JSONB column (already RLS-scoped to `id = auth.uid()` per `sql/phase1_auth_rls.sql`); no new table, no migration file

**Testing**: Vitest — unit tests for the pure solar→lunar conversion function and birth-date validation helper (co-located `.test.ts`, per CLAUDE.md §7)

**Target Platform**: Web (Vercel), responsive (mobile + desktop), reuses existing PIN/OAuth session

**Project Type**: Web application (single Next.js app, no separate frontend/backend split)

**Performance Goals**: Standard page load; form submit round-trip well under the 1-minute completion target in SC-001 (no heavy computation — lunar conversion is a synchronous pure-function lookup)

**Constraints**: Must follow existing UI conventions (icon sizes, `<DatePicker>`/`<TimePicker>`, `toast.error()`, no native `<input type="date">`/`<input type="time">`); must not alter or duplicate the existing `user_profiles` RLS policy

**Scale/Scope**: 3 new routes, 1 shared form component, 1 pure lunar-calendar utility module, 0 new DB tables/migrations — single-user-scoped data, no scale concerns

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Constitution rule | Status |
|---|---|
| Only additive schema changes on the shared Supabase DB | ✅ Pass — no schema change at all; reuses existing JSONB column |
| Never use native `<input type="date">`/`<input type="time">` | ✅ Pass — plan uses `<DatePicker>`/`<TimePicker>` |
| Never use `confirm()`/`alert()` | ✅ Pass — no destructive action in this feature; errors via `toast.error()` |
| Tests required for new pure logic (CLAUDE.md §7) | ✅ Pass — lunar conversion + date validation are pure functions, unit tests planned |
| No speculative abstractions / no features beyond what was asked | ✅ Pass — no repository layer added; direct Supabase calls from the page component, matching `app/profile/page.tsx` |
| Documentation/comments in English | ✅ Pass — spec/plan/code comments in English; only user-facing copy is Vietnamese |

No violations. Complexity Tracking table not needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-tu-vi-onboarding/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

(No `contracts/` — this feature has no new public API/endpoint; the page talks to Supabase directly through the existing RLS-scoped client, same pattern as `app/profile/page.tsx`.)

### Source Code (repository root)

```text
app/
├── tu-vi/
│   ├── page.tsx           # Entry point: no profile → onboarding form; has profile → redirect to /tu-vi/overview
│   ├── edit/
│   │   └── page.tsx       # Always shows the form pre-filled (User Story 3)
│   └── overview/
│       └── page.tsx       # Fortune-overview destination placeholder (built out by a future feature)

src/
├── components/
│   └── tu-vi/
│       └── HoroscopeOnboardingForm.tsx   # Shared form used by both page.tsx and edit/page.tsx
└── lib/
    ├── lunar-calendar.ts        # Pure solar→lunar conversion function
    ├── lunar-calendar.test.ts
    ├── horoscope-profile.ts     # Birth-date validation + profile_data.horoscope shape helpers
    └── horoscope-profile.test.ts
```

**Structure Decision**: Follows the existing single-Next.js-app layout (`app/` for routes, `src/components` and `src/lib` for shared code) already used by `app/profile/page.tsx`. No new backend/service split — reads and writes go straight from the page component to Supabase via `getSupabaseBrowserClient()`, exactly like the existing profile page.

## Complexity Tracking

*No violations — table not needed.*
