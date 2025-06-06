"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { GAME_CONFIG } from "@/lib/game-config"
import { formatDuration } from "@/lib/utils"
import PixelCard from "@/components/pixel-card"
import PixelButton from "@/components/pixel-button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, Target, TrendingUp, Activity } from "lucide-react"

interface DailyTaskData {
	date: string
	tasks: TaskEntry[]
	total_tasks: number
	total_units: number
	total_time: number
	total_coins: number
	unique_task_types: number
}

interface TaskEntry {
	id: number
	task_name: string
	units_completed: number
	time_spent_minutes: number
	notes?: string
	created_at: string
	coins_earned: number
}

interface DailyTaskStatsProps {
	userId: string
}

export default function DailyTaskStats({ userId }: DailyTaskStatsProps) {
	const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
	const [dailyData, setDailyData] = useState<DailyTaskData | null>(null)
	const [loading, setLoading] = useState(false)
	const [availableDates, setAvailableDates] = useState<string[]>([])

	// Получаем доступные даты для выбора
	useEffect(() => {
		if (userId) {
			fetchAvailableDates()
		}
	}, [userId])

	// Загружаем данные для выбранной даты
	useEffect(() => {
		if (userId && selectedDate) {
			fetchDailyData()
		}
	}, [userId, selectedDate])

	const fetchAvailableDates = async () => {
		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(userId)
			if (empError || !employeeId) return

			const { data, error } = await supabase
				.from("task_logs")
				.select("work_date")
				.eq("employee_id", employeeId)
				.order("work_date", { ascending: false })

			if (error) throw error

			const uniqueDates = [...new Set(data?.map(log => log.work_date) || [])]
			setAvailableDates(uniqueDates)

			// Если выбранной даты нет в доступных, выбираем последнюю
			if (uniqueDates.length > 0 && !uniqueDates.includes(selectedDate)) {
				setSelectedDate(uniqueDates[0])
			}

		} catch (error) {
			console.error("Ошибка загрузки доступных дат:", error)
		}
	}

	const fetchDailyData = async () => {
		try {
			setLoading(true)

			const { employeeId, error: empError } = await authService.getEmployeeId(userId)
			if (empError || !employeeId) {
				throw new Error("Employee not found")
			}

			const { data: logs, error } = await supabase
				.from("task_logs")
				.select(`
          id,
          units_completed,
          time_spent_minutes,
          notes,
          created_at,
          task_types!inner(name)
        `)
				.eq("employee_id", employeeId)
				.eq("work_date", selectedDate)
				.order("created_at", { ascending: false })

			if (error) throw error

			if (!logs || logs.length === 0) {
				setDailyData({
					date: selectedDate,
					tasks: [],
					total_tasks: 0,
					total_units: 0,
					total_time: 0,
					total_coins: 0,
					unique_task_types: 0
				})
				return
			}

			// Обрабатываем данные
			const tasks: TaskEntry[] = logs.map((log: any) => {
				const taskName = log.task_types.name
				const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
				const coinsEarned = log.units_completed * coinsPerUnit

				return {
					id: log.id,
					task_name: taskName,
					units_completed: log.units_completed,
					time_spent_minutes: log.time_spent_minutes,
					notes: log.notes,
					created_at: log.created_at,
					coins_earned: coinsEarned
				}
			})

			const totalTasks = tasks.length
			const totalUnits = tasks.reduce((sum, task) => sum + task.units_completed, 0)
			const totalTime = tasks.reduce((sum, task) => sum + task.time_spent_minutes, 0)
			const totalCoins = tasks.reduce((sum, task) => sum + task.coins_earned, 0)
			const uniqueTaskTypes = new Set(tasks.map(task => task.task_name)).size

			setDailyData({
				date: selectedDate,
				tasks,
				total_tasks: totalTasks,
				total_units: totalUnits,
				total_time: totalTime,
				total_coins: totalCoins,
				unique_task_types: uniqueTaskTypes
			})

		} catch (error) {
			console.error("Ошибка загрузки дневных данных:", error)
		} finally {
			setLoading(false)
		}
	}

	const getDateDisplay = (date: string) => {
		const dateObj = new Date(date)
		const today = new Date()
		const yesterday = new Date(today)
		yesterday.setDate(yesterday.getDate() - 1)

		if (date === today.toISOString().split('T')[0]) {
			return "Сегодня"
		} else if (date === yesterday.toISOString().split('T')[0]) {
			return "Вчера"
		} else {
			return dateObj.toLocaleDateString('ru-RU', {
				weekday: 'long',
				day: 'numeric',
				month: 'long'
			})
		}
	}

	const getQuickDateButtons = () => {
		const today = new Date().toISOString().split('T')[0]
		const yesterday = new Date()
		yesterday.setDate(yesterday.getDate() - 1)
		const yesterdayStr = yesterday.toISOString().split('T')[0]

		return [
			{ date: today, label: "Сегодня" },
			{ date: yesterdayStr, label: "Вчера" }
		].filter(btn => availableDates.includes(btn.date))
	}

	if (loading) {
		return (
			<PixelCard>
				<div className="p-8 text-center">
					<div className="text-4xl mb-4">📊</div>
					<div className="text-xl font-bold">Загрузка данных...</div>
				</div>
			</PixelCard>
		)
	}

	return (
		<div className="space-y-6">
			{/* Выбор даты */}
			<PixelCard>
				<div className="p-4">
					<h3 className="text-xl font-bold mb-4 flex items-center gap-2">
						<Calendar className="h-5 w-5" />
						Статистика по дням
					</h3>

					{/* Быстрые кнопки */}
					<div className="flex gap-2 mb-4">
						{getQuickDateButtons().map((btn) => (
							<PixelButton
								key={btn.date}
								variant={selectedDate === btn.date ? "primary" : "secondary"}
								size="sm"
								onClick={() => setSelectedDate(btn.date)}
							>
								{btn.label}
							</PixelButton>
						))}
					</div>

					{/* Выпадающий список дат */}
					<select
						value={selectedDate}
						onChange={(e) => setSelectedDate(e.target.value)}
						className="w-full p-2 border-2 border-black rounded bg-white"
					>
						{availableDates.map((date) => (
							<option key={date} value={date}>
								{getDateDisplay(date)} ({date})
							</option>
						))}
					</select>
				</div>
			</PixelCard>

			{/* Данные за выбранный день */}
			{dailyData && (
				<>
					{/* Общая статистика дня */}
					<PixelCard>
						<div className="p-6">
							<h4 className="text-lg font-bold mb-4">
								📅 {getDateDisplay(dailyData.date)}
							</h4>

							{dailyData.total_tasks === 0 ? (
								<div className="text-center py-8">
									<div className="text-4xl mb-2">😴</div>
									<div className="text-lg font-semibold">Нет данных за этот день</div>
									<div className="text-muted-foreground">В этот день задачи не выполнялись</div>
								</div>
							) : (
								<>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
										<div className="text-center">
											<div className="text-2xl font-bold text-blue-600">{dailyData.total_tasks}</div>
											<div className="text-sm text-muted-foreground">Задач выполнено</div>
										</div>
										<div className="text-center">
											<div className="text-2xl font-bold text-green-600">{dailyData.total_units}</div>
											<div className="text-sm text-muted-foreground">Единиц завершено</div>
										</div>
										<div className="text-center">
											<div className="text-xl font-bold text-orange-600">{formatDuration(dailyData.total_time)}</div>
											<div className="text-sm text-muted-foreground">Время работы</div>
										</div>
										<div className="text-center">
											<div className="text-2xl font-bold text-purple-600">{dailyData.total_coins}</div>
											<div className="text-sm text-muted-foreground">Очков заработано</div>
										</div>
									</div>

									<div className="flex items-center gap-4 text-sm text-muted-foreground">
										<span>🎯 {dailyData.unique_task_types} типов задач</span>
										<span>⏱️ Среднее время: {Math.round(dailyData.total_time / dailyData.total_tasks)} мин/задача</span>
									</div>
								</>
							)}
						</div>
					</PixelCard>

					{/* Список задач за день */}
					{dailyData.tasks.length > 0 && (
						<PixelCard>
							<div className="p-6">
								<h4 className="text-lg font-bold mb-4 flex items-center gap-2">
									<Activity className="h-5 w-5" />
									Выполненные задачи ({dailyData.tasks.length})
								</h4>

								<div className="space-y-3 max-h-96 overflow-y-auto">
									{dailyData.tasks.map((task) => (
										<div key={task.id} className="flex items-center justify-between p-4 bg-white border-2 border-gray-200 rounded">
											<div className="flex-1">
												<div className="font-semibold text-lg">{task.task_name}</div>
												<div className="text-sm text-muted-foreground flex items-center gap-4">
													<span>📊 {task.units_completed} ед.</span>
													<span>⏱️ {formatDuration(task.time_spent_minutes)}</span>
													<span>🕐 {new Date(task.created_at).toLocaleTimeString('ru-RU', {
														hour: '2-digit',
														minute: '2-digit'
													})}</span>
												</div>
												{task.notes && (
													<div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">
														💬 {task.notes}
													</div>
												)}
											</div>
											<div className="text-right">
												<div className="text-lg font-bold text-green-600">
													+{task.coins_earned} очков
												</div>
												<div className="text-xs text-muted-foreground">
													{Math.round(task.time_spent_minutes / task.units_completed)} мин/ед.
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						</PixelCard>
					)}
				</>
			)}
		</div>
	)
} 