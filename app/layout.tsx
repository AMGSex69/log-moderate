import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/hooks/use-auth"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
	title: "Task Logger | Игровая система задач",
	description: "8-битная система управления задачами с геймификацией, очками и достижениями",
	generator: 'v0.dev',
	icons: {
		icon: [
			{
				url: '/icons/favicon-16.svg',
				sizes: '16x16',
				type: 'image/svg+xml',
			},
			{
				url: '/favicon.svg',
				sizes: '32x32',
				type: 'image/svg+xml',
			},
		],
		shortcut: '/favicon.svg',
		apple: '/favicon.svg',
	},
	manifest: '/manifest.json',
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="ru">
			<body className={inter.className}>
				<AuthProvider>{children}</AuthProvider>
			</body>
		</html>
	)
}
