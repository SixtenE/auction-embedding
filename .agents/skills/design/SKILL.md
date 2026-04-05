---
name: design
description: Generates or updates a DESIGN.md file that documents the project's visual design system — colors, typography, spacing, component geometry, and design philosophy. Trigger this skill when the user asks to "create a DESIGN.md", "document the design system", "capture the visual language", or "describe the UI design".
---

# Design Documentation Skill

This skill produces a `DESIGN.md` file that captures the visual design language of the project in one authoritative place, following the format established by the [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) collection.

## When to Use This Skill

Trigger this skill when the user:

- Asks to "create a DESIGN.md" or "write a design doc"
- Wants to "document the design system" or "capture the visual language"
- Asks for a "UI overview" or "design principles summary"
- Needs a reference document for maintaining visual consistency
- Onboards a new designer or frontend engineer

## What to Include in DESIGN.md

A good `DESIGN.md` covers:

1. **Design Philosophy** — The core ethos and visual identity in one paragraph. What is the brand expression? What feeling should the UI convey?
2. **Visual Foundation** — Color palette (hex values), overall aesthetic (minimalist, vibrant, etc.), and any defining motifs.
3. **Typography** — Font families, weights used, size scale, line-height values.
4. **Color System** — Named semantic roles (primary, muted, background, focus, etc.) with exact hex values.
5. **Layout & Spacing** — Base spacing unit, section padding, content width, density approach.
6. **Component Geometry** — Border radius rules, shadow policy, shape vocabulary (pill, card, etc.).
7. **Distinctive Elements** — Anything that makes this design system immediately recognisable.

## How to Generate DESIGN.md

### Step 1: Read the Frontend Code

Before writing anything, read:

- CSS/Tailwind config (`tailwind.config.js`, `tailwind.config.ts`, `theme/`)
- Global stylesheets (`src/index.css`, `styles/globals.css`, `app/globals.css`)
- UI component files (`src/components/ui/`, `components/`)
- Root layout or app entry (`src/App.tsx`, `app/layout.tsx`, `pages/_app.tsx`)
- Any design token files (`tokens.json`, `theme.ts`)

Use `Glob` to find these files and `Read` to examine them. Do **not** guess hex values or font names—extract them from the actual code.

### Step 2: Extract the Design Tokens

From the files you read, collect:

| Token type | Where to find it |
|------------|-----------------|
| Colors | `tailwind.config`, CSS variables (`--color-*`, `--background`, etc.) |
| Typography | `@font-face`, `fontFamily` in Tailwind config, repeated className patterns |
| Spacing | `spacing` in Tailwind config, repeated `gap-*` / `p-*` / `m-*` patterns |
| Border radius | `borderRadius` in Tailwind config, repeated `rounded-*` patterns |
| Shadows | `boxShadow` in Tailwind config, repeated `shadow-*` patterns |

### Step 3: Identify the Design Philosophy

Look for:

- A dominant aesthetic — is it minimal/monochrome, colorful, corporate, playful?
- Recurring visual motifs (pill buttons, card grids, full-bleed sections)
- Brand typography choices (a distinctive display font signals brand intent)
- Spacing philosophy — tight/dense or open/airy?

### Step 4: Write DESIGN.md

Write the file at the repo root. Use the template below as a starting point, filling in project-specific values from what you read.

```markdown
# Design

## Design Philosophy

[One paragraph: the core aesthetic, the brand expression, what feeling the UI should convey.]

## Visual Foundation

[Describe the overall visual approach — monochrome, colorful, minimalist, etc.]

**Distinctive elements:**
- [Font choice and why it matters]
- [Shape vocabulary — pill buttons, card radius, etc.]
- [Shadow / depth policy]

## Typography

| Role | Font | Weight(s) | Size range | Line-height |
|------|------|-----------|------------|-------------|
| Display | ... | ... | ... | ... |
| Body | ... | ... | ... | ... |
| Mono | ... | ... | ... | ... |

## Color System

| Name | Hex | Role |
|------|-----|------|
| ... | `#...` | ... |

## Layout & Spacing

- **Base unit**: [e.g. 4px or 8px]
- **Content max-width**: [e.g. 1280px]
- **Section vertical padding**: [e.g. 64–96px]
- **Density**: [tight / balanced / airy]

## Component Geometry

- **Interactive elements** (buttons, badges): [e.g. 9999px radius — full pill]
- **Containers** (cards, modals): [e.g. 12px radius]
- **Shadows**: [e.g. none — depth via border and background shift only]

## Distinctive Elements

- [Element 1 — what it is and why it's distinctive]
- [Element 2]
```

### Step 5: Verify and Commit

After writing:

1. Cross-check every hex value and font name against the source files.
2. Confirm every radius and spacing value matches the Tailwind config or CSS variables.
3. Commit: `docs: add DESIGN.md`

## Quality Checklist

Before finishing, confirm:

- [ ] Every color has an exact hex value (no guesses)
- [ ] Font family names match what is actually imported or configured
- [ ] Border radius values are drawn from the config, not invented
- [ ] The design philosophy section reads like a human wrote it, not a spec list
- [ ] No fabricated details — everything is traceable to source files

## Example: auction-embedding

Below is a reference `DESIGN.md` for the `auction-embedding` project that lives in this repository.

---

# Design

## Design Philosophy

The interface embraces **calm utility** — a clean, low-friction tool for uploading and searching images. The UI stays out of the way: neutral grays create a professional backdrop that lets image thumbnails become the visual focus. There are no decorative flourishes; every element earns its place by serving a task.

## Visual Foundation

The design uses a light neutral canvas with subtle gray borders and muted text hierarchy. The single accent color (indigo/violet) is reserved for primary actions, creating clear visual hierarchy without noise.

**Distinctive elements:**
- `Inter` as the system font — legible and neutral
- Consistent `rounded-lg` (8px) radius on cards and inputs; `rounded-md` on buttons
- Minimal shadows — `shadow-sm` at most, primarily using border for container definition
- Tab-based navigation to keep upload and search workflows cleanly separated

## Typography

| Role | Font | Weight(s) | Notes |
|------|------|-----------|-------|
| UI / Body | Inter (system fallback) | 400, 500, 600 | Tailwind default stack |
| Mono | ui-monospace, SFMono | 400 | Code / ID display |

## Color System

Sourced from Tailwind CSS defaults and shadcn/ui CSS variables:

| Name | Hex (light) | Role |
|------|-------------|------|
| Background | `#ffffff` | Page background |
| Card | `#ffffff` | Card surface |
| Border | `#e5e7eb` | Dividers, input borders |
| Muted | `#f3f4f6` | Secondary backgrounds, badges |
| Muted foreground | `#6b7280` | Placeholder, secondary text |
| Foreground | `#111827` | Primary text |
| Primary | `#4f46e5` | CTA buttons, active tabs |
| Primary foreground | `#ffffff` | Text on primary |
| Destructive | `#ef4444` | Delete actions |

## Layout & Spacing

- **Base unit**: 4px (Tailwind default)
- **Page padding**: `px-4` → `px-6` (mobile → desktop)
- **Max content width**: `max-w-4xl` (896px) centered
- **Card gap**: `gap-4` (16px) in image grids
- **Density**: balanced — enough whitespace to breathe, tight enough to show many thumbnails

## Component Geometry

- **Buttons**: `rounded-md` (6px)
- **Cards / panels**: `rounded-lg` (8px)
- **Input fields**: `rounded-md` (6px)
- **Image thumbnails**: `rounded-md` (6px) with `object-cover` fill
- **Shadows**: `shadow-sm` on cards; no shadows on interactive elements — borders carry the weight

## Distinctive Elements

- **Tab layout** — Upload and Search live in sibling tabs, keeping the mental model simple: you either add images or find them.
- **Score badge** — Search results overlay a cosine similarity score badge on each thumbnail, making relevance immediately visible without a separate list view.
- **Drag-and-drop upload zone** — The upload tab's primary affordance is a large drop target, signalling that the preferred interaction is drag-and-drop rather than a file picker button.
