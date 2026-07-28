# Typsettle

[![npm](https://img.shields.io/npm/v/%40liiift-studio%2Ftypsettle.svg)](https://www.npmjs.com/package/@liiift-studio/typsettle) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![part of liiift type-tools](https://img.shields.io/badge/liiift-type--tools-blueviolet)](https://github.com/Liiift-Studio/type-tools)

Paragraph text enters from randomised letter-spacing and transitions to optical equilibrium. A page-load animation that feels typographic rather than decorative — lines staggered, motion purposeful. Like watching a compositor tune a paragraph. Respects `prefers-reduced-motion`.

![Each line of a paragraph starts at a random letter-spacing offset and eases independently to its settled tracking, staggered line by line.](https://raw.githubusercontent.com/Liiift-Studio/Typsettle/main/assets/settle.gif?v=1)

> Each line starts at a random tracking offset and eases to its settled spacing, staggered line by line. ([live demo](https://typsettle.com))

**[typsettle.com](https://typsettle.com)** · [npm](https://www.npmjs.com/package/@liiift-studio/typsettle) · [GitHub](https://github.com/Liiift-Studio/Typsettle)

TypeScript · Zero runtime dependencies (~4 kB gzip) · React + Vanilla JS

---

## Install

```bash
npm install @liiift-studio/typsettle
```

---

## Usage

> **Next.js App Router:** this library uses browser APIs. Add `"use client"` to any component file that imports from it.

### React component

```tsx
'use client'

import { SettleText } from '@liiift-studio/typsettle'

<SettleText spread={0.04} duration={800} stagger={80}>
  Your paragraph text here...
</SettleText>
```

### React hook

```tsx
'use client'

import { useSettle } from '@liiift-studio/typsettle'

// Inside a React component:
const { ref, replay } = useSettle({ spread: 0.04, duration: 800, stagger: 80 })
return <p ref={ref}>Your paragraph text here...</p>
```

The hook returns a `replay` function so you can re-run the settle on demand — here, a complete component with a replay button:

```tsx
'use client'

import { useSettle } from '@liiift-studio/typsettle'

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
import { applySettle, removeSettle, replaySettle, getCleanHTML } from '@liiift-studio/typsettle'

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
import type { SettleOptions } from '@liiift-studio/typsettle'

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
| `targetTracking` | `0` | Letter-spacing each line settles to in em. `0` = natural spacing. `'auto'` measures the original rendered tracking and settles there |
| `direction` | `'expand'` | `'expand'` animates from condensed → normal tracking; `'compress'` animates from normal → condensed |
| `intersect` | `false` | Replay the animation each time the element scrolls into view |
| `quietReplay` | `false` | When `true`, replays with each line individually offsetting then settling (staggered), instead of all lines flashing simultaneously. Has no effect when `stagger` is `0` |
| `lineDetection` | `'bcr'` | `'bcr'` reads actual browser layout — ground truth, works with any font and inline HTML. `'canvas'` uses `@chenglou/pretext` for arithmetic line breaking with no forced reflow on resize (`npm install @chenglou/pretext`). Falls back to `'bcr'` while pretext loads |
| `as` | `'p'` | HTML element to render, e.g. `'h1'`, `'div'`. *(React component only)* |

---

## API reference

### Core functions

| Function | Description |
|----------|-------------|
| `applySettle(element, originalHTML, options)` | Wrap lines and run the settle animation |
| `removeSettle(element, originalHTML)` | Restore the element to its original markup |
| `replaySettle(element)` | Replay the settle animation on a previously-settled element |
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
| `onReady` | `(replay: () => void) => void` | Callback fired once the animation completes, receiving a `replay` function |

### Constants

| Export | Description |
|--------|-------------|
| `SETTLE_CLASSES` | CSS class names injected into the generated markup (`settle-word`, `settle-line`, `settle-probe`) — target these to style the wrapped spans. |

---

## How it works

Each visual line is wrapped in a `<span>`. A random `letter-spacing` value in `[-spread, +spread]` em is applied immediately. On the next `requestAnimationFrame`, a CSS transition is set on each span and `letter-spacing` is set to `0em` — the browser animates each line back to zero. Stagger is implemented as a per-span `transition-delay` of `i × stagger` ms.

The line spans are **not** automatically removed after the transition completes — they remain in the DOM with `letter-spacing: 0em`. Call `removeSettle(el, original)` manually if you need to restore the original markup (e.g. before a re-run). The animation is skipped entirely if `prefers-reduced-motion: reduce` is set or `active` is `false`.

**Line break safety:** Line breaks are locked to the browser's natural layout. Each run starts from the original HTML, detects lines at zero letter-spacing, then wraps them with `white-space: nowrap`. Word breaks never change during or after the animation. Lines may overflow briefly during the transition (when random offsets are applied) but settle to `letter-spacing: 0em` — their exact natural width — by the time the animation ends.

---

## Dev notes

### `next` in root devDependencies

`package.json` at the repo root lists `next` as a devDependency. This is a **Vercel detection workaround** — not a real dependency of the npm package. Vercel's build system inspects the root `package.json` to detect the framework; without `next` present it falls back to a static build and skips the Next.js pipeline, breaking the `/site` subdirectory deploy.

The package itself has zero runtime dependencies. Do not remove this entry.

---

## Future improvements

- **Variable font axis settle** — settle `wdth` or `wght` instead of (or alongside) letter-spacing, for fonts where axis variation reads more clearly at large sizes
- **Random seed** — accept a `seed` option for deterministic random offsets, so repeated runs and snapshot tests reproduce the same starting state (the offsets are applied client-side after hydration, so this is for reproducibility, not for resolving any SSR mismatch — see [SSR & Next.js](#ssr--nextjs))
