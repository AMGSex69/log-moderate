"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase, type TaskType } from "@/lib/supabase"
import PixelCard from "./pixel-card"
import { GAME_CONFIG } from "@/lib/game-config"
import UserProfileModal from "./user-profile-modal"
import { useUserProfileModal } from "@/hooks/use-user-profile-modal"

interface LeaderboardEntry {
	employee_id: string
	user_id?: string
	full_name: string
	total_units: number
	total_time: number
	total_tasks: number
	total_coins: number
	work_days: number
	avg_time_per_unit: number
}

export default function Leaderboard() {
	const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
	const [selectedTask, setSelectedTask] = useState<string>("all")
	const [timeframe, setTimeframe] = useState<string>("all")
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
	const [loading, setLoading] = useState(true)
	const { userId, isOpen, showFullStats, openProfile, closeProfile } = useUserProfileModal()

	useEffect(() => {
		fetchTaskTypes()
	}, [])

	useEffect(() => {
		fetchLeaderboard()
	}, [selectedTask, timeframe])

	const fetchTaskTypes = async () => {
		try {
			const { data, error } = await supabase.from("task_types").select("*").order("name")
			if (error) throw error
			setTaskTypes(data || [])
		} catch (error) {
			console.error("Ошибка загрузки типов задач:", error)
		}
	}

	const fetchLeaderboard = async () => {
		setLoading(true)
		try {
			let query = supabase
				.from("task_logs")
				.select(
					"employee_id, units_completed, time_spent_minutes, task_type_id, employees(full_name, user_id, offices(name)), task_types(name)",
				)
				.eq("employees.offices.name", "Рассвет")

			// Фильтр по времени
			if (timeframe !== "all") {
				const days = timeframe === "week" ? 7 : timeframe === "month" ? 30 : timeframe === "quarter" ? 90 : 1
				const startDate = new Date()
				startDate.setDate(startDate.getDate() - days)
				query = query.gte("work_date", startDate.toISOString().split("T")[0])
			}

			// Фильтр по типу задачи
			if (selectedTask !== "all") {
				query = query.eq("task_type_id", Number.parseInt(selectedTask))
			}

			const { data, error } = await query

			if (error) {
				console.error("❌ Ошибка запроса лидерборда:", error)
				throw error
			}

			console.log("📊 Данные лидерборда:", data?.length, "записей")

			// Группируем по сотрудникам со всей статистикой
			const statsMap = new Map<string, LeaderboardEntry>()

			// Сначала собираем уникальные даты для подсчета рабочих дней
			const employeeWorkDays = new Map<string, Set<string>>()

			data?.forEach((log: any) => {
				const employeeId = log.employee_id
				const workDate = log.work_date

				// Добавляем дату в набор рабочих дней сотрудника
				if (!employeeWorkDays.has(employeeId)) {
					employeeWorkDays.set(employeeId, new Set())
				}
				employeeWorkDays.get(employeeId)?.add(workDate)

				const existing = statsMap.get(employeeId) || {
					employee_id: employeeId,
					user_id: log.employees.user_id,
					full_name: log.employees.full_name,
					total_units: 0,
					total_time: 0,
					total_tasks: 0,
					total_coins: 0,
					work_days: 0,
					avg_time_per_unit: 0,
				}

				existing.total_tasks += 1
				existing.total_time += log.time_spent_minutes
				existing.total_units += log.units_completed
				existing.work_days = employeeWorkDays.get(employeeId)?.size || 0

				// Рассчитываем монеты по конфигурации
				const taskName = log.task_types.name
				const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
				existing.total_coins += log.units_completed * coinsPerUnit

				statsMap.set(employeeId, existing)
			})

			// Показываем только сотрудников с выполненными задачами
			console.log("📈 Сотрудников с задачами:", statsMap.size)

			// Рассчитываем среднее время и сортируем
			const sortedStats = Array.from(statsMap.values())
				.map((stat) => ({
					...stat,
					avg_time_per_unit: stat.total_units > 0 ? Math.round(stat.total_time / stat.total_units) : 0,
				}))
				.filter((stat) => stat.total_tasks > 0) // Показываем только тех, кто работал
				.sort((a, b) => b.total_time - a.total_time) // Сортируем по часам работы

			setLeaderboard(sortedStats)
			console.log("✅ Лидерборд установлен:", sortedStats.length, "сотрудников")
			console.log("🔍 Первые 3:", sortedStats.slice(0, 3))
		} catch (error) {
			console.error("Ошибка загрузки лидерборда:", error)
		} finally {
			setLoading(false)
		}
	}

	const getRankIcon = (index: number) => {
		switch (index) {
			case 0:
				return "🥇"
			case 1:
				return "🥈"
			case 2:
				return "🥉"
			default:
				return `#${index + 1}`
		}
	}

	const getRankColor = (index: number) => {
		switch (index) {
			case 0:
				return "from-yellow-200 to-yellow-300 border-yellow-500"
			case 1:
				return "from-gray-200 to-gray-300 border-gray-500"
			case 2:
				return "from-orange-200 to-orange-300 border-orange-500"
			default:
				return "from-blue-100 to-purple-100 border-black"
		}
	}

	return (
		<PixelCard>
			<div className="p-6">
				<div className="flex items-center gap-2 mb-6">
					<span className="text-2xl">🏆</span>
					<h2 className="text-2xl font-bold">Лидерборд офиса</h2>
					<div className="text-sm text-muted-foreground ml-2">
						Полная статистика всех сотрудников
					</div>
				</div>

				<div className="flex gap-4 mb-6">
					<Select value={timeframe} onValueChange={setTimeframe}>
						<SelectTrigger className="w-40 border-2 border-black">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="week">За неделю</SelectItem>
							<SelectItem value="month">За месяц</SelectItem>
							<SelectItem value="quarter">За квартал</SelectItem>
							<SelectItem value="all">За все время</SelectItem>
						</SelectContent>
					</Select>

					<Select value={selectedTask} onValueChange={setSelectedTask}>
						<SelectTrigger className="w-60 border-2 border-black">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Все задачи</SelectItem>
							{taskTypes.map((task) => (
								<SelectItem key={task.id} value={task.id.toString()}>
									{task.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-3">
					{loading ? (
						<div className="text-center py-8">
							<div className="text-4xl animate-spin">⚡</div>
							<div className="mt-2">Загрузка рейтинга...</div>
						</div>
					) : leaderboard.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<div className="text-4xl mb-2">😴</div>
							<div>Нет данных за выбранный период</div>
						</div>
					) : (
						leaderboard.map((entry, index) => (
							<PixelCard
								key={entry.employee_id}
								className={`bg-gradient-to-r ${getRankColor(index)}`}
								glowing={index === 0}
							>
								<div className="p-4">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-4">
											<div className="text-2xl font-bold">{getRankIcon(index)}</div>
											<div
												className="cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
												onClick={() => entry.user_id && openProfile(entry.user_id, true)}
											>
												<div className="font-bold text-lg hover:text-blue-600 transition-colors">
													{entry.full_name} 👤
												</div>
												<div className="text-sm text-muted-foreground">
													{entry.total_tasks} задач • {Math.floor(entry.total_time / 60)}ч {entry.total_time % 60}м
												</div>
											</div>
										</div>

										<div className="text-right">
											<div className="flex items-center gap-2 mb-1">
												<span className="text-xl">⏰</span>
												<span className="font-bold text-xl text-blue-600">{Math.floor(entry.total_time / 60)}ч {entry.total_time % 60}м</span>
											</div>
											<div className="text-sm text-muted-foreground">{entry.work_days} дней • {entry.total_units} единиц</div>
										</div>
									</div>
								</div>
							</PixelCard>
						))
					)}
				</div>
			</div>

			{/* Модальное окно профиля пользователя */}
			<UserProfileModal
				userId={userId}
				isOpen={isOpen}
				onClose={closeProfile}
				showFullStats={showFullStats}
			/>
		</PixelCard>
	)
}
