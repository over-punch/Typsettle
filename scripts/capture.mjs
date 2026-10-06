// scripts/capture.mjs — reproducible README visuals and measurements for typsettle, from the local build.
//
// Serves the repo over HTTP, renders scripts/capture.html in headless Chromium (the real
// applySettle from dist/core.js, with a seeded Math.random), then produces:
//   • assets/settle.gif        — the staggered settle; every CSS transition the library starts is
//                                paused and stepped with the Web Animations API, so frames are exact
//   • assets/hero-settled.png  — the same paragraph at rest
//   • assets/directions.png    — first frame of `expand` and `compress` against the settled text,
//                                with the column's right edge drawn in
// and prints the measurements quoted in the README (layout shift, height change, overshoot).
//
// Requires: ffmpeg on PATH and Playwright (resolved from this repo, or from the type-tools
// monorepo's axisRhythm checkout). Run: npm run build && npm run capture
// Optional: CAPTURE_PORT=5964 to pin the port (default: a free one).

import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, mkdir, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";

/** Loads Playwright from this repo, falling back to the sibling axisRhythm checkout in the monorepo. */
async function loadPlaywright() {
	try {
		return await import("playwright");
	} catch {
		const require = createRequire(new URL("../../axisRhythm/package.json", import.meta.url).pathname);
		return require("playwright");
	}
}
const { chromium } = await loadPlaywright();

const ROOT = process.cwd();
const FRAME_DIR = join(ROOT, "assets", ".frames");
/** Content types for the static server. */
const MIME = {
	".html": "text/html",
	".js": "application/javascript",
	".mjs": "application/javascript",
	".css": "text/css",
	".json": "application/json",
	".map": "application/json",
	".png": "image/png",
	".svg": "image/svg+xml",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

// --- Static file server rooted at the repo (serves /dist, /site, /scripts) ---
const server = createServer(async (req, res) => {
	try {
		const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
		const path = join(ROOT, url === "/" ? "/scripts/capture.html" : url);
		const data = await readFile(path);
		res.writeHead(200, { "Content-Type": MIME[extname(path)] ?? "application/octet-stream" });
		res.end(data);
	} catch {
		res.writeHead(404);
		res.end("not found");
	}
});

await new Promise((r) => server.listen(Number(process.env.CAPTURE_PORT) || 0, r));
const { port } = server.address();
const url = `http://localhost:${port}/scripts/capture.html`;

await rm(FRAME_DIR, { recursive: true, force: true });
await mkdir(FRAME_DIR, { recursive: true });

const browser = await chromium.launch();

/** Opens the capture page at 2x and waits for fonts. */
async function openPage() {
	const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1100, height: 900 } });
	await page.goto(url, { waitUntil: "networkidle" });
	await page.evaluate(() => window.__ready);
	await page.waitForTimeout(300);
	return page;
}

try {
	// --- 1. Measurements (real time, unpaused) ---
	{
		const page = await openPage();
		for (const opts of [
			{ spread: 0.04, duration: 800, stagger: 80 },
			{ spread: 0.04, duration: 800, stagger: 80, direction: "compress" },
		]) {
			const m = await page.evaluate((o) => window.__measure(o), opts);
			console.log("measure %j -> %j", opts, m);
		}
		await page.close();
	}

	// --- 2. Animation frames -> GIF ---
	{
		const FPS = 25;
		const TAIL_FRAMES = 25; // one second at rest before the loop restarts
		const page = await openPage();
		const card = await page.$("#hero");
		const info = await page.evaluate(() => window.__prepareHero());
		console.log("hero: %d lines, %d transitions, %d ms", info.lines, info.transitions, info.total);
		const motionFrames = Math.ceil((info.total / 1000) * FPS) + 1;
		let frame = 0;
		/** Saves the card as the next numbered frame. */
		const shoot = async () => {
			await card.screenshot({ path: join(FRAME_DIR, `f${String(frame++).padStart(4, "0")}.png`), omitBackground: true });
		};
		for (let i = 0; i < 8; i++) await shoot(); // a beat on the start state
		for (let i = 0; i < motionFrames; i++) {
			await page.evaluate((ms) => window.__seekHero(ms), Math.min(info.total, (i * 1000) / FPS));
			await shoot();
		}
		for (let i = 0; i < TAIL_FRAMES; i++) await shoot();
		await card.screenshot({ path: "assets/hero-settled.png", omitBackground: true });
		console.log("captured %d frames and assets/hero-settled.png", frame);
		await page.close();

		const palette = join(FRAME_DIR, "palette.png");
		const vf = `fps=${FPS},scale=680:-1:flags=lanczos`;
		const gen = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(FRAME_DIR, "f%04d.png"), "-vf", vf + ",palettegen=max_colors=16:stats_mode=full", "-frames:v", "1", "-update", "1", palette], { stdio: "inherit" });
		if (gen.status !== 0) throw new Error("Ffmpeg palettegen failed");
		const out = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(FRAME_DIR, "f%04d.png"), "-i", palette, "-lavfi", vf + " [x]; [x][1:v] paletteuse=dither=none:diff_mode=rectangle", "-loop", "0", "assets/settle.gif"], { stdio: "inherit" });
		if (out.status !== 0) throw new Error("Ffmpeg GIF assembly failed");
		console.log("assembled assets/settle.gif");
	}

	// --- 3. Direction comparison still ---
	{
		const page = await openPage();
		const info = await page.evaluate(() => window.__prepareCompare());
		console.log("directions: %j", info);
		await page.waitForTimeout(100);
		await (await page.$("#compare")).screenshot({ path: "assets/directions.png", omitBackground: true });
		console.log("captured assets/directions.png");
		await page.close();
	}
} finally {
	await browser.close();
	server.close();
	await rm(FRAME_DIR, { recursive: true, force: true });
}
console.log("done");
