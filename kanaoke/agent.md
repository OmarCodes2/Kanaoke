# Kanaoke design reference

## Scope and intent

This document is the visual and interaction reference for all future Kanaoke surfaces. The canonical source is the **Library / song-selection page** (`/library`), verified in the running Electron app at its native 1200 × 800 window size.

The desired feeling is a premium, dark, art-first rhythm-game music browser: **cinematic and immersive on the selected-song side; compact, legible, and tactile on the library side**. It is inspired by osu! in its density and song-art focus, but should not become loud, candy-colored, or skeuomorphic.

## App context

Kanaoke is a local-first Electron + Vite + React + TypeScript app for learning Japanese through music. Song maps live as `.osj` directories; the main process scans them, calculates a status, serves local images through a `local-image://` protocol, and exposes functionality through the preload API. React Router owns five primary flows:

| Route | Role |
| --- | --- |
| `/library` | Select and inspect songs; the visual source of truth |
| `/import` | Import an existing song map or create one |
| `/editor/:id` | Time/sync lyrics |
| `/learn/:id` | Learn from synchronized lyrics |
| `/sing/:id` | Distraction-reduced karaoke playback |

`LibraryPage.tsx` owns library scanning, last-selection persistence, keyboard selection, the selected cover image, dictionary-panel state, and the sidebar. It composes `SongPreviewPanel` for the hero and `SongListItem` for each library row. Do not duplicate song status decisions in the UI: statuses come from `scanLibrary()` in `src/main/songMapUtils.ts`.

## Composition

```text
┌──────────────────────────────────── left: selected-song hero ────────────────────────────────────┬── right: library ──┐
│ full-bleed selected cover + dim/blurred backdrop                                                    │ logo + four icons  │
│ dark cinematic overlays, vignette, soft bloom/grain                                                 ├────────────────────┤
│                                                                                                     │ art-led song cards │
│                         large song title                                                            │ scrollable list    │
│                    artist · duration · status                                                       │ selected = white   │
│                     one contextual primary action                                                   │ outline + glow     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────────┘
```

- The app fills the viewport (`100vw × 100vh`) with no page scroll. Electron starts at 1200 × 800.
- At desktop size, the library sidebar is `480px` fixed/min width. At `≤1200px`, it reduces to `400px`; the hero takes all remaining space.
- The sidebar is a separate vertically scrolling region. The hero can also scroll independently if its content needs space.
- Keep hero text centered in a maximum `800px` column. The action is visually single-purpose; do not add a row of competing hero actions.

## Visual foundations

### Color

| Use | Value / treatment |
| --- | --- |
| Base canvas | `#0d0d0d` |
| Raised dark | `#1a1a1a` / `#252525` |
| Primary text | white or `rgba(255,255,255,.98)` |
| Secondary/muted text | `rgba(255,255,255,.7)` / `.45` / `.35` by hierarchy |
| Brand accent | pink `#ff66aa`, purple `#aa66ff`, cyan `#66aaff` |
| Success / synced | `#66ff88` |
| Warning / needs sync | `#ffaa66` |
| Error / invalid | `#ff6666` |

Darkness is structural, not a flat background. Use translucent black/charcoal panels, weak white borders (`rgba(255,255,255,.06–.1)`), deep black shadows, blurred art, and glow only to establish hierarchy. A status may introduce green/orange/red; it must not recolor the entire screen.

### Typography

- System sans stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif`.
- Hero title: `64px`, weight `700`, line height `1.1`, letter spacing `-2px`, white, with a modest dark/pink shadow.
- Hero artist and duration: `22px`; artist is `600`, duration `500`, status is smaller (`14px`, `700`, uppercase).
- Library title: `17px`, `700`, slight negative tracking; artist `13px`, `500`; duration/status labels `10px` and low-contrast.
- Use a monospace face only for the tiny duration in a list card (`Courier New` is currently used). Keep metadata secondary.

### Radius, borders, shadows

- Cards: `14px`; compact control buttons: `13px`; menus: `12px`; modal: `24px`.
- Art on a library card is squared on the right and inherits the card’s left radii, so it feels embedded rather than pasted on.
- Default card border: low-contrast white at `.06`; selected card: `.5` white border plus a layered neutral-white halo. Do not use a pink selected outline.
- Glass surfaces use `backdrop-filter: blur(10–30px) saturate(180%)`, paired with a translucent charcoal fill. Always retain enough opaque fill that text remains readable over any artwork.

## Library sidebar

### Header

- Use a generous header (`24px 32px 16px`) with the Kanaoke wordmark on the left; the current logo is `72px` high.
- Place dictionary, library-folder, import, and add-map actions in compact 43 × 43 icon buttons with 8px gaps.
- Controls are charcoal glass with a faint border, a 13px radius, and a subtle horizontal sheen on hover. They should brighten gently, never jump or strongly glow.
- A ready dictionary can use the pink active color/border. Header controls must expose accessible labels and tooltips.

### Song cards

- Use 16px side margins and 8px vertical gaps. A row has a minimum height of 80px; actual cards use `16px 20px` padding with no left padding.
- Reserve a 120px-wide, full-height cover crop flush to the card’s left edge. Crop with `object-fit: cover`; fade its right edge into the card with a dark gradient.
- Place text after a 136px left offset: title, artist, then duration plus status dot/label.
- Default card: approximately `rgba(15,15,18,.6)`, opacity `.87`, soft top inset highlight, and a low black shadow.
- Hover: lift only `3px`, increase opacity/background slightly, and scale the art subtly. Active press: a fast, small `scale(.98)` compression.
- Selected: opacity `1`, `scale(1.02)`, darkened card fill, neutral white outline and broad white halo. It remains legible rather than neon. The selected state sits above neighboring cards.
- Long titles should remain one line and fade at the trailing edge; do not wrap cards taller merely to show a title.

### Scrollbars

- Keep them narrow (8px in the library), low-contrast, and rounded. Use a dark transparent track and an `rgba(255,255,255,.3)` thumb that becomes `.5` on hover.

## Selected-song hero

### Artwork and atmosphere

- The selected cover is both the subject and the color source. Use it as the hero image and separately as a fixed, overscanned (`120%`) backdrop.
- Backdrop treatment: `blur(60px) brightness(.25) saturate(1.3) contrast(1.1)`, followed by a near-black vertical overlay (`.88–.92`). This lets artwork set a mood without compromising text.
- Hero artwork uses a 2.5:1 container and is intentionally taller than the crop (`height: calc(100% + 200px)`) so it can move subtly.
- Overlay stack, from subtle to strong: top light-control burn, side vignette, bottom cinematic black fade, soft-light bloom, and barely perceptible grain (`.06` opacity). The lower half must fade smoothly into black behind content.
- When no cover is available, use a restrained dark gradient and large initials—not a generic image icon or a bright empty state.

### Content and action

- Position content in the lower/middle portion of the hero (`160px 56px 64px` padding) and animate in with a short `20px` upward fade (`.8s`).
- Show title first, then one compact metadata line: artist · duration · status pill.
- Status is informational and localized: translucent matching-color pill with a soft colored text shadow.
- A synced song shows the green **Start** action. It opens a modal with **Learn** and **Sing** choices.
- A song needing sync shows the orange **Sync** action, which goes directly to the editor. Missing/invalid states retain their red status treatment and should not imply the song is playable.
- Primary buttons are wide, centered, and confident (`24px` type, current horizontal padding 113px). Use a light diagonal gradient, glow that matches the action, and a sweep highlight. Hover lifts 3px and may scale to `1.02`; pressed state returns toward the surface.

### Hero menu and modal

- Place an unfilled circular 44 × 44 three-dot menu in the hero’s top-right. It should be quiet until hovered.
- Its popup is dark glass, 12px radius, 8px padding, at least 160px wide, with pink hover fill/glow. Current actions: Edit Sync and Open Folder.
- Use a full-screen blurred/dimmed overlay for the Start modal. The modal is dark glass, 24px radius, `48px 56px` padding, and a narrow `500px` maximum width. It enters with a `20px` upward scale/fade.
- Modal choices are generous vertically stacked cards, not small dialog buttons. They use neutral glass by default and pink border/glow only on hover.

## Motion and interaction rules

- Standard easing: `cubic-bezier(.4, 0, .2, 1)`.
- Micro-interactions should be quick: song cards `140ms`, header controls `200ms`; larger content/overlay arrivals use `200–800ms`.
- Use horizontal highlight sweeps on buttons/icons and a slow 8s fallback background pulse when no artwork is available.
- Couple cover art parallax to pointer motion and song-list scroll only subtly: current maximum is `6.75px`, with `scale(1.1)`. The effect should feel like depth, never like the artwork is sliding around.
- Keyboard contract on `/library`: `↑` / `↓` cycles selection (wrapping); `Enter` opens Learn only for synced songs. Persist the selected song id in local storage.
- Selection changes must update hero image, blurred background, metadata, status, available action, and sidebar selected state together.

## Reuse checklist

When creating a new screen or component that should belong to this system:

1. Start from the global CSS tokens in `src/index.css`; do not invent a competing palette.
2. Use artwork to establish atmosphere, then heavily darken it so information is primary.
3. Preserve a clear hierarchy: one hero focus, one primary action, supporting metadata, then secondary controls.
4. Prefer neutral-white selection affordances. Reserve pink/purple for brand focus, not every active state.
5. Use glass sparingly and always layer it over a readable dark base.
6. Treat status colors as semantic feedback only.
7. Keep interaction animation physical but restrained—short lifts, compressions, fades, and depth shifts rather than bouncy motion.
8. Preserve accessible names for icon-only controls and never make color the sole status signal.

## Implementation anchors

| Responsibility | Source |
| --- | --- |
| Application routes | `src/App.tsx` |
| Global tokens and baseline controls | `src/index.css` |
| Selection orchestration, library scan, shortcuts | `src/pages/LibraryPage.tsx` |
| Two-column layout, backdrop, header, sidebar | `src/pages/LibraryPage.module.css` |
| Hero actions, status-specific behavior, modal | `src/components/SongPreviewPanel.tsx` |
| Cinematic hero art, overlays, primary actions | `src/components/SongPreviewPanel.module.css` |
| Library row structure | `src/components/SongListItem.tsx` |
| Library-card visual states | `src/components/SongListItem.module.css` |
| Cover image IPC loading | `src/hooks/useCoverImage.ts` |
| Hero parallax | `src/hooks/useParallax.ts` |
| Local library/song-map status calculation | `src/main/songMapUtils.ts` |

Keep this document aligned with the selected-song experience whenever its visual language changes.
