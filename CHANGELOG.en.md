# Bordena changelog

## W 1.0

Public W/SemVer versions, quick Add column, Windows installer and signed CHOPIK Launcher delivery contract.

## AW 0.82

- Unsaved event/calendar protection on Escape, form dismissal and native window close; save, discard or continue editing.
- Date fields retain incomplete input and validate before saving.
- A conflicting editor now asks to reopen the entry; export instructions remain specific to external Changesets.
- Exports and backups flush pending Markdown; restore rechecks its preview after flushing the editor.
- The main BAT launches release 0.8.2 only, reports a missing EXE and returns an error code. Development remains in dev.bat.
- Ctrl+K scrolls the selected keyboard result into view and wraps long names. Title placeholders use the readable shared secondary text color.
- Recurrence expansion computes its constant all-day span once and skips that calculation for timed entries.
- Stabilization checks and limitations: docs/BORDENA_082_FINAL_QA_REPORT.md.

## AW 0.81

Colored calendars in one menu; independent visibility and creation target. Drag existing blocks and return them to tasks. Local time without an IANA selector, profile-free scheduling, audited settings and colored year markers.

## AW 0.8

UX Restructure & Smart Planning

- Tabs are off by default; Use tabs restores compatible navigation without deleting saved tabs.
- Sidebar groups navigation, workspace, boards/folders, custom calendars and secondary actions. The main Calendar entry opens the general calendar.
- Compact title/view headers and neutral lane drop areas replace tall empty containers. Header plus creates sections; double-click lane titles to rename, with Enter/Escape and Undo.
- Focus is in View and Ctrl+K with a clear exit. Colors, Markdown and all previous board views remain supported.
- Edit planning inside cards: existing blocks, explicit additional blocks, date moves retaining local start/duration and safe unscheduling without changing the card or deadline. Occurrence/series scope and unsaved changes are explicit; filters are preserved.
- Year calendar with twelve months, month/day drill-down and exact period navigation; wheel scrolling does not accidentally switch years.
- Year chart separates merged busy hours, summed planned hours and counts. Availability percentages require a profile. Time zones, DST, month boundaries and recurrence exceptions are respected.
- IndexedDB and portable JSON schemas remain unchanged. Windows x64 version is 0.8.0; the application works offline.

## AW 0.71

Visual Fidelity

- Adaptive Free columns, balanced surfaces, a flexible board title and clearer view controls.
- More compact sidebar groups, bounded expandable Markdown previews and more legible calendar events and panels.
- Existing data, board layouts, colors and calendar planning are preserved.
- Multi-day agenda occurrences are shown once on their start date.

## AW 0.7

UX Redesign & Focus

- End-of-day deadlines no longer appear again on the following date. Double-clicking an event opens the editor without the side panel shifting the grid.

- Clean board/calendar headers, labeled views and contextual panels.
- Ctrl+K commands and local objects, unified creation, persistent card colors.
- Collapsible navigation, Compact and Focus, preserving existing data and services.

## AW 0.6

Bordena Calendar

- Direct task planning: no selection checkboxes or Suggest times button; drop onto a month date or day/week time to save a linked block. Click to edit dates and times. The task panel can be hidden and remembers its state.
- The wheel switches months; Day, Week, Agenda and the task list scroll smoothly. Month drop targets and localized task dates/priorities are supported.

- “Support the developer” with Velora's Boosty mark in the Bordena menu and About.

- Unified Bordena 0.1–0.6 numbering without AW; UI 0.6, Windows/SemVer 0.6.0.

- Smooth calendar/task-list mouse-wheel scrolling with accumulated steps, immediate direction reversal, interaction cancellation and reduced-motion support.
- Shared dialog padding and a gray close cross, preserving one close action in custom headers.
- Separate category/template selectors with sorting and a section/stage preview; the “+” tooltip explicitly offers board or calendar creation.
- Usability follow-up: permanent general calendar, per-card custom calendar selection, and a shared “+” menu for boards and calendars.
- Wider padded forms and tabs with safe truncation. Dropping a card into an empty lane or board creates its section automatically.
- “Support the author” in the logo menu and About, using the same Boosty address as Velora.
- Multiple local calendars, a shared app tab, day/week/month/agenda views and bounded overlap expansion.
- Standalone events, original-card time blocks, derived deadlines and portable checklist anchors.
- Zoned recurrence and exceptions, availability profiles, overnight intervals, opt-in one-off rescheduling, shared history and reminders.
- Calendar Changeset operations and JSON v6 backup/restore; old document versions remain readable.
- Fixed native card windows to configure the shared WebView2 profile in Rust.
- Recurring-block automatic rescheduling and future-only series edits remain outside the implemented scope; see the 0.6 report.

## AW 0.4

linked projects, JSON commands and calendar

- Local ID-based board links, separate calculated progress and explicitly enabled range-based movement; cycle checks and idempotence.
- Mirrors refer to one original card and retain independent placement. Deleted originals appear unavailable.
- Create local board/card links from Markdown selections with ordinary tabs and Back navigation.
- Strict Changeset JSON v1: revision checks, verified backup, one transaction, SHA-256 ledger and whole-batch undo.
- Ten template categories, custom reusable structures and six custom field types; table view edits the same cards.
- Managed image and MP3/WAV previews; external local video/document references, path checks, names, groups, ordering and pins.
- Shared date and optional time calendar; attach dates to words using right-click or Shift+F10 and edit them in preview.
- Fixed local date-only expiry, expired times today, offset-to-local calendar editing and explicit matrix completion states.
- Session structural undo/redo, configurable backup slots preserving manual/checkpoint copies, Windows notifications off by default.
- Whole-header section dragging, direct color palette, independent section/stage/state selection and a responsive card panel.
- JSON v4 reads v1–v3; verified checkpoint precedes legacy model edits. Twenty-six offline guide topics in RU/EN.

## AW 0.3

sections and workspaces

- Move whole sections with a grip, keyboard commands or section settings; retain cards and section options.
- Section progress is off by default. Choose manual values or a positional scale without overwriting manual data.
- Workspaces and optional project folders organize the existing local board database. Move, archive and remove containers safely.
- One settings center for appearance, controls, data, About, the guide and this changelog.
- Russian, English and OS language selection; language changes retain card drafts.
- Seventeen searchable offline guide topics in both languages.
- JSON v3 and verified backups retain workspace definitions, project folders, section order, progress modes and preferences. Import also reads v1/v2.
- Removed the obsolete board-wide progress control and duplicate global theme/export controls.
- Fixed an inherited member lookup that reported an error while editing notes offline.
- Local linked boards and explicitly enabled progress/movement rules are planned separately in the roadmap.

## AW 0.2

navigation and layouts

- Independent @bordena packages and a smaller development environment.
- Tabs, favorites, recent boards and local search.
- Middle-button panning, free sections and a matrix with independent stages/states.
- Safe layout switching, manual progress, colors and JSON v2.
- Local cross-board card moves preserve identity and attachment keys.

## AW 0.1

foundation

- Independent offline Windows application from CHOPIK Team, incorporating part of the Doska code.
- Separate application identity, WebView2 profile, local attachments and dev.bat.
- Approved Bordena logo with a subtle glow, authorship and license notices.
- JSON v1 export and verified backups with attachments.

Windows installer and clean-machine verification results are recorded in the implementation report.
