import Demo from "@/components/Demo"
import Hero from "@/components/Hero"
import CodeBlock from "@/components/CodeBlock"
import { version } from "../../../package.json"
import { version as siteVersion } from "../../package.json"
import SiteFooter from "../components/SiteFooter"
import PortsSection from "../components/PortsSection"

export default function Home() {
	return (
		<main className="flex flex-col items-center px-6 py-20 gap-24">

			{/* Hero */}
			<Hero
				eyebrow="letter-spacing settling"
				title={[{ text: "Settle," }, { text: "into place.", italic: true, subtle: true }]}
				install="@overpunch/typsettle"
				github="https://github.com/over-punch/Typsettle"
				tech={["TypeScript", "Zero dependencies", "React + Vanilla JS"]}
			>
				<p className="text-base leading-relaxed max-w-lg">
					Paragraph text enters from randomised letter-spacing and transitions to optical equilibrium. A page-load animation that feels typographic rather than decorative — lines staggered, motion purposeful. Nothing animates under prefers-reduced-motion, on slow-refresh screens, or with active set to false.
				</p>
			</Hero>

			{/* Demo */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-4">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Live demo</h2>
				<div className="rounded-xl -mx-8 px-8 py-8" style={{ background: "var(--panel)", overflow: 'hidden' }}>
					<Demo />
				</div>
			</section>

			{/* Explanation */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">How it works</h2>
				<div className="prose-grid grid grid-cols-1 sm:grid-cols-2 gap-12 text-sm leading-relaxed">
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-base">The entrance</p>
						<p>Each line of text starts from its own random letter-spacing offset, up to the spread you set: looser than its settled spacing with the default &apos;expand&apos;, tighter with &apos;compress&apos;. The offset is different on every line, so the paragraph starts slightly uneven and reads as typographic texture rather than noise.</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-base">The resolution</p>
						<p>A CSS transition carries each line to its natural letter-spacing baseline — the element&apos;s existing CSS tracking, if any, or zero if none is set. The stagger control spaces these transitions apart so lines settle in sequence rather than all at once. Lines are locked as the browser set them, so nothing re-wraps and nothing below the text moves while it settles.</p>
					</div>
				</div>
			</section>

			{/* Usage */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex items-baseline gap-4">
					<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Usage</h2>
				</div>
				<div className="flex flex-col gap-8 text-sm">
					<div className="flex flex-col gap-3">
						<p className="text-muted">Drop-in component</p>
						<CodeBlock code={`import { SettleText } from '@overpunch/typsettle'

<SettleText spread={0.04} duration={800} stagger={80}>
  Your paragraph text here...
</SettleText>`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="text-muted">Hook</p>
						<CodeBlock code={`import { useSettle } from '@overpunch/typsettle'

const { ref, replay } = useSettle({ spread: 0.04, duration: 800, stagger: 80 })
return <p ref={ref}>{children}</p>`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="text-muted">Vanilla JS</p>
						<CodeBlock code={`import { applySettle, removeSettle, replaySettle, getCleanHTML } from '@overpunch/typsettle'

const el = document.querySelector('p')
const original = getCleanHTML(el)
applySettle(el, original, { spread: 0.04, duration: 800, stagger: 80 })

// Replay the animation on a settled element (e.g. on a button click):
// replaySettle(el)

// Restore original markup:
// removeSettle(el, original)`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="text-muted">Options</p>
						<table className="w-full text-xs">
							<caption className="sr-only">SettleText / useSettle / applySettle options reference</caption>
							<thead>
								<tr className="text-subtle text-left">
									<th scope="col" className="pb-2 pr-6 font-normal">Option</th>
									<th scope="col" className="pb-2 pr-6 font-normal">Default</th>
									<th scope="col" className="pb-2 font-normal">Description</th>
								</tr>
							</thead>
							<tbody className="text-muted zebra">
								<tr className="hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">spread</td><td className="py-2 pr-6">0.04</td><td className="py-2">Max initial letter-spacing offset in em.</td></tr>
								<tr className="hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">duration</td><td className="py-2 pr-6">800</td><td className="py-2">Transition duration in milliseconds.</td></tr>
								<tr className="hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">easing</td><td className="py-2 pr-6 font-mono text-xs">&apos;cubic-bezier(0.25, 0.1, 0.25, 1)&apos;</td><td className="py-2">CSS easing string.</td></tr>
								<tr className="hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">stagger</td><td className="py-2 pr-6">0</td><td className="py-2">Delay between lines in ms. 0 = all settle together.</td></tr>
								<tr className="hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">active</td><td className="py-2 pr-6">true</td><td className="py-2">Set false to skip animation entirely.</td></tr>
								<tr className="hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">targetTracking</td><td className="py-2 pr-6">0</td><td className="py-2">Extra letter-spacing (em) each line settles to, on top of the element&apos;s own. 0 = natural spacing. &apos;auto&apos; measures per-line optical density and evens it out: dense lines settle slightly looser, sparse lines slightly tighter, within ±0.05em. A positive amount is limited to the room each line has, so the settled text never overflows.</td></tr>
								<tr className="hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">direction</td><td className="py-2 pr-6">&apos;expand&apos;</td><td className="py-2">&apos;expand&apos; — each line starts looser (by up to spread) and settles in. &apos;compress&apos; — each line starts tighter (by up to spread) and settles out.</td></tr>
								<tr className="hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">intersect</td><td className="py-2 pr-6">false</td><td className="py-2">When true, re-runs the animation each time the element scrolls into view.</td></tr>
								<tr className="hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">quietReplay</td><td className="py-2 pr-6">false</td><td className="py-2">When true, a replay keeps the existing lines and offsets each one from its settled spacing, then eases back (staggered when stagger is set, all at once when it is 0), instead of rebuilding the element.</td></tr>
								<tr className="hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">lineDetection</td><td className="py-2 pr-6">&apos;bcr&apos;</td><td className="py-2">&apos;bcr&apos; reads actual browser layout — ground truth, works with any font and inline HTML. &apos;canvas&apos; uses <a href="https://github.com/chenglou/pretext" className="underline">@chenglou/pretext</a> for arithmetic line breaking with no forced reflow on resize. Install pretext separately.</td></tr>
							</tbody>
						</table>
					</div>
				</div>
			</section>

			<PortsSection
				npm="@overpunch/typsettle"
				bundle="typsettle"
				attr="data-typsettle" figma="frozen"
				framerComponent="Typsettle"
				repo="over-punch/Typsettle"
			/>

			<SiteFooter current="typsettle" npmVersion={version} siteVersion={siteVersion} />

		</main>
	)
}
