# Tasks: Goal Date Range Validation

- [x] T1: Add `isValidGoalDateRange(startDate, targetDate)` to `app/notes/_lib/goalsUtils.ts`
- [x] T2: Add unit tests for T1 in `app/notes/_lib/goalsUtils.test.ts` (start-after-target, start-before-target, equal dates, one date empty)
- [x] T3: Add `dateRangeError` key to `src/lib/i18n/dictionaries/en.ts` and `vi.ts` under `notes.goals`
- [x] T4: Call the guard from `saveEditingGoal` in `app/notes/_hooks/useGoalsActions.ts`, toast-error and return early on failure
- [x] T5: Run `npm run test` — full suite must pass
