"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import PixelButton from "./pixel-button"
import PixelCard from "./pixel-card"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Pause, Play, Coffee } from "lucide-react"

interface BreakControlsProps {
	onBreakStart: () => void
	onBreakEnd: () => void
	isOnBreak: boolean
	isWorking: boolean
}

export default function BreakControls({ onBreakStart, onBreakEnd, isOnBreak, isWorking }: BreakControlsProps) {
	const { user } = useAuth()
	const { toast } = useToast()
	const [breakStartTime, setBreakStartTime] = useState<Date | null>(null)

	useEffect(() => { }, [])

	const handleBreakStart = async () => {
		if (!user) return

		if (!isWorking) {
			toast({
				title: "Не на работе",
				description: "Обед можно начать только в рабочее время",
				variant: "destructive",
			})
			return
		}

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) throw new Error("Employee not found")

			// Записываем начало перерыва
			const { error } = await supabase.from("break_logs").insert({
				employee_id: employeeId,
				break_type: "lunch",
				start_time: new Date().toISOString(),
				date: new Date().toISOString().split("T")[0],
			})

			if (error) throw error

			setBreakStartTime(new Date())
			onBreakStart()

			toast({
				title: "🍽️ Обед начат",
				description: "Все активные задачи приостановлены",
			})
		} catch (error) {
			console.error("Ошибка начала перерыва:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось начать перерыв",
				variant: "destructive",
			})
		}
	}

	const handleBreakEnd = async () => {
		if (!user) return

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) throw new Error("Employee not found")

			// Обновляем запись перерыва
			const { error } = await supabase
				.from("break_logs")
				.update({ end_time: new Date().toISOString() })
				.eq("employee_id", employeeId)
				.eq("date", new Date().toISOString().split("T")[0])
				.is("end_time", null)

			if (error) throw error

			setBreakStartTime(null)
			onBreakEnd()

			toast({
				title: "🎯 Обед завершен",
				description: "Можно продолжать работу",
			})
		} catch (error) {
			console.error("Ошибка завершения перерыва:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось завершить перерыв",
				variant: "destructive",
			})
		}
	}

	const formatDuration = (startTime: Date) => {
		const now = new Date()
		const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000 / 60)
		return `${diff} мин`
	}

	return (
		<div className="space-y-4">
			{/* Статус перерыва */}
			{isOnBreak && breakStartTime && (
				<div className="bg-orange-300 border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
					<div className="font-mono text-xs text-black text-center font-black uppercase">
						🍽️ ОБЕД: {formatDuration(breakStartTime)}
					</div>
				</div>
			)}

			{/* Кнопки управления обедом */}
			{!isOnBreak ? (
				<button
					onClick={handleBreakStart}
					disabled={!isWorking}
					className={`
						w-full font-mono font-black uppercase tracking-wider text-sm
						${isWorking
							? 'bg-orange-400 hover:bg-orange-500 text-black'
							: 'bg-gray-300 text-gray-500 cursor-not-allowed'
						}
						border-4 border-black rounded-none
						shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
						${isWorking ? 'hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]' : ''}
						transition-all duration-100
						p-3
						flex items-center justify-center gap-2
					`}
				>
					<span className="text-lg">🍽️</span>
					{isWorking ? "НАЧАТЬ ОБЕД" : "НЕДОСТУПНО"}
				</button>
			) : (
				<button
					onClick={handleBreakEnd}
					className="
						w-full font-mono font-black text-white uppercase tracking-wider text-sm
						bg-gray-600 hover:bg-gray-700 
						border-4 border-black rounded-none
						shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
						hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
						hover:translate-x-[2px] hover:translate-y-[2px]
						transition-all duration-100
						p-3
						flex items-center justify-center gap-2
					"
				>
					<span className="text-lg">⏹️</span>
					ЗАВЕРШИТЬ ОБЕД
				</button>
			)}
		</div>
	)
}
