"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Play, Square } from "lucide-react"
import type { TaskType } from "@/lib/supabase"
import { useActiveSessions } from "@/hooks/use-active-sessions"

interface TaskCardProps {
	taskType: TaskType
	isActive: boolean
	onStart: () => void
	onStop: () => void
	currentTime?: string
}

const taskIcons: Record<string, string> = {
	"Решения МЖИ": "📋",
	"Протоколы МЖИ": "📄",
	Обзвоны: "📞",
	Обходы: "🚶‍♂️",
	"Развeshивание плакатов": "📋",
	Актуализация: "🔄",
	Протоколы: "📝",
	Отчёты: "📊",
	Опросы: "❓",
	"Юридически значимые опросы": "⚖️",
	"Модерация ОСС": "🏢",
	"Модерация чатов": "💬",
	АСГУФ: "🖥️",
	"Задачи руководства": "👔",
	"Особые задачи": "⭐",
}

export default function TaskCard({ taskType, isActive, onStart, onStop, currentTime }: TaskCardProps) {
	const formatDuration = (minutes: number) => {
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
	}

	return (
		<div className="relative h-full">
			{/* Пиксельная карточка */}
			<div
				className={`
					h-full flex flex-col relative
					border-4 border-black rounded-none
					transition-all duration-100
					hover:translate-x-[1px] hover:translate-y-[1px] 
					hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
					${isActive
						? "bg-green-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
						: "bg-gray-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
					}
				`}
			>
				{/* Декоративные пиксели в углах */}
				<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
				<div className="absolute top-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>

				<div className="p-4 flex flex-col h-full">
					{/* Заголовок */}
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center gap-3">
							{/* Иконка в пиксельной рамке */}
							<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								<span className="text-xl">{taskIcons[taskType.name] || "📋"}</span>
							</div>
							<div>
								<h3 className="font-mono font-black text-base text-black uppercase tracking-wide drop-shadow-sm">
									{taskType.name}
								</h3>
								<p className="font-mono text-sm text-black font-semibold mt-1">
									{taskType.description}
								</p>
							</div>
						</div>

						{/* Статус бейдж */}
						{isActive && (
							<div className="bg-red-400 border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								<span className="font-mono text-sm font-black text-black">АКТИВНО</span>
							</div>
						)}
					</div>

					{/* Контейнер для динамического контента */}
					<div className="flex-1 space-y-3">
						{isActive && currentTime && (
							<div className="bg-black border-2 border-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								<div className="flex items-center gap-2">
									<Clock className="h-5 w-5 text-green-400" />
									<span className="font-mono text-xl font-black text-green-400 drop-shadow-sm">
										{currentTime}
									</span>
								</div>
							</div>
						)}
					</div>

					{/* Кнопка в пиксельном стиле */}
					<div className="mt-4">
						{!isActive ? (
							<Button
								onClick={onStart}
								className="
									w-full font-mono font-black text-black uppercase tracking-wider text-base
									bg-green-300 hover:bg-green-400 
									border-4 border-black rounded-none
									shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
									hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
									hover:translate-x-[2px] hover:translate-y-[2px]
									transition-all duration-100
								"
								size="lg"
							>
								<Play className="h-5 w-5 mr-2" />
								НАЧАТЬ
							</Button>
						) : (
							<Button
								onClick={onStop}
								className="
									w-full font-mono font-black text-white uppercase tracking-wider text-base
									bg-red-500 hover:bg-red-600 
									border-4 border-black rounded-none
									shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
									hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
									hover:translate-x-[2px] hover:translate-y-[2px]
									transition-all duration-100
								"
								size="lg"
							>
								<Square className="h-5 w-5 mr-2" />
								ЗАВЕРШИТЬ
							</Button>
						)}
					</div>
				</div>

				{/* Нижние декоративные пиксели */}
				<div className="absolute bottom-1 left-1 w-2 h-2 bg-red-400 border border-black"></div>
				<div className="absolute bottom-1 right-1 w-2 h-2 bg-green-400 border border-black"></div>
			</div>

			{/* Дополнительная тень для глубины */}
			<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
		</div>
	)
}
