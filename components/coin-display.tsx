"use client"

import { useState, useEffect } from "react"

interface CoinDisplayProps {
	coins: number
	animated?: boolean
}

export default function CoinDisplay({ coins, animated = false }: CoinDisplayProps) {
	const [displayCoins, setDisplayCoins] = useState(coins)
	const [isAnimating, setIsAnimating] = useState(false)

	useEffect(() => {
		if (animated && coins !== displayCoins) {
			setIsAnimating(true)
			const increment = coins > displayCoins ? 1 : -1
			const timer = setInterval(() => {
				setDisplayCoins((prev) => {
					if (prev === coins) {
						clearInterval(timer)
						setIsAnimating(false)
						return prev
					}
					return prev + increment
				})
			}, 50)
			return () => clearInterval(timer)
		} else {
			setDisplayCoins(coins)
		}
	}, [coins, displayCoins, animated])

	return (
		<div className={`flex items-center gap-2 ${isAnimating ? "animate-bounce" : ""}`}>
			{/* 8-битная анимированная монетка */}
			<div className="relative">
				<div className="w-8 h-8 relative animate-spin-slow">
					{/* Основа монеты */}
					<div className="absolute inset-0 bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 rounded-full border-2 border-yellow-800 shadow-lg">
						{/* Внутренний круг */}
						<div className="absolute inset-1 bg-gradient-to-br from-yellow-200 to-yellow-400 rounded-full border border-yellow-700">
							{/* Центральный символ */}
							<div className="absolute inset-0 flex items-center justify-center">
								<span className="text-xs font-black text-yellow-900 font-mono">₽</span>
							</div>
						</div>
						{/* Блики */}
						<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-100 rounded-full opacity-60"></div>
						<div className="absolute bottom-1 right-1 w-1 h-1 bg-yellow-200 rounded-full opacity-40"></div>
					</div>
				</div>

				{/* Анимация подбрасывания при изменении */}
				{isAnimating && (
					<div className="absolute inset-0 animate-ping">
						<div className="w-8 h-8 bg-yellow-400 rounded-full opacity-25"></div>
					</div>
				)}
			</div>
			<span className="font-bold text-xl font-mono text-yellow-600">{displayCoins.toLocaleString()}</span>
		</div>
	)
}
