# Bordena W 1.0 user guide

## Bordena W 1.0: navigation and workspace

Tabs are hidden by default. Use the sidebar and Ctrl+K; Alt+Left / Alt+Right navigate history. Settings → Interface → Use tabs restores the compatible tab mode without deleting saved tabs. Boards retain Free, Matrix, Table and Goal Path. Title and view stay together; secondary actions are in ⋯. Lanes have neutral empty space. The header plus adds a section; double-click a lane title to rename it, Enter saves, Escape cancels, Ctrl+Z undoes. Multiple sections remain supported. Focus is in View and Ctrl+K, with an explicit Exit focus command. One button controls sidebar/drawer. Ctrl+B leaves text editors in control. Compact is independent. Card and section colors stay visible; full Markdown remains in the editor. Bordena.bat starts the release only and reports a missing EXE; use dev.bat for development.

## Calendar, year and workload

The sidebar has one Calendar entry. Inside All calendars manage visibility, colors, names and the new-entry target independently. General toggles all sources without duplicates. Day, Week, Month, List and Year views share filters. Today and T return to the current date without resetting filters. Arrows move the current period, 90 days in List. The month wheel changes months; the year wheel scrolls the overview. Year shows 12 months: click a title for Month or a date for Day. The chart below is collapsible. Busy hours merge overlaps; summed planned hours and task/event counts are separate metrics. All-day items and deadlines do not add hours. There are no availability percentages; colored dots identify each day’s calendars. These are plans, not actual hours worked. Ctrl+N creates an event; Escape cancels a drag. Dismissing a changed event or calendar offers Save, Discard changes or Continue editing, including when quitting. Correct empty or invalid dates before saving. Exports and backups wait for the last pending card edit.

## Work blocks and card planning

Open Basics and progress → Planning in a card. Edit an existing block here without leaving the card. Use Edit plan when a plan exists; Add another work block is explicit. Moving the date retains local start and elapsed duration, or the calendar-day span for all-day blocks. The card deadline is independent. Save applies the form. The last active block can return the task to unscheduled; otherwise only this block is removed. Recurrences require an occurrence/series choice. Unsaved changes offer save, discard or continue editing. The card, Markdown, files and progress remain. Ctrl+Z undoes supported operations outside text fields. Filters are preserved; Show task explicitly reveals the source after unscheduling. Standalone events are cancelled without claiming a task was returned.

## Recurrence and time zones

In advanced options choose daily, weekly, monthly or yearly repetition, an interval, weekdays, an end date or a count. Occurrences are computed only for the visible period. Edit or cancel one occurrence or the entire series. Absolute timestamps are not rewritten. Timed entries display in the device zone; recurrence keeps its original zone and wall time, while all-day dates stay calendar dates. Changing device zones changes presentation only; the 31st skips months without that date. A nonexistent DST wall time is skipped; an ambiguous autumn hour uses its first occurrence. Editing only the future portion and automatic rescheduling of recurring blocks are not implemented in this iteration; edit an occurrence manually.

## Flexible task scheduling

Availability profiles are not needed. Set a default calendar in board options; an explicit card or block assignment takes precedence. Assignment alone does not create an event or change the source card color. In Unscheduled tasks set a duration and drop a card onto a month date or day/week time: the linked block is saved immediately without changing the card deadline. Click a task to choose its date and time, or click an existing block to edit it. Hide the list with its close button and restore it with Unscheduled tasks; the choice persists. The wheel switches months in Month and smoothly scrolls Day, Week and Agenda.

## Smart rescheduling and safety

Manual is the default. To allow rescheduling explicitly select Smart or Next Day on a calendar/block, mark the block flexible. Search runs daily 09:00–20:00 in device-local time, respecting busy intervals and due dates. Historical profiles remain in backups but never control the search. Completed, cancelled, pinned and unavailable sources are not moved. Without a suitable slot the block remains in Needs planning; the original deadline is unchanged. Changing the mode or search horizon permits another attempt. Automatic actions use the main window coordinator and shared history. Undo/Redo is available while later edits remain compatible. Windows reminders require separate opt-in and only work while Bordena runs. Full backups include calendar data in JSON v6; exports without calendar data remain compatible JSON v5.

## Example: video production

Create a Video calendar, a production board and cards for script, recording and editing. Use Schedule a time block from each card to plan separate sessions. Editing can have several blocks. Keep publication due on the card: moving a session never postpones publication. Show video and personal calendars together in week view.

## Example: software development

On a release board define Goal Path stages and implementation, QA and documentation cards. In Development schedule blocks linked to those cards or stages. Assign a colored calendar to the board, pin a meeting and drag tasks into free time. A flexible one-off block can explicitly allow rescheduling without changing the release deadline.

## Example: personal routine

Create Personal, Study and Home calendars. Add standalone meetings without boards and a recurring lesson on selected weekdays. Cancel one lesson as an exception while retaining the series. In All calendars enable the categories you want; colors and names distinguish overlapping events.

## Getting started

Bordena stores projects on this computer and works offline. Use the logo menu for settings, help and backups. Create a board with the button in the sidebar.

## Workspaces

Choose a workspace above the board list. Use the adjacent menu to create or rename one. Workspaces organize local work without members or accounts. Tabs and favorites let you return to boards in other workspaces.

## Projects and folders

A project is an optional folder containing boards. Create one in the workspace menu. Rename it in the list; its menu can move or archive the project. Deleting a folder keeps its boards. Nested folders are not supported.

## Boards and navigation

Choose a name, project and mode when creating a board. Closing a tab does not delete its board. Use the star for favorites. Ctrl+K searches boards, projects and card text; Ctrl+Tab switches tabs when enabled. The board menu can move, archive or delete a board. Trash retains deleted items for 14 days.

## Cards

Add a card using the section button, then open it to edit. Its title, notes, tags, priority and deadline are saved locally. Drag cards to reorder or move them. Bordena waits for open edits to save before closing.

## Markdown notes

Notes support headings (#), emphasis (**text**), lists and links. Switch between preview and editing in a card. Changing the interface language never translates your content.

## Checklists

Write - [ ] task or - [x] done on a separate line in a note. Check items in preview. Checklists are independent of positional section progress.

## Sections

A free board contains lanes with card sections. Add a section and name it immediately. The arrow collapses the entire section. Its menu contains color, completed-card behavior, settings and deletion with confirmation.

## Moving a section

Drag the free area of the colored section header. Buttons and title editing work independently. All cards, notes and settings stay with it. Keyboard: Tab to the header, Space, arrow keys, Space; Esc cancels. The menu also provides move up/down commands, and section settings let you choose another lane. The round header swatch opens the color palette directly.

## Free board

Lanes hold independent sections. Layout controls can add and rename lanes. Sections retain their own order. Scroll or hold the middle mouse button to explore a large board.

## Matrix

Matrix columns are stages and rows are states. Cards retain both coordinates independently of their free-board section. Drag cards between cells or select a stage and state in the card. Collapsing a row does not delete its cards.

## Section progress

Progress is off by default. In section settings choose manual or positional progress. Manual values range from 0 to 100 in the card. Positional progress gives the first card 0%, the last 100%, with even steps between. One card has no defined value. Position does not mean task completion and never overwrites manual values.

## Switching modes

Choose free or matrix mode above the board. A verified local backup protects model changes. IDs, notes, attachments and manual progress are preserved. Returning to free mode restores the previous sections and their placement.

## Colors and appearance

Choose section colors in their menus. Layout controls provide stage/state colors and subtle cell tinting. Interface settings contain theme, density, zoom and animation options. Your custom names remain unchanged.

## Keyboard and controls

Ctrl+K: search; Ctrl+Tab / Ctrl+Shift+Tab: tabs; Ctrl+B: sidebar; Ctrl+Z: safely undo supported changes; Ctrl+S: save edits; Ctrl+plus/minus/0: zoom. Enter and Space activate buttons; Esc closes menus. Configure the quick-note shortcut in settings.

## Export, import and restore

In Data settings export the current board or all boards. Attachments use ZIP with SHA-256 verification; exports without files use JSON. Review object counts and ID conflicts before importing. Adding boards does not replace existing IDs. Replacing all data requires a full export and a verified safety backup. JSON v5 preserves links, mirrors, rules, templates, fields and external file references; older v1–v4 exports remain readable.

## Attachments and local storage

Attached files are copied into the Bordena profile. Data settings show its path and the latest local backup. Removing an original file does not remove the attachment. Do not move individual profile files while the app is running; use a full ZIP export. Keep external backups on another drive.

## Linked boards

Expand Linked board in a card, choose a local board and select navigation, progress or automatic stage movement. Progress comes from an explicit board percentage, completed tasks, stage weights or selected cards/sections. An empty or unset source shows a reason instead of 0%. Ranges from 0 to 100 must not overlap; full coverage can be disabled. Only enabled rules change the stage and an explicitly selected section; state and manual percentage are preserved. ID-based links reject cycles and update after saving. Deleting a board leaves an unavailable link and preserves its parent card.

## Card mirrors

In a card expand Card mirrors and choose a destination board and section. A mirror refers to one original card. Title, notes, priority and progress update from that original; dragging a mirror changes only its placement. In a matrix its stage and state are independent. Clicking opens the original. Removing a mirror does not delete the task; a deleted original appears unavailable.

## Links from selected text

Select Markdown editor text to create a task or board, link an existing board/card or open a detected link. A successful action turns the selection into a bordena://board/ID or bordena://card/ID link. If the document changed meanwhile, Bordena preserves the newer text. Navigation opens the object in the main view; Alt+Left returns to the previous screen.

## Bordena JSON commands

Settings → Data → Bordena Changeset JSON applies a local command file after strict validation. Commands use stable IDs and expectedUpdatedAt from an export; they execute no code and use no network. A verified backup precedes one atomic transaction. Repeating an identical batch ID creates no duplicates. Undo the latest batch before making further changes, or explicitly restore its backup afterward. BORDENA_AI_EXCHANGE_GUIDE.md describes the format and examples.

## Templates and fields

Board creation offers ten template categories. Sample cards are added only when requested. Board options can save a custom template, import/export its JSON and add text, number, date, percentage, checkbox or option-list fields. Templates copy structure and field definitions with new IDs, without real links, attachments or history. Edit values in a card and show selected fields in the table.

## Images, audio and external files

Managed images and MP3/WAV play inside Bordena. The attachment menu changes name/group, order and pinning. Unlinking keeps local bytes; deleting a managed copy requires confirmation and a verified backup. Link videos and large materials as local external files: stored path, presence check, supported preview or Windows opening. External bytes are excluded from exports; select a new path after moving a file. Video codec support depends on WebView2.

## Deadlines, states and notifications

A date without time lasts through the local day. A timed deadline expires at that instant and honors an explicit timezone offset. An overdue unfinished card receives a subtle red outline; disabling animations or reduced motion removes pulsing. Layout states have Mark as completed: an explicit value overrides section completion regardless of its name. Legacy states without this setting use their section. Frozen does not automatically mean completed. Windows notifications default to off and check only while the main window is open, with no background service.

## Table, undo and backup slots

Table is a third view of the same cards: search, overdue filtering, sorting and editing stage, state, priority and deadline. Choose custom field columns separately. Ctrl+Z and Ctrl+Shift+Z outside text inputs undo/redo supported structural edits in this session. Notes have their editor history; durable activity is kept separately. Data settings retain 0/3/5/10 or a custom number of automatic backups; manual, legacy and checkpoint copies are excluded from pruning. In-profile backups do not replace external exports.

## Calendar and text dates

Click a deadline, choose a calendar day, optionally enable time and press Apply. Today, tomorrow and next week are one click away. Date-only deadlines last through the day; timed values retain the local timezone offset. Right-click a word or selection in the editor (Shift+F10 on the keyboard) to attach a date, insert one at an empty caret or separately edit the card deadline. In preview, click an underlined date to change it or remove its attachment while preserving the word and surrounding text. A text date never silently changes the card deadline. Escape cancels a draft; ordinary editor Ctrl+Z undoes insertion. Anchors are stored in Markdown and included in exports.

## Goal Path

Create a board with Goal Path layout or choose the route icon on an existing board. Add, rename and reorder steps in path settings. Attach ordinary cards with their Markdown, checklists and files intact. Removing a route step does not delete cards or its matrix axis.

## Goal progress and step order

Choose manual progress, completed required steps or your own metric. The manual value survives mode changes. Visit steps freely, return to earlier ones and skip optional steps. Enable strict ordering explicitly. No required steps means unset progress, never automatic completion.

## Your own metrics

Define a name, start, target, unit and direction. Edit the current value directly or record a dated measurement. Backdated measurements affect the current value only with Use as current value checked. History and the chart show your own values without norms or advice.

## Deadline Actions

Deadlines are highlighted by default. In a card open Automation → Deadline Action, choose an action and save. Completed and archived tasks are skipped unless explicitly allowed. One scheduler watches the nearest deadline. Events missed while Bordena was closed are checked at next start. An unchanged deadline runs once.

## If → Then rules

Add a card rule based on deadline, a nonempty checklist, explicit 100%, required goal steps, your metric or linked progress range. Actions assign section, stage, state or manual progress, complete a goal step or log history. Saving explicitly enables a rule; disable, pause or remove it later. Conflicting assignments do not move the card.

## Goal templates and undo

The shared catalog includes 19 goal structures for personal projects, study, video, software and music. Copies get fresh IDs and never inherit actual measurements. Examples and their rules require separate opt-in. Automation uses shared history. Ctrl+Z outside the editor undoes the last structural action while preserving later text; conflicting manual edits block undo. An undone event does not fire again.
