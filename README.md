# Typsettle

[![npm](https://img.shields.io/npm/v/%40overpunch%2Ftypsettle.svg)](https://www.npmjs.com/package/@overpunch/typsettle) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![part of liiift type-tools](https://img.shields.io/badge/liiift-type--tools-blueviolet)](https://github.com/over-punch/type-tools)

Paragraph text enters from randomised letter-spacing and transitions to optical equilibrium. A page-load animation that feels typographic rather than decorative — lines staggered, motion purposeful. Like watching a compositor tune a paragraph. Respects `prefers-reduced-motion`.

![Each line of a paragraph starts at a random letter-spacing offset and eases independently to its settled tracking, staggered line by line.](https://raw.githubusercontent.com/over-punch/Typsettle/main/assets/settle.gif?v=1)

> Each line starts at a random tracking offset and eases to its settled spacing, staggered line by line. ([live demo](https://typsettle.com))

**[typsettle.com](https://typsettle.com)** · [npm](https://www.npmjs.com/package/@overpunch/typsettle) · [GitHub](https://github.com/over-punch/Typsettle)

TypeScript · Zero runtime dependencies (~4 kB gzip) · React + Vanilla JS

---

## Install

```bash
npm install @overpunch/typsettle
```

---

## Usage

> **Next.js App Router:** this library uses browser APIs. Add `"use client"` to any component file that imports from it.

### React component

```tsx
'use client'

import { SettleText } from '@overpunch/typsettle'

<SettleText spread={0.04} duration={800} stagger={80}>
  Your paragraph text here...
</SettleText>
```

### React hook

```tsx
'use client'

import { useSettle } from '@overpunch/typsettle'

// Inside a React component:
const { ref, replay } = useSettle({ spread: 0.04, duration: 800, stagger: 80 })
return <p ref={ref}>Your paragraph text here...</p>
```

The hook returns a `replay` function so you can re-run the settle on demand — here, a complete component with a replay button:

```tsx
'use client'

import { useSettle } from '@overpunch/typsettle'

export function SettlingParagraph() {
  const { ref, replay } = useSettle({ spread: 0.04, duration: 800, stagger: 80 })
  return (
    <>
      <p ref={ref}>
        Paragraph text enters from randomised letter-spacing and eases to
        optical equilibrium.
      </p>
      <button onClick={replay}>Replay</button>
    </>
  )
}
```

### Vanilla JS

```ts
import { applySettle, removeSettle, replaySettle, getCleanHTML } from '@overpunch/typsettle'

const el = document.querySelector('p')
const original = getCleanHTML(el)

applySettle(el, original, { spread: 0.04, duration: 800, stagger: 80 })

// Re-run after custom fonts load — line detection uses BCR, which gives wrong
// line groups if the font hasn't swapped in yet. applySettle resets to original first,
// so re-calling it is safe:
document.fonts.ready.then(() => {
  applySettle(el, original, { spread: 0.04, duration: 800, stagger: 80 })
})

// The line spans remain in the DOM after the animation completes.
// Call removeSettle to restore original markup (e.g. before re-running):
// removeSettle(el, original)

// Replay the settle animation on a previously-settled element:
// replaySettle(el)
```

### TypeScript

```ts
import type { SettleOptions } from '@overpunch/typsettle'

const opts: SettleOptions = { spread: 0.04, duration: 800, stagger: 80, active: true }
```

---

## SSR & Next.js

The animation is **client-only by design** — it reads live browser layout to detect line breaks, so it never runs on the server. Render your text normally (it ships as plain markup, fully indexable and accessible), and the settle wraps and animates it after mount:

- **No hydration mismatch.** The server emits your original paragraph markup; line-wrapping and the random per-line offsets are applied client-side in a layout effect, *after* React has hydrated. There is nothing random in the server output to mismatch.
- **`"use client"` required.** Any file importing from this package must be a Client Component in the App Router (the package touches `window`, `requestAnimationFrame`, and `matchMedia`).
- **Settled is the resting state.** If JS never runs, or `prefers-reduced-motion: reduce` is set, the reader simply sees the paragraph at its natural spacing — the animation degrades to nothing, not to broken markup.

---

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `spread` | `0.04` | Max initial letter-spacing offset in em. Each line gets a random value in `[-spread, +spread]` |
| `duration` | `800` | CSS transition duration in ms |
| `easing` | `'cubic-bezier(0.25, 0.1, 0.25, 1)'` | CSS easing string |
| `stagger` | `0` | Delay between lines in ms. `0` settles all lines together; `80` gives a cascading effect |
| `active` | `true` | Set `false` to skip the animation entirely (e.g. for conditional disabling) |
| `targetTracking` | `0` | Extra letter-spacing (em) each line settles to, on top of the element's own. `0` = natural spacing. `'auto'` evens out optical density: dense lines settle slightly looser and sparse lines slightly tighter (±0.05em). A positive amount is limited to the room each line has, so the settled text never overflows |
| `direction` | `'expand'` | `'expand'` starts each line looser (by up to `spread`) and settles in; `'compress'` starts each line tighter and settles out |
| `intersect` | `false` | Replay the animation each time the element scrolls into view |
| `quietReplay` | `false` | When `true`, a replay keeps the existing lines and offsets each one from its settled spacing, then eases back (staggered when `stagger` is set; all at once when it is `0`), instead of rebuilding the element |
| `lineDetection` | `'bcr'` | `'bcr'` reads actual browser layout — ground truth, works with any font and inline HTML. `'canvas'` uses `@chenglou/pretext` for arithmetic line breaking with no forced reflow on resize (`npm install @chenglou/pretext`). Falls back to `'bcr'` while pretext loads |
| `as` | `'p'` | HTML element to render, e.g. `'h1'`, `'div'`. *(React component only)* |

---

## API reference

### Core functions

| Function | Description |
|----------|-------------|
| `applySettle(element, originalHTML, options)` | Wrap lines and run the settle animation |
| `removeSettle(element, originalHTML)` | Restore the element to its original markup |
| `replaySettle(element, originalHTML?, options?)` | Replay the settle animation on a previously-settled element (the element's own original is used when `originalHTML` is omitted). Returns a function that cancels pending staggered replays |
| `getCleanHTML(element)` | Return the element's inner HTML with any Typsettle spans stripped |

### React hook

`useSettle(options)` returns `{ ref, replay }`:

| Key | Type | Description |
|-----|------|-------------|
| `ref` | `React.RefObject` | Attach to the element you want to animate |
| `replay` | `() => void` | Call to replay the settle animation imperatively |

### `SettleText` component props

Accepts all `SettleOptions` plus:

| Prop | Type | Description |
|------|------|-------------|
| `as` | `string` | HTML element to render (default `'p'`) |
| `onReady` | `(replay: () => void) => void` | Called when the component mounts, with a `replay` function to run the animation again |

### Constants

| Export | Description |
|--------|-------------|
| `SETTLE_CLASSES` | CSS class names injected into the generated markup (`settle-word`, `settle-line`, `settle-probe`) — target these to style the wrapped spans. |

---

## How it works

Each visual line is wrapped in a `<span>`. Each line is set to its start spacing (its settled spacing plus a random offset up to `spread` em: looser for `expand`, tighter for `compress`) with transitions off, the browser computes that state, then a CSS transition is switched on and the settled spacing set — so the animation runs however `applySettle` is called (from a task, a promise, a frame). Stagger is a per-span `transition-delay` of `i × stagger` ms. The settled spacing is the element's own `letter-spacing`, so your tracking is kept.

The line spans stay in the DOM after the transition. Call `removeSettle(el)` to restore the original markup. The animation is skipped (the original content is shown, untouched) if `prefers-reduced-motion: reduce` is set or `active` is `false`.

**Line break safety:** each run starts from the original content, wraps every word in a plain inline span (spaces between words stay in the text flow, so the layout is the browser's own), groups the words into lines, then locks each line with `white-space: nowrap`. Lines keep exactly the words the browser put on them, including a word the browser breaks at a hyphen or with `overflow-wrap`; CJK and Thai break between characters. Justified text stays justified and `text-indent` applies to the first line only. With `expand`, lines are wider than their settled width while they animate, so they can briefly extend past the column (by up to `spread` em per character).

**Markup:** inline elements, your own `<br>`, images and the spaces between elements are kept, and the original elements are reused, so event listeners on them (React's included) keep working. An element that runs across a line break becomes one copy per line (a link over two lines becomes two links; only the first keeps its `id`). `getCleanHTML()` returns the original markup. Copied text includes a line break at each line end.

**Limits:** lines are locked at the width they had when the effect ran, with the fonts loaded then. The React hook and the Webflow embed re-run on resize and font load; with the vanilla API, call `applySettle` again after a resize or once fonts have loaded. Automatic hyphenation (`hyphens: auto`) can't happen inside a locked line, so such a word moves whole to the next line.

**React is optional.** The main entry also exports the React hook and component, so it imports `react`; without React installed, import the vanilla API from `@overpunch/typsettle/core`.

---

## Dev notes

### `next` in root devDependencies

`package.json` at the repo root lists `next` as a devDependency. This is a **Vercel detection workaround** — not a real dependency of the npm package. Vercel's build system inspects the root `package.json` to detect the framework; without `next` present it falls back to a static build and skips the Next.js pipeline, breaking the `/site` subdirectory deploy.

The package itself has zero runtime dependencies. Do not remove this entry.

---

## Future improvements

- **Variable font axis settle** — settle `wdth` or `wght` instead of (or alongside) letter-spacing, for fonts where axis variation reads more clearly at large sizes
- **Random seed** — accept a `seed` option for deterministic random offsets, so repeated runs and snapshot tests reproduce the same starting state (the offsets are applied client-side after hydration, so this is for reproducibility, not for resolving any SSR mismatch — see [SSR & Next.js](#ssr--nextjs))
