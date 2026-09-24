"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { SettleText } from "@overpunch/typsettle"

const PARAGRAPHS = [
	`The first thing a reader notices about a text is not the words but the colour — the even grey field of the paragraph taken as a whole. Before meaning, before syntax, there is that impression: light, dark, dense, airy. The typographer works to make it even, to give the reader a surface to move across without resistance. A page-load animation that begins in chaos and resolves into order says something about the text it introduces: that it knows where it is going.`,
	`Tracking — the spacing between letters across a whole word or line — is the most delicate of the compositor's instruments. Too tight and letters close against each other; too loose and words fragment. The right amount is invisible.`,
]

function Slider({ label, value, min, max, step, onChange, title }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; title?: string }) {
	/** Stable id for aria-describedby association between input and value readout */
	const valueId = `slider-val-${label.replace(/\s+/g, '-').toLowerCase()}`
	/** Display value rounded to avoid floating-point noise (e.g. 0.035000000000000003) */
	const displayValue = Number.isInteger(step) ? value : parseFloat(value.toPrecision(4))
	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs uppercase tracking-[0.18em] font-medium text-muted">{label}</span>
			<input type="range" min={min} max={max} step={step} value={value} aria-label={label} aria-describedby={valueId} title={title} onChange={e => onChange(Number(e.target.value))} onTouchStart={e => e.stopPropagation()} style={{ touchAction: 'none' }} />
			<span id={valueId} className="tabular-nums text-xs text-muted text-right" aria-live="polite">{displayValue}</span>
		</div>
	)
}

/** Before/after toggle — left half = without effect, right half filled = with effect */
function BeforeAfterToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
	return (
		<button
			onClick={onClick}
			aria-label="Toggle before/after comparison"
			aria-pressed={active}
			title={active ? 'Hide comparison' : 'Compare without effect'}
			style={{
				position: 'absolute', bottom: 0, right: 0,
				width: 32, height: 32, borderRadius: '50%',
				border: '1px solid currentColor',
				opacity: active ? 0.8 : 0.25,
				background: 'transparent',
				display: 'flex', alignItems: 'center', justifyContent: 'center',
				cursor: 'pointer', transition: 'opacity 0.15s ease',
				outline: 'none',
			}}
			onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--foreground)' }}
			onBlur={e => { e.currentTarget.style.boxShadow = 'none' }}
		>
			<svg aria-hidden="true" width="14" height="10" viewBox="0 0 14 10" fill="none">
				<rect x="0.5" y="0.5" width="13" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
				<line x1="7" y1="0.5" x2="7" y2="9.5" stroke="currentColor" strokeWidth="1"/>
				<rect x="8" y="1.5" width="5" height="7" fill="currentColor"/>
			</svg>
		</button>
	)
}

const EASING_OPTIONS = [
	{ label: 'ease', value: 'ease' },
	{ label: 'ease-out', value: 'ease-out' },
	{ label: 'ease-in-out', value: 'ease-in-out' },
	{ label: 'linear', value: 'linear' },
] as const

type EasingOption = typeof EASING_OPTIONS[number]['value']

export default function Demo() {
	const [spread, setSpread] = useState(0.04)
	const [duration, setDuration] = useState(800)
	const [stagger, setStagger] = useState(80)
	const [easing, setEasing] = useState<EasingOption>('ease')
	const [direction, setDirection] = useState<'expand' | 'compress'>('expand')
	const [key, setKey] = useState(0)
	const [beforeAfter, setComparing] = useState(false)

	// No useDeferredValue — SettleText only applies CSS transitions; the prop
	// update is cheap and deferred values caused a double-animate on preset clicks
	// (old deferred values fired one render before new ones caught up).

	const replay = useCallback(() => setKey(k => k + 1), [])

	/** Tracks whether the first intersection has already fired (initial mount view) */
	const hasPlayedRef = useRef(false)
	/** Timestamp of the last intersection-triggered replay, for cooldown guard */
	const lastReplayTimeRef = useRef(0)
	const containerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const el = containerRef.current
		if (!el || typeof IntersectionObserver === 'undefined') return
		const COOLDOWN_MS = 1200
		const io = new IntersectionObserver(entries => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					if (hasPlayedRef.current) {
						const now = Date.now()
						if (now - lastReplayTimeRef.current > COOLDOWN_MS) {
							lastReplayTimeRef.current = now
							replay()
						}
					} else {
						hasPlayedRef.current = true
					}
				}
			}
		}, { threshold: 0.3 })
		io.observe(el)
		return () => io.disconnect()
	}, [replay])

	/** Memoised style object — referentially stable to prevent unnecessary SettleText re-runs */
	const sampleStyle = useMemo<React.CSSProperties>(() => ({
		fontFamily: "var(--font-merriweather), serif",
		fontSize: "1.125rem",
		lineHeight: "1.8",
		fontVariationSettings: '"wght" 300, "opsz" 18, "wdth" 100',
	}), [])

	/** Stabilised toggle callback */
	const handleToggleCompare = useCallback(() => setComparing(v => !v), [])

	return (
		<div className="w-full">
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
				<Slider label="Spread" value={spread} min={0.005} max={0.12} step={0.005} onChange={setSpread} title="Maximum letter-spacing offset lines start from before settling — higher = more dramatic entrance" />
				<Slider label="Duration (ms)" value={duration} min={200} max={2000} step={50} onChange={setDuration} title="How long each line takes to transition to its settled position, in milliseconds" />
				<Slider label="Stagger (ms)" value={stagger} min={0} max={300} step={10} onChange={setStagger} title="Delay between each line's animation start — 0 = all lines settle together, higher = sequential wave" />
			</div>
			<div className="flex flex-wrap items-center gap-3 mb-4">
				<span className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Easing</span>
				{EASING_OPTIONS.map(({ label, value }) => (
					<button key={value} onClick={() => { setEasing(value); replay() }} aria-pressed={easing === value} title={`Use the ${label} acceleration curve for the settling transition`} className="text-xs px-3 py-1 rounded-full border transition-opacity" style={{ borderColor: 'currentColor', opacity: easing === value ? 1 : 0.5, background: easing === value ? 'var(--btn-bg)' : 'transparent' }}>{label}</button>
				))}
				<span className="text-xs uppercase tracking-[0.18em] font-medium text-muted ml-4">Direction</span>
				{(['expand', 'compress'] as const).map(v => (
					<button key={v} onClick={() => { setDirection(v); replay() }} aria-pressed={direction === v} title={v === 'expand' ? 'Lines start wide (tracked out) and settle inward to normal spacing' : 'Lines start tight (tracked in) and open outward to normal spacing'} className="text-xs px-3 py-1 rounded-full border transition-opacity" style={{ borderColor: 'currentColor', opacity: direction === v ? 1 : 0.5, background: direction === v ? 'var(--btn-bg)' : 'transparent' }}>{v}</button>
				))}
			</div>
			<div className="flex items-center gap-3 flex-wrap mb-8">
				<button
					onClick={() => { setSpread(0.01); setDuration(1500); setStagger(100); setEasing('ease-out'); replay() }}
					aria-label="Subtle preset: set spread 0.01, duration 1500ms, stagger 100ms, easing ease-out, and replay"
					title="Low spread, slow duration, generous stagger — a barely-there entrance that feels natural in body text"
					className="text-xs px-4 py-1.5 rounded-full border transition-opacity hover:opacity-100"
					style={{ borderColor: 'currentColor', opacity: 0.5, background: 'var(--btn-bg)' }}
				>
					Subtle
				</button>
				<button
					onClick={() => { setSpread(0.08); setDuration(350); setStagger(15); setEasing('ease'); replay() }}
					aria-label="Dramatic preset: set spread 0.08, duration 350ms, stagger 15ms, easing ease, and replay"
					title="High spread, fast duration, tight stagger — a bold simultaneous snap that commands attention"
					className="text-xs px-4 py-1.5 rounded-full border transition-opacity hover:opacity-100"
					style={{ borderColor: 'currentColor', opacity: 0.5, background: 'var(--btn-bg)' }}
				>
					Dramatic
				</button>
				<button
					onClick={replay}
					aria-label="Play again — re-run the settle animation from the start"
					title="Re-run the settle animation from the start"
					className="text-xs px-4 py-1.5 rounded-full border transition-opacity hover:opacity-100"
					style={{ borderColor: 'currentColor', opacity: 0.7, background: 'var(--btn-bg)' }}
				>
					<span aria-hidden="true">↺</span> Play again
				</button>
			</div>
			<div ref={containerRef} className="relative pb-8">
				<div className="flex flex-col gap-8">
					{PARAGRAPHS.map((para, i) => (
						<SettleText key={`${key}-${i}`} spread={spread} duration={duration} stagger={stagger} easing={easing} direction={direction} style={sampleStyle}>
							{para}
						</SettleText>
					))}
				</div>
				{beforeAfter && (
					<div aria-hidden={true} style={{ position: 'absolute', top: 0, left: 0, width: '100%', opacity: 0.25, pointerEvents: 'none' }} className="flex flex-col gap-8">
						{PARAGRAPHS.map((para, i) => (
							<p key={i} style={{ ...sampleStyle, margin: 0 }}>{para}</p>
						))}
					</div>
				)}
				<BeforeAfterToggle active={beforeAfter} onClick={handleToggleCompare} />
			</div>
			<p className="text-xs text-muted italic mt-8" style={{ lineHeight: "1.8" }} aria-live="polite">Text enters from randomised tracking and settles to equilibrium. Each line is staggered by {stagger}ms.</p>
		</div>
	)
}
