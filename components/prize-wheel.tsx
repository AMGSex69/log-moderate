"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Gift, Sparkles, X } from "lucide-react"
import PixelCard from "./pixel-card"
import PixelButton from "./pixel-button"

export interface Prize {
	id: string
	name: string
	description: string
	icon: string
	rarity: "common" | "rare" | "epic" | "legendary"
	weight: number // Вес для определения вероятности
	color: string
}

const PRIZES: Prize[] = [
	// Обычные призы (70% шанс) - шуточные и неформальные
	{
		id: "coffee_boss",
		name: "Кофе от босса",
		description: "Начальник лично принесет кофе",
		icon: "☕",
		rarity: "common",
		weight: 18,
		color: "#8B4513",
	},
	{
		id: "compliment",
		name: "Комплимент",
		description: "Искренний комплимент от коллеги",
		icon: "😊",
		rarity: "common",
		weight: 16,
		color: "#FFB6C1",
	},
	{
		id: "meme",
		name: "Мем дня",
		description: "Персональный мем в корпоративном чате",
		icon: "😂",
		rarity: "common",
		weight: 15,
		color: "#98FB98",
	},
	{
		id: "playlist",
		name: "Плейлист",
		description: "Твоя музыка в офисе на час",
		icon: "🎵",
		rarity: "common",
		weight: 12,
		color: "#DDA0DD",
	},
	{
		id: "snack_delivery",
		name: "Доставка печенек",
		description: "Коллега принесет печеньки к столу",
		icon: "🍪",
		rarity: "common",
		weight: 9,
		color: "#F4A460",
	},

	// Редкие призы (22% шанс) - тоже шуточные но чуть лучше
	{
		id: "lunch_choice",
		name: "Выбор обеда",
		description: "Ты решаешь что заказывать на обед команде",
		icon: "🍕",
		rarity: "rare",
		weight: 7,
		color: "#FF6347",
	},
	{
		id: "parking_king",
		name: "Король парковки",
		description: "Лучшее место на парковке на неделю",
		icon: "👑",
		rarity: "rare",
		weight: 5,
		color: "#FFD700",
	},
	{
		id: "meeting_skip",
		name: "Пропуск совещания",
		description: "Можешь пропустить одно скучное совещание",
		icon: "🏃‍♂️",
		rarity: "rare",
		weight: 4,
		color: "#32CD32",
	},
	{
		id: "office_dj",
		name: "Офисный DJ",
		description: "Контроль над музыкой в офисе на день",
		icon: "🎧",
		rarity: "rare",
		weight: 3,
		color: "#9370DB",
	},
	{
		id: "dress_code_free",
		name: "Свободный дресс-код",
		description: "Можешь прийти в чем угодно на неделю",
		icon: "👕",
		rarity: "rare",
		weight: 3,
		color: "#20B2AA",
	},

	// Эпические призы (2.5% шанс) - очень крутые
	{
		id: "free_lunch",
		name: "Бесплатный обед",
		description: "Обед за счет компании в хорошем ресторане",
		icon: "🍽️",
		rarity: "epic",
		weight: 1.5,
		color: "#FF4500",
	},
	{
		id: "power_nap",
		name: "Час сна",
		description: "Официальный час сна на рабочем месте",
		icon: "😴",
		rarity: "epic",
		weight: 1,
		color: "#8A2BE2",
	},

	// Легендарный приз (0.5% шанс) - серьезный
	{
		id: "day_off",
		name: "Выходной день",
		description: "Дополнительный оплачиваемый выходной",
		icon: "🏖️",
		rarity: "legendary",
		weight: 0.5,
		color: "#FF1493",
	},
]

interface PrizeWheelProps {
	currentCoins?: number
	isOpen?: boolean
	onClose: () => void
	onPrizeWon?: (prize: Prize) => void
	onCoinsSpent?: (amount: number) => void
}

export default function PrizeWheel({ currentCoins, isOpen = true, onClose, onPrizeWon, onCoinsSpent }: PrizeWheelProps) {
	const [isSpinning, setIsSpinning] = useState(false)
	const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null)
	const [rotation, setRotation] = useState(0)
	const wheelRef = useRef<HTMLDivElement>(null)

	const totalWeight = PRIZES.reduce((sum, prize) => sum + prize.weight, 0)
	const segmentAngle = 360 / PRIZES.length

	const selectRandomPrize = (): Prize => {
		const random = Math.random() * totalWeight
		let currentWeight = 0

		for (const prize of PRIZES) {
			currentWeight += prize.weight
			if (random <= currentWeight) {
				return prize
			}
		}

		return PRIZES[0] // Fallback
	}

	const spinWheel = () => {
		if (isSpinning) return

		setIsSpinning(true)
		setSelectedPrize(null)

		const prize = selectRandomPrize()
		const prizeIndex = PRIZES.findIndex((p) => p.id === prize.id)

		// Рассчитываем угол для остановки на выбранном призе
		const targetAngle = 360 - prizeIndex * segmentAngle - segmentAngle / 2
		const spins = 5 + Math.random() * 3 // 5-8 полных оборотов
		const finalRotation = rotation + spins * 360 + targetAngle

		setRotation(finalRotation)

		// Анимация завершается через 4 секунды
		setTimeout(() => {
			setSelectedPrize(prize)
			setIsSpinning(false)
			onPrizeWon?.(prize)
			// НЕ закрываем автоматически!
		}, 4000)
	}

	const getRarityColor = (rarity: string) => {
		switch (rarity) {
			case "common":
				return "from-gray-400 to-gray-600"
			case "rare":
				return "from-blue-400 to-blue-600"
			case "epic":
				return "from-purple-400 to-purple-600"
			case "legendary":
				return "from-yellow-400 to-yellow-600"
			default:
				return "from-gray-400 to-gray-600"
		}
	}

	const handleBackdropClick = (e: React.MouseEvent) => {
		// НЕ закрываем при клике на фон
		e.stopPropagation()
	}

	const handleModalClick = (e: React.MouseEvent) => {
		e.stopPropagation()
	}

	if (!isOpen) return null

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
			<PixelCard className="w-full max-w-4xl relative">
				<div onClick={handleModalClick}>
					{/* Кнопка закрытия */}
					<button
						onClick={onClose}
						className="absolute top-4 right-4 z-20 p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
					>
						<X className="h-5 w-5" />
					</button>

					<div className="p-8 text-center">
						<div className="flex items-center justify-center gap-2 mb-8">
							<Gift className="h-8 w-8 text-yellow-500" />
							<h2 className="text-3xl font-bold">🎰 Колесо Фортуны</h2>
							<Sparkles className="h-8 w-8 text-yellow-500" />
						</div>

						<div className="relative w-96 h-96 mx-auto mb-8">
							{/* Красивая стрелка с 3D эффектом */}
							<div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-6 z-20">
								<div className="relative">
									{/* Тень стрелки */}
									<div
										className="absolute top-2 left-2 opacity-30"
										style={{
											width: 0,
											height: 0,
											borderLeft: "12px solid transparent",
											borderRight: "12px solid transparent",
											borderBottom: "24px solid #000000",
										}}
									></div>

									{/* Основная стрелка - темно-красная */}
									<div
										className="relative"
										style={{
											width: 0,
											height: 0,
											borderLeft: "12px solid transparent",
											borderRight: "12px solid transparent",
											borderBottom: "24px solid #DC2626",
										}}
									></div>

									{/* Блик на стрелке - светло-красный */}
									<div
										className="absolute top-1 left-1/2 transform -translate-x-1/2"
										style={{
											width: 0,
											height: 0,
											borderLeft: "4px solid transparent",
											borderRight: "4px solid transparent",
											borderBottom: "8px solid #FCA5A5",
										}}
									></div>

									{/* Белый блик для 3D эффекта */}
									<div
										className="absolute top-0.5 left-1/2 transform -translate-x-1/2"
										style={{
											width: 0,
											height: 0,
											borderLeft: "2px solid transparent",
											borderRight: "2px solid transparent",
											borderBottom: "4px solid #FFFFFF",
										}}
									></div>
								</div>
							</div>

							{/* Колесо */}
							<div
								ref={wheelRef}
								className="w-full h-full rounded-full border-8 border-yellow-500 relative overflow-hidden shadow-2xl"
								style={{
									transform: `rotate(${rotation}deg)`,
									transition: isSpinning ? "transform 4s cubic-bezier(0.23, 1, 0.32, 1)" : "none",
								}}
							>
								{PRIZES.map((prize, index) => {
									const angle = index * segmentAngle

									return (
										<div
											key={prize.id}
											className="absolute w-full h-full"
											style={{
												transform: `rotate(${angle}deg)`,
												clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.sin((segmentAngle * Math.PI) / 180)}% ${50 - 50 * Math.cos((segmentAngle * Math.PI) / 180)}%)`,
											}}
										>
											<div
												className={`w-full h-full bg-gradient-to-r ${getRarityColor(prize.rarity)} border-r border-white/30`}
												style={{ backgroundColor: prize.color }}
											>
												{/* Убираем все иконки и текст - только цветные сегменты */}
											</div>
										</div>
									)
								})}
							</div>

							{/* Центральная кнопка */}
							<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
								<PixelButton
									onClick={spinWheel}
									disabled={isSpinning}
									className="w-20 h-20 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold shadow-lg"
								>
									<span className="text-2xl">{isSpinning ? "🎲" : "🎯"}</span>
								</PixelButton>
							</div>
						</div>

						{/* Результат */}
						{selectedPrize && (
							<div className="mb-8 p-6 bg-gradient-to-r from-green-100 to-green-200 rounded-lg border-2 border-green-300 shadow-lg">
								<div className="text-6xl mb-4">{selectedPrize.icon}</div>
								<h3 className="text-2xl font-bold text-green-800 mb-2">{selectedPrize.name}</h3>
								<p className="text-green-700 text-lg mb-3">{selectedPrize.description}</p>
								<div
									className={`inline-block px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r ${getRarityColor(selectedPrize.rarity)} text-white`}
								>
									{selectedPrize.rarity.toUpperCase()}
								</div>
							</div>
						)}

						{/* Кнопки */}
						<div className="flex gap-6 justify-center">
							{!selectedPrize && (
								<PixelButton onClick={spinWheel} disabled={isSpinning} variant="success" className="px-10 py-4 text-lg">
									{isSpinning ? "Крутится..." : "Крутить колесо! 🎰"}
								</PixelButton>
							)}

							{selectedPrize && (
								<PixelButton onClick={spinWheel} disabled={isSpinning} variant="success" className="px-10 py-4 text-lg">
									Крутить еще раз! 🎰
								</PixelButton>
							)}

							<PixelButton onClick={onClose} variant="secondary" className="px-8 py-4">
								Закрыть
							</PixelButton>
						</div>

						{/* Легенда редкости */}
						<div className="mt-8 text-sm text-gray-600">
							<div className="flex justify-center gap-6 flex-wrap">
								<span className="flex items-center gap-2">
									<div className="w-4 h-4 bg-gradient-to-r from-gray-400 to-gray-600 rounded"></div>
									Обычный (70%)
								</span>
								<span className="flex items-center gap-2">
									<div className="w-4 h-4 bg-gradient-to-r from-blue-400 to-blue-600 rounded"></div>
									Редкий (22%)
								</span>
								<span className="flex items-center gap-2">
									<div className="w-4 h-4 bg-gradient-to-r from-purple-400 to-purple-600 rounded"></div>
									Эпический (2.5%)
								</span>
								<span className="flex items-center gap-2">
									<div className="w-4 h-4 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded"></div>
									Легендарный (0.5%)
								</span>
							</div>
						</div>
					</div>
				</div>
			</PixelCard>
		</div>
	)
}
