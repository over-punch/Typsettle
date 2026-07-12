import Demo from "@/components/Demo"
import CopyInstall from "@/components/CopyInstall"
import CodeBlock from "@/components/CodeBlock"
import ToolDirectory from "@/components/ToolDirectory"
import { version } from "../../../package.json"
import { version as siteVersion } from "../../package.json"
import SiteFooter from "../components/SiteFooter"
import PortsSection from "../components/PortsSection"
import { MagnetChar } from "@liiift-studio/magnettype"

export default function Home() {
	return (
		<main className="flex flex-col items-center px-6 py-20 gap-24">

			{/* Hero */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<p className="text-xs uppercase tracking-[0.18em] font-medium text-muted">typsettle</p>
					<h1 className="text-4xl lg:text-8xl xl:text-9xl" style={{ fontFamily: "var(--font-merriweather), serif", fontVariationSettings: '"wght" 300, "opsz" 144', lineHeight: "1.05em" }}>
						<MagnetChar as="span" minWeight={300} maxWeight={800} spreadRadius={220} fixedAxes={{ opsz: 144 }}>Settle,</MagnetChar><br />
						<MagnetChar as="span" minWeight={300} maxWeight={800} spreadRadius={220} fixedAxes={{ opsz: 144 }} style={{ color: "var(--foreground-subtle)", fontStyle: "italic" }}>into place.</MagnetChar>
					</h1>
				</div>
				<div className="flex items-center gap-4">
					<CopyInstall />
					<a
						href="https://github.com/Liiift-Studio/Typsettle"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="Typsettle on GitHub (opens in new tab)"
						className="text-sm text-muted hover:text-foreground transition-colors"
					>
						GitHub ↗
					</a>
				</div>
				<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted tracking-wide">
					<span>TypeScript</span>
					<span aria-hidden="true">·</span>
					<span>Zero dependencies</span>
					<span aria-hidden="true">·</span>
					<span>React + Vanilla JS</span>
				</div>
				<p className="text-base leading-relaxed max-w-lg">
					Paragraph text enters from randomised letter-spacing and transitions to optical equilibrium. A page-load animation that feels typographic rather than decorative — lines staggered, motion purposeful. Respects prefers-reduced-motion and the active option.
				</p>
			</section>

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
						<p>Each line of text starts with a randomised letter-spacing offset — some wider, some tighter. The offset is unique per line, creating a sense of subtle chaos that reads as typographic texture rather than noise.</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-base">The resolution</p>
						<p>A CSS transition carries each line to its natural letter-spacing baseline — the element&apos;s existing CSS tracking, if any, or zero if none is set. The stagger control spaces these transitions apart so lines settle in sequence rather than all at once.</p>
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
						<CodeBlock code={`import { SettleText } from '@liiift-studio/typsettle'

<SettleText spread={0.04} duration={800} stagger={80}>
  Your paragraph text here...
</SettleText>`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="text-muted">Hook</p>
						<CodeBlock code={`import { useSettle } from '@liiift-studio/typsettle'

const { ref, replay } = useSettle({ spread: 0.04, duration: 800, stagger: 80 })
return <p ref={ref}>{children}</p>`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="text-muted">Vanilla JS</p>
						<CodeBlock code={`import { applySettle, removeSettle, replaySettle, getCleanHTML } from '@liiift-studio/typsettle'

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
							<tbody className="text-muted">
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">spread</td><td className="py-2 pr-6">0.04</td><td className="py-2">Max initial letter-spacing offset in em.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">duration</td><td className="py-2 pr-6">800</td><td className="py-2">Transition duration in milliseconds.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">easing</td><td className="py-2 pr-6 font-mono text-xs">&apos;cubic-bezier(0.25, 0.1, 0.25, 1)&apos;</td><td className="py-2">CSS easing string.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">stagger</td><td className="py-2 pr-6">0</td><td className="py-2">Delay between lines in ms. 0 = all settle together.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">active</td><td className="py-2 pr-6">true</td><td className="py-2">Set false to skip animation entirely.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">targetTracking</td><td className="py-2 pr-6">—</td><td className="py-2">Letter-spacing each line settles to, in em. When omitted, lines settle to 0em (the element&apos;s natural spacing). Pass a number for a consistent loose or tight equilibrium. &apos;auto&apos; measures per-line optical density and adjusts each line&apos;s target to equalise density across the paragraph — dense lines get more tracking, sparse lines less, clamped to ±0.05em.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">direction</td><td className="py-2 pr-6">&apos;expand&apos;</td><td className="py-2">&apos;expand&apos; — lines start wide and ease to natural. &apos;compress&apos; — lines start at zero tracking and ease outward.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">intersect</td><td className="py-2 pr-6">false</td><td className="py-2">When true, re-runs the animation each time the element scrolls into view.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">quietReplay</td><td className="py-2 pr-6">false</td><td className="py-2">When true, replays stagger each line individually (offset then settle) instead of flashing all lines simultaneously. Has no effect when stagger is 0.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">lineDetection</td><td className="py-2 pr-6">&apos;bcr&apos;</td><td className="py-2">&apos;bcr&apos; reads actual browser layout — ground truth, works with any font and inline HTML. &apos;canvas&apos; uses <a href="https://github.com/chenglou/pretext" className="underline">@chenglou/pretext</a> for arithmetic line breaking with no forced reflow on resize. Install pretext separately.</td></tr>
							</tbody>
						</table>
					</div>
				</div>
			</section>

			<PortsSection
				npm="@liiift-studio/typsettle"
				bundle="typsettle"
				attr="data-typsettle" figma="frozen"
				framerComponent="Typsettle"
				repo="Liiift-Studio/Typsettle"
			/>

			<SiteFooter current="typsettle" npmVersion={version} siteVersion={siteVersion} />

		</main>
	)
}
