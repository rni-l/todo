# Personal TODO App Prototype Specification

Date: 2026-06-07
Audience: product design tools, UI designers, and future implementation planning
Product type: personal self-hosted web TODO application
Design direction: Apple-ish personal productivity workspace

## 1. Product Summary

This product is a personal TODO web application inspired by TickTick, designed for one user only. It will be deployed on the user's own cloud server, so desktop and mobile devices share the same data through the same web service. It is not a team collaboration platform, SaaS product, or public-facing app.

The first version should feel like a polished personal command center: fast to open, quiet to look at, efficient to operate, and strong enough to replace a daily task manager. The product should prioritize task capture, daily planning, calendar review, project organization, saved filters, reminders, and file-backed task context.

The application is online-first. It does not promise offline editing. A PWA install experience is required so the app can be launched like a native app on mobile and desktop. Browser notifications are supported after permission is granted.

## 2. Design Read

Reading this as: a self-hosted personal productivity workspace for one power user, with an Apple-ish calm glass-material language, leaning toward a polished PWA product interface rather than a marketing page.

Design dials:

- Design variance: 5 out of 10. Calm, premium, and recognizably product-like.
- Motion intensity: 4 out of 10. Subtle state motion and tactile transitions only.
- Visual density: 7 out of 10 on desktop, 5 out of 10 on mobile. The app must support real daily task volume.

The interface should not look like a generic dashboard, SaaS landing page, or decorative bento layout. The task list is the center of the experience. Visual polish should come from spacing, typography, hierarchy, material layering, micro-interactions, and state design.

## 3. Product Principles

1. Capture must be instant.
   The user should be able to create a task from the main screen or command palette without deciding every property first.

2. Today must be obvious.
   The app should always make today's commitments, overdue items, and upcoming reminders easy to find.

3. Organization should be powerful but quiet.
   Projects, sections, tags, priorities, filters, and calendar views should support planning without making the interface feel administrative.

4. Details should stay close.
   Selecting a task should open a details panel without navigating away from the current list whenever possible.

5. Files are context, not the main object.
   Attachments should support task context, but the product should still feel like a TODO app rather than a file manager.

6. One user, one source of truth.
   No team features, sharing, comments, permission roles, or multi-user complexity in the first version.

## 4. First-Version Scope

### In Scope

- Single-user password login
- Main task workspace
- Inbox
- Today view
- Upcoming view
- Week and month calendar views
- Projects/lists
- Project sections
- Tags
- Saved smart filters
- Completed tasks view
- Task details drawer
- Markdown task description
- Checklist subtasks
- Priority
- Due date
- Optional reminder time
- Practical recurring tasks
- Browser notifications
- Command palette
- PWA install support
- Any-file attachments up to 100 MB per file
- Manual data export/import
- Separate attachment export/import

### Out of Scope

- Multi-user accounts
- Team collaboration
- Comments
- Shared projects
- Full offline editing
- Natural-language quick add
- AI task parsing
- Pomodoro timer
- Habit tracking
- Advanced analytics
- Third-party calendar sync
- Start/end time scheduling
- Kanban board
- Public file links

## 5. Information Architecture

The app uses a persistent workspace shell with a global navigation layer, a content layer, and a task detail layer.

Primary navigation:

- Inbox
- Today
- Upcoming
- Calendar
- Projects
- Tags
- Smart Filters
- Completed
- Settings

Secondary navigation:

- Project list
- Project sections
- Tag list
- Saved filter list
- View settings
- Import/export
- Attachment management

Global actions:

- New task
- Open command palette
- Search
- Toggle theme
- Notification permissions
- Account/session menu

## 6. Desktop Layout

Desktop target width: 1280 px to 1728 px.
Minimum useful desktop width: 1024 px.

The desktop shell uses three functional regions.

### Left Sidebar

Width: 248 px expanded.
Collapsed width: 68 px optional for later.

Purpose:

- Primary navigation
- Project shortcuts
- Smart filter shortcuts
- Quick access to settings

Structure:

- Top app identity row
- New task button
- Primary navigation group
- Projects group
- Smart filters group
- Bottom utility row

Visual behavior:

- Background uses a soft translucent material, slightly distinct from page background.
- Sidebar has a subtle right border or inner highlight, not a heavy shadow.
- Active navigation item uses a filled or tinted rounded rectangle.
- Counts appear as small right-aligned badges.

### Main Content

Flexible width.
Recommended max content width: no hard max for list views; allow width to adapt.

Structure:

- Header row
- Quick add row
- View controls row, when needed
- Task list or calendar content

Header row includes:

- View title
- Context subtitle or count
- Search icon/button
- Sort/group controls
- More actions menu

### Right Detail Drawer

Width: 420 px to 520 px.
Behavior:

- Opens when a task is selected.
- Can be closed with Escape or close button.
- On wide desktop it docks to the right.
- On narrower desktop/tablet it overlays the main content.

Purpose:

- Edit task title
- Edit task properties
- Write Markdown notes
- Manage checklist subtasks
- Manage attachments
- Configure recurrence and reminder

## 7. Mobile Layout

Mobile target width: 360 px to 430 px.

The mobile shell should not simply shrink the desktop. It uses a bottom navigation model and full-screen task detail screens.

Primary mobile navigation:

- Today
- Inbox
- Calendar
- Projects
- More

Mobile layout rules:

- The sidebar becomes a "More" screen or slide-over panel.
- Task detail opens as a full-screen sheet.
- New task action is always available from a floating button or bottom bar action.
- Command palette becomes a mobile command/search sheet.
- Touch targets should be at least 44 px tall.
- Dense text should remain readable; do not use tiny desktop table typography.

Mobile interaction priority:

1. Add task quickly.
2. View today.
3. Complete or postpone a task.
4. Open task details.
5. Check calendar.

## 8. Main Screens

### 8.1 Login Screen

Purpose:

Authenticate the single user before exposing any data.

Layout:

- Centered login panel on a calm background.
- App name and short line of copy.
- Password input.
- Optional username input if configured.
- Submit button.
- Error message area.

Visual notes:

- Avoid a marketing-style hero.
- The screen should feel private, minimal, and secure.
- Use soft material card, but keep it compact.

States:

- Default
- Focused input
- Submitting
- Invalid password
- Server unavailable

Suggested copy:

- Title: "My Tasks"
- Subtitle: "Private task workspace"
- Button: "Sign in"
- Error: "The password is incorrect."

### 8.2 Workspace Shell

Purpose:

The reusable frame for all authenticated screens.

Desktop composition:

- Left sidebar
- Main content area
- Optional right task drawer

Mobile composition:

- Top compact title bar
- Main content
- Bottom navigation
- Floating new-task action

Shell components:

- App identity
- Navigation items
- New task action
- Search/command shortcut
- Theme toggle
- User/session menu

### 8.3 Inbox View

Purpose:

Default capture area for tasks not assigned to a project.

Content:

- View title: "Inbox"
- Subtitle: task count or empty-state copy
- Quick add input
- Task list grouped by status or ungrouped

Task list item content:

- Completion checkbox
- Task title
- Priority marker
- Due date/reminder chip
- Project name if relevant
- Tags
- Attachment indicator
- Recurrence indicator

Empty state:

- Short calm message.
- Primary action to add task.
- No illustration-heavy empty state.

Suggested empty copy:

- "Nothing waiting in Inbox."
- "Capture a task when something needs a place to land."

### 8.4 Today View

Purpose:

Daily execution screen.

Content groups:

- Overdue
- Today
- No time, if due today without reminder time
- Completed today, collapsible

Header:

- "Today"
- Date
- Count of open tasks
- Button to hide/show completed

Interactions:

- Complete task
- Open task detail
- Postpone to tomorrow
- Change priority
- Drag reorder within Today

Visual behavior:

- Overdue items should be visible but not aggressive.
- Today's focused tasks should have the clearest hierarchy.
- Completed items collapse by default after completion.

### 8.5 Upcoming View

Purpose:

Lightweight planning list across near-future dates.

Groups:

- Tomorrow
- This week
- Next week
- Later
- No date, optional section

Interactions:

- Drag task between date groups to change due date.
- Click date chip to edit.
- Use group collapse for long lists.

### 8.6 Calendar View

Purpose:

Review and reschedule tasks by date.

Modes:

- Week view
- Month view

Not included:

- Hour-by-hour schedule grid
- Start/end time blocks

Week view:

- Seven columns.
- Each day shows date, weekday, and task count.
- Tasks appear as compact pills or rows inside day columns.
- Today column is visually highlighted.

Month view:

- Calendar grid with day cells.
- Tasks show as compact rows, with overflow indicator when too many.
- Clicking a day opens a day detail panel or filtered list.

Interactions:

- Drag task to another day to change due date.
- Click task to open detail drawer.
- Click empty day area to create task due on that day.
- Switch week/month mode.

Calendar task visual:

- Priority shown through a small color dot or line.
- Reminder time shown as small text, not as a timeline block.
- Recurrence shown with a repeat icon.

### 8.7 Projects View

Purpose:

Manage task lists/projects and their sections.

Project behavior:

- A task may belong to one project.
- A project may have multiple sections.
- Sections organize tasks within a project.

Project screen layout:

- Project title
- Project metadata row
- Section tabs or stacked section groups
- Quick add within current project
- Task list

Section behavior:

- Section name is editable.
- Tasks can be dragged between sections.
- Empty sections can show a minimal empty row.

Project management:

- Create project
- Rename project
- Archive project
- Delete project, with confirmation
- Reorder projects in sidebar

### 8.8 Tags View

Purpose:

Browse and manage tags.

Tag screen:

- Tag list
- Selected tag task list
- Tag color optional
- Rename/delete tag actions

Tag usage:

- Tasks can have multiple tags.
- Tags appear as compact chips.
- Tags are useful in smart filters.

Visual rule:

- Tag colors should be muted and secondary, not a rainbow-heavy UI.

### 8.9 Smart Filters View

Purpose:

Saved custom task views.

Filter capabilities:

- Filter
- Sort
- Group

Filter fields:

- Project
- Section
- Tag
- Priority
- Due date range
- Completion status
- Has attachment
- Has reminder
- Is recurring
- Created date
- Updated date

Sort options:

- Due date
- Priority
- Created time
- Updated time
- Manual order

Group options:

- Date
- Project
- Tag
- Priority
- Completion status

Filter builder layout:

- Name input
- Condition rows
- Sort selector
- Group selector
- Preview area
- Save button

Condition row:

- Field selector
- Operator selector
- Value selector/input
- Remove button

Design note:

The filter builder should feel friendly and constrained. Do not expose a query language in version one.

### 8.10 Completed View

Purpose:

Review completed tasks.

Content:

- Completed today
- Completed this week
- Older completed tasks

Interactions:

- Restore task
- Open completed task detail
- Permanently delete, optional later

Visual rule:

- Completed tasks are lower contrast but still readable.

### 8.11 Settings View

Purpose:

Configure personal app behavior.

Sections:

- Account
- Appearance
- Notifications
- Data export/import
- Attachment export/import
- App info

Settings items:

- Change password
- Theme mode: system, light, dark
- Notification permission status
- Reminder default time
- Export data
- Import data
- Export attachments
- Import attachments
- Maximum upload size display
- Sign out

## 9. Task Detail Drawer

The task detail drawer is the main editing surface.

Desktop layout:

- Header action row
- Title editor
- Metadata grid
- Markdown description editor
- Checklist section
- Attachments section
- Activity/status section, optional

Mobile layout:

- Full-screen task detail
- Sticky top bar
- Save state indicator
- Bottom action area if needed

### Detail Fields

Required:

- Title
- Completion status

Optional:

- Project
- Section
- Due date
- Reminder time
- Priority
- Tags
- Recurrence
- Markdown description
- Checklist subtasks
- Attachments

### Metadata Grid

Rows:

- Project
- Date
- Reminder
- Priority
- Tags
- Repeat

Interaction:

- Each row opens a popover or sheet.
- Empty fields show quiet placeholders.

Suggested placeholders:

- "No project"
- "No date"
- "No reminder"
- "No priority"
- "No tags"
- "Does not repeat"

### Markdown Description

Modes:

- Edit mode
- Preview mode

Supported Markdown:

- Paragraphs
- Headings
- Links
- Lists
- Code blocks
- Inline code
- Block quotes

Security:

- Rendered Markdown must be sanitized.
- Raw HTML should either be disabled or sanitized strictly.

### Checklist Subtasks

Behavior:

- Add subtask
- Complete subtask
- Reorder subtasks
- Delete subtask

Rule:

- Subtasks do not appear independently in Today, Calendar, or filters.

### Attachments

Behavior:

- Upload one or more files.
- Maximum size: 100 MB per file.
- Any file type is accepted.
- Display original filename, size, upload date.
- Download requires authenticated request.
- Delete removes file and metadata after confirmation.

Attachment card content:

- File icon
- Original filename
- File size
- Upload date
- Download action
- Delete action

States:

- Uploading
- Upload failed
- File missing after data import
- Downloading
- Deleted

## 10. Task List Item Specification

Task item must be compact but information-rich.

Default row height:

- Desktop: 44 px to 56 px depending on metadata.
- Mobile: 56 px to 72 px.

Content order:

1. Completion checkbox
2. Priority indicator
3. Title
4. Metadata chips
5. Right-side actions on hover or focus

Metadata chips:

- Due date
- Reminder time
- Project
- Tags
- Attachment count
- Repeat icon

Desktop hover actions:

- Open details
- Set date
- Set priority
- More menu

Mobile row action:

- Tap opens detail.
- Checkbox remains directly tappable.
- Long press opens quick actions.

Completed state:

- Title uses strikethrough or muted style.
- Row animates gently before moving/collapsing.
- Completion should feel satisfying but fast.

## 11. Quick Add

First version quick add is plain, not natural-language parsing.

Behavior:

- User types title and presses Enter.
- Task is created in current context.
- If current view is Today, due date defaults to today.
- If current view is a Project, project defaults to that project.
- If current view is a Tag, tag defaults to that tag.
- If current view is Calendar day, due date defaults to that day.

Quick add components:

- Text input
- Add button, optional on desktop and visible on mobile
- Context hint

Placeholder examples:

- Inbox: "Add a task to Inbox"
- Today: "Add a task for today"
- Project: "Add a task to this project"
- Calendar day: "Add a task for this date"

## 12. Command Palette

Shortcut:

- Desktop: Cmd+K on macOS, Ctrl+K on Windows/Linux.
- Mobile: accessible from search/action button.

Purpose:

- Jump between views
- Search tasks
- Create task
- Change selected task date
- Change selected task priority
- Open settings

Layout:

- Center modal on desktop.
- Bottom sheet or full-screen sheet on mobile.
- Search input at top.
- Results grouped by type.

Groups:

- Tasks
- Views
- Projects
- Tags
- Actions

States:

- Empty query
- Results
- No results
- Loading

Visual behavior:

- Keyboard focus must be very clear.
- Result rows should show icon, label, secondary metadata.
- Enter activates selected row.
- Escape closes palette.

## 13. Date, Reminder, and Recurrence

### Date Picker

Must support:

- Today
- Tomorrow
- This weekend
- Next week
- Custom date
- Clear date

Date picker surfaces:

- Task detail drawer
- Task row quick action
- Calendar drag/drop
- Command palette action

### Reminder

Reminder is optional.

Fields:

- Date, inherited from due date or separately selected
- Time

Browser notification behavior:

- User must grant permission.
- Notification should include task title.
- Clicking notification opens task detail when possible.
- App should show notification permission status in settings.

### Recurrence

Supported recurrence types:

- Daily
- Weekly
- Monthly
- Yearly
- Every N days
- Every N weeks
- Every N months
- Workdays
- Selected weekdays
- After completion, repeat after N days
- Optional end date

UI:

- Repeat selector starts simple.
- Advanced options appear progressively.
- Use clear human-readable summaries.

Examples:

- "Every weekday"
- "Every 2 weeks on Monday"
- "3 days after completion"
- "Monthly until Dec 31"

## 14. Import and Export

Data and attachments are exported separately.

### Data Export

Formats:

- JSON export
- SQLite snapshot, optional implementation detail

Data includes:

- Tasks
- Projects
- Sections
- Tags
- Smart filters
- Settings
- Reminder data
- Recurrence rules
- Attachment metadata

### Attachment Export

Format:

- ZIP archive of attachment files.

Options:

- Export all attachments.
- Export attachments by date range or project, optional future enhancement.

### Data Import

Import must use a preview step.

Preview shows:

- Export version
- Number of tasks
- Number of projects
- Number of tags
- Number of attachments in metadata
- Missing attachment warning
- Conflict/overwrite warning

Import modes:

- Replace current data
- Merge into current data, optional later

### Attachment Import

Behavior:

- User imports attachment ZIP separately.
- App matches files by stored internal IDs.
- Missing files remain marked as missing.

## 15. Visual Style Direction

The visual language should feel like a calm Apple-ish productivity workspace.

Keywords:

- Private
- Calm
- Precise
- Soft material
- Light depth
- Focused
- Personal
- Efficient

Avoid:

- Marketing-page hero sections
- Oversized decorative cards
- Purple-blue AI gradients
- Heavy glassmorphism everywhere
- One-note beige palette
- Dense enterprise dashboard styling
- Bright rainbow tag systems
- Cartoon empty states
- Excessive shadows
- Big scroll animations

### Color Tokens

Use semantic tokens rather than hard-coded color names in designs.

Suggested light theme:

- App background: cool off-white
- Surface: white with subtle translucency
- Elevated surface: soft frosted white
- Text primary: near-black cool neutral
- Text secondary: medium cool gray
- Border: low-contrast cool gray
- Accent: calm blue or blue-green
- Danger: muted red
- Warning: amber
- Success: green

Suggested dark theme:

- App background: near-black cool neutral
- Surface: deep graphite
- Elevated surface: translucent graphite
- Text primary: near-white
- Text secondary: soft gray
- Border: subtle graphite line
- Accent: same hue family as light theme, adjusted for contrast

Accent rule:

- Use one primary accent hue across the app.
- Priority colors can use small markers, not large filled surfaces.

### Typography

Recommended direction:

- Use a modern sans-serif family.
- Avoid overly playful or editorial fonts.
- Use a mono font only for small technical metadata if needed.

Possible font directions:

- Option 1: Geist Sans + Geist Mono
- Option 2: SF-like system stack for native Apple feel
- Option 3: Satoshi + JetBrains Mono

Type scale:

- App title: 18 to 20 px, semibold
- View title: 24 to 32 px, semibold
- Section title: 14 to 16 px, semibold
- Task title: 14 to 16 px
- Metadata: 12 to 13 px
- Button: 13 to 15 px, medium

### Spacing

Use an 8 px spacing foundation.

Suggested scale:

- 4 px: tight internal icon/text gap
- 8 px: compact row gap
- 12 px: small control spacing
- 16 px: standard component padding
- 24 px: screen section gap
- 32 px: major layout gap

### Radius

Use a consistent rounded-but-not-bubbly radius system.

- Small controls: 8 px
- Inputs and task rows: 10 to 12 px
- Panels and drawers: 16 to 20 px
- Pills: full radius only for chips and badges

### Shadows and Material

Use shadows sparingly.

- Sidebar and drawer can use subtle border and blur.
- Floating command palette can use stronger elevation.
- Avoid heavy black shadows.
- Prefer layered borders, translucency, and background blur for depth.

## 16. Motion Direction

Motion should make state changes understandable, not decorative.

Motion principles:

- Fast
- Subtle
- Reversible
- Reduced-motion friendly
- No continuous animation by default

Recommended motion:

- Drawer open/close: 180 to 240 ms
- Command palette open: 140 to 180 ms
- Task completion: 180 ms visual feedback, then collapse/move
- Drag/drop: spring-like but restrained
- Popovers: 120 to 160 ms fade/scale
- Mobile sheet: 220 to 280 ms slide

Must support:

- prefers-reduced-motion
- Clear focus states without relying on animation

## 17. Accessibility Requirements

Baseline:

- WCAG AA contrast
- Keyboard navigable desktop UI
- Visible focus ring
- Touch targets at least 44 px on mobile
- Inputs use visible labels, not placeholder-only labels
- Buttons have accessible names
- Icon-only buttons require tooltips and aria labels
- Dialogs trap focus
- Escape closes dialogs/drawers where appropriate

Task list keyboard interactions:

- Arrow keys can move selection, optional future enhancement.
- Enter opens selected task.
- Space toggles completion only when checkbox is focused.
- Cmd/Ctrl+K opens command palette.
- Escape closes drawer/palette.

## 18. Loading, Empty, and Error States

### Loading

Use skeletons that match actual layout.

Examples:

- Sidebar nav skeleton
- Task row skeleton
- Calendar cell skeleton
- Detail drawer skeleton

Avoid:

- Generic centered spinner as the primary loading state.

### Empty States

Empty states should be compact and useful.

Examples:

- Inbox empty: "Nothing waiting in Inbox."
- Today empty: "Today is clear."
- Project empty: "No tasks in this project yet."
- Filter empty: "No tasks match this filter."
- Calendar day empty: "No tasks scheduled."

### Error States

Errors should be specific and recoverable.

Examples:

- Login error: "The password is incorrect."
- Upload too large: "This file is over the 100 MB limit."
- Upload failed: "Upload failed. Try again."
- Import invalid: "This export file cannot be read."
- Attachment missing: "File not restored."
- Session expired: "Sign in again to continue."

## 19. Key User Flows

### Flow 1: Sign In

1. User opens app.
2. Login screen appears.
3. User enters password.
4. App validates credentials.
5. User lands on Today view.

### Flow 2: Quick Capture

1. User opens Inbox or Today.
2. User types task title in quick add.
3. User presses Enter.
4. Task appears in current list.
5. Input clears and stays focused.

### Flow 3: Plan Today

1. User opens Today.
2. User reviews overdue and today groups.
3. User completes tasks or postpones them.
4. User opens a task detail drawer to add context.
5. Completed tasks collapse into completed section.

### Flow 4: Reschedule on Calendar

1. User opens Calendar.
2. User switches to week or month.
3. User drags task to another date.
4. App updates due date.
5. Task appears in new date cell.

### Flow 5: Create Smart Filter

1. User opens Smart Filters.
2. User creates new filter.
3. User adds conditions.
4. User chooses sort and group.
5. User previews matching tasks.
6. User saves filter.
7. Filter appears in sidebar.

### Flow 6: Add Attachment

1. User opens task detail.
2. User drops file or clicks upload.
3. App checks file size.
4. App uploads file.
5. Attachment appears in task detail.
6. User can download or delete it later.

### Flow 7: Export Data

1. User opens Settings.
2. User selects Export Data.
3. App generates JSON export.
4. User downloads file.
5. If needed, user separately exports attachments ZIP.

## 20. Component Inventory

Navigation:

- Sidebar
- Sidebar item
- Sidebar section
- Bottom mobile nav
- Breadcrumb or context header, optional

Task:

- Task row
- Completion checkbox
- Priority marker
- Metadata chip
- Quick add input
- Task detail drawer
- Checklist item
- Attachment card
- Recurrence summary

Calendar:

- Calendar header
- Week grid
- Month grid
- Day cell
- Calendar task pill
- Date picker

Filtering:

- Filter list
- Filter builder
- Condition row
- Sort selector
- Group selector

Overlays:

- Command palette
- Popover
- Modal
- Mobile sheet
- Confirmation dialog
- Toast

Forms:

- Text input
- Textarea
- Markdown editor
- Select
- Toggle
- Segmented control
- File dropzone

Feedback:

- Skeleton row
- Empty state
- Error banner
- Inline error
- Save status indicator

## 21. Prototype Screen Checklist

The design稿 should include at least these frames.

Desktop:

1. Login
2. Today view with task drawer closed
3. Today view with task drawer open
4. Inbox empty state
5. Upcoming grouped list
6. Calendar week view
7. Calendar month view
8. Project view with sections
9. Smart filter builder
10. Command palette
11. Settings export/import
12. Attachment upload state

Mobile:

1. Login
2. Today view
3. Task detail full-screen sheet
4. Calendar month view
5. Mobile command/search sheet
6. More/settings screen

State frames:

1. Loading task list
2. Empty Today
3. Upload failed
4. Import preview
5. Notification permission prompt
6. Session expired

## 22. Design Generation Prompt

Use this section if another tool needs a compact prompt.

Create a high-fidelity web and mobile prototype for a personal self-hosted TODO app inspired by TickTick, but with an Apple-ish productivity workspace aesthetic. The app is for one user only. It has a left sidebar, central task list, right task detail drawer on desktop, and bottom navigation plus full-screen detail sheet on mobile. Core views include Inbox, Today, Upcoming, Calendar week/month, Projects with sections, Tags, Smart Filters, Completed, and Settings. The interface should feel calm, private, precise, lightly translucent, and efficient. Avoid marketing-page hero sections, decorative bento layouts, generic SaaS dashboards, bright purple-blue gradients, and cartoon empty states. Include task rows with completion checkbox, priority marker, due date, reminder, tags, project, recurrence, and attachment indicators. Include a command palette, Markdown task detail editor, checklist subtasks, any-file attachment cards, smart filter builder, import/export settings, browser notification permission state, loading skeletons, empty states, and error states. Use a cool neutral palette with one calm accent color, subtle glass material, clear focus states, restrained motion, and responsive desktop/mobile layouts.

## 23. Open Decisions for Later

These decisions can wait until visual design or implementation.

- Exact app name
- Exact accent color
- Exact font family
- Whether to support compact and comfortable density modes
- Whether to support dark mode in first implementation or only design now
- Whether SQLite export is exposed in UI or JSON only
- Whether attachment export can be filtered by project/date in version one
- Whether keyboard navigation goes beyond command palette in version one

