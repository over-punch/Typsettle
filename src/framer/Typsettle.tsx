// typsettle/src/framer/Typsettle.tsx — Framer code component wrapping the typsettle core.
//
// Distribution: paste this file into Framer (Insert → Code → New Component), or host it as an
// ES module and add it by URL. It imports the framework-agnostic core straight from the CDN, so
// it needs no build step — the core functions take a DOM element, not React, so there is no
// React version/externalisation issue.
//
// typsettle is an APPLY-ONCE entrance animation: applySettle wraps each visual line in a span
// whose letter-spacing starts at a random offset and eases (via a CSS transition) to optical
// equilibrium. There is no rAF loop — the animation is driven entirely by CSS. Because line
// detection reads the live layout (getBoundingClientRect line grouping depends on container
// width), we re-run applySettle on width changes, exactly as the proven `useSettle` hook does.
//
// The rendering logic mirrors `useSettle` (getCleanHTML snapshot, applySettle in an effect,
// ResizeObserver re-run, optional intersect replay); the only Framer-specific additions are the
// property controls, RenderTarget gating, and layout annotations.
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
// Pin to a published version so shared instances stay stable. Bump when the core changes.
// The core is framework-agnostic (operates on a DOM element), so no React externalisation is needed.
import { applySettle, removeSettle, replaySettle, getCleanHTML } from "https://esm.sh/@liiift-studio/typsettle@1.0.21"

/** Props surfaced to the Framer UI via addPropertyControls, plus base text styling.
 *  Option fields are declared explicitly so the component needs no type import over HTTP. */
interface TypsettleFramerProps {
	/** The paragraph text to settle. Multi-line content shows the effect best. */
	text: string
	/** CSS font-family for the paragraph. Any font works — the effect animates tracking, not an axis. */
	fontFamily: string
	/** Font size in px. */
	fontSize: number
	/** Line height (unitless multiplier). */
	lineHeight: number
	/** Text colour. */
	color: string
	/** Horizontal text alignment. */
	textAlign: "left" | "center" | "right"
	/** Line detection method: 'bcr' (layout ground truth) or 'canvas' (needs @chenglou/pretext). */
	lineDetection: "bcr" | "canvas"
	/** Max initial letter-spacing offset in em. */
	spread: number
	/** Animation duration in ms. */
	duration: number
	/** CSS easing string (e.g. cubic-bezier(...) or ease-out). */
	easing: string
	/** Delay between lines in ms; 0 settles all lines together. */
	stagger: number
	/** Animation direction: 'expand' (start wide, ease in) or 'compress' (start tight, ease out). */
	direction: "expand" | "compress"
	/** Target tracking mode: 'natural' (settle to base), 'value' (explicit em), 'auto' (density-equalised). */
	trackingMode: "natural" | "value" | "auto"
	/** Explicit target letter-spacing in em, used only when trackingMode is 'value'. */
	trackingValue: number
	/** Re-run the animation each time the element scrolls into view. */
	intersect: boolean
	/** When false, skip the animation and render the settled (plain) paragraph. */
	active: boolean
}

/**
 * Per-line tracking settle entrance animation, as a Framer code component.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 */
export default function Typsettle(props: Partial<TypsettleFramerProps>) {
	const {
		text = "Typography that settles into place, line by line, as if a compositor were tuning the paragraph in real time.",
		fontFamily = "Fraunces",
		fontSize = 32,
		lineHeight = 1.4,
		color = "#111111",
		textAlign = "left",
		lineDetection = "bcr",
		spread = 0.06,
		duration = 1000,
		easing = "cubic-bezier(0.25, 0.1, 0.25, 1)",
		stagger = 90,
		direction = "expand",
		trackingMode = "natural",
		trackingValue = 0,
		intersect = false,
		active = true,
	} = props

	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const el = ref.current
		if (!el) return

		// Snapshot the pristine markup before typsettle wraps it in line/word spans.
		const original = getCleanHTML(el)

		// Animate on the live site and on the editing canvas (so the designer sees the settle);
		// render a single settled frame on export / thumbnails where an entrance loop is undesirable.
		const target = RenderTarget.current()
		const animate = active && (target === RenderTarget.preview || target === RenderTarget.canvas)

		if (!animate) {
			// Static: show the settled (clean) paragraph with no offset/transition.
			el.innerHTML = original
			return () => {
				el.innerHTML = original
			}
		}

		// Fold the tracking-mode enum + numeric value back into the core's number | 'auto' union.
		const targetTracking =
			trackingMode === "auto" ? "auto" : trackingMode === "value" ? trackingValue : undefined

		const options = {
			lineDetection,
			spread,
			duration,
			easing,
			stagger,
			direction,
			targetTracking,
			intersect,
			active: true,
		}

		// Apply once, then re-run whenever the container width changes — line grouping is
		// layout-dependent, so a resize must recompute which words fall on which line.
		const runSettle = () => applySettle(el, original, options)
		runSettle()

		let ro: ResizeObserver | undefined
		if (typeof ResizeObserver !== "undefined") {
			let lastWidth = 0
			let rafId = 0
			ro = new ResizeObserver((entries) => {
				const w = Math.round(entries[0].contentRect.width)
				if (w === lastWidth) return
				lastWidth = w
				cancelAnimationFrame(rafId)
				rafId = requestAnimationFrame(runSettle)
			})
			ro.observe(el)
		}

		// Optional: replay the settle each time the element re-enters the viewport,
		// mirroring the useSettle hook's IntersectionObserver behaviour.
		let io: IntersectionObserver | undefined
		let cancelReplay: (() => void) | null = null
		let hasSettledOnce = true
		if (intersect && typeof IntersectionObserver !== "undefined") {
			io = new IntersectionObserver((entries) => {
				if (!entries[0].isIntersecting) return
				if (hasSettledOnce) {
					cancelReplay?.()
					cancelReplay = replaySettle(el, original, options)
				} else {
					runSettle()
					hasSettledOnce = true
				}
			})
			io.observe(el)
		}

		return () => {
			ro?.disconnect()
			io?.disconnect()
			cancelReplay?.()
			removeSettle(el, original)
		}
	}, [
		text,
		lineDetection,
		spread,
		duration,
		easing,
		stagger,
		direction,
		trackingMode,
		trackingValue,
		intersect,
		active,
	])

	return (
		<div
			ref={ref}
			style={{
				fontFamily,
				fontSize,
				lineHeight,
				color,
				textAlign,
				width: "100%",
			}}
		>
			{text}
		</div>
	)
}

// Map every meaningful SettleOptions field to a Framer control.
// Omitted: `quietReplay` (only affects replaySettle's stagger flash — not surfaced here);
// the core's element/HTML arguments and the returned cancel function are runtime plumbing,
// not user options.
addPropertyControls(Typsettle, {
	text: {
		type: ControlType.String,
		title: "Text",
		defaultValue:
			"Typography that settles into place, line by line, as if a compositor were tuning the paragraph in real time.",
		displayTextArea: true,
	},
	fontFamily: {
		type: ControlType.String,
		title: "Font",
		defaultValue: "Fraunces",
		description: "Any font works — the effect animates letter-spacing, not a font axis.",
	},
	fontSize: { type: ControlType.Number, title: "Size", defaultValue: 32, min: 8, max: 200, unit: "px" },
	lineHeight: { type: ControlType.Number, title: "Line height", defaultValue: 1.4, min: 0.8, max: 3, step: 0.05 },
	color: { type: ControlType.Color, title: "Colour", defaultValue: "#111111" },
	textAlign: {
		type: ControlType.Enum,
		title: "Align",
		options: ["left", "center", "right"],
		optionTitles: ["Left", "Center", "Right"],
		defaultValue: "left",
		displaySegmentedControl: true,
	},
	lineDetection: {
		type: ControlType.Enum,
		title: "Line detect",
		options: ["bcr", "canvas"],
		optionTitles: ["Layout (BCR)", "Canvas"],
		defaultValue: "bcr",
		description: "Canvas mode needs @chenglou/pretext; falls back to BCR when unavailable.",
	},
	spread: {
		type: ControlType.Number,
		title: "Spread",
		defaultValue: 0.06,
		min: 0,
		max: 0.3,
		step: 0.005,
		unit: "em",
		description: "Max initial random tracking offset per line.",
	},
	duration: { type: ControlType.Number, title: "Duration", defaultValue: 1000, min: 0, max: 5000, step: 50, unit: "ms" },
	easing: {
		type: ControlType.String,
		title: "Easing",
		defaultValue: "cubic-bezier(0.25, 0.1, 0.25, 1)",
		description: "Any CSS easing string.",
	},
	stagger: {
		type: ControlType.Number,
		title: "Stagger",
		defaultValue: 90,
		min: 0,
		max: 600,
		step: 10,
		unit: "ms",
		description: "Delay between lines; 0 settles all lines together.",
	},
	direction: {
		type: ControlType.Enum,
		title: "Direction",
		options: ["expand", "compress"],
		optionTitles: ["Expand", "Compress"],
		defaultValue: "expand",
	},
	trackingMode: {
		type: ControlType.Enum,
		title: "Settle to",
		options: ["natural", "value", "auto"],
		optionTitles: ["Natural", "Value", "Auto density"],
		defaultValue: "natural",
		description: "Auto equalises optical density across lines.",
	},
	trackingValue: {
		type: ControlType.Number,
		title: "Track value",
		defaultValue: 0,
		min: -0.1,
		max: 0.1,
		step: 0.005,
		unit: "em",
		hidden: (p: Partial<TypsettleFramerProps>) => p.trackingMode !== "value",
	},
	intersect: { type: ControlType.Boolean, title: "On scroll", defaultValue: false, enabledTitle: "Replay", disabledTitle: "Once" },
	active: { type: ControlType.Boolean, title: "Active", defaultValue: true, enabledTitle: "On", disabledTitle: "Off" },
})
