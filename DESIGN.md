# FoundFlow Visual System

## Direction

FoundFlow uses an original airport-portal visual language derived from the reference's calm institutional clarity: high-key architectural fields, a restrained purple action color, compact white work surfaces, square-ended controls and disciplined alignment. It must remain clearly independent and never reuse Changi Airport logos, names, copy or proprietary imagery.

## Theme

- Register: product
- Color strategy: restrained with purple reserved for primary actions, active navigation and focus
- Atmosphere: bright airport operations portal, calm and trustworthy rather than consumer or AI-themed
- Background: original generic-terminal photograph at low contrast under a white/lavender wash
- Work surfaces: opaque white or cool-gray panels; no decorative glassmorphism

## Color Palette

- `--ink`: `#232133` — primary text
- `--ink-soft`: `#504b5f` — secondary text
- `--muted`: `#6f6978` — metadata and helper text
- `--field`: `#f7f5f9` — page field
- `--panel`: `#ffffff` — working surfaces
- `--panel-subtle`: `#faf9fb` — nested toolbars and read-only summaries
- `--line`: `#d8d3dc` — standard borders
- `--line-strong`: `#bdb5c4` — active group boundaries
- `--purple`: `#7a35b0` — primary action
- `--purple-dark`: `#63258f` — hover/pressed action
- `--purple-soft`: `#f0e7f6` — selected rows and focus groups
- `--magenta`: `#b4267f` — secondary brand accent, used sparingly
- `--danger`: `#c6333f` — destructive/error state
- `--warning`: `#8a5a00` — warning state
- `--success`: `#28744f` — completed/confirmed state
- `--info`: `#365f91` — informational state

All body and control text must meet WCAG 2.1 AA contrast.

## Typography

- UI family: Lato, weights 400, 700 and 900
- Monospace: Geist Mono for identifiers and currency figures only
- Body: 15–16px, 1.5 line-height
- Labels: 14px, 700
- Page title: 30–38px, 700, no tighter than `-0.025em`
- Section title: 20–24px, 700
- Utility text: at least 13px, except nonessential version metadata
- Headings use balanced wrapping; prose is capped at 72 characters

## Application Shell

- Persistent white top bar with original FoundFlow mark, product name, compact navigation and signed-in state
- Thin purple rule below the header establishes identity without a heavy colored masthead
- Desktop content width: 1180px centered
- Public/auth pages may use a split composition over the architectural background
- Operational pages use the same architectural field with opaque white work surfaces
- Mobile navigation wraps into a compact second row; no horizontal scrolling

## Components

### Buttons

- Height: 44px minimum
- Radius: 4px
- Primary: solid purple with white text
- Secondary: white with purple border/text
- Destructive: white or pale red with danger border/text; confirmation required
- Explicit hover, active, focus-visible, disabled and loading states
- Loading labels use an ellipsis character

### Inputs

- Height: 44px minimum
- Radius: 4px
- White background, 1px cool-gray border
- Purple focus border plus a visible 3px soft focus ring
- Labels sit above fields; helper/error text stays adjacent
- Selects set explicit foreground/background for Windows consistency

### Panels

- Radius: 6px for primary work surfaces, 4px for nested controls
- White background
- Either a 1px border or a compact `0 4px 10px rgba(35, 25, 45, .10)` shadow, not both decoratively
- Padding: 20–28px desktop, 16–20px compact
- Avoid nested card grids; use sections, dividers, rows and toolbars

### Status

- Status chips include text and color
- Confirmed uses green, review uses amber, archived uses neutral, collected uses purple
- Progress remains determinate and reports real stages

### Inventory

- One bordered list with clearly nested rows, source-photo provenance and compact actions
- Containers are identified by hierarchy and labels rather than increasingly large indentation
- Manual records are separated from photo-box coverage totals

## Layout & Responsive Behavior

- Desktop forms: two columns where fields are naturally paired
- Workflow workspaces: evidence/capture column plus wider review column
- Below 820px: one column, full-width controls, reduced panel padding
- Below 540px: compact header/navigation, action rows stack, hierarchy indentation is capped
- Every route must pass `scrollWidth <= clientWidth` at 375px
- Modals use a scrollable body and visible footer at short viewport heights

## Motion

- 150–220ms state transitions on color, border, opacity and transform only
- No page-load choreography
- Reduced motion removes nonessential transitions

## Accessibility

- Skip link to `#main-content`
- Semantic landmarks and one route-level `h1`
- Visible focus on every interactive element
- Stable accessible names for dynamic labels
- Live regions for async status and validation
- Controls remain usable at 200% text zoom
