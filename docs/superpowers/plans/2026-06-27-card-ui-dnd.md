# Card UI redesign + drag-and-drop reorder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the DayTasks daily widget to match the reference card layout, replace the completed-last sort with a user-controlled `sortOrder`, and enable drag-to-reorder of sibling tasks.

**Architecture:** Pure view-model + pure DOM renderer (unit-tested) stay free of Obsidian APIs; the Obsidian host (`main.ts`) owns ephemeral UI state (collapse/description sets), attaches SortableJS, and persists order via a new `reorderSiblings` service method writing the existing `sortOrder` field. Order is read back in `buildTaskForest` via a new `bySortOrder` comparator that replaces `completedLast`.

**Tech Stack:** TypeScript, Obsidian plugin API, SortableJS, vitest, esbuild, custom CSS build (`build-css.mjs`).

## Global Constraints

- Never hardcode colors — use Obsidian CSS variables (theme tokens) only.
- Pure renderer (`src/obsidian/widgetRenderer.ts`) and view-model (`src/ui/*`) MUST NOT import from `obsidian`; Obsidian-only work (icons, `Menu`, Sortable) lives in `src/main.ts` or new host modules.
- TDD: write the failing test first, watch it fail, implement minimal, watch it pass, commit.
- Run `npm run check` (typecheck + tests) green before each commit that touches `src/`.
- Commit message footer on every commit:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Branch: `feat/card-ui-dnd` (already created).
- `createdAt` is an ISO datetime; always slice to `YYYY-MM-DD` before `formatMonthDay`.

---

### Task 1: `bySortOrder` comparator — drop the done sort

**Files:**
- Modify: `src/core/subtasks.ts`
- Test: `tests/core/subtasks.test.ts`

**Interfaces:**
- Produces: `buildTaskForest(tasks, isCompleted)` unchanged signature, but roots/children ordered by `sortOrder` (then `createdAt`), no longer by completion.

- [ ] **Step 1: Write the failing tests**

Add to `tests/core/subtasks.test.ts`:

```ts
import { buildTaskForest } from "../../src/core/subtasks";
import type { DayTask } from "../../src/core/task";

function task(over: Partial<DayTask> & { id: string }): DayTask {
	return {
		title: over.id,
		status: "open",
		scheduledDate: "2026-06-27",
		tags: [],
		contexts: [],
		projects: [],
		timeEntries: [],
		createdAt: "2026-06-27T00:00:00.000Z",
		updatedAt: "2026-06-27T00:00:00.000Z",
		...over,
	};
}

const notDone = (s: string) => s === "done";

describe("buildTaskForest ordering", () => {
	it("orders roots by sortOrder, not completion", () => {
		const tasks = [
			task({ id: "b", sortOrder: "000020", status: "done" }),
			task({ id: "a", sortOrder: "000010" }),
		];
		const forest = buildTaskForest(tasks, notDone);
		expect(forest.map((n) => n.task.id)).toEqual(["a", "b"]);
	});

	it("tasks without sortOrder sort after, by createdAt", () => {
		const tasks = [
			task({ id: "new2", createdAt: "2026-06-27T02:00:00.000Z" }),
			task({ id: "ordered", sortOrder: "000010" }),
			task({ id: "new1", createdAt: "2026-06-27T01:00:00.000Z" }),
		];
		const forest = buildTaskForest(tasks, notDone);
		expect(forest.map((n) => n.task.id)).toEqual(["ordered", "new1", "new2"]);
	});

	it("orders children by sortOrder", () => {
		const tasks = [
			task({ id: "p" }),
			task({ id: "c2", parentId: "p", sortOrder: "000020", status: "done" }),
			task({ id: "c1", parentId: "p", sortOrder: "000010" }),
		];
		const forest = buildTaskForest(tasks, notDone);
		expect(forest[0].children.map((n) => n.task.id)).toEqual(["c1", "c2"]);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/subtasks.test.ts -t "ordering"`
Expected: FAIL — current `completedLast` sorts `done` last, so the first test gets `["a","b"]` only by luck of sortOrder; the second/third fail because order is by completion not sortOrder.

- [ ] **Step 3: Replace the comparator**

In `src/core/subtasks.ts`, replace the `completedLast` function and both `.sort(completedLast)` calls:

```ts
/**
 * Sibling order: tasks with a stored `sortOrder` come first (lexicographic over
 * the zero-padded strings); tasks without one fall after, ordered by `createdAt`.
 * Completion no longer affects order — manual drag order wins.
 */
const bySortOrder = (a: DayTask, b: DayTask): number => {
	const ao = a.sortOrder;
	const bo = b.sortOrder;
	if (ao !== undefined && bo !== undefined) {
		return ao < bo ? -1 : ao > bo ? 1 : 0;
	}
	if (ao !== undefined) return -1;
	if (bo !== undefined) return 1;
	return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
};
```

Change line ~78 `.sort(completedLast)` → `.sort(bySortOrder)` (children) and line ~86 `.sort(completedLast)` → `.sort(bySortOrder)` (roots). The `isCompleted` param stays (still used elsewhere) — if it becomes unused after this edit, keep it in the signature but prefix with `_` only if the linter complains; otherwise leave as-is since `computeChildProgress`/`createDailyTasksWidgetModel` still pass it.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/subtasks.test.ts`
Expected: PASS (all, including existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/subtasks.ts tests/core/subtasks.test.ts
git commit -m "feat(sort): order tasks by sortOrder, drop completed-last sort

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `reorderSiblings` service method

**Files:**
- Modify: `src/core/dayTaskService.ts`
- Test: `tests/core/dayTaskService.test.ts` (or the existing service test file — confirm name with `ls tests/core`)

**Interfaces:**
- Consumes: `this.dependencies.store` (`TaskStore`: `get`, `save`).
- Produces: `reorderSiblings(parentId: string | null, orderedIds: string[]): Promise<void>` — assigns `sortOrder = String(index * 10).padStart(6, "0")` to each listed task, in array order, and saves it. Ids not found are skipped.

- [ ] **Step 1: Write the failing test**

```ts
it("reorderSiblings assigns zero-padded sortOrder in array order", async () => {
	const a = await service.createTask({ title: "A", scheduledDate: "2026-06-27" });
	const b = await service.createTask({ title: "B", scheduledDate: "2026-06-27" });
	const c = await service.createTask({ title: "C", scheduledDate: "2026-06-27" });

	await service.reorderSiblings(null, [c.id, a.id, b.id]);

	expect((await service.getTask(c.id))?.sortOrder).toBe("000000");
	expect((await service.getTask(a.id))?.sortOrder).toBe("000010");
	expect((await service.getTask(b.id))?.sortOrder).toBe("000020");
});

it("reorderSiblings skips unknown ids without throwing", async () => {
	const a = await service.createTask({ title: "A", scheduledDate: "2026-06-27" });
	await expect(
		service.reorderSiblings(null, ["nope", a.id])
	).resolves.toBeUndefined();
	expect((await service.getTask(a.id))?.sortOrder).toBe("000010");
});
```

(Match the existing test's setup for how `service` is constructed — reuse the same `beforeEach`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/dayTaskService.test.ts -t reorderSiblings`
Expected: FAIL — `service.reorderSiblings is not a function`.

- [ ] **Step 3: Implement the method**

Add to `DayTaskService` (near `updateTask`):

```ts
/**
 * Persists a manual sibling order by writing each task's `sortOrder`
 * (zero-padded so it compares lexicographically). `parentId` is informational
 * — the caller supplies the already-ordered sibling ids. Unknown ids skipped.
 */
async reorderSiblings(_parentId: string | null, orderedIds: string[]): Promise<void> {
	for (let index = 0; index < orderedIds.length; index += 1) {
		const task = await this.dependencies.store.get(orderedIds[index]);
		if (!task) {
			continue;
		}
		task.sortOrder = String(index * 10).padStart(6, "0");
		task.updatedAt = this.dependencies.now();
		await this.dependencies.store.save(task);
	}
}
```

If `this.dependencies.now` does not exist in this service, drop the `updatedAt` line (check how `updateTask` stamps `updatedAt` and mirror it exactly).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/dayTaskService.test.ts -t reorderSiblings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/dayTaskService.ts tests/core/dayTaskService.test.ts
git commit -m "feat(service): add reorderSiblings to persist manual task order

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: View-model — `collapsed` + `createdLabel`, thread the new sets

**Files:**
- Modify: `src/ui/taskCard.ts`, `src/ui/todayView.ts`, `src/ui/dailyTasksWidgetController.ts`
- Test: `tests/ui/taskCard.test.ts`

**Interfaces:**
- Produces: `TaskCardViewModel` gains required `collapsed: boolean` and `createdLabel: string`.
- `createTaskCardViewModel(task, statusManager, referenceDate, priorities, nesting, relations)` — `nesting` gains optional `collapsed?: boolean` (default `false`).
- `createDailyTasksWidgetModel(...)` gains two trailing params: `collapsedIds: ReadonlySet<string> = new Set()`, and top-level cards are collapsed iff `collapsedIds.has(id)`; subtasks are collapsed iff `!expanded(asCard)` — see Step 3.

- [ ] **Step 1: Write the failing test**

Add to `tests/ui/taskCard.test.ts`:

```ts
it("exposes createdLabel from createdAt date portion", () => {
	const vm = createTaskCardViewModel(
		baseTask({ createdAt: "2026-06-25T13:00:00.000Z" }),
		statusManager,
		"2026-06-27",
		priorities
	);
	expect(vm.createdLabel).toBe("Jun 25");
	expect(vm.collapsed).toBe(false);
});

it("collapsed reflects the nesting flag", () => {
	const vm = createTaskCardViewModel(
		baseTask({}),
		statusManager,
		"2026-06-27",
		priorities,
		{ collapsed: true }
	);
	expect(vm.collapsed).toBe(true);
});
```

(Reuse the file's existing `baseTask`/`statusManager`/`priorities` helpers; if `baseTask` doesn't exist, copy the construction the other tests in the file use.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ui/taskCard.test.ts -t createdLabel`
Expected: FAIL — `createdLabel`/`collapsed` undefined.

- [ ] **Step 3: Implement**

`src/ui/taskCard.ts`:
- Add to `TaskCardNesting`: `collapsed?: boolean;`
- Add to `TaskCardViewModel`: `collapsed: boolean;` and `createdLabel: string;`
- In the returned object add:

```ts
createdLabel: formatMonthDay(task.createdAt.slice(0, 10)),
collapsed: nesting.collapsed ?? false,
```

`src/ui/todayView.ts` — extend `createDailyTasksWidgetModel` signature with `collapsedIds`:

```ts
export function createDailyTasksWidgetModel(
	date: string,
	tasks: DayTask[],
	statusManager: StatusManager,
	referenceDate: string,
	priorities: PriorityConfig[],
	getChildren: (id: string) => DayTask[] = () => [],
	expandedIds: ReadonlySet<string> = new Set(),
	getById: (id: string) => DayTask | undefined = () => undefined,
	getBlocking: (id: string) => DayTask[] = () => [],
	collapsedIds: ReadonlySet<string> = new Set()
): DailyTasksWidgetModel {
```

Thread collapse into `toCard`. Top-level cards collapse when their id is in `collapsedIds`; subtasks default collapsed **unless** their id is in `collapsedIds` is the wrong polarity — instead pass a `depth` so defaults differ:

```ts
const toCard = (node: TaskNode, depth: number): TaskCardViewModel => {
	const directChildren = getChildren(node.task.id);
	const childProgress =
		directChildren.length > 0 ? computeChildProgress(directChildren, isCompleted) : undefined;
	// Top-level default expanded; subtasks default collapsed. `collapsedIds`
	// holds the ids the user has toggled away from their default.
	const toggled = collapsedIds.has(node.task.id);
	const collapsed = depth === 0 ? toggled : !toggled;
	return createTaskCardViewModel(
		node.task,
		statusManager,
		referenceDate,
		priorities,
		{
			children: node.children.map((child) => toCard(child, depth + 1)),
			childProgress,
			expanded: expandedIds.has(node.task.id),
			collapsed,
		},
		{ resolve: getById, blocking: getBlocking(node.task.id) }
	);
};

const cards = buildTaskForest(tasks, isCompleted).map((node) => toCard(node, 0));
```

`src/ui/dailyTasksWidgetController.ts` — add a `collapsedIds` param to `getWidgetForDate` and forward it:

```ts
getWidgetForDate(
	date: string,
	expandedIds: ReadonlySet<string> = new Set(),
	collapsedIds: ReadonlySet<string> = new Set()
): DailyTasksWidgetModel {
	return createDailyTasksWidgetModel(
		date,
		this.dependencies.service.getTasksForDate(date),
		this.dependencies.statusManager,
		this.dependencies.today(),
		this.dependencies.priorities,
		(id) => this.dependencies.service.getChildren(id),
		expandedIds,
		(id) => this.dependencies.service.getById(id) ?? undefined,
		(id) => this.dependencies.service.byBlocker(id),
		collapsedIds
	);
}
```

- [ ] **Step 4: Update existing renderer-test fixtures**

`tests/obsidian/widgetRenderer.test.ts` `filledModel` — add `collapsed: false` and `createdLabel: "Jun 25"` to **both** card objects (required fields now). Run `npx vitest run tests/ui/taskCard.test.ts tests/obsidian/widgetRenderer.test.ts`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ tests/ui/taskCard.test.ts tests/obsidian/widgetRenderer.test.ts
git commit -m "feat(viewmodel): add collapsed + createdLabel, thread collapsedIds

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Renderer — collapsed row vs expanded card + chevron toggle

**Files:**
- Modify: `src/obsidian/widgetRenderer.ts`
- Test: `tests/obsidian/widgetRenderer.test.ts`

**Interfaces:**
- Consumes: `card.collapsed`, `card.createdLabel`.
- Produces: `WidgetRenderHandlers` gains `onToggleCollapsed?(taskId: string): void`, `onToggleDescription?(taskId: string): void`, `onOpenMenu?(taskId: string, anchor: HTMLElement): void`. Collapsed card renders `.task-card--collapsed` with a slim row; chevron button `.task-card__collapse` calls `onToggleCollapsed`.

- [ ] **Step 1: Write the failing test**

```ts
it("renders a collapsed card as a slim row with id and due, no metadata grid", () => {
	const model = { ...filledModel, cards: [{ ...filledModel.cards[0], collapsed: true }] };
	const root = render(model);
	const card = root.querySelector(".task-card")!;
	expect(card.classList.contains("task-card--collapsed")).toBe(true);
	expect(card.querySelector(".task-card__metadata-grid")).toBeNull();
	expect(card.querySelector(".task-card__collapsed-id")?.textContent).toContain("TSK-8cA562sd");
});

it("chevron toggles collapse via handler", () => {
	const onToggleCollapsed = vi.fn();
	const root = render(filledModel, allOn, { onToggleCollapsed });
	(root.querySelector(".task-card__collapse") as HTMLElement).click();
	expect(onToggleCollapsed).toHaveBeenCalledWith("TSK-8cA562sd");
});
```

Update the `render` helper to spread extra handlers (check its current signature ~line 88; if it doesn't accept a handlers override, add an optional `extraHandlers` param merged into the default handlers object).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts -t collapse`
Expected: FAIL — no `.task-card--collapsed` / `.task-card__collapse`.

- [ ] **Step 3: Implement**

In `widgetRenderer.ts`:
- Add the three handler fields to `WidgetRenderHandlers`.
- Add a chevron builder:

```ts
/** Card-level collapse toggle (chevron). Expanded shows full card; collapsed shows a slim row. */
function renderCollapseControl(
	card: TaskCardViewModel,
	handlers: WidgetRenderHandlers
): HTMLElement {
	const button = el("button", "task-card__collapse");
	button.setAttribute("aria-expanded", String(!card.collapsed));
	button.setAttribute("aria-label", card.collapsed ? "Expand card" : "Collapse card");
	const icon = el("span", "task-card__collapse-icon");
	icon.dataset.icon = card.collapsed ? "chevron-down" : "chevron-up";
	icon.setAttribute("aria-hidden", "true");
	button.appendChild(icon);
	button.addEventListener("click", (event) => {
		stop(event);
		handlers.onToggleCollapsed?.(card.id);
	});
	return button;
}
```

- Add the kebab builder:

```ts
/** Per-card actions menu trigger (⋮). Delegates to the host to build the Menu. */
function renderMenuControl(
	card: TaskCardViewModel,
	handlers: WidgetRenderHandlers
): HTMLElement {
	const button = el("button", "task-card__menu");
	button.setAttribute("aria-label", "Task actions");
	const icon = el("span", "task-card__menu-icon");
	icon.dataset.icon = "more-vertical";
	icon.setAttribute("aria-hidden", "true");
	button.appendChild(icon);
	button.addEventListener("click", (event) => {
		stop(event);
		handlers.onOpenMenu?.(card.id, button);
	});
	return button;
}
```

- Add the chevron + kebab into `renderRailTop`:

```ts
function renderRailTop(
	card: TaskCardViewModel,
	handlers: WidgetRenderHandlers
): HTMLElement {
	const top = el("div", "task-card__rail-top");
	top.appendChild(renderPriorityControl(card, handlers));
	top.appendChild(renderStatusControl(card, handlers));
	top.appendChild(renderCollapseControl(card, handlers));
	top.appendChild(renderMenuControl(card, handlers));
	return top;
}
```

- In `renderTaskCard`, branch on `card.collapsed`. Refactor the existing expanded body into a `renderExpandedBody(card, options, handlers)` returning the `content` element (everything currently appended to `content`), then:

```ts
if (card.collapsed) {
	cardEl.classList.add("task-card--collapsed");
	const content = el("div", "task-card__content");
	const row = el("div", "task-card__collapsed-row");
	row.appendChild(el("span", "task-card__collapsed-title",
		truncate(card.title, 30)));
	if (options.showTaskIds) {
		row.appendChild(el("span", "task-card__collapsed-id", card.id));
	}
	if (card.dueLabel) {
		row.appendChild(el("span", "task-card__collapsed-due", card.dueLabel));
	}
	content.appendChild(row);
	mainRow.appendChild(content);
} else {
	mainRow.appendChild(renderExpandedBody(card, options, handlers));
}
```

Keep `mainRow` getting the `handle` first (unchanged) and `cardEl.appendChild(renderRailTop(...))` after, for both branches. The subtask `<ul>` block stays after the card element (unchanged) — collapsed parents still render their subtask list container, but CSS hides it (see Task 11); functionally subtasks remain reachable once expanded.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/widgetRenderer.ts tests/obsidian/widgetRenderer.test.ts
git commit -m "feat(render): collapsed slim row + chevron/kebab rail controls

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Renderer — boxed metadata grid (Priority · Due · Created · Estimate)

**Files:**
- Modify: `src/obsidian/widgetRenderer.ts`
- Test: `tests/obsidian/widgetRenderer.test.ts`

**Interfaces:**
- Produces: expanded cards contain `.task-card__metadata-grid` with four `.task-card__meta-cell` columns labeled Priority/Due/Created/Estimate; empty values render `—`.

- [ ] **Step 1: Write the failing test**

```ts
it("renders a 4-column metadata grid including Created", () => {
	const root = render(filledModel);
	const grid = root.querySelector(".task-card__metadata-grid")!;
	const labels = [...grid.querySelectorAll(".task-card__meta-label")].map((n) => n.textContent);
	expect(labels).toEqual(["Priority", "Due", "Created", "Estimate"]);
	const created = grid.querySelectorAll(".task-card__meta-cell")[2];
	expect(created.querySelector(".task-card__meta-value")?.textContent).toBe("Jun 25");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts -t "metadata grid"`
Expected: FAIL — no `.task-card__metadata-grid`.

- [ ] **Step 3: Implement**

Add a grid builder and call it from `renderExpandedBody` **in place of** the old `renderMetadata` due/scheduled/estimate items (projects/contexts move to Task 6). The old `metaWithIcon`/`renderMetadata` can be reduced or kept for projects only — but for this task add:

```ts
function metaCell(label: string, iconName: string, value: string | undefined, extraClass = ""): HTMLElement {
	const cell = el("div", `task-card__meta-cell ${extraClass}`.trim());
	cell.appendChild(el("div", "task-card__meta-label", label));
	const val = el("div", "task-card__meta-value");
	const icon = el("span", "task-card__meta-icon");
	icon.dataset.icon = iconName;
	icon.setAttribute("aria-hidden", "true");
	val.appendChild(icon);
	val.appendChild(el("span", "task-card__meta-text", value ?? "—"));
	cell.appendChild(val);
	return cell;
}

function renderMetadataGrid(card: TaskCardViewModel): HTMLElement {
	const grid = el("div", "task-card__metadata-grid");
	grid.appendChild(metaCell("Priority", card.priorityIcon ?? "flag", card.priorityLabel));
	const dueCell = metaCell("Due", "calendar-clock", card.dueLabel);
	if (card.overdue) dueCell.classList.add("is-overdue");
	grid.appendChild(dueCell);
	grid.appendChild(metaCell("Created", "calendar", card.createdLabel));
	grid.appendChild(metaCell("Estimate", "clock", card.estimateLabel, "task-card__meta-cell--estimate"));
	return grid;
}
```

In `renderExpandedBody`, append `renderMetadataGrid(card)` right after the title row (before description). Remove the old due/scheduled/estimate appends from `renderMetadata` (leave projects/contexts handling to be replaced in Task 6).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/widgetRenderer.ts tests/obsidian/widgetRenderer.test.ts
git commit -m "feat(render): boxed Priority/Due/Created/Estimate metadata grid

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Renderer — labeled Projects / Contexts / Tags rows

**Files:**
- Modify: `src/obsidian/widgetRenderer.ts`
- Test: `tests/obsidian/widgetRenderer.test.ts`

**Interfaces:**
- Produces: three optional rows `.task-card__chip-row` each with a `.task-card__chip-row-label` ("Projects"/"Contexts"/"Tags") and chips; rendered only when the list is non-empty and the option is enabled.

- [ ] **Step 1: Write the failing test**

```ts
it("renders labeled Projects/Contexts/Tags rows", () => {
	const root = render(filledModel);
	const labels = [...root.querySelectorAll(".task-card__chip-row-label")].map((n) => n.textContent);
	expect(labels).toEqual(["Projects", "Contexts", "Tags"]);
	const tagsRow = [...root.querySelectorAll(".task-card__chip-row")]
		.find((r) => r.querySelector(".task-card__chip-row-label")?.textContent === "Tags")!;
	expect(tagsRow.querySelectorAll(".task-card__tag").length).toBe(2);
});

it("omits a chip row when its list is empty", () => {
	const model = { ...filledModel, cards: [{ ...filledModel.cards[1], collapsed: false }] };
	const root = render(model);
	expect(root.querySelector(".task-card__chip-row")).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts -t "chip-row\|labeled Projects"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add a generic row builder and replace the old `renderMetadata` (projects/contexts) + `renderTags`:

```ts
function chipRow(label: string, chips: HTMLElement[]): HTMLElement {
	const row = el("div", "task-card__chip-row");
	row.appendChild(el("span", "task-card__chip-row-label", label));
	const list = el("div", "task-card__chip-row-chips");
	chips.forEach((c) => list.appendChild(c));
	row.appendChild(list);
	return row;
}
```

In `renderExpandedBody`, after the metadata grid + description, build the rows:

```ts
if (options.showProjects && card.projects.length > 0) {
	const chips = card.projects.map((project) => {
		const link = colorChip("task-card__project", project.label, `↗ ${project.label}`);
		link.dataset.path = project.path;
		makeActivatable(link, () => handlers.onOpenProject?.(project.path));
		return link;
	});
	content.appendChild(chipRow("Projects", chips));
}
if (options.showContexts && card.contexts.length > 0) {
	const chips = card.contexts.map((context) =>
		el("span", "task-card__context", `@${context}`));
	content.appendChild(chipRow("Contexts", chips));
}
if (options.showTags && card.tags.length > 0) {
	const chips = card.tags.map((tag) => {
		const chip = colorChip("task-card__tag", tag, `#${tag}`);
		makeActivatable(chip, () => handlers.onSelectTag?.(tag));
		return chip;
	});
	content.appendChild(chipRow("Tags", chips));
}
```

Delete the now-unused `renderMetadata` and `renderTags` functions (and the old `metaWithIcon` if nothing else uses it — check first).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/widgetRenderer.ts tests/obsidian/widgetRenderer.test.ts
git commit -m "feat(render): labeled Projects/Contexts/Tags chip rows

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Renderer — description "Read more" toggle

**Files:**
- Modify: `src/obsidian/widgetRenderer.ts`, `src/ui/taskCard.ts`, `src/ui/todayView.ts`, `src/ui/dailyTasksWidgetController.ts`
- Test: `tests/obsidian/widgetRenderer.test.ts`

**Interfaces:**
- Produces: `TaskCardViewModel` gains `descriptionExpanded: boolean`. When a description exceeds 140 chars and `descriptionExpanded` is false, render the truncated text + a `.task-card__read-more` button calling `onToggleDescription(id)`. Thread a `descExpandedIds: ReadonlySet<string>` through `createDailyTasksWidgetModel` / `getWidgetForDate` like `collapsedIds`.

- [ ] **Step 1: Write the failing test**

```ts
const longDesc = "x".repeat(200);
it("truncates long descriptions with a Read more toggle", () => {
	const model = { ...filledModel, cards: [{ ...filledModel.cards[0], description: longDesc, descriptionExpanded: false }] };
	const onToggleDescription = vi.fn();
	const root = render(model, allOn, { onToggleDescription });
	const desc = root.querySelector(".task-card__description")!;
	expect(desc.textContent!.length).toBeLessThan(longDesc.length);
	(root.querySelector(".task-card__read-more") as HTMLElement).click();
	expect(onToggleDescription).toHaveBeenCalledWith("TSK-8cA562sd");
});

it("shows full description when expanded, no toggle", () => {
	const model = { ...filledModel, cards: [{ ...filledModel.cards[0], description: longDesc, descriptionExpanded: true }] };
	const root = render(model);
	expect(root.querySelector(".task-card__description")!.textContent).toBe(longDesc);
	expect(root.querySelector(".task-card__read-more")).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts -t "Read more\|full description"`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/ui/taskCard.ts`: add `descriptionExpanded: boolean;` to the view-model and `descriptionExpanded?: boolean` to `TaskCardNesting`; set `descriptionExpanded: nesting.descriptionExpanded ?? false`.

`src/ui/todayView.ts`: add trailing param `descExpandedIds: ReadonlySet<string> = new Set()` and pass `descriptionExpanded: descExpandedIds.has(node.task.id)` into the `createTaskCardViewModel` nesting object.

`src/ui/dailyTasksWidgetController.ts`: add trailing `descExpandedIds` param to `getWidgetForDate`, forward as the new last arg.

`tests/obsidian/widgetRenderer.test.ts` `filledModel`: add `descriptionExpanded: false` to both cards.

`widgetRenderer.ts` — replace the description append in `renderExpandedBody`:

```ts
const DESC_LIMIT = 140;
if (card.description) {
	const block = el("div", "task-card__description-block");
	const collapsedDesc = !card.descriptionExpanded && card.description.length > DESC_LIMIT;
	const text = collapsedDesc ? `${card.description.slice(0, DESC_LIMIT)}…` : card.description;
	block.appendChild(el("div", "task-card__description", text));
	if (card.description.length > DESC_LIMIT) {
		const toggle = el("button", "task-card__read-more",
			card.descriptionExpanded ? "Read less" : "Read more");
		toggle.addEventListener("click", (event) => {
			stop(event);
			handlers.onToggleDescription?.(card.id);
		});
		block.appendChild(toggle);
	}
	content.appendChild(block);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts tests/ui/taskCard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/widgetRenderer.ts src/ui/ tests/
git commit -m "feat(render): description Read more/less toggle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Renderer — subtasks box header (chevron · label · progress · count · % pill)

**Files:**
- Modify: `src/obsidian/widgetRenderer.ts`
- Test: `tests/obsidian/widgetRenderer.test.ts`

**Interfaces:**
- Produces: when a card has `childProgress`, render `.task-card__subtasks-box` wrapping a header `.task-card__subtasks-head` (existing disclosure chevron + the literal label "Subtasks" + progress bar + `done/total` + a `.task-card__subtasks-pct` pill) followed by the existing subtask `<ul>`. The subtask `<ul>` moves **inside** the box.

- [ ] **Step 1: Write the failing test**

```ts
it("renders a Subtasks box with label, count, and percent pill", () => {
	const child = { ...filledModel.cards[1], collapsed: true, id: "TSK-child" };
	const parent = { ...filledModel.cards[0], children: [child], childProgress: { done: 1, total: 2 }, expanded: true };
	const root = render({ ...filledModel, cards: [parent] });
	const box = root.querySelector(".task-card__subtasks-box")!;
	expect(box.querySelector(".task-card__subtasks-head")!.textContent).toContain("Subtasks");
	expect(box.querySelector(".task-card__subtasks-pct")?.textContent).toBe("50%");
	expect(box.querySelector(".task-card__subtasks")).not.toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts -t "Subtasks box"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Restructure the subtask rendering in `renderTaskCard`. Replace `renderSubtaskFooter` + the trailing `<ul>` append with a single box. Add:

```ts
function subtaskPercent(progress: { done: number; total: number }): string {
	if (progress.total === 0) return "0%";
	return `${Math.round((progress.done / progress.total) * 100)}%`;
}

function renderSubtasksBox(
	card: TaskCardViewModel,
	options: WidgetRenderOptions,
	handlers: WidgetRenderHandlers
): HTMLElement {
	const box = el("div", "task-card__subtasks-box");
	const head = el("div", "task-card__subtasks-head");
	if (card.children.length > 0) {
		head.appendChild(renderDisclosure(card, handlers));
	}
	head.appendChild(el("span", "task-card__subtasks-label", "Subtasks"));
	if (card.childProgress) {
		head.appendChild(renderProgress(card.childProgress));
		head.appendChild(el("span", "task-card__subtasks-pct",
			subtaskPercent(card.childProgress)));
	}
	box.appendChild(head);
	if (card.children.length > 0) {
		const sublist = el("ul", "task-card__subtasks");
		sublist.id = `subtasks-${card.id}`;
		if (!card.expanded) sublist.setAttribute("hidden", "");
		for (const child of card.children) {
			sublist.appendChild(renderTaskCard(child, options, handlers));
		}
		box.appendChild(sublist);
	}
	return box;
}
```

In `renderTaskCard` (expanded branch only — `renderExpandedBody` or right after `mainRow` per current structure), where the old footer + `<ul>` were appended, append `renderSubtasksBox(card, options, handlers)` to `content` (so it sits inside the card body) **only when** `card.childProgress || card.children.length > 0`. Remove the old `renderSubtaskFooter` call and the old standalone `<ul>` append at the bottom of `renderTaskCard`. Delete `renderSubtaskFooter` if now unused.

Note: `renderProgress` already exists and renders the `<progress>` + `done/total` label — reuse it.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/widgetRenderer.ts tests/obsidian/widgetRenderer.test.ts
git commit -m "feat(render): boxed Subtasks section with percent pill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: SortableJS dependency + pure order-extraction helper

**Files:**
- Create: `src/obsidian/dragReorder.ts`
- Test: `tests/obsidian/dragReorder.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `siblingOrder(listEl: HTMLElement): string[]` — pure; returns the `data-task-id` of each direct-child `.daytasks-note-widget__card` in DOM order (skips nested lists).
  - `attachReorder(listEl: HTMLElement, parentId: string | null, onReorder: (parentId: string | null, orderedIds: string[]) => void): { destroy(): void }` — wraps SortableJS; on drop calls `onReorder(parentId, siblingOrder(listEl))`.

- [ ] **Step 1: Install the dependency**

```bash
npm install sortablejs@^1.15.6 && npm install -D @types/sortablejs@^1.15.8
```

Expected: both added to `package.json`. (esbuild bundles `sortablejs` into `main.js` — it ships with the plugin.)

- [ ] **Step 2: Write the failing test**

`tests/obsidian/dragReorder.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { siblingOrder } from "../../src/obsidian/dragReorder";

function listWith(ids: string[]): HTMLElement {
	const ul = document.createElement("ul");
	ul.className = "daytasks-cards";
	for (const id of ids) {
		const li = document.createElement("li");
		li.className = "daytasks-note-widget__card";
		const card = document.createElement("div");
		card.className = "task-card";
		card.dataset.taskId = id;
		li.appendChild(card);
		ul.appendChild(li);
	}
	return ul;
}

describe("siblingOrder", () => {
	it("returns direct child task ids in DOM order", () => {
		const ul = listWith(["a", "b", "c"]);
		expect(siblingOrder(ul)).toEqual(["a", "b", "c"]);
	});

	it("ignores cards nested deeper in the tree", () => {
		const ul = listWith(["a", "b"]);
		const nested = document.createElement("div");
		nested.className = "task-card";
		nested.dataset.taskId = "deep";
		ul.querySelector("li")!.appendChild(nested);
		expect(siblingOrder(ul)).toEqual(["a", "b"]);
	});
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/obsidian/dragReorder.test.ts`
Expected: FAIL — module/`siblingOrder` not found.

- [ ] **Step 4: Implement `dragReorder.ts`**

```ts
import Sortable from "sortablejs";

/**
 * Direct-child task ids of a card list, in DOM order. Reads the `data-task-id`
 * of each immediate `<li>.daytasks-note-widget__card`'s `.task-card`, so nested
 * subtask cards (deeper in the tree) are not counted as siblings.
 */
export function siblingOrder(listEl: HTMLElement): string[] {
	const ids: string[] = [];
	for (const li of Array.from(listEl.children)) {
		if (!(li instanceof HTMLElement) || !li.classList.contains("daytasks-note-widget__card")) {
			continue;
		}
		const card = li.querySelector<HTMLElement>(":scope > .task-card");
		const id = card?.dataset.taskId;
		if (id) {
			ids.push(id);
		}
	}
	return ids;
}

export interface ReorderHandle {
	destroy(): void;
}

/**
 * Wires SortableJS onto one sibling list. Dragging is grabbed by the card handle
 * only; groups are NOT shared, so items never cross between lists (siblings-only).
 */
export function attachReorder(
	listEl: HTMLElement,
	parentId: string | null,
	onReorder: (parentId: string | null, orderedIds: string[]) => void
): ReorderHandle {
	const sortable = Sortable.create(listEl, {
		handle: ".task-card__handle",
		draggable: ".daytasks-note-widget__card",
		animation: 150,
		onEnd: () => onReorder(parentId, siblingOrder(listEl)),
	});
	return { destroy: () => sortable.destroy() };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/obsidian/dragReorder.test.ts`
Expected: PASS. (`Sortable.create` is only hit by `attachReorder`, which the unit test does not call — `siblingOrder` is import-safe. If the bare `import Sortable` errors under jsdom, change it to `import type` is not possible since it's used at runtime; instead confirm vitest resolves `sortablejs` — it will, it's a normal npm module.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/obsidian/dragReorder.ts tests/obsidian/dragReorder.test.ts
git commit -m "feat(dnd): add SortableJS + sibling order extraction helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Host wiring — collapse state, drag attach, reorder + menu callbacks

**Files:**
- Modify: `src/main.ts`
- Test: manual (Obsidian host, not unit-tested — keep logic thin)

**Interfaces:**
- Consumes: `getWidgetForDate(date, expandedIds, collapsedIds, descExpandedIds)`; `attachReorder`; `service.reorderSiblings`; `Menu` from `obsidian`.
- Produces: collapse + description toggles re-render; drops persist via `reorderSiblings` then `refreshViews`; kebab opens a `Menu`.

- [ ] **Step 1: Add state fields + imports**

In `src/main.ts`:
- Import: `import { MarkdownView, Menu, Notice, Plugin, setIcon } from "obsidian";`
- Import: `import { attachReorder, type ReorderHandle } from "./obsidian/dragReorder";`
- Near `private expandedIds = new Set<string>();` add:

```ts
private collapsedIds = new Set<string>();
private descExpandedIds = new Set<string>();
private reorderHandles: ReorderHandle[] = [];
```

- [ ] **Step 2: Pass new sets + handlers into the render call**

In `renderWidgetInto`, update the model call and handlers:

```ts
const model = this.controller.getWidgetForDate(
	date,
	this.expandedIds,
	this.collapsedIds,
	this.descExpandedIds
);
renderDailyTasksWidget(container, model, this.widgetOptions(), {
	onCycleStatus: (taskId) => void this.handleCycleStatus(taskId),
	onCyclePriority: (taskId) => void this.handleCyclePriority(taskId),
	onAddTask: () => this.openCreateModal(date),
	onEditTask: (taskId) => void this.openEditModal(taskId),
	onOpenProject: (path) => this.openProject(path),
	onOpenTask: (taskId) => this.openTaskNote(taskId),
	onSelectTag: (tag) => this.searchTag(tag),
	onToggleSubtasks: (taskId) => this.toggleSubtasks(taskId),
	onToggleCollapsed: (taskId) => this.toggleCollapsed(taskId),
	onToggleDescription: (taskId) => this.toggleDescription(taskId),
	onOpenMenu: (taskId, anchor) => this.openTaskMenu(taskId, anchor),
});
this.applyIcons(container);
this.attachDrag(container, date);
return true;
```

- [ ] **Step 3: Add the toggle + drag + menu methods**

After `toggleSubtasks`, add:

```ts
private toggleCollapsed(taskId: string): void {
	if (this.collapsedIds.has(taskId)) {
		this.collapsedIds.delete(taskId);
	} else {
		this.collapsedIds.add(taskId);
	}
	this.refreshViews();
}

private toggleDescription(taskId: string): void {
	if (this.descExpandedIds.has(taskId)) {
		this.descExpandedIds.delete(taskId);
	} else {
		this.descExpandedIds.add(taskId);
	}
	this.refreshViews();
}

/** (Re)attaches SortableJS to the top-level list + each subtask list in `container`. */
private attachDrag(container: HTMLElement, _date: string): void {
	const topList = container.querySelector<HTMLElement>(".daytasks-cards");
	if (topList) {
		this.reorderHandles.push(
			attachReorder(topList, null, (parentId, ids) =>
				void this.handleReorder(parentId, ids))
		);
	}
	container.querySelectorAll<HTMLElement>(".task-card__subtasks").forEach((sublist) => {
		const parentId = sublist.id.replace(/^subtasks-/, "");
		this.reorderHandles.push(
			attachReorder(sublist, parentId, (pid, ids) =>
				void this.handleReorder(pid, ids))
		);
	});
}

private async handleReorder(parentId: string | null, orderedIds: string[]): Promise<void> {
	try {
		await this.service.reorderSiblings(parentId, orderedIds);
	} catch (error) {
		console.error("DayTasks: reorder failed", error);
	}
	this.refreshViews();
}

private openTaskMenu(taskId: string, anchor: HTMLElement): void {
	const menu = new Menu();
	menu.addItem((item) =>
		item.setTitle("Edit").setIcon("pencil").onClick(() => void this.openEditModal(taskId)));
	menu.addItem((item) =>
		item.setTitle("Add subtask").setIcon("plus").onClick(() => this.openCreateSubtask(taskId)));
	menu.addItem((item) =>
		item.setTitle("Delete").setIcon("trash").onClick(() => void this.deleteTask(taskId)));
	const rect = anchor.getBoundingClientRect();
	menu.showAtPosition({ x: rect.left, y: rect.bottom });
}
```

For `openCreateSubtask`: check how the create modal is invoked for subtasks today. If a subtask-create path exists (the edit modal exposed `getChildren`/`onDelete`; `service.createSubtask(parentId, input)` exists), wire it to the existing create modal seeded with `parentId`. If no such modal entry exists yet, implement minimally:

```ts
private openCreateSubtask(parentId: string): void {
	const parent = this.service.getById(parentId);
	if (!parent) return;
	this.openCreateModal(parent.scheduledDate, parentId); // extend openCreateModal to accept an optional parentId and call service.createSubtask when present
}
```

Adjust `openCreateModal`'s signature only if needed; if that is too invasive, drop "Add subtask" from the menu for v1 (leave Edit + Delete) and note it.

- [ ] **Step 4: Destroy Sortable instances before re-render (leak guard)**

In `refreshViews` (and anywhere the widget is torn down / re-rendered), before re-rendering, destroy existing handles:

```ts
private destroyReorder(): void {
	for (const handle of this.reorderHandles) {
		handle.destroy();
	}
	this.reorderHandles = [];
}
```

Call `this.destroyReorder();` at the **start** of `refreshViews()` (and in the plugin's `onunload`). Since `renderWidgetInto` runs for both reading + live preview and repopulates `reorderHandles`, the destroy-then-reattach keeps instances 1:1 with live DOM.

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck`
Expected: no errors. Fix any signature mismatches (e.g. `openCreateModal` arity).

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat(host): collapse/desc state, SortableJS drag, kebab menu

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: CSS — match the reference layout with theme tokens

**Files:**
- Modify: `styles/task-card.css`, `styles/widget.css`
- Build: `node build-css.mjs` regenerates `styles.css`

**Interfaces:** none (presentational). Use only `var(--...)` Obsidian tokens.

- [ ] **Step 1: Add styles**

Append to `styles/task-card.css` (adapt existing token names already used in the file — reuse its `--background-*`, `--text-*`, `--interactive-accent`, radius/border vars):

```css
/* Metadata grid */
.task-card__metadata-grid {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: var(--size-4-2);
	padding: var(--size-4-3);
	margin: var(--size-4-2) 0;
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-m);
	background: var(--background-secondary);
}
.task-card__meta-cell { display: flex; flex-direction: column; gap: var(--size-2-1); }
.task-card__meta-label { font-size: var(--font-ui-smaller); color: var(--text-muted); }
.task-card__meta-value { display: inline-flex; align-items: center; gap: var(--size-2-2); }
.task-card__meta-cell.is-overdue .task-card__meta-text { color: var(--text-error); }

/* Chip rows */
.task-card__chip-row { display: flex; align-items: baseline; gap: var(--size-4-2); margin: var(--size-2-2) 0; }
.task-card__chip-row-label { min-width: 4.5em; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.task-card__chip-row-chips { display: flex; flex-wrap: wrap; gap: var(--size-2-2); }

/* Read more */
.task-card__read-more {
	background: none; border: none; padding: 0; cursor: pointer;
	color: var(--text-accent); font-size: var(--font-ui-smaller);
}

/* Rail controls */
.task-card__collapse, .task-card__menu {
	background: none; border: none; cursor: pointer; color: var(--text-muted);
	display: inline-flex; padding: var(--size-2-1); border-radius: var(--radius-s);
}
.task-card__collapse:hover, .task-card__menu:hover { background: var(--background-modifier-hover); }

/* Collapsed slim row */
.task-card--collapsed .task-card__collapsed-row {
	display: flex; align-items: center; gap: var(--size-4-2); min-width: 0;
}
.task-card--collapsed .task-card__collapsed-title { font-weight: var(--font-medium); }
.task-card--collapsed .task-card__collapsed-id { color: var(--text-muted); font-size: var(--font-ui-smaller); }
.task-card--collapsed .task-card__collapsed-due { color: var(--text-muted); margin-left: auto; }

/* Subtasks box */
.task-card__subtasks-box {
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-m); margin-top: var(--size-4-2);
	background: var(--background-secondary);
}
.task-card__subtasks-head {
	display: flex; align-items: center; gap: var(--size-4-2);
	padding: var(--size-4-2) var(--size-4-3);
}
.task-card__subtasks-label { font-weight: var(--font-medium); }
.task-card__subtasks-pct {
	margin-left: auto; padding: 0 var(--size-4-2); border-radius: var(--radius-s);
	background: var(--background-modifier-success); color: var(--text-on-accent);
	font-size: var(--font-ui-smaller);
}
.task-card__subtasks { list-style: none; margin: 0; padding: 0 var(--size-4-2) var(--size-4-2); }

/* Drag handle: visible, grab cursor */
.task-card__handle {
	cursor: grab; color: var(--text-faint);
	width: var(--size-4-3); align-self: stretch; flex: 0 0 auto;
}
.task-card__handle::before { content: "⠿"; }
.task-card__handle:active { cursor: grabbing; }
.sortable-ghost { opacity: 0.4; }
.sortable-chosen { background: var(--background-modifier-hover); }
```

If `--size-*`/`--radius-*`/`--font-*` token names differ from what the existing file uses, match the existing file's conventions instead — grep the current `styles/task-card.css` for the variables it already references and reuse those.

- [ ] **Step 2: Rebuild CSS**

Run: `node build-css.mjs`
Expected: `styles.css` regenerated, no error.

- [ ] **Step 3: Commit**

```bash
git add styles/ styles.css
git commit -m "style(card): grid metadata, chip rows, collapsed row, subtasks box

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: Full build, manual in-vault verification, final commit

**Files:** none new — verification + any fixes surfaced.

- [ ] **Step 1: Full check**

Run: `npm run check`
Expected: typecheck + all tests PASS.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean (fix any unused-import/`any` issues from the new code).

- [ ] **Step 3: Build into the test vault**

Run: `npm run build:test`
Expected: build succeeds, plugin copied to `daytask-vault`.

- [ ] **Step 4: Manual verification checklist (open `daytask-vault` in Obsidian, a daily note in reading mode AND live preview)**

Verify each:
- Top-level cards render expanded with the 4-col metadata grid (Priority/Due/Created/Estimate), labeled Projects/Contexts/Tags rows, and a Subtasks box with a % pill.
- Chevron collapses a card to the slim row (title≤30…, id, due); chevron re-expands. State holds across typing/refresh.
- Subtasks render collapsed by default; their chevron expands them to a full card.
- Long descriptions show "Read more"; clicking toggles to "Read less".
- ⋮ opens the actions menu (Edit / Add subtask / Delete) and each works.
- Drag a top-level card by the ⠿ handle → order changes and **persists after closing/reopening the note** (data.json `sortOrder` written).
- Drag a subtask within its parent → persists; a subtask cannot be dropped into the top-level list.
- Completed tasks stay where dragged (no auto-sink to bottom).
- Toggle a light and a dark theme → colors adapt (no hardcoded palette).

- [ ] **Step 5: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues from manual verification of card UI + dnd

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Match layout w/ theme tokens → Tasks 4–8, 11. ✓
- Collapse/expand model + defaults → Tasks 3, 4, 10. ✓
- Compact subtasks expanding to full cards → Tasks 3 (collapse polarity by depth), 8. ✓
- Metadata grid incl. Created → Task 5. ✓
- Separate Projects/Contexts/Tags rows → Task 6. ✓
- Read more → Task 7. ✓
- Drag-to-reorder siblings only + SortableJS → Tasks 9, 10. ✓
- Persist via sortOrder + reorderSiblings → Task 2, 10. ✓
- Drop done sort (bySortOrder) → Task 1. ✓
- Kebab actions menu → Tasks 4 (control), 10 (Menu). ✓
- Header/footer restyle → Task 11 (covered by existing structure + CSS; no DOM change needed beyond current header/footer). ✓

**Open items flagged for the implementer (resolve in-task, not blockers):**
- `DayTaskService` `updatedAt` stamping mechanism (Task 2 Step 3) — mirror `updateTask`.
- `openCreateModal` parentId arity for "Add subtask" (Task 10 Step 3) — extend or drop the item for v1.
- Exact CSS token names (Task 11) — reuse the existing file's conventions.

**Type consistency:** `collapsed`/`createdLabel`/`descriptionExpanded` added in Task 3/7 and consumed in Tasks 4–8; `siblingOrder`/`attachReorder`/`ReorderHandle` defined in Task 9 and consumed in Task 10; `reorderSiblings(parentId, orderedIds)` defined in Task 2, consumed in Task 10. Handler names (`onToggleCollapsed`/`onToggleDescription`/`onOpenMenu`) defined in Task 4, wired in Task 10. Consistent.
