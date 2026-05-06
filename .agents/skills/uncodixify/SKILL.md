---
name: uncodixify
description: Use for CivicSense frontend UI design/refactors to avoid generic AI/Codex-looking UI. Trigger for dashboard, map UI, forms, filters, sidebars, tables, cards, dark mode, shadcn/Tailwind polish, and any task asking to make UI look cleaner, more professional, senior-designed, SaaS-level, less AI-generated, or less Codex-like.
---

# Uncodixify for CivicSense

This skill teaches Codex how to build CivicSense UI in a way that does not look like default AI-generated UI.

Codex UI usually drifts toward:
- soft gradients
- floating panels
- eyebrow labels
- decorative copy
- hero sections inside dashboards
- oversized rounded corners
- transform animations
- dramatic shadows
- glassmorphism
- “premium SaaS” cosplay
- layouts that try too hard

Do not do that.

CivicSense should feel human-designed, functional, restrained, clear, and honest. Think GitHub, Linear, Raycast, Stripe dashboard, and well-made internal tools. They do not scream for attention. They work.

## Prime Directive

When editing CivicSense UI:

1. Preserve working product logic.
2. Make the interface more normal, more useful, and more aligned.
3. Remove AI-looking decoration.
4. Prefer boring clarity over fake premium.
5. If a design choice feels easy for an AI to generate, reject it and choose the cleaner option.

## Project Context

CivicSense is an AI-powered civic issue reporting platform.

Frontend stack:
- React + Vite
- Tailwind CSS
- shadcn/ui
- React Router
- Zustand
- Axios
- TanStack Query where used
- React Leaflet

Backend capabilities:
- JWT auth
- role-based security
- issue creation
- issue listing/filtering
- nearby geo query
- image upload
- AI analysis hook
- Kafka async processing
- issue deletion

Main UI areas:
- login/register
- protected dashboard
- map dashboard
- nearby issue filters
- issue marker popups
- create issue form
- image upload flow
- future admin/officer dashboard

## When to Use This Skill

Use this skill whenever the user asks for:
- UI polish
- dashboard redesign
- SaaS-level UI
- senior designer UI
- make this look professional
- make this less AI-generated
- make it cleaner
- improve Tailwind/shadcn styling
- fix layout alignment
- map dashboard design
- form design
- filters/table/sidebar/card design
- dark mode design

Also use this skill automatically when editing:
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Register.jsx`
- `frontend/src/components/**`
- any Tailwind/shadcn UI file
- any map UI / Leaflet view

## Preserve Logic First

When refactoring UI, do not break:
- API endpoints
- state names unless necessary
- auth/logout logic
- JWT handling
- map movement
- map click-to-create behavior
- marker rendering
- delete issue behavior
- filters
- dark mode persistence
- file upload flow
- backend payload structure

If the task is visual only, do not change business logic.

## Keep It Normal: CivicSense UI Standard

### Sidebars

Use:
- 240–260px fixed width when a sidebar is truly needed
- solid background
- border-right
- simple navigation
- predictable spacing

Avoid:
- floating detached sidebar shells
- rounded outer sidebar
- decorative brand block
- nav badges unless functional
- transform hover animations
- decorative blobs
- “workspace” promo blocks

### Headers

Use:
- compact header
- product name
- current page title if needed
- necessary actions
- simple hierarchy

Avoid:
- hero headers inside dashboards
- marketing copy
- eyebrow labels
- uppercase letter-spaced mini labels
- gradient text
- decorative subtitles
- giant headings

### Sections

Use:
- standard padding: 20–30px
- clear grouping
- normal content hierarchy

Avoid:
- hero strips inside internal tools
- decorative explanatory copy
- overpadded empty sections
- fake premium layout gaps

### Navigation

Use:
- simple links
- clear active state
- subtle hover state
- 16–20px icons only if useful

Avoid:
- animated nav links
- badges unless functional
- decorative icon backgrounds
- pill navigation everywhere

### Buttons

Use:
- solid fill or simple border
- 8–10px radius
- clear label
- consistent height

Avoid:
- pill buttons as default
- gradient backgrounds
- glow
- oversized buttons
- dramatic hover transforms

### Cards / Panels

Use:
- simple containers
- 8–12px radius max
- 1px subtle border
- minimal shadow, max around `0 2px 8px rgba(0,0,0,0.1)`
- functional grouping only

Avoid:
- 20–32px radius everywhere
- repeated rounded rectangles on everything
- glass cards
- colored shadows
- floating effect
- nested panel types unless necessary
- card grids just because dashboards often have them

### Forms

Use:
- labels above fields
- standard inputs
- clear focus states
- predictable vertical spacing
- useful validation
- simple select elements or shadcn select if already installed

Avoid:
- fancy floating labels
- animated underlines
- morphing input shapes
- hidden labels
- placeholders as the only label
- decorative helper text

### Modals / Overlays

Use:
- centered overlay when a true modal is needed
- simple backdrop
- straightforward close button
- plain layout

For map creation UI:
- Prefer side panel over modal if Leaflet z-index/layers conflict.
- Do not place full forms inside Leaflet popup unless explicitly requested.

Avoid:
- slide-in animation for decoration
- glass overlay
- dramatic shadows
- modals that feel trapped inside map layers

### Dropdowns / Selects

Use:
- simple list
- clear selected state
- subtle border
- normal height

Avoid:
- fancy motion
- pill dropdowns
- oversized custom visuals unless necessary

### Tables

Use:
- clean rows
- simple borders
- left-aligned text
- subtle hover
- practical columns

Avoid:
- tag badge for every cell
- fake status noise
- zebra striping unless it improves readability
- decorative “data table” styling

### Lists

Use:
- simple list items
- consistent spacing
- clear hierarchy

Avoid:
- decorative bullets
- oversized list cards
- activity feed filler text

### Tabs

Use:
- underline or simple border indicator

Avoid:
- pill tab overload
- animated sliding indicators

### Badges

Use:
- only when they communicate real state
- small text
- simple border/background
- 6–8px radius

Avoid:
- rounded pill overload
- glows
- decorative badges like “Live” unless it is functional

### Icons

Use:
- monochrome or subtle color
- 16–20px size
- consistent stroke

Avoid:
- decorative icon containers
- random colored icon backgrounds
- over-iconifying the UI

### Typography

Use:
- clear hierarchy
- readable 14–16px body text
- simple sans-serif already configured by the project
- consistent weights

Avoid:
- serif headline + sans-serif body as “premium” shortcut
- mixed font gimmicks
- giant marketing headlines
- decorative labels

### Spacing

Use:
- consistent scale: 4 / 8 / 12 / 16 / 24 / 32px
- compact but readable internal UI spacing

Avoid:
- random gaps
- excessive padding
- dead space created to look expensive

### Borders

Use:
- 1px solid
- subtle neutral colors

Avoid:
- gradient borders
- thick decorative borders

### Shadows

Use:
- none or very subtle
- max roughly `0 2px 8px rgba(0,0,0,0.1)`

Avoid:
- dramatic drop shadows
- colored shadows
- giant blur shadows
- glow haze

### Transitions

Use:
- 100–200ms ease
- simple color/opacity transitions

Avoid:
- bouncy animations
- transform effects
- hover translate
- decorative motion

### Layouts

Use:
- standard grid/flex
- predictable structure
- clear content hierarchy

Avoid:
- creative asymmetry for no reason
- overlaps
- creative justify tricks
- floating dashboard pieces

### Containers

Use:
- normal wrappers
- max width only when needed
- functional layout structure

Avoid:
- decorative wrappers
- unnecessary nested shells

### Toolbars

Use:
- simple horizontal layout
- 48–56px height when applicable
- clear actions

Avoid:
- decorative labels
- complex toolbar layouts

## Hard No List

Never do these unless the user explicitly asks for them:

- oversized rounded corners
- pill overload
- floating glassmorphism shells
- soft corporate gradients
- generic dark SaaS composition
- decorative sidebar blobs
- “control room” cosplay
- sticky left rail unless information architecture needs it
- metric-card grid as first instinct
- fake charts
- random glows
- blur haze
- frosted panels
- conic-gradient donuts
- hero section inside internal UI
- alignment that creates dead space just to look premium
- overpadded layouts
- mobile collapse that stacks into one long unusable page
- ornamental labels like “live pulse,” “night shift,” “operator checklist”
- generic startup copy
- style choices made because they are easy to generate
- uppercase eyebrow labels
- `<small>` decorative headers
- blue-heavy palette unless already used intentionally
- rounded `span`s everywhere
- decorative explanatory note cards

## Specifically Banned Patterns

Avoid these common AI/Codex mistakes:

- border radii in 20–32px range across everything
- repeating same rounded rectangle on sidebar, cards, buttons, panels
- sidebar around 280px with brand block and decorative nav
- floating detached sidebar with rounded shell
- canvas chart in glass card without product reason
- donut chart with fake percentages
- UI cards using glows instead of hierarchy
- mixed alignment logic
- overuse of muted gray-blue text that weakens contrast
- “premium dark mode” as blue-black gradients plus cyan accents
- template typography
- “MARCH SNAPSHOT” style labels
- hero-strip with decorative copy
- decorative copy like “Operational clarity without the clutter”
- section notes everywhere explaining obvious UI
- transform hover animations
- box shadows like `0 24px 60px rgba(0,0,0,0.35)`
- status dots created only for decoration
- uppercase muted labels with letter spacing
- pipeline bars with gradients
- KPI cards by default
- “Team focus” or “Recent activity” filler panels
- tag badges for every status in a table
- workspace quota/progress panels
- footer meta lines like “dashboard • dark mode • single-file”
- trend-up / trend-flat decorative indicators
- right rail schedule panels unless needed
- multiple nested panel types

## Color Rules

Colors must stay calm and functional.

Priority order:
1. Use existing project colors if present.
2. If no palette exists, use one of the palettes below.
3. Do not invent random colors.

For CivicSense, prefer muted neutral UI:
- light background: `#f8f9fa` or `#fafafa`
- light surface: `#ffffff`
- light text: `#212529` or `#0f172a`
- light border: neutral gray/slate

- dark background: `#0f0f0f`, `#121212`, or `#0d1117`
- dark surface: `#1a1a1a`, `#1e1e1e`, or `#161b22`
- dark text: `#f5f5f5`, `#e1e1e1`, or `#c9d1d9`

Use blue sparingly because the Uncodixify rule warns against blue-heavy UI. CivicSense may already use blue in earlier UI, but do not make everything blue.

Use severity colors functionally:
- high: red only where needed
- medium: amber/orange only where needed
- low: green only where needed

Do not use severity colors decoratively.

## Approved Palette Inspiration

Use only as inspiration, not as a requirement.

Dark:
- Obsidian Depth: background `#0f0f0f`, surface `#1a1a1a`, primary `#00d4aa`, secondary `#00a3cc`, accent `#ff6b9d`, text `#f5f5f5`
- Carbon Elegance: background `#121212`, surface `#1e1e1e`, primary `#bb86fc`, secondary `#03dac6`, accent `#cf6679`, text `#e1e1e1`
- Void Space: background `#0d1117`, surface `#161b22`, primary `#58a6ff`, secondary `#79c0ff`, accent `#f78166`, text `#c9d1d9`

Light:
- Pearl Minimal: background `#f8f9fa`, surface `#ffffff`, primary `#0066cc`, secondary `#6610f2`, accent `#ff6b35`, text `#212529`
- Ivory Studio: background `#f5f5f4`, surface `#fafaf9`, primary `#0891b2`, secondary `#06b6d4`, accent `#f59e0b`, text `#1c1917`
- Alabaster Pure: background `#fcfcfc`, surface `#ffffff`, primary `#1d4ed8`, secondary `#2563eb`, accent `#dc2626`, text `#1e293b`
- Frost Bright: background `#f1f5f9`, surface `#f8fafc`, primary `#0f766e`, secondary `#14b8a6`, accent `#e11d48`, text `#0f172a`

## CivicSense Dashboard Rules

For `Dashboard.jsx`:

### Map

- Map should be the main working surface.
- Do not bury it under decorative panels.
- Keep Leaflet controls usable.
- Keep zoom control away from custom overlays.
- Avoid placing a form inside Leaflet popup.
- Use a side panel or simple modal for create issue.
- Marker popups must be compact and practical.
- Marker popups may include delete action if backend supports it.

### Filters

- Filters should be functional and easy to scan.
- A toolbar or plain sidebar section is acceptable.
- Do not use decorative filter cards.
- Do not over-explain filters.

### Metrics

- Do not default to large KPI grid.
- If metrics exist, keep them compact and useful.
- Avoid fake analytics.

### Create Issue Panel

- Use clear labels.
- Include selected coordinates if useful.
- Keep title/description/category/severity simple.
- Keep cancel/submit actions clear.
- Do not use dramatic shadows or huge rounding.
- Do not create random issues before explicit submit.

### Dark Mode

- Keep dark mode simple.
- No dark gradients.
- No cyan glow.
- Surfaces should be calm, readable, and neutral.

## CivicSense Auth Pages

For login/register:

- Use a simple centered form.
- Clear title.
- Clear labels.
- Simple card/container.
- No hero split screen unless explicitly requested.
- No marketing copy.
- No gradients.
- No decorative illustrations.
- Keep auth pages fast and usable.

## CivicSense Future Pages

For admin/officer dashboards:

- Prefer table/list + map split.
- Use real data only.
- No fake charts unless backed by API.
- No “AI insights” filler cards unless backend provides insight data.
- No decorative activity feeds.
- Prioritize workflows:
  - triage
  - assignment
  - verification
  - status update
  - image review

## Code Output Rules

When producing UI code:

- Return complete files when user asks for updated file.
- Do not remove existing imports needed by logic.
- Do not change endpoint strings unless asked.
- Do not add dependencies unless asked.
- Use Tailwind classes already compatible with the project.
- Use shadcn components already installed.
- If a new shadcn component is needed, mention the install command.
- Keep CSS inside Tailwind unless a separate file is already part of the project.
- Keep class names readable.
- Avoid giant one-off decorative class strings.
- Prefer extracting repeated UI patterns only if it improves clarity.

## Review Checklist Before Final Answer

Before finalizing UI changes, verify:

- Does it look like a useful product rather than an AI demo?
- Did I avoid oversized rounding?
- Did I avoid gradients/glass/glows?
- Did I avoid decorative copy?
- Did I preserve all working logic?
- Did I keep map controls usable?
- Did I keep forms accessible with labels/id/name?
- Did I avoid fake data/fake analytics?
- Did I use calm colors?
- Did I keep spacing consistent?
- Did I reduce, not increase, visual noise?

If any answer is no, revise before returning.
