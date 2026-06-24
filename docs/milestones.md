# Milestones

## v0: Daily Task Loop

- Create a task with a generated `TSK-xxxxxxxx` ID.
- Save task data in the plugin store.
- Maintain an in-memory task index by ID, date, status, parent ID, tag, and project.
- Detect the active daily-note date from the note path.
- Render the day's tasks as cards in a bottom-of-note widget.
- Show task tags and project links on cards.
- Toggle task status from the card and sync it back to the store and index.

## v1: Detail Notes

- Create a full markdown detail note only when requested.
- Link a task to its detail note by task ID.
- Open an existing detail note from the task card.

## v2: Local API

- Add bearer-token-protected localhost HTTP API.
- Support browser-extension-friendly CORS.
- Expose task create, list, read, update, delete, status toggle, project, tag, and time tracking endpoints.

## v3: Time Tracking

- Add start and stop time tracking operations.
- Store time entries on the task definition.
- Display active timers and totals on cards.

## v4: Pomodoro

- Add Pomodoro sessions linked to task IDs.
- Summarize focus time by day and task.
