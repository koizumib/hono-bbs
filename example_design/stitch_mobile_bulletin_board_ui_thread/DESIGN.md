---
name: Cybernetic Slate BBS
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  headline-lg:
    fontFamily: Noto Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Noto Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
  label-badge:
    fontFamily: Noto Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter-xs: 0.25rem
  gutter-sm: 0.5rem
  gutter-md: 0.75rem
  gutter-lg: 1rem
  gutter-xl: 1.5rem
  touch-target: 2.75rem
  post-padding-x: 0.875rem
  post-padding-y: 0.75rem
---

## Brand & Style

The design system is constructed for anonymous mobile-first discourse, blending modern developer-tool utility (like GitHub, Discord, and Linear) with the high-velocity, rapid-exchange layout of traditional Japanese textboards (5channel / Futaba BBS). 

### Personality & Tone
- **Sub-surface & Covert:** Evokes privacy, speed, and anonymity without descending into illegible edge-case hacker tropes.
- **Dense yet Ergonomic:** Balances text-heavy feeds and nested anchor references (`>>1`) with thumb-friendly controls, tactile response surfaces, and legible information hierarchy.
- **Developer-grade Polish:** Crisp contrast ratios, muted borders, precise monospaced accents for hashes and identifiers, and focused electric blue accents to anchor real-time interaction.

### Visual Aesthetic
The style follows **Developer-Oriented Slate Minimalism with Layered Tonal Depth**. Dark slate-navy canvases stack into crisp surface cards separated by subtle low-contrast lines (`rgba(255, 255, 255, 0.08)`). Interactive targets leverage electric blue primaries and emerald/amber indicators for telemetry data (velocity tags, unread anchors, user momentum).

## Colors

The palette is tuned specifically for sustained low-light mobile readability and visual comfort. Pure blacks are rejected in favor of deep oceanic navy-slate tones that retain elevation layers.

### Color Roles & Semantic Values
- **Background Root (`#0a0e17`):** The foundational substrate of the application.
- **Surface Elevation 1 (`#111827`):** App bars, persistent navigation, bottom drawers, and sticky footers.
- **Surface Elevation 2 / Post Card (`#151e2e`):** Standard post response containers, inactive chips, and floating modules.
- **Surface Elevation 3 / Hover & Active (`#1a2436`):** Highlighted anchor quotes, hovered responses, and active input bars.
- **Primary Accent (`#3b82f6` / `#2563eb`):** Active buttons, floating write triggers, highlighted post number indices, and internal thread anchors (`>>res`).
- **Telemetry & Status Secondary (`#10b981`):** High-velocity thread momentum tags (勢い), active anonymous author tag indicators.
- **Telemetry & Identity Tertiary (`#f59e0b`):** Repeated poster identification badges (`ID:xxxxxxxx(3)`), warning flags, and original poster (OP) markers.
- **Border Subtle:** `#1e293b` (default post separator borders and subtle input containment).
- **Text High-Contrast:** `#f1f5f9` (post body text and thread title).
- **Text Muted:** `#64748b` to `#94a3b8` (timestamps, anonymous labels, and inactive icon buttons).

## Typography

Typography prioritizes high-density CJK (Japanese text) paired with clean monospaced telemetry for post IDs and anchor logic.

- **Primary Typeface:** `Noto Sans` (with system fallback to `Noto Sans JP` / system CJK sans-serif) ensures balanced glyph weight and clear kanji legibility at small sizes.
- **Monospace Accent:** `JetBrains Mono` handles thread sequence counters, hashes, timestamps, IDs (`ID:ac2653541c`), and post reply targets (`>>3`).
- **Hierarchical Balance:** Thread headers are weighted bold at `20px` to maintain context during rapid scroll, while post responses are optimized at `14px/22px` for comfortable scanning on 360–420px mobile viewports.

## Layout & Spacing

The layout is built for high information density on mobile screens while observing strict ergonomic boundaries for one-handed operation.

### Viewport & Grid
- **Mobile Container (Fluid with Max Constraints):** 100% viewport width up to `640px`; centers on desktop viewports with a maximum thread stream width of `768px` or a dual-pane layout on screens exceeding `1024px`.
- **Vertical Post Stream:** Continuous linear card/item list separated by `1px` structural hairline dividers (`#1e293b`), avoiding disconnected floating cards to minimize vertical pixel waste.
- **Safe Tap Boundaries:** Bottom action bars reserve a `44px` (`2.75rem`) minimum touch target, offset by system navigation safe areas (`env(safe-area-inset-bottom)`).
- **Nested Quote Indentation:** Inline quotes (`>>X`) leverage an asymmetrical left border (`2px solid #3b82f6`) with an `8px` inner left indent, preventing horizontal scroll clipping.

## Elevation & Depth

This design system eschews heavy drop-shadows in favor of **Tonal Layering and Border Delineation**, creating an intentional dark-mode IDE aesthetic.

1. **Base Layer (`#0a0e17`):** The canvas beneath unpopulated stream zones.
2. **Container Layer (`#111827`):** Navigation bars, search surfaces, and thread rows.
3. **Card Layer (`#151e2e`):** Selected response rows, unread demarcations, and active modal sheets.
4. **Overlay / Bottom Sheet (`#1a2436`):** Quick-reply modal drawer, filter menus, and action drawers. Accompanied by a 20% backdrop-blur (`backdrop-filter: blur(12px)`) with a faint ambient glow `0 8px 32px rgba(0, 0, 0, 0.45)`.
5. **Hairline Seams:** Tonal boundaries between post items are defined using `1px solid rgba(255, 255, 255, 0.06)` instead of soft shadows to maintain surgical visual sharpness.

## Shapes

The shape system adopts a **Soft (`1`)** geometry. UI elements use subtle border radii (`4px` to `8px`) that reinforce an analytical, technical tool aesthetic. Excessive circularity is avoided except for pill badges and quick-action icon containers.

- **Buttons & Search Inputs:** `6px` radius (`rounded-md`).
- **Post Item Cards:** Square edges along outer mobile borders (`0px`) with `6px` internal child elements (code blocks, media previews).
- **Badges & Tags (ID counts, momentum):** Fully rounded pills (`9999px`) to visually differentiate metadata from clickable structural content.
- **Quick-Reply Bottom Drawer:** `12px` top-left and top-right radii for organic mobile ascension.

## Components

### 1. Response Items (BBS Post Cards)
- **Header Structure:** Post number (`#3b82f6`, bold mono), poster handle (default `#10b981` for anonymous `名無しさん`), timestamp (`#64748b`), user ID token (`#f59e0b` when multiple posts exist, indicating frequency `(3)`), and utility action buttons (Report / Reply trigger `#64748b`).
- **Body:** `#f1f5f9` font rendering with parsed quote links (`>>N`) styled in primary electric blue (`#3b82f6`) with hover/touch accent state.
- **Anchor Indicator:** A vertical indicator stripe on the left edge (`3px solid #3b82f6`) denotes items matching an active quote-preview or unread batch.

### 2. Primary & Secondary Buttons
- **Primary Action (New Thread / Post):** `#2563eb` solid background, text `#ffffff`, `font-weight: 600`, height `40px` (`2.5rem`), padding `0 1rem`, `rounded-md`.
- **Secondary Action (Refresh / Filter):** `#1e293b` background with border `1px solid #334155`, text `#94a3b8`, active hover `#f1f5f9`.

### 3. Filter Chips & Momentum Tags
- **Filter Chips (Images, Videos, Links):** Muted background `#151e2e`, border `1px solid #1e293b`, icon paired with 12px label. Active state switches border and text to `#3b82f6` with a subtle primary background tint `rgba(59, 130, 246, 0.1)`.
- **Momentum Badge (勢い):** High-visibility pill badge with dark amber/red tint (`rgba(245, 158, 11, 0.15)`), text `#f59e0b`, tracking the post-frequency velocity.

### 4. Input Fields & Quick Reply Bar
- **Bottom Docked Post Bar:** Sticky bar at bottom viewport, `#111827` background, upper border `1px solid #1e293b`. Contains an input field (`#151e2e` fill, `#334155` border) with placeholder "返信を書き込む..." (`#64748b`), paired with an attachment trigger and primary `#2563eb` submission button.

### 5. Checkbox & Radio Controls
- **Style:** Compact square (`16px x 16px`) with `3px` radius, background `#151e2e`, border `1px solid #475569`. Checked state transitions background to `#3b82f6` displaying a white crisp checkmark icon. Used for options like Sage, Anonymous ID concealment, and media filters.