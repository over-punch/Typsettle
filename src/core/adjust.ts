// settle/src/core/adjust.ts — framework-agnostic settle animation algorithm
import { SETTLE_CLASSES, type SettleOptions } from './types'

// ─── Pretext (canvas line detection) ─────────────────────────────────────────

type PretextModule = {
	prepareWithSegments: (text: string, font: string) => unknown
	layoutWithLines: (prepared: unknown, maxWidth: number, lineHeight: number) => { lines: { text: string }[] }
}

let _pretext: PretextModule | null = null
let _pretextLoading = false

let _pretextPromise: Promise<void> | null = null

/** Starts (once) loading the optional pretext package; resolves when it is ready or has failed. */
function tryLoadPretext(): Promise<void> {
	if (_pretext !== null) return Promise.resolve()
	if (_pretextLoading && _pretextPromise) return _pretextPromise
	_pretextLoading = true
	// @ts-ignore — optional peer dep; suppress "cannot find module" without a declaration stub
	_pretextPromise = import(/* @vite-ignore */ /* webpackIgnore: true */ '@chenglou/pretext')
		.then((m) => {
			const mod = m as PretextModule & { default?: PretextModule }
			_pretext = typeof mod.prepareWithSegments === 'function' ? mod : (mod.default ?? null)
		})
		.catch(() => {
			_pretextLoading = false
			console.warn('[typsettle] canvas lineDetection requires @chenglou/pretext — falling back to BCR')
		})
	return _pretextPromise
}

type PreparedEntry = { originalHTML: string; prepared: unknown }
const pretextCache = new WeakMap<HTMLElement, PreparedEntry>()

function getCanvasFont(el: HTMLElement): string {
	// The whole computed family list: the browser quotes names that need it ("Source Serif 4").
	const s = getComputedStyle(el)
	return `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
}

function getLineHeightPx(el: HTMLElement): number {
	const s = getComputedStyle(el)
	const lh = parseFloat(s.lineHeight)
	return isNaN(lh) ? parseFloat(s.fontSize) * 1.2 : lh
}

/**
 * Measure optical density of a text string by rendering to an off-screen canvas.
 * Returns ink pixel fraction in [0, 1] — higher = denser (more ink coverage).
 *
 * @param text     - Text string to render
 * @param font     - CSS font string (e.g. '400 16px Inter') matching the element
 * @param fontSize - Font size in px — used to size the canvas height
 */
function measureLineDensity(text: string, font: string, fontSize: number): number {
	if (!text.trim()) return 0
	const canvas = document.createElement('canvas')
	// Width: rough estimate (0.7 × fontSize per character covers most fonts)
	const width  = Math.ceil(fontSize * text.length * 0.7) || 1
	const height = Math.ceil(fontSize * 2)
	canvas.width  = width
	canvas.height = height
	const ctx = canvas.getContext('2d')
	if (!ctx) return 0
	ctx.font = font
	ctx.fillStyle = 'white'
	ctx.fillRect(0, 0, width, height)
	ctx.fillStyle = 'black'
	ctx.fillText(text, 0, fontSize * 1.2)
	const data = ctx.getImageData(0, 0, width, height).data
	let ink = 0
	for (let i = 0; i < data.length; i += 4) {
		if (data[i] < 140) ink++
	}
	return ink / (width * height)
}

/** Resolved defaults applied when options are omitted */
const DEFAULTS = {
	spread: 0.04,
	duration: 800,
	easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
	stagger: 0,
}

/** Per-item data kept during one apply: the whitespace before it, an author <br> before it, and whether it is a whole element. */
interface ItemMeta {
	lead: string
	breakBefore: HTMLBRElement | null
	atomic?: boolean
}

/** A piece of one item on one line: usually a whole word, or part of a word the browser breaks. */
interface Segment {
	item: HTMLElement
	text: string
	top: number
	bottom: number
	lead: string
	breakBefore: HTMLBRElement | null
	atomic: boolean
	/** Whether this is the item's first segment (its start is the span's start). */
	first: boolean
}

/**
 * Splits a text node that the browser lays out over several lines into one piece per line, by
 * measuring where each character's box starts a new line. Used only for the rare word that wraps.
 */
function splitAtLineBreaks(node: Text, text: string): { text: string; top: number; bottom: number }[] {
	const pieces: { text: string; top: number; bottom: number }[] = []
	const range = document.createRange()
	let start = 0
	let top = NaN, bottom = NaN
	for (let i = 0; i < text.length; i++) {
		range.setStart(node, i)
		range.setEnd(node, i + 1)
		const rect = range.getClientRects()[0]
		if (!rect) continue
		const middle = (rect.top + rect.bottom) / 2
		if (Number.isNaN(top)) { top = rect.top; bottom = rect.bottom; continue }
		if (middle > bottom) {
			pieces.push({ text: text.slice(start, i), top, bottom })
			start = i
			top = rect.top
			bottom = rect.bottom
		} else {
			bottom = Math.max(bottom, rect.bottom)
		}
	}
	pieces.push({ text: text.slice(start), top: Number.isNaN(top) ? 0 : top, bottom: Number.isNaN(bottom) ? 0 : bottom })
	return pieces.filter((p) => p.text.length > 0)
}

/** Elements kept whole during the rebuild (no text of their own to split). */
const ATOMIC_TAGS = new Set(['IMG', 'SVG', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'VIDEO', 'AUDIO', 'CANVAS', 'IFRAME', 'OBJECT', 'MATH'])

/** Scripts written without spaces between words: every grapheme is a possible line break. */
const UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u

/**
 * Splits a space-free token into the pieces a line may break between: graphemes for CJK, Thai and
 * similar scripts (Intl.Segmenter keeps combining marks with their base), the whole token otherwise.
 */
function splitUnspaced(token: string): string[] {
	if (!UNSPACED_SCRIPT.test(token)) return [token]
	const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(t: string): Iterable<{ segment: string }> } }).Segmenter
	if (!Seg) return Array.from(token)
	return Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(token), (seg) => seg.segment)
}

/** A finite number, else the default (with a one-time warning). */
function finiteOr(value: unknown, fallback: number, name: string): number {
	if (value === undefined) return fallback
	if (typeof value === 'number' && Number.isFinite(value)) return value
	if (!warned.has(name)) {
		warned.add(name)
		console.warn(`[typsettle] ${name} must be a finite number; got ${String(value)}, using ${fallback}`)
	}
	return fallback
}

/** Warnings already printed. */
const warned = new Set<string>()

/** The snapshot each processed element was built from, returned by getCleanHTML. */
const originals = new WeakMap<HTMLElement, string>()

/**
 * The element's original nodes: each element's child list, so a refit or removal can put the very
 * same nodes back (keeping their event listeners, React's included) instead of re-parsing HTML.
 */
interface NodeSnapshot { html: string; children: Map<Node, Node[]> }
const snapshots = new WeakMap<HTMLElement, NodeSnapshot>()

/** Records every element's child list under root. */
function takeSnapshot(root: HTMLElement, html: string): NodeSnapshot {
	const children = new Map<Node, Node[]>()
	const visit = (node: Node) => {
		children.set(node, Array.from(node.childNodes))
		node.childNodes.forEach((child) => { if (child.nodeType === Node.ELEMENT_NODE) visit(child) })
	}
	visit(root)
	return { html, children }
}

/** Puts the original nodes back where they were. */
function restoreSnapshot(snapshot: NodeSnapshot): void {
	snapshot.children.forEach((kids, parent) => (parent as Element).replaceChildren(...kids))
}

/**
 * Pass 1: bring the element back to its original content, reusing the original nodes when they
 * are still known (a refit, or a first run on an element that already holds originalHTML).
 */
function resetElement(element: HTMLElement, originalHTML: string): void {
	const snap = snapshots.get(element)
	if (snap && snap.html === originalHTML) {
		restoreSnapshot(snap)
		return
	}
	if (snap) restoreSnapshot(snap)
	const current = element.querySelector(`.${SETTLE_CLASSES.line}`) ? null : element.innerHTML
	if (current !== originalHTML) element.innerHTML = originalHTML
	snapshots.set(element, takeSnapshot(element, originalHTML))
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Strips all optical-margin injected markup from a clone of the element and returns the clean
 * innerHTML (the author's own <br> tags are kept). Safe to call multiple times — idempotent.
 *
 * @param el - Element that may contain optical-margin markup


/**
 * Returns the element's original innerHTML: for an element this library processed, the exact
 * snapshot it was built from; otherwise the innerHTML with any settle markup removed. Idempotent.
 *
 * @param el - Element that may contain settle markup
 */
export function getCleanHTML(el: HTMLElement): string {
	const original = originals.get(el)
	if (original !== undefined && el.querySelector(`.${SETTLE_CLASSES.line}`)) return original
	const clone = el.cloneNode(true) as HTMLElement
	const settleSpans = clone.querySelectorAll(
		`.${SETTLE_CLASSES.word}, .${SETTLE_CLASSES.line}, .${SETTLE_CLASSES.probe}`,
	)
	settleSpans.forEach((node) => {
		const parent = node.parentNode
		if (!parent) return
		while (node.firstChild) parent.insertBefore(node.firstChild, node)
		parent.removeChild(node)
	})
	clone.querySelectorAll('br[data-settle-br]').forEach((br) => br.parentNode?.removeChild(br))
	clone.normalize()
	return clone.innerHTML
}

/** Prints a console warning the first time it is seen. */
function warnOnce(message: string): void {
	if (warned.has(message)) return
	warned.add(message)
	console.warn(message)
}

/** The settled letter-spacing (em) of each line span, so a replay never reads a mid-transition value. */
const settledEm = new WeakMap<HTMLElement, number>()

/** Latest apply per element, so pretext finishing a load re-applies only if nothing newer ran. */
const latestApply = new WeakMap<HTMLElement, object>()

/** A CSS timing function the browser accepts, else the default (with a warning). */
function safeEasing(easing: unknown): string {
	if (typeof easing !== 'string' || !easing.trim()) return DEFAULTS.easing
	// Only the characters a timing function can contain (letters, digits, commas, dots, minus,
	// parentheses, spaces), then the browser's own check.
	const ok = /^[\w\s(),.-]+$/.test(easing) && (typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
		? CSS.supports('transition-timing-function', easing)
		: /^[a-z-]+(\([\d.,\s-]*\))?$/i.test(easing.trim()))
	if (ok) return easing.trim()
	warnOnce(`[typsettle] easing "${easing}" is not a valid timing function; using the default`)
	return DEFAULTS.easing
}

/** spread is in em: anything over 1em pushes lines far past the column while animating. */
function clampSpread(spread: number): number {
	if (spread <= 1) return spread
	warnOnce(`[typsettle] spread ${spread}em is very large; using 1em`)
	return 1
}

/** Formats an em value for letter-spacing ("0" for zero). */
const emValue = (v: number) => (v === 0 ? '0' : `${v.toFixed(4)}em`)

/**
 * Applies the settle animation to an element: each visual line starts with offset letter-spacing
 * and eases to its settled value.
 *
 *  1. Reset — bring back the original content (the original nodes, when known)
 *  2. Word wrap — wrap each word in a plain inline span, leaving the spaces between words in the
 *     text flow, so the browser breaks lines exactly as it does for the original text
 *  3. Line grouping — by position (a word the browser breaks is split there)
 *  4. Rebuild — one line span per line inside its inline ancestors (one link stays one link within a
 *     line), reusing the original elements so their listeners keep working
 *  5. Animate — each line is set to its start spacing with transitions off, the browser computes
 *     that state, then the transition is switched on and the settled spacing set
 *
 * @param element      - The live DOM element to animate (must be rendered and visible)
 * @param originalHTML - HTML snapshot taken before the first applySettle call (getCleanHTML)
 * @param options      - SettleOptions (merged with defaults)
 */
export function applySettle(
	element: HTMLElement,
	originalHTML: string,
	options: SettleOptions | null = {},
): void {
	if (typeof window === 'undefined' || !element) return
	const opts = options ?? {}

	// Inactive, reduced motion, or an e-ink / slow-refresh display: the original content, no animation.
	const active = opts.active ?? true
	if (!active || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || window.matchMedia?.('(update: slow)')?.matches) {
		resetElement(element, originalHTML)
		return
	}

	const spread   = clampSpread(Math.abs(finiteOr(opts.spread, DEFAULTS.spread, 'spread')))
	const duration = Math.max(0, finiteOr(opts.duration, DEFAULTS.duration, 'duration'))
	const easing   = safeEasing(opts.easing ?? DEFAULTS.easing)
	const stagger  = Math.max(0, finiteOr(opts.stagger, DEFAULTS.stagger, 'stagger'))
	const direction = opts.direction ?? 'expand'

	const applyToken = {}
	latestApply.set(element, applyToken)

	// --- Pass 1: Reset ---
	resetElement(element, originalHTML)
	originals.set(element, originalHTML)
	if (!element.textContent?.trim()) return
	if (!element.offsetWidth && !element.getBoundingClientRect().width) return

	// The element's own letter-spacing is the settled baseline.
	const computedStyle = getComputedStyle(element)
	const fontSizePx    = parseFloat(computedStyle.fontSize) || 16
	const originalLSPx  = parseFloat(computedStyle.letterSpacing) || 0
	const originalLSEm  = originalLSPx / fontSizePx
	const px = (v: string) => parseFloat(v) || 0
	const contentWidth = element.getBoundingClientRect().width - px(computedStyle.paddingLeft) - px(computedStyle.paddingRight) - px(computedStyle.borderLeftWidth) - px(computedStyle.borderRightWidth)

	// --- Pass 2: Word wrap ---
	const items: HTMLElement[] = []
	const meta = new WeakMap<Element, ItemMeta>()
	let pendingSpace = ''
	let pendingBreak: HTMLBRElement | null = null
	const pushWord = (span: HTMLElement, lead: string) => {
		meta.set(span, { lead: pendingSpace + lead, breakBefore: pendingBreak })
		pendingSpace = ''
		pendingBreak = null
		items.push(span)
	}
	const walk = (node: Node): void => {
		if (node.nodeType === Node.TEXT_NODE) {
			const textNode = node as Text
			const text = textNode.textContent ?? ''
			if (!text.trim()) { pendingSpace += text; return }
			const fragment = document.createDocumentFragment()
			let lead = ''
			for (const token of text.split(/(\s+)/)) {
				if (!token) continue
				if (/^\s+$/.test(token)) {
					fragment.appendChild(document.createTextNode(token))
					lead += token
					continue
				}
				for (const piece of splitUnspaced(token)) {
					const span = document.createElement('span')
					span.className = SETTLE_CLASSES.word
					// A locked nowrap line can't hyphenate, so the measurement mustn't either.
					span.style.hyphens = 'manual'
					span.textContent = piece
					fragment.appendChild(span)
					pushWord(span, lead)
					lead = ''
				}
			}
			pendingSpace += lead
			textNode.parentNode!.replaceChild(fragment, textNode)
			return
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return
		const el = node as Element
		if (el.tagName === 'BR') { pendingBreak = el as HTMLBRElement; return }
		if (!el.hasChildNodes() || ATOMIC_TAGS.has(el.tagName)) {
			meta.set(el, { lead: pendingSpace, breakBefore: pendingBreak, atomic: true })
			pendingSpace = ''
			pendingBreak = null
			items.push(el as HTMLElement)
			return
		}
		Array.from(el.childNodes).forEach(walk)
	}
	Array.from(element.childNodes).forEach(walk)
	if (items.length === 0) { resetElement(element, originalHTML); return }

	// --- Pass 3: Line grouping ---
	const lineDetection = opts.lineDetection ?? 'bcr'
	if (lineDetection === 'canvas' && _pretext === null) {
		// First call: BCR now, and re-apply once pretext has loaded (if nothing newer ran).
		tryLoadPretext().then(() => {
			if (_pretext && element.isConnected && latestApply.get(element) === applyToken) applySettle(element, originalHTML, opts)
		})
	}
	const toSeg = (item: HTMLElement): Segment => {
		const info = meta.get(item)
		return { item, text: info?.atomic ? '' : item.textContent ?? '', top: 0, bottom: 0, lead: info?.lead ?? '', breakBefore: info?.breakBefore ?? null, atomic: !!info?.atomic, first: true }
	}
	let lines: Segment[][] = []
	let usedPretext = false
	if (lineDetection === 'canvas' && _pretext !== null) {
		try {
			const cached = pretextCache.get(element)
			let prepared: unknown
			if (cached && cached.originalHTML === originalHTML) {
				prepared = cached.prepared
			} else {
				prepared = _pretext.prepareWithSegments(element.textContent ?? '', getCanvasFont(element))
				pretextCache.set(element, { originalHTML, prepared })
			}
			const { lines: pretextLines } = _pretext.layoutWithLines(prepared, contentWidth, getLineHeightPx(element))
			let si = 0
			for (const pl of pretextLines) {
				const target = pl.text.replace(/\s+/g, '')
				const line: Segment[] = []
				let acc = ''
				while (si < items.length) {
					acc += (items[si].textContent ?? '').replace(/\s+/g, '')
					line.push(toSeg(items[si]))
					si++
					if (acc.length >= target.length) break
				}
				if (line.length) lines.push(line)
			}
			while (si < items.length) lines[lines.length - 1]?.push(toSeg(items[si++]))
			lines = lines.flatMap((line) => {
				const out: Segment[][] = [[]]
				line.forEach((seg, k) => { if (k > 0 && seg.breakBefore) out.push([]); out[out.length - 1].push(seg) })
				return out
			})
			usedPretext = lines.length > 0
		} catch (err) {
			warnOnce('[typsettle] canvas line detection failed — using the browser layout')
			lines = []
		}
	}
	if (!usedPretext) {
		// BCR path. A word the browser itself breaks (after a hyphen, or with overflow-wrap) is split
		// into one segment per line at the real break.
		const segments: Segment[] = []
		for (const item of items) {
			const rects = item.getClientRects?.()
			const rect = rects && rects.length ? rects[0] : item.getBoundingClientRect()
			const info = meta.get(item)
			const text = info?.atomic ? '' : item.textContent ?? ''
			if (rects && rects.length > 1 && !info?.atomic && item.firstChild?.nodeType === Node.TEXT_NODE) {
				for (const [k, piece] of splitAtLineBreaks(item.firstChild as Text, text).entries()) {
					segments.push({ item, text: piece.text, top: piece.top, bottom: piece.bottom, lead: k === 0 ? info?.lead ?? '' : '', breakBefore: k === 0 ? info?.breakBefore ?? null : null, atomic: false, first: k === 0 })
				}
				continue
			}
			segments.push({ item, text, top: rect.top, bottom: rect.bottom ?? rect.top, lead: info?.lead ?? '', breakBefore: info?.breakBefore ?? null, atomic: !!info?.atomic, first: true })
		}
		// A word starts a new line when its vertical middle is below the bottom of the current line's
		// boxes: a superscript or a larger word stays in its line, and tight line-heights stay apart.
		let current: Segment[] | null = null
		let groupBottom = -Infinity
		for (const seg of segments) {
			const middle = (seg.top + seg.bottom) / 2
			if (current === null || middle > groupBottom || (current.length > 0 && seg.breakBefore)) {
				current = []
				lines.push(current)
				groupBottom = seg.bottom
			} else {
				groupBottom = Math.max(groupBottom, seg.bottom)
			}
			current.push(seg)
		}
	}
	if (lines.length === 0) return
	const lineTexts = lines.map((line) => line.map((seg, k) => (k > 0 ? seg.lead : '') + seg.text).join('').replace(/\s+/g, ' ').trim())

	// --- Settled targets (optional) ---
	let targetAdjustments: number[] = lines.map(() => 0)
	const targetTrackingOption = opts.targetTracking
	if (typeof targetTrackingOption === 'number' && Number.isFinite(targetTrackingOption)) {
		targetAdjustments = lines.map(() => targetTrackingOption)
	} else if (targetTrackingOption === 'auto') {
		// Equalize optical density: dense lines open up, sparse lines tighten (±0.05em).
		const font = getCanvasFont(element)
		const densities = lineTexts.map((text) => measureLineDensity(text, font, fontSizePx))
		const avg = densities.reduce((a, b) => a + b, 0) / densities.length
		targetAdjustments = densities.map((d) => Math.max(-0.05, Math.min(0.05, (d - avg) * 2.0)))
	}

	// --- Pass 4: Rebuild ---
	const chains = new Map<Segment, Element[]>()
	for (const line of lines) {
		for (const seg of line) {
			const ancestors: Element[] = []
			let node: Element | null = seg.item.parentElement
			while (node && node !== element) { ancestors.unshift(node); node = node.parentElement }
			chains.set(seg, ancestors)
		}
	}
	const justify = computedStyle.textAlign === 'justify'
	const ws = computedStyle.whiteSpace
	const lineWhiteSpace = ws === 'pre' || ws === 'pre-wrap' || ws === 'break-spaces' ? 'pre' : 'nowrap'
	const copied = new Set<Element>()
	const fragment = document.createDocumentFragment()
	const lineSpans: HTMLElement[] = []
	lines.forEach((line, lineIndex) => {
		const lineSpan = document.createElement('span')
		lineSpan.className = SETTLE_CLASSES.line
		lineSpan.style.display = 'inline-block'
		lineSpan.style.whiteSpace = lineWhiteSpace
		// text-indent is inherited: without this every line would be indented, not just the first.
		lineSpan.style.textIndent = '0'
		const nextSeg = lines[lineIndex + 1]?.[0]
		if (justify && nextSeg && !nextSeg.breakBefore && contentWidth > 0) {
			lineSpan.style.width = `${contentWidth}px`
			lineSpan.style.textAlignLast = 'justify'
		}
		let openChain: { source: Element; clone: Element }[] = []
		line.forEach((seg, k) => {
			const ancestors = chains.get(seg) ?? []
			let shared = 0
			while (shared < openChain.length && shared < ancestors.length && openChain[shared].source === ancestors[shared]) shared++
			openChain = openChain.slice(0, shared)
			let parent: Node = shared ? openChain[shared - 1].clone : lineSpan
			const lead = k === 0 ? seg.lead.replace(/[\r\n]+/g, '') : seg.lead
			if (lead) parent.appendChild(document.createTextNode(lead))
			for (let a = shared; a < ancestors.length; a++) {
				let copy: Element
				if (copied.has(ancestors[a])) {
					copy = ancestors[a].cloneNode(false) as Element
					copy.removeAttribute('id')
				} else {
					copy = ancestors[a]
					copy.replaceChildren()
				}
				copied.add(ancestors[a])
				parent.appendChild(copy)
				openChain.push({ source: ancestors[a], clone: copy })
				parent = copy
			}
			if (seg.atomic) {
				parent.appendChild(seg.item)
			} else {
				const word = document.createElement('span')
				word.className = SETTLE_CLASSES.word
				word.textContent = seg.text
				parent.appendChild(word)
			}
		})
		fragment.appendChild(lineSpan)
		lineSpans.push(lineSpan)
		if (lineIndex < lines.length - 1) {
			const authorBreak = lines[lineIndex + 1][0].breakBefore
			if (authorBreak) {
				fragment.appendChild(authorBreak.cloneNode(false))
			} else {
				const br = document.createElement('br')
				br.setAttribute('data-settle-br', '')
				br.setAttribute('aria-hidden', 'true')
				fragment.appendChild(br)
			}
		}
	})
	element.innerHTML = ''
	element.appendChild(fragment)

	// --- Pass 5: Animate ---
	// A positive settled adjustment is limited to the room each line has, so the settled state never
	// overflows (targetTracking used to leave lines wider than the column).
	const settled = lineSpans.map((span, i) => {
		const adj = targetAdjustments[i]
		if (adj <= 0 || justify) return originalLSEm + adj
		const room = contentWidth - span.getBoundingClientRect().width - 0.5
		const chars = [...(span.textContent ?? '')].length || 1
		const maxAdjEm = Math.max(0, room / chars / fontSizePx)
		return originalLSEm + Math.min(adj, maxAdjEm)
	})
	lineSpans.forEach((span, i) => {
		// expand starts wider and settles in; compress starts tighter and settles out.
		const offset = Math.random() * spread
		const start = direction === 'compress' ? settled[i] - offset : settled[i] + offset
		span.style.transition = 'none'
		span.style.letterSpacing = emValue(start)
		settledEm.set(span, settled[i])
	})
	// The browser must compute the start state before the transition is switched on, or it never sees
	// a change to animate (setting the target in a later frame without this was a race that usually lost).
	void element.offsetWidth
	lineSpans.forEach((span, i) => {
		span.style.transition = `letter-spacing ${duration}ms ${easing}`
		if (stagger > 0) span.style.transitionDelay = `${i * stagger}ms`
		span.style.letterSpacing = emValue(settled[i])
	})
}

/**
 * Removes settle markup and restores the element to its original content (the original nodes,
 * when known).
 *
 * @param element      - The element that was previously animated
 * @param originalHTML - The snapshot passed to the original applySettle call (optional)
 */
export function removeSettle(element: HTMLElement, originalHTML?: string): void {
	const html = originalHTML ?? originals.get(element) ?? getCleanHTML(element)
	const snap = snapshots.get(element)
	if (snap && snap.html === html) restoreSnapshot(snap)
	else element.innerHTML = html
	snapshots.delete(element)
	originals.delete(element)
}

/**
 * Re-runs the settle animation. With `quietReplay`, the existing lines are kept and each briefly
 * offsets from its settled spacing and eases back (staggered when `stagger` is set); otherwise the
 * element is rebuilt and animated from scratch.
 *
 * @param element      - The live DOM element to animate
 * @param originalHTML - HTML snapshot taken before the first applySettle call (optional: the element's
 *                       own original is used when omitted)
 * @param options      - SettleOptions (merged with defaults)
 * @returns              A function that cancels pending staggered replays
 */
export function replaySettle(
	element: HTMLElement,
	originalHTML?: string,
	options: SettleOptions = {},
): () => void {
	const html = originalHTML ?? originals.get(element) ?? getCleanHTML(element)
	const stagger     = Math.max(0, finiteOr(options.stagger, DEFAULTS.stagger, 'stagger'))
	const quietReplay = options.quietReplay ?? false
	const existingLineSpans = Array.from(element.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`))

	if (!quietReplay || existingLineSpans.length === 0) {
		applySettle(element, html, options)
		return () => {}
	}

	const spread   = clampSpread(Math.abs(finiteOr(options.spread, DEFAULTS.spread, 'spread')))
	const duration = Math.max(0, finiteOr(options.duration, DEFAULTS.duration, 'duration'))
	const easing   = safeEasing(options.easing ?? DEFAULTS.easing)
	const direction = options.direction ?? 'expand'
	const timerIds: ReturnType<typeof setTimeout>[] = []

	existingLineSpans.forEach((span, i) => {
		const id = setTimeout(() => {
			// The stored settled value, never the computed one (mid-transition it is a value in between).
			const target = settledEm.get(span) ?? 0
			const offset = Math.random() * spread
			const start = direction === 'compress' ? target - offset : target + offset
			span.style.transition = 'none'
			span.style.letterSpacing = emValue(start)
			void span.offsetWidth
			span.style.transition = `letter-spacing ${duration}ms ${easing}`
			span.style.letterSpacing = emValue(target)
		}, i * stagger)
		timerIds.push(id)
	})
	return () => { timerIds.forEach(clearTimeout) }
}
