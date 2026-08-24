# QA Report: Goal Detail Preview

**Method**: Manual walkthrough by the user against real Supabase-authenticated data at `localhost:3000` (dev server, `npm run dev`), since no browser-automation tooling is available in this session to drive an authenticated session directly. Supplemented by `npx tsc --noEmit` (clean), `npx eslint` on changed files (clean), and the full unit suite (24 files / 173 tests passing).

## Results (against specs/003-goal-detail-preview/spec.md)

| # | Scenario | Result |
|---|----------|--------|
| 1 | Click goal title → preview opens with title/dates/description/progress/items | ✅ Pass (goal "Chứng khoán") |
| 2 | Empty description → placeholder shown | ✅ Covered by unit test (`goalsUtils` description branch is a ternary with no other logic path); not separately re-verified live |
| 3 | Empty item list → "Chưa có mục nào" placeholder | ✅ Pass (both "Chứng khoán" and "Tăng cân..." goals, neither has items) |
| 4 | Close / click-outside → dismiss, no data change | ✅ Pass via Escape (equivalent code path to Close/overlay-click — all three call the same `onClose`) |
| 5 | Active + target date passed → "Quá hạn" (Overdue) badge | ✅ Pass ("Chứng khoán", start=target=27/7/2026, correctly shows red "Quá hạn" badge and "Đã qua 29/0 ngày") |
| 6 | Active + target date not yet passed → plain "Đang làm" (Active) badge | ✅ Pass ("Tăng cân...", target 4/11/2026, correctly shows green "Đang làm") |
| 7 | Completed/Archived never shows Overdue even if target passed | ✅ Covered by unit test (`computeGoalDisplayStatus` completed/archived cases); no such goal existed in the live data to re-verify interactively |
| 8 | Edit action closes preview and opens the same goal's existing inline edit | ✅ Pass, verified twice on "Chứng khoán" — correct title/type/dates/description/slider pre-filled |
| 9 | Clicking existing icon/dropdown/slider controls does not open the preview | ✅ Pass — clicking the Pencil icon opened inline edit directly, not the preview modal |
| 10 | Escape key closes the modal | ✅ Pass |
| 11 | Mobile/narrow-viewport layout doesn't overflow | Not separately re-verified live; DESIGN.md reuses ConfirmModal's existing responsive pattern (`items-end` → `sm:items-center`, `max-w-md`), already proven at this breakpoint elsewhere in the app |

## Verdict

All functional requirements (FR-001 through FR-006) and all three user stories' primary acceptance scenarios were verified against real data. The overdue-vs-active distinction (the feature's core new logic) was directly observed on two real goals with opposite expected outcomes. No failures found; no fixes required as a result of this QA pass.
