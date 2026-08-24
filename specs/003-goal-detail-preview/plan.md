# Plan: Goal Detail Preview

**Feature**: [spec.md](spec.md) · **Design**: [docs/DESIGN.md](../../docs/DESIGN.md)

## Approach

Pure client-side addition, no schema/API changes, matching FR-006.

### New files

- `app/notes/_components/tabs/GoalDetailPreviewModal.tsx` — the modal component itself (presentational, follows `ConfirmModal`'s hand-rolled overlay pattern per DESIGN).
- `app/notes/_lib/goalsUtils.test.ts` — extend with tests for the new pure helpers (no new test file needed, existing one already covers this module).

### Changed files

- `app/notes/_lib/goalsUtils.ts` — extract the ad hoc date-math currently inline in `GoalsTab.tsx:359-367` (start/end/elapsed/total days) into a pure `computeGoalProgress(startDate?, targetDate?)` helper, and add a pure `computeGoalDisplayStatus(status, targetDate?)` helper implementing the overdue rule (FR-003): returns `'overdue'` only when `status === 'active'` and `targetDate` is before today; otherwise returns the stored `status` unchanged. Both are new, focused helpers — not a rewrite of the existing three functions in that file.
- `app/notes/_components/tabs/GoalsTab.tsx` — goal card's content area gets an `onClick` that opens the preview (existing icon/select/slider controls keep their own `stopPropagation`, unchanged); the inline `elapsedDays`/`totalDays` calc at 359-367 is replaced with a call to the new `computeGoalProgress` helper (keeps existing progress-bar rendering behavior identical, just de-duplicates the math so the new modal can reuse it). Preview-open state (`previewGoal: Goal | null`) is a LOCAL `useState` inside `GoalsTab`, not lifted to `page.tsx` — revised from the original plan of following `ConfirmModal`'s page-level pattern, because that pattern exists specifically so ONE shared `ConfirmModal` instance can serve delete confirmations across every tab; this preview has no cross-tab sharing need, so keeping its state local avoids widening `GoalsTabState`/`GoalsTabActions` and touching `page.tsx` at all. `<GoalDetailPreviewModal>` is rendered directly inside `GoalsTab.tsx`. Edit action calls the existing `startEditingGoal(goal)` prop already passed into `GoalsTab` and closes the preview.

### Risk / tradeoffs

- **No new abstraction beyond the two pure helpers** — the modal itself is a plain presentational component, matching every other modal in this codebase (no new state-management pattern, no new primitive).
- **Escape-key-closes is new behavior** not present on `ConfirmModal` today (flagged in DESIGN as a real accessibility gap, added here as a small, self-contained addition — not retrofitted onto ConfirmModal, out of scope for this feature).
- **No schema/migration risk** — confirmed no new Supabase columns/tables; `Goal`/`GoalItem` types are unchanged.
- **Test coverage**: `computeGoalProgress` and `computeGoalDisplayStatus` are pure functions → unit-testable per CLAUDE.md §7 (added to `goalsUtils.test.ts`). The modal component itself and the click-wiring in `GoalsTab.tsx`/`page.tsx` are UI rendering — per CLAUDE.md §7 and existing project convention, not unit-tested; verified instead via the native QA pass (manual walkthrough against spec.md's acceptance scenarios).

## Consistency check

- Matches `.specify/memory/constitution.md`: existing UI conventions (icon-only ghost action buttons unaffected, no `confirm()`/`alert()` introduced), TypeScript strict mode, `@/*` alias, Tailwind utility classes matching existing modal styling.
- No violation of "what we never do" (no schema/auth change, no native date/time inputs).
