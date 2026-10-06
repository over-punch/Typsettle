// settle/src/react/useSettle.ts — React hook: runs the settle animation on mount, on width changes and
// after fonts load, replays on scroll-into-view when `intersect` is set.
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { applySettle, getCleanHTML, replaySettle } from '../core/adjust'
import type { SettleOptions } from '../core/types'

/** Options for useSettle (the core options; `active: false` shows the original content). */
export interface UseSettleOptions extends SettleOptions {
	active?: boolean
}

/**
 * React hook that applies the settle animation to a ref'd element.
 *
 * @param options    - SettleOptions
 * @param contentKey - A value that changes when the element's content changes (SettleText derives one
 *                     from its children). The library rebuilds the element's DOM, so new content
 *                     needs a fresh element and a fresh snapshot.
 * @returns            `ref` to attach, and `replay()` to run the animation again
 */
export function useSettle(options: UseSettleOptions = {}, contentKey?: string) {
	const ref = useRef<HTMLElement>(null)
	const originalHTMLRef = useRef<string | null>(null)
	/** The element originalHTMLRef was read from; a new element is read afresh. */
	const sourceElRef = useRef<HTMLElement | null>(null)
	const optionsRef = useRef(options)
	optionsRef.current = options
	const hasSettledOnce = useRef(false)
	const cancelReplayRef = useRef<(() => void) | null>(null)

	// Every option is a dependency (serialised, so an inline object doesn't re-run every render).
	const optionsKey = JSON.stringify(options)
	const { intersect } = options

	/** The element's original markup, read once per element. */
	const snapshot = (el: HTMLElement): string => {
		if (originalHTMLRef.current === null || sourceElRef.current !== el) {
			originalHTMLRef.current = getCleanHTML(el)
			sourceElRef.current = el
		}
		return originalHTMLRef.current
	}

	const run = useCallback(() => {
		const el = ref.current
		if (!el) return
		applySettle(el, snapshot(el), optionsRef.current)
		hasSettledOnce.current = true
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [optionsKey, contentKey])

	const replay = useCallback(() => {
		const el = ref.current
		if (!el) return
		cancelReplayRef.current?.()
		cancelReplayRef.current = replaySettle(el, snapshot(el), optionsRef.current)
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => () => { cancelReplayRef.current?.() }, [])

	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		// With `intersect`, the first run waits until the element scrolls into view.
		if (!intersect) run()
		if (typeof ResizeObserver === 'undefined') return

		// Start from the current width, so the observer's first report doesn't rebuild again.
		let lastWidth = Math.round(el.getBoundingClientRect().width)
		let rafId = 0
		const ro = new ResizeObserver((entries) => {
			if (!entries.length) return
			const w = Math.round(entries[0].contentRect.width)
			if (w === lastWidth) return
			lastWidth = w
			cancelAnimationFrame(rafId)
			rafId = requestAnimationFrame(run)
		})
		ro.observe(el)
		return () => {
			ro.disconnect()
			cancelAnimationFrame(rafId)
		}
	}, [run, intersect])

	// Re-run once fonts finish loading (measurements before the swap use the fallback font); not when
	// they are already loaded, which would rebuild the element a second time on mount.
	useEffect(() => {
		if (typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded') return
		let cancelled = false
		document.fonts.ready.then(() => { if (!cancelled) run() }).catch(() => {})
		return () => { cancelled = true }
	}, [run])

	useEffect(() => {
		if (!intersect || typeof IntersectionObserver === 'undefined') return
		const el = ref.current
		if (!el) return
		const io = new IntersectionObserver((entries) => {
			if (!entries[entries.length - 1].isIntersecting) return
			if (hasSettledOnce.current) replay()
			else run()
		})
		io.observe(el)
		return () => io.disconnect()
	}, [intersect, run, replay])

	return { ref, replay }
}
