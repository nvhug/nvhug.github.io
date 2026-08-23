# Feature Specification: Goal Date Range Validation

**Feature Branch**: `001-goal-date-validation`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Validate that a goal's start date isn't after its target date before saving an edited goal in the Notes dashboard. Currently saveEditingGoal only checks that the title isn't empty; it doesn't check start_date vs target_date. GoalsTab renders a progress bar computed from elapsedDays/totalDays using those two dates, so a reversed range currently produces a negative/nonsensical progress display. Add a pure date-range check, call it before saving, and show a toast error when invalid."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reject an invalid date range on save (Priority: P1)

A user editing a goal in the Notes dashboard sets a start date that is later than the target date and tries to save. The system must reject the save and tell them why, instead of silently storing a goal whose progress bar will render nonsense (negative elapsed days, percentages outside 0-100%).

**Why this priority**: This is the entire feature — without it, invalid data reaches the database and breaks the progress display users rely on to track goals.

**Independent Test**: Open an existing goal, set start date after target date, click save — verify save is blocked and an error message is shown, and the goal's stored dates are unchanged.

**Acceptance Scenarios**:

1. **Given** a goal being edited, **When** the user sets start date after target date and saves, **Then** the save is rejected and an error toast explains the date range is invalid.
2. **Given** a goal being edited, **When** the user sets start date on or before target date and saves, **Then** the save proceeds as today.
3. **Given** a goal being edited with only one of the two dates set (the other left blank), **When** the user saves, **Then** the save proceeds as today (no range to compare).

### Edge Cases

- What happens when start date equals target date? Treated as valid (a zero-length goal window is not a reversed range).
- What happens when one of the two dates is empty/unset? No range comparison is possible — save proceeds unchanged from current behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST prevent saving an edited goal whose start date is later than its target date, when both dates are set.
- **FR-002**: System MUST show a clear, localized (Vietnamese/English) error message when a save is blocked for this reason, using the project's existing toast-error pattern.
- **FR-003**: System MUST NOT change behavior when either date is empty, or when start date is on or before target date.

### Key Entities

- **Goal**: user-defined objective tracked in the Notes dashboard; relevant attributes here are `start_date` and `target_date` (both optional, ISO date strings), used to compute a progress bar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of save attempts with a reversed date range (start after target) are blocked with a visible error, verified by automated tests.
- **SC-002**: 100% of save attempts with a valid or partial date range behave exactly as before this change, verified by automated tests.

## Assumptions

- "Invalid" means strictly start date later than target date; equal dates are valid.
- The existing `toast.error()` + i18n dictionary pattern (already used elsewhere in goal editing, e.g. the empty-title check) is the correct UX for this error — no new UI component is introduced.
- No database migration is needed; this is a client-side validation added before the existing Supabase update call.
