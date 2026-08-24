# Feature Specification: Goal Detail Preview

**Feature Branch**: `003-goal-detail-preview`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Add a Goal Detail Preview modal to the Notes dashboard's Goals tab, showing title, description, progress, dates, status (incl. computed overdue), and item list, with Edit/Close actions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a goal's full detail without leaving the list (Priority: P1)

A user browsing their goals in the Notes dashboard clicks on a goal to see its full detail — description, timeline, status, and its items — without navigating away or entering edit mode.

**Why this priority**: This is the entire feature; every other behavior (Edit, Close) hangs off this core view.

**Independent Test**: Click any goal in the list; a modal opens showing that goal's title, description, dates, computed progress, status, and item list; clicking outside or Close dismisses it with no side effects.

**Acceptance Scenarios**:

1. **Given** a goal with a description, start date, target date, and items, **When** the user clicks the goal, **Then** the preview modal opens showing all of that data.
2. **Given** a goal with no description, **When** the preview opens, **Then** the description area shows an empty-state message instead of blank space.
3. **Given** a goal with no items, **When** the preview opens, **Then** the items section shows an empty-state message instead of an empty list.
4. **Given** the preview modal is open, **When** the user clicks the overlay outside the modal or the Close action, **Then** the modal closes and no data changes.

---

### User Story 2 - See at a glance whether a goal is overdue (Priority: P2)

A user wants to immediately tell whether an in-progress goal has run past its target date, without having to compare dates manually.

**Why this priority**: Directly useful triage information, but the preview is still valuable without it (P1 covers the core view).

**Independent Test**: Open the preview for a goal whose target date is in the past and whose status is still active; confirm an "Overdue" indicator is shown instead of (or alongside) the plain "Active" status.

**Acceptance Scenarios**:

1. **Given** a goal with status "active" and a target date before today, **When** the preview opens, **Then** it shows an "Overdue" state.
2. **Given** a goal with status "active" and a target date on or after today, **When** the preview opens, **Then** it shows the plain "Active" state (not overdue).
3. **Given** a goal with status "completed" or "archived" and a target date in the past, **When** the preview opens, **Then** it shows that stored status, never "Overdue" (overdue only applies to still-active goals).
4. **Given** a goal with no target date set, **When** the preview opens, **Then** it shows the plain stored status (overdue cannot be computed without a target date).

---

### User Story 3 - Jump straight to editing from the preview (Priority: P3)

A user reviewing a goal in the preview decides they want to change something and can go straight into editing it without re-finding the goal in the list.

**Why this priority**: A convenience shortcut on top of the existing edit flow — not required for the preview to deliver its core value (P1), and the existing inline-edit entry point (the row's own Edit action) remains available either way.

**Independent Test**: Open the preview for a goal, click its Edit action, and confirm the preview closes and that goal's existing inline edit form opens, identical to clicking Edit directly on the goal row.

**Acceptance Scenarios**:

1. **Given** the preview modal is open, **When** the user clicks Edit, **Then** the preview closes and the same goal's row switches into its existing inline edit mode.

---

### Edge Cases

- What happens when the goal's item list is long? → The item list scrolls within the modal; the modal itself does not grow unbounded.
- What happens when start date is missing but target date is set (or vice versa)? → Progress cannot be computed (needs both); show the dates that do exist and omit the progress indicator.
- What happens if the goal is deleted by another action while the preview is open? → Out of scope for this feature (no realtime sync exists elsewhere in this dashboard either); closing and reopening reflects current data.
- What happens when the user clicks an existing interactive control on the goal row (Pencil/Trash icon, status dropdown, completion slider) instead of the row's general content area? → Those controls keep their current behavior unchanged; only clicking the row's non-interactive content area (title/description area) opens the preview.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Clicking a goal in the Goals tab MUST open a read-only preview showing that goal's title, description, start date, target date, status, and item list.
- **FR-002**: The preview MUST show a computed progress indicator (elapsed vs. total time) whenever both start date and target date are present, and MUST omit it otherwise.
- **FR-003**: The preview MUST show a computed "Overdue" state when the goal's stored status is "active" and its target date has passed; otherwise it MUST show the goal's plain stored status.
- **FR-004**: The preview MUST show an empty-state message when the description is absent, and an empty-state message when the item list is empty.
- **FR-005**: The preview MUST offer an Edit action that closes the preview and opens the existing inline edit flow for that goal, and a Close action that dismisses the preview with no data changes.
- **FR-006**: The preview MUST NOT introduce any new stored data, API route, or authentication requirement — it only reads data already available to the Goals tab.

### Key Entities

- **Goal**: existing entity (title, description, start_date, target_date, status, items) — no new fields.
- **GoalItem**: existing entity, listed read-only inside the preview.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can view a goal's full detail (description, dates, status, items) in a single click from the Goals list, without a page navigation.
- **SC-002**: 100% of goals with both a start and target date show a progress indicator in the preview; 100% of goals missing either date show none (no incorrect/partial calculation).
- **SC-003**: An overdue active goal is visually distinguishable from a non-overdue active goal in the preview in every case where a target date exists.

## Assumptions

- "Overdue" is computed client-side from `target_date` vs. the current date and is never persisted — the stored `status` field keeps its existing three values (`active`/`completed`/`archived`).
- The preview reuses the existing inline edit flow for its Edit action rather than introducing a second edit surface.
- The existing hand-rolled modal pattern (fixed-overlay, not the unused Sheet/Radix primitive) is followed, per current project convention across `ConfirmModal`/`UpgradeModal`.
- No new Supabase query is required — the Goals tab already fetches the goal and its items before this feature.
