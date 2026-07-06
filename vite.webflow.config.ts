// vite.webflow.config.ts — standalone minified IIFE bundle for Webflow Custom Code Embed.
// Produces a single self-contained browser global (window.Typsettle) with no module loader,
// no React, and no external dependencies — droppable into a Webflow embed via one <script> tag.
import { defineConfig } from 'vite'

export default defineConfig({
	build: {
		// Do not wipe dist/ — the library build (vite.config.ts) writes index.js/.cjs there too.
		emptyOutDir: false,
		lib: {
			entry: 'src/webflow/embed.ts',
			formats: ['iife'],
			// Exposes the module's exports (init, restart, destroy) as window.Typsettle.
			name: 'Typsettle',
			fileName: () => 'typsettle.webflow.min.js',
		},
		rollupOptions: {
			// The core's optional `import('@chenglou/pretext')` (canvas lineDetection) must not
			// be inlined — the embed defaults to BCR detection and the core catches its absence,
			// so bundling pretext would add tens of kB of dead weight to the embed.
			external: ['@chenglou/pretext'],
		},
		minify: true,
	},
})
