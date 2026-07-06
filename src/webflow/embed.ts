// typsettle/src/webflow/embed.ts — zero-config browser bundle for Webflow Custom Code Embed.
// Runs the settle page-load animation on any element marked with [data-typsettle], reading
// options from data-* attributes, re-running on width change (line grouping is width-dependent),
// and optionally replaying on viewport entry. Exposes a small window.Typsettle API.
import { applySettle, removeSettle, replaySettle, getCleanHTML } from '../core/adjust'
import type { SettleOptions } from '../core/types'

/** Attribute that opts an element in to the settle animation. */
const OPT_IN_ATTR = 'data-typsettle'

/** Per-element state tracked while an element is under management. */
interface Tracked {
	/** Clean HTML snapshot taken before the first applySettle mutation. */
	originalHTML: string
	/** Parsed options, re-read from the DOM on every (re)run. */
	options: SettleOptions
	/** Width observer that re-runs the animation when the element's width changes. */
	resizeObserver: ResizeObserver | null
	/** Viewport observer that replays the animation on re-entry (intersect only). */
	intersectObserver: IntersectionObserver | null
	/** Cancels any in-flight staggered replay timers. */
	cancelReplay: (() => void) | null
	/** True once the element has completed its first settle. */
	hasSettledOnce: boolean
}

/** Elements currently under management, keyed for O(1) teardown. */
const registry = new WeakMap<HTMLElement, Tracked>()

/** Live set of managed elements so restart() with no argument can reach them all. */
const managed = new Set<HTMLElement>()

/**
 * Coerce a data-* string to a boolean.
 * Treats '', 'true', '1', 'yes', 'on' as true and 'false', '0', 'no', 'off' as false.
 * Returns undefined for unrecognised values so the caller falls through to the default.
 *
 * @param raw - Raw attribute value (or undefined when unset)
 */
function parseBool(raw: string | undefined): boolean | undefined {
	if (raw === undefined) return undefined
	const v = raw.trim().toLowerCase()
	if (v === '' || v === 'true' || v === '1' || v === 'yes' || v === 'on') return true
	if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false
	return undefined
}

/**
 * Read settle options from an element's data-* attributes.
 * Unset or invalid attributes fall through to the library defaults.
 *
 * Supported attributes:
 *   data-ts-line-detection  — 'bcr' (default) or 'canvas' (needs @chenglou/pretext)
 *   data-ts-spread          — max initial letter-spacing offset in em (default 0.04)
 *   data-ts-duration        — animation duration in ms (default 800)
 *   data-ts-easing          — CSS easing string
 *   data-ts-stagger         — per-line delay in ms (default 0)
 *   data-ts-active          — false to skip the animation (default true)
 *   data-ts-target-tracking — 'auto' or an em number the lines settle to
 *   data-ts-direction       — 'expand' (default) or 'compress'
 *   data-ts-intersect       — true to replay each time the element enters the viewport
 *   data-ts-quiet-replay    — true to avoid the all-lines flash on staggered replays
 *
 * @param el - The opted-in element
 */
function readOptions(el: HTMLElement): SettleOptions {
	const d = el.dataset
	const opts: SettleOptions = {}

	if (d.tsLineDetection === 'bcr' || d.tsLineDetection === 'canvas') {
		opts.lineDetection = d.tsLineDetection
	}
	if (d.tsSpread !== undefined) { const n = parseFloat(d.tsSpread); if (!isNaN(n)) opts.spread = n }
	if (d.tsDuration !== undefined) { const n = parseFloat(d.tsDuration); if (!isNaN(n)) opts.duration = n }
	if (d.tsEasing) opts.easing = d.tsEasing
	if (d.tsStagger !== undefined) { const n = parseFloat(d.tsStagger); if (!isNaN(n)) opts.stagger = n }

	const active = parseBool(d.tsActive)
	if (active !== undefined) opts.active = active

	if (d.tsTargetTracking !== undefined) {
		if (d.tsTargetTracking.trim().toLowerCase() === 'auto') {
			opts.targetTracking = 'auto'
		} else {
			const n = parseFloat(d.tsTargetTracking)
			if (!isNaN(n)) opts.targetTracking = n
		}
	}

	if (d.tsDirection === 'expand' || d.tsDirection === 'compress') {
		opts.direction = d.tsDirection
	}

	const intersect = parseBool(d.tsIntersect)
	if (intersect !== undefined) opts.intersect = intersect

	const quietReplay = parseBool(d.tsQuietReplay)
	if (quietReplay !== undefined) opts.quietReplay = quietReplay

	return opts
}

/**
 * Run (or re-run) the settle animation on a tracked element.
 * Re-reads options from the DOM each time so live attribute edits take effect.
 * applySettle resets to the original snapshot internally, so repeat calls are idempotent.
 *
 * @param el      - Managed element
 * @param tracked - Its registry record
 */
function run(el: HTMLElement, tracked: Tracked): void {
	tracked.options = readOptions(el)
	applySettle(el, tracked.originalHTML, tracked.options)
	tracked.hasSettledOnce = true
}

/**
 * Replay the settle animation on a tracked element without a hard innerHTML reset
 * once it has settled, mirroring the React hook's intersect behaviour.
 *
 * @param el      - Managed element
 * @param tracked - Its registry record
 */
function replay(el: HTMLElement, tracked: Tracked): void {
	tracked.cancelReplay?.()
	tracked.cancelReplay = replaySettle(el, tracked.originalHTML, tracked.options)
}

/**
 * Begin managing a single element: snapshot its clean HTML, run the animation,
 * and wire width + viewport observers that mirror the useSettle hook.
 *
 * @param el - Element to animate
 */
function initElement(el: HTMLElement): void {
	if (registry.has(el)) return

	const tracked: Tracked = {
		originalHTML: getCleanHTML(el),
		options: readOptions(el),
		resizeObserver: null,
		intersectObserver: null,
		cancelReplay: null,
		hasSettledOnce: false,
	}
	registry.set(el, tracked)
	managed.add(el)

	run(el, tracked)

	// Re-run on width change — line grouping is width-dependent, so a reflow must
	// regroup and re-animate. Only integer width changes trigger a re-run, throttled
	// to one per animation frame so a drag-resize doesn't thrash layout.
	if (typeof ResizeObserver !== 'undefined') {
		let lastWidth = Math.round(el.getBoundingClientRect().width)
		let rafId = 0
		const ro = new ResizeObserver((entries) => {
			const w = Math.round(entries[0].contentRect.width)
			if (w === lastWidth) return
			lastWidth = w
			cancelAnimationFrame(rafId)
			rafId = requestAnimationFrame(() => run(el, tracked))
		})
		ro.observe(el)
		tracked.resizeObserver = ro
	}

	// Replay each time the element re-enters the viewport (opt-in via data-ts-intersect).
	if (tracked.options.intersect && typeof IntersectionObserver !== 'undefined') {
		const io = new IntersectionObserver((entries) => {
			if (!entries[0].isIntersecting) return
			if (tracked.hasSettledOnce) {
				replay(el, tracked)
			} else {
				run(el, tracked)
			}
		})
		io.observe(el)
		tracked.intersectObserver = io
	}
}

/**
 * Scan a root for opted-in elements and begin managing each one.
 *
 * @param root - Element or document to search (default: document)
 */
function init(root: ParentNode = document): void {
	root.querySelectorAll<HTMLElement>(`[${OPT_IN_ATTR}]`).forEach(initElement)
}

/**
 * Replay the settle animation on demand — one element, or every managed element
 * when called with no argument. Useful for triggering the effect after a route change.
 *
 * @param el - Optional specific element; omit to restart all managed elements
 */
function restart(el?: HTMLElement): void {
	if (el) {
		const tracked = registry.get(el)
		if (tracked) replay(el, tracked)
		return
	}
	managed.forEach((element) => {
		const tracked = registry.get(element)
		if (tracked) replay(element, tracked)
	})
}

/**
 * Restore an element to its original HTML and stop managing it, disconnecting
 * its observers and cancelling any in-flight replay timers.
 *
 * @param el - Element previously initialised
 */
function destroy(el: HTMLElement): void {
	const tracked = registry.get(el)
	if (!tracked) return
	tracked.resizeObserver?.disconnect()
	tracked.intersectObserver?.disconnect()
	tracked.cancelReplay?.()
	removeSettle(el, tracked.originalHTML)
	registry.delete(el)
	managed.delete(el)
}

/**
 * Auto-initialise once the DOM is parsed and web fonts have loaded.
 * Fonts must settle first: BCR line detection reads real glyph metrics, which
 * shift when a web font swaps in. The core also re-runs safely, so a font swap
 * arriving after the first pass simply regroups lines correctly.
 */
function autoInit(): void {
	const start = () => {
		if (document.fonts?.ready) {
			document.fonts.ready.then(() => init()).catch(() => init())
		} else {
			init()
		}
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start, { once: true })
	} else {
		start()
	}
}

autoInit()

// Public browser API — assigned to window.Typsettle via the IIFE global name.
export { init, restart, destroy }
