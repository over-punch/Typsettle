import type { Metadata } from "next"
import "./globals.css"
import { Inter } from "next/font/google"
import SiteHeader from "../components/SiteHeader"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
	title: "Typsettle — Page-load text animation to optical equilibrium",
	icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
	description: "Typsettle animates paragraph text from randomised per-line letter-spacing to optical equilibrium on page load. A typographic entrance animation with stagger and replay support.",
	keywords: ["typsettle", "page load animation", "entrance animation", "letter spacing", "typography", "typesetting", "text animation", "variable font", "TypeScript", "npm", "react"],
	openGraph: {
		title: "Typsettle — Page-load text animation to optical equilibrium",
		description: "Paragraph text enters from randomised per-line letter-spacing and settles into place. Stagger, replay, intersection trigger, and density equalisation built in.",
		url: "https://typsettle.com",
		siteName: "Typsettle",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Typsettle — Page-load text animation to optical equilibrium",
		description: "Paragraph text enters from randomised per-line letter-spacing and settles into place. Stagger, replay, intersection trigger, and density equalisation built in.",
		site: "@liiift",
	},
	metadataBase: new URL("https://typsettle.com"),
	alternates: { canonical: "https://typsettle.com" },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`h-full antialiased ${inter.variable}`}>
			<body className="min-h-full flex flex-col">
				<SiteHeader current="typsettle" githubUrl="https://github.com/Liiift-Studio/Typsettle" />{children}</body>
		</html>
	)
}
