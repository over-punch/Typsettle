// settle/src/__tests__/adjust.test.ts — core algorithm tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { applySettle, removeSettle, getCleanHTML } from '../core/adjust'
import { SETTLE_CLASSES } from '../core/types'

// ─── DOM measurement mock ─────────────────────────────────────────────────────
const CONTAINER_WIDTH = 600
const WORD_WIDTH = 80

// BCR top counter — each word span gets a top value cycling across lines.
// 3 words per line: words 0-2 → top=0, words 3-5 → top=20, words 6-8 → top=40.
let wordIndex = 0

/**
 * Mocks offsetWidth on HTMLElement.prototype (with no-op setter so happy-dom
 * constructor doesn't throw) and getBoundingClientRect on Element.prototype.
 * Word spans get WORD_WIDTH; everything else gets CONTAINER_WIDTH.
 * Each word span call increments wordIndex so BCR.top cycles across simulated lines.
 * Returns a restore function.
 */
function mockMeasurement() {
	wordIndex = 0

	const proto = HTMLElement.prototype
	const priorOffsetWidth = Object.getOwnPropertyDescriptor(proto, 'offsetWidth')

	Object.defineProperty(proto, 'offsetWidth', {
		configurable: true,
		get: function (this: HTMLElement) {
			if (this.classList?.contains(SETTLE_CLASSES.probe)) return 0
			if (this.classList?.contains(SETTLE_CLASSES.word)) return WORD_WIDTH
			return CONTAINER_WIDTH
		},
		set: () => { /* no-op — allows happy-dom constructor to run without throwing */ },
	})

	const origBCR = Element.prototype.getBoundingClientRect
	Element.prototype.getBoundingClientRect = function (this: Element) {
		const el = this as HTMLElement
		if (el.classList?.contains(SETTLE_CLASSES.probe)) {
			return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
		}
		if (el.classList?.contains(SETTLE_CLASSES.word)) {
			// Assign each word a top value cycling across 3 simulated lines (3 words each)
			const idx = wordIndex++
			const top = Math.floor(idx / 3) * 20
			return { width: WORD_WIDTH, height: 20, top, left: 0, right: WORD_WIDTH, bottom: top + 20, x: 0, y: top, toJSON: () => ({}) } as DOMRect
		}
		return { width: CONTAINER_WIDTH, height: 100, top: 0, left: 0, right: CONTAINER_WIDTH, bottom: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
	}

	return () => {
		if (priorOffsetWidth) Object.defineProperty(proto, 'offsetWidth', priorOffsetWidth)
		Element.prototype.getBoundingClientRect = origBCR
	}
}

function makeElement(html: string): HTMLElement {
	const el = document.createElement('p')
	el.innerHTML = html
	el.style.width = `${CONTAINER_WIDTH}px`
	document.body.appendChild(el)
	return el
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('settle', () => {
	let restore: () => void

	beforeEach(() => {
		document.body.innerHTML = ''
		restore = mockMeasurement()
	})

	afterEach(() => {
		restore()
	})

	it('active:false restores original HTML without injecting settle markup', () => {
		const el = makeElement('one two three four five six')
		const original = getCleanHTML(el)
		applySettle(el, original, { active: false })
		expect(el.innerHTML).toBe(original)
		expect(el.querySelectorAll(`.${SETTLE_CLASSES.line}`).length).toBe(0)
	})

	it('prefers-reduced-motion: reduce restores original HTML without injecting markup', () => {
		const originalMatchMedia = window.matchMedia
		// Mock matchMedia to return matches:true for prefers-reduced-motion
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			configurable: true,
			value: (query: string) => ({
				matches: query.includes('prefers-reduced-motion'),
				media: query,
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => false,
			}),
		})

		const el = makeElement('one two three four five six')
		const original = getCleanHTML(el)
		applySettle(el, original, {})
		expect(el.innerHTML).toBe(original)
		expect(el.querySelectorAll(`.${SETTLE_CLASSES.line}`).length).toBe(0)

		// Restore
		Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: originalMatchMedia })
	})

	it('getCleanHTML is idempotent', () => {
		const el = makeElement('<em>Hello</em> world')
		const html = getCleanHTML(el)
		const html2 = getCleanHTML(el)
		expect(html).toBe(html2)
	})

	it('applySettle does not throw on empty element', () => {
		const el = makeElement('')
		const original = getCleanHTML(el)
		expect(() => applySettle(el, original, {})).not.toThrow()
	})

	it('removeSettle restores original HTML', () => {
		const el = makeElement('<em>Hello</em> world')
		const original = getCleanHTML(el)
		applySettle(el, original, {})
		removeSettle(el, original)
		expect(el.innerHTML).toBe(original)
	})

	it('preserves inline elements', () => {
		const el = makeElement('<em>italic</em> and <strong>bold</strong>')
		const original = getCleanHTML(el)
		applySettle(el, original, {})
		expect(el.querySelector('em')).toBeTruthy()
		expect(el.querySelector('strong')).toBeTruthy()
	})

	it('produces .settle-line spans after applySettle', () => {
		// 9 words → 3 simulated lines (3 words per BCR.top group)
		const el = makeElement('one two three four five six seven eight nine')
		const original = getCleanHTML(el)
		applySettle(el, original, {})
		const lines = el.querySelectorAll(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBeGreaterThan(0)
	})

	it('each .settle-line has a letter-spacing style set', () => {
		const el = makeElement('one two three four five six seven eight nine')
		const original = getCleanHTML(el)
		applySettle(el, original, {})
		const lines = el.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBeGreaterThan(0)
		lines.forEach((line) => {
			expect(line.style.letterSpacing).toBeTruthy()
		})
	})

	it('initial letter-spacing values are non-zero (random offsets applied)', () => {
		// Mock Math.random to always return 0.9 so offset = (0.9*2-1)*spread = 0.8*spread ≠ 0
		const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9)
		const el = makeElement('one two three four five six seven eight nine')
		const original = getCleanHTML(el)
		applySettle(el, original, { spread: 0.04 })
		const lines = el.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBeGreaterThan(0)
		lines.forEach((line) => {
			// Before the rAF fires, letter-spacing should be the non-zero initial offset
			expect(line.style.letterSpacing).not.toBe('0em')
			expect(line.style.letterSpacing).not.toBe('')
		})
		spy.mockRestore()
	})

	it('letter-spacing values are within ±spread range', () => {
		const spread = 0.04
		const el = makeElement('one two three four five six seven eight nine')
		const original = getCleanHTML(el)
		applySettle(el, original, { spread })
		const lines = el.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBeGreaterThan(0)
		lines.forEach((line) => {
			const value = parseFloat(line.style.letterSpacing)
			expect(Math.abs(value)).toBeLessThanOrEqual(spread + Number.EPSILON)
		})
	})

	it('stagger > 0 sets different transition-delay per line', () => {
		// Need at least 2 lines: use 6 words (groups of 3 per simulated line)
		const el = makeElement('one two three four five six')
		const original = getCleanHTML(el)
		applySettle(el, original, { stagger: 50 })
		const lines = el.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBeGreaterThanOrEqual(2)
		// The second line (index 1) should have transition-delay: 50ms
		const secondLine = lines[1]
		const style = secondLine.getAttribute('style') ?? ''
		expect(style).toContain('50ms')
	})

	it('stagger=0 (default) does not set non-zero transition delays', () => {
		const el = makeElement('one two three four five six')
		const original = getCleanHTML(el)
		applySettle(el, original, { stagger: 0 })
		const lines = el.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBeGreaterThan(0)
		lines.forEach((line) => {
			const style = line.getAttribute('style') ?? ''
			// Should not contain transition-delay at all, or only 0ms
			const hasNonZeroDelay = /transition-delay:\s*[1-9]/.test(style)
			expect(hasNonZeroDelay).toBe(false)
		})
	})

	it('getCleanHTML removes settle-line spans after applySettle', () => {
		const el = makeElement('one two three four five six seven eight nine')
		const original = getCleanHTML(el)
		applySettle(el, original, {})
		// After applying, there should be settle-line spans
		expect(el.querySelectorAll(`.${SETTLE_CLASSES.line}`).length).toBeGreaterThan(0)
		// getCleanHTML should strip them
		const cleaned = getCleanHTML(el)
		const tempEl = document.createElement('div')
		tempEl.innerHTML = cleaned
		expect(tempEl.querySelectorAll(`.${SETTLE_CLASSES.line}`).length).toBe(0)
	})

	it('spread:0 → all lines have letter-spacing of 0em', () => {
		const el = makeElement('one two three four five six seven eight nine')
		const original = getCleanHTML(el)
		applySettle(el, original, { spread: 0 })
		const lines = el.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBeGreaterThan(0)
		lines.forEach((line) => {
			expect(parseFloat(line.style.letterSpacing)).toBe(0)
		})
	})

	it('custom duration appears in the transition style', () => {
		const el = makeElement('one two three four five six seven eight nine')
		const original = getCleanHTML(el)
		applySettle(el, original, { duration: 1234 })
		const lines = el.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBeGreaterThan(0)
		const style = lines[0].getAttribute('style') ?? ''
		expect(style).toContain('1234ms')
	})

	it('custom easing appears in the transition style', () => {
		const el = makeElement('one two three four five six seven eight nine')
		const original = getCleanHTML(el)
		applySettle(el, original, { easing: 'linear' })
		const lines = el.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBeGreaterThan(0)
		const style = lines[0].getAttribute('style') ?? ''
		expect(style).toContain('linear')
	})

	it('transition style contains letter-spacing property', () => {
		const el = makeElement('one two three four five six seven eight nine')
		const original = getCleanHTML(el)
		applySettle(el, original, {})
		const lines = el.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBeGreaterThan(0)
		const style = lines[0].getAttribute('style') ?? ''
		expect(style).toContain('letter-spacing')
	})

	it('single word: exactly 1 line span produced', () => {
		const el = makeElement('Hello')
		const original = getCleanHTML(el)
		applySettle(el, original, {})
		const lines = el.querySelectorAll(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBe(1)
	})

	it('applying twice from same original gives same line count', () => {
		const el = makeElement('one two three four five six seven eight nine')
		const original = getCleanHTML(el)
		applySettle(el, original, {})
		const count1 = el.querySelectorAll(`.${SETTLE_CLASSES.line}`).length
		wordIndex = 0
		applySettle(el, original, {})
		const count2 = el.querySelectorAll(`.${SETTLE_CLASSES.line}`).length
		expect(count2).toBe(count1)
	})

	it('default duration (800ms) appears in transition style when not specified', () => {
		const el = makeElement('one two three four five six seven eight nine')
		const original = getCleanHTML(el)
		applySettle(el, original, {})
		const lines = el.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBeGreaterThan(0)
		const style = lines[0].getAttribute('style') ?? ''
		expect(style).toContain('800ms')
	})
})

// ─── Review fixes (2026-10) ──────────────────────────────────────────────────

import { replaySettle } from '../core/adjust'

describe('review fixes', () => {
	let cleanup: (() => void) | null = null
	beforeEach(() => { document.body.innerHTML = ''; cleanup = mockMeasurement() })
	afterEach(() => { cleanup?.(); cleanup = null; vi.restoreAllMocks() })

	it('keeps the spaces between elements, one link stays one link, getCleanHTML returns the input', () => {
		const html = '<em>alpha</em> <strong>beta</strong> gamma <a href="#x" id="L">delta</a> epsilon.'
		const el = makeElement(html)
		const text = el.textContent
		applySettle(el, html, {})
		expect(el.textContent).toBe(text)
		expect(el.querySelectorAll('#L').length).toBe(1)
		expect(getCleanHTML(el)).toBe(html)
	})

	it('ends every line at the settled spacing with a transition, synchronously', () => {
		const html = 'One two three four five six seven eight nine ten eleven twelve'
		const el = makeElement(html)
		applySettle(el, html, { duration: 500 })
		const lines = el.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`)
		expect(lines.length).toBeGreaterThan(0)
		lines.forEach((line) => {
			expect(line.style.transition).toContain('letter-spacing')
			expect(parseFloat(line.style.letterSpacing)).toBe(0)
		})
	})

	it('rejects an easing that would inject markup or other CSS', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		const html = 'One two three four five six seven'
		const el = makeElement(html)
		applySettle(el, html, { easing: 'ease"><img src=x onerror=alert(1)>' })
		expect(el.querySelectorAll('img').length).toBe(0)
		const line = el.querySelector<HTMLElement>(`.${SETTLE_CLASSES.line}`)!
		expect(line.style.transition).not.toContain('img')
	})

	it('replaySettle(el) with one argument replays the element instead of emptying it', () => {
		const html = 'One two three four five six seven'
		const el = makeElement(html)
		applySettle(el, html, {})
		replaySettle(el)
		expect(el.textContent).toBe(html)
		removeSettle(el)
		expect(el.innerHTML).toBe(html)
	})

	it('keeps the original elements, so their listeners survive a re-run', () => {
		const html = 'Please read <a href="#">our terms</a> carefully now.'
		const el = makeElement(html)
		const link = el.querySelector('a')!
		let clicks = 0
		link.addEventListener('click', (e) => { e.preventDefault(); clicks++ })
		applySettle(el, html, {})
		applySettle(el, html, {})
		el.querySelector('a')!.click()
		expect(clicks).toBe(1)
	})
})
