# Privacy

DayTasks is local-first. It stores tasks in Obsidian plugin data and writes
optional detail notes inside the user's vault.

## Stored Data

DayTasks stores task records through Obsidian plugin storage. Records can
include:

- task title and description;
- status, priority, dates, estimate, and timestamps;
- tags, contexts, and project note paths;
- subtask and dependency ids;
- optional detail-note path;
- Task List view state.

Optional detail notes are normal Markdown files in the vault. DayTasks manages
their task frontmatter and leaves the body to the user.

## Network

DayTasks does not send task data to a server. The local API settings are
reserved and the API is not implemented in the current plugin.

## Vault Writes

DayTasks writes:

- plugin data through Obsidian's plugin data APIs;
- managed detail-note frontmatter through Obsidian frontmatter processing;
- detail-note files and folders when the user asks to create them.

It does not write managed task lists into daily-note bodies.

## User-Controlled Content

The body of a detail note belongs to the user. DayTasks does not rewrite it.
Non-managed frontmatter keys are preserved when managed task fields are synced.
