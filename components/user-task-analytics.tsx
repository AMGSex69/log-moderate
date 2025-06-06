"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { GAME_CONFIG } from "@/lib/game-config"
import { formatDuration } from "@/lib/utils"
import PixelCard from "@/components/pixel-card"
import PixelButton from "@/components/pixel-button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
	BarChart3,
	Calendar,
	Clock,
	Target,
	TrendingUp,
	Award,
	ChevronDown,
	ChevronUp
} from "lucide-react"

interface UserTaskStats {
	task_name: string
	task_group: string
	total_count: number
	total_units: number
	total_time: number
	total_coins: number
	avg_time_per_unit: number
	percentage_of_work: number
	last_completed: string
	first_completed: string
	best_day_units: number
	best_day_date: string
	efficiency_score: number
}

interface DailyStats {
	date: string
	total_tasks: number
	total_units: number
	total_time: number
	total_coins: number
	unique_task_types: number
	most_productive_task: string
}

interface UserAnalytics {
	user_id: string
	total_tasks: number
	total_units: number
	total_time: number
	total_coins: number
	work_days: number
	avg_tasks_per_day: number
	avg_time_per_task: number
	most_productive_task: string
	favorite_task_group: string
	task_breakdown: UserTaskStats[]
	daily_breakdown: DailyStats[]
	period_start: string
	period_end: string
}

interface UserTaskAnalyticsProps {
	userId: string
}

export default function UserTaskAnalytics({ userId }: UserTaskAnalyticsProps) {
	const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
	const [loading, setLoading] = useState(true)
	const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
	const [expandedTask, setExpandedTask] = useState<string | null>(null)
	const [sortBy, setSortBy] = useState<'units' | 'time' | 'coins' | 'efficiency'>('units')

	const getTaskGroup = (taskName: string): string => {
		for (const [groupKey, groupData] of Object.entries(GAME_CONFIG.TASK_GROUPS)) {
			if (groupData.tasks.includes(taskName)) {
				return groupData.name
			}
		}
		return "Прочие"
	}

	const getDateRange = () => {
		const end = new Date()
		const start = new Date()

		switch (period) {
			case 'week':
				start.setDate(end.getDate() - 7)
				break
			case 'month':
				start.setDate(end.getDate() - 30)
				break
			case 'quarter':
				start.setDate(end.getDate() - 90)
				break
			case 'year':
				start.setDate(end.getDate() - 365)
				break
		}

		return {
			start: start.toISOString().split('T')[0],
			end: end.toISOString().split('T')[0]
		}
	}

	useEffect(() => {
		fetchUserAnalytics()
	}, [userId, period])

	const fetchUserAnalytics = async () => {
		if (!userId) return

		try {
			setLoading(true)
			const { start, end } = getDateRange()

			// Получаем employee_id пользователя
			const { employeeId, error: empError } = await authService.getEmployeeId(userId)
			if (empError || !employeeId) {
				throw new Error("Employee not found")
			}

			// Получаем все логи за период
			const { data: logs, error } = await supabase
				.from("task_logs")
				.select(`
          *,
          task_types!inner(name)
        `)
				.eq("employee_id", employeeId)
				.gte("work_date", start)
				.lte("work_date", end)
				.order("work_date", { ascending: false })

			if (error) throw error

			if (!logs || logs.length === 0) {
				setAnalytics({
					user_id: userId,
					total_tasks: 0,
					total_units: 0,
					total_time: 0,
					total_coins: 0,
					work_days: 0,
					avg_tasks_per_day: 0,
					avg_time_per_task: 0,
					most_productive_task: "Нет данных",
					favorite_task_group: "Нет данных",
					task_breakdown: [],
					daily_breakdown: [],
					period_start: start,
					period_end: end
				})
				return
			}

			// Анализируем данные
			const taskMap = new Map<string, UserTaskStats>()
			const dailyMap = new Map<string, DailyStats>()
			const groupMap = new Map<string, number>()

			let totalTasks = 0
			let totalUnits = 0
			let totalTime = 0
			let totalCoins = 0

			logs.forEach((log: any) => {
				const taskName = log.task_types.name
				const workDate = log.work_date
				const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
				const taskCoins = log.units_completed * coinsPerUnit
				const taskGroup = getTaskGroup(taskName)

				// Статистика по задачам
				const existing = taskMap.get(taskName) || {
					task_name: taskName,
					task_group: taskGroup,
					total_count: 0,
					total_units: 0,
					total_time: 0,
					total_coins: 0,
					avg_time_per_unit: 0,
					percentage_of_work: 0,
					last_completed: workDate,
					first_completed: workDate,
					best_day_units: 0,
					best_day_date: workDate,
					efficiency_score: 0
				}

				existing.total_count += 1
				existing.total_time += log.time_spent_minutes
				existing.total_units += log.units_completed
				existing.total_coins += taskCoins

				if (workDate > existing.last_completed) {
					existing.last_completed = workDate
				}
				if (workDate < existing.first_completed) {
					existing.first_completed = workDate
				}
				if (log.units_completed > existing.best_day_units) {
					existing.best_day_units = log.units_completed
					existing.best_day_date = workDate
				}

				taskMap.set(taskName, existing)

				// Группировка по группам задач
				groupMap.set(taskGroup, (groupMap.get(taskGroup) || 0) + log.units_completed)

				// Статистика по дням
				const dailyExisting = dailyMap.get(workDate) || {
					date: workDate,
					total_tasks: 0,
					total_units: 0,
					total_time: 0,
					total_coins: 0,
					unique_task_types: 0,
					most_productive_task: taskName
				}

				dailyExisting.total_tasks += 1
				dailyExisting.total_units += log.units_completed
				dailyExisting.total_time += log.time_spent_minutes
				dailyExisting.total_coins += taskCoins

				dailyMap.set(workDate, dailyExisting)

				totalTasks += 1
				totalUnits += log.units_completed
				totalTime += log.time_spent_minutes
				totalCoins += taskCoins
			})

			// Рассчитываем проценты и средние значения
			const taskBreakdown = Array.from(taskMap.values()).map((task) => {
				const avgTimePerUnit = task.total_units > 0 ? Math.round(task.total_time / task.total_units) : 0
				const expectedTimePerUnit = 30 // Примерное ожидаемое время
				const efficiencyScore = expectedTimePerUnit > 0 ? Math.max(0, 100 - ((avgTimePerUnit - expectedTimePerUnit) / expectedTimePerUnit) * 100) : 0

				return {
					...task,
					avg_time_per_unit: avgTimePerUnit,
					percentage_of_work: totalTime > 0 ? Math.round((task.total_time / totalTime) * 100) : 0,
					efficiency_score: Math.round(efficiencyScore)
				}
			})

			// Сортируем разбивку по задачам
			const sortedTaskBreakdown = taskBreakdown.sort((a, b) => {
				switch (sortBy) {
					case 'time':
						return b.total_time - a.total_time
					case 'coins':
						return b.total_coins - a.total_coins
					case 'efficiency':
						return b.efficiency_score - a.efficiency_score
					default:
						return b.total_units - a.total_units
				}
			})

			// Дополняем статистику по дням
			const dailyBreakdown = Array.from(dailyMap.values())
				.map((day) => {
					const dayTasks = logs.filter((log: any) => log.work_date === day.date)
					const taskTypes = new Set(dayTasks.map((log: any) => log.task_types.name))
					const mostProductiveTask = dayTasks.reduce((prev, current) =>
						current.units_completed > prev.units_completed ? current : prev
					).task_types.name

					return {
						...day,
						unique_task_types: taskTypes.size,
						most_productive_task: mostProductiveTask
					}
				})
				.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

			// Находим самую продуктивную задачу и любимую группу
			const mostProductiveTask = taskBreakdown.sort((a, b) => b.total_units - a.total_units)[0]?.task_name || "Нет данных"
			const favoriteTaskGroup = Array.from(groupMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Нет данных"

			// Рассчитываем количество рабочих дней
			const workDays = new Set(logs.map((log: any) => log.work_date)).size
			const avgTasksPerDay = workDays > 0 ? Math.round((totalTasks / workDays) * 10) / 10 : 0
			const avgTimePerTask = totalTasks > 0 ? Math.round(totalTime / totalTasks) : 0

			setAnalytics({
				user_id: userId,
				total_tasks: totalTasks,
				total_units: totalUnits,
				total_time: totalTime,
				total_coins: totalCoins,
				work_days: workDays,
				avg_tasks_per_day: avgTasksPerDay,
				avg_time_per_task: avgTimePerTask,
				most_productive_task: mostProductiveTask,
				favorite_task_group: favoriteTaskGroup,
				task_breakdown: sortedTaskBreakdown,
				daily_breakdown: dailyBreakdown,
				period_start: start,
				period_end: end
			})

		} catch (error) {
			console.error("Ошибка загрузки аналитики пользователя:", error)
		} finally {
			setLoading(false)
		}
	}

	const getPeriodText = () => {
		switch (period) {
			case 'week': return 'Неделя'
			case 'month': return 'Месяц'
			case 'quarter': return 'Квартал'
			case 'year': return 'Год'
		}
	}

	const getTaskGroupColor = (groupName: string) => {
		for (const [key, group] of Object.entries(GAME_CONFIG.TASK_GROUPS)) {
			if (group.name === groupName) {
				return group.color
			}
		}
		return '#6B7280'
	}

	if (loading) {
		return (
			<PixelCard>
				<div className="p-8 text-center">
					<div className="text-4xl mb-4">📊</div>
					<div className="text-xl font-bold">Анализ ваших задач...</div>
				</div>
			</PixelCard>
		)
	}

	if (!analytics) {
		return (
			<PixelCard>
				<div className="p-8 text-center">
					<div className="text-4xl mb-4">📭</div>
					<div className="text-xl font-bold">Нет данных для анализа</div>
					<div className="text-muted-foreground">Выполните несколько задач, чтобы увидеть статистику</div>
				</div>
			</PixelCard>
		)
	}

	return (
		<div className="space-y-6">
			{/* Фильтры периода */}
			<PixelCard>
				<div className="p-4">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-xl font-bold flex items-center gap-2">
							<BarChart3 className="h-5 w-5" />
							Детальная статистика по задачам
						</h3>
						<div className="flex gap-2">
							{(['week', 'month', 'quarter', 'year'] as const).map((p) => (
								<PixelButton
									key={p}
									variant={period === p ? "primary" : "secondary"}
									size="sm"
									onClick={() => setPeriod(p)}
								>
									{p === 'week' && '7 дней'}
									{p === 'month' && '30 дней'}
									{p === 'quarter' && '90 дней'}
									{p === 'year' && '1 год'}
								</PixelButton>
							))}
						</div>
					</div>

					{/* Общая статистика */}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div className="text-center">
							<div className="text-2xl font-bold text-blue-600">{analytics.total_tasks}</div>
							<div className="text-sm text-muted-foreground">Всего задач</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-green-600">{analytics.total_units}</div>
							<div className="text-sm text-muted-foreground">Единиц выполнено</div>
						</div>
						<div className="text-center">
							<div className="text-xl font-bold text-orange-600">{formatDuration(analytics.total_time)}</div>
							<div className="text-sm text-muted-foreground">Общее время</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-purple-600">{analytics.total_coins}</div>
							<div className="text-sm text-muted-foreground">Очков заработано</div>
						</div>
					</div>

					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
						<div className="text-center">
							<div className="text-lg font-bold">{analytics.work_days}</div>
							<div className="text-xs text-muted-foreground">Рабочих дней</div>
						</div>
						<div className="text-center">
							<div className="text-lg font-bold">{analytics.avg_tasks_per_day}</div>
							<div className="text-xs text-muted-foreground">Задач в день</div>
						</div>
						<div className="text-center">
							<div className="text-lg font-bold">{formatDuration(analytics.avg_time_per_task)}</div>
							<div className="text-xs text-muted-foreground">Среднее время/задача</div>
						</div>
						<div className="text-center">
							<div className="text-lg font-bold">{analytics.favorite_task_group}</div>
							<div className="text-xs text-muted-foreground">Любимая группа</div>
						</div>
					</div>
				</div>
			</PixelCard>

			{/* Вкладки с анализом */}
			<PixelCard>
				<div className="p-6">
					<Tabs defaultValue="tasks" className="w-full">
						<TabsList className="grid w-full grid-cols-2 border-2 border-black">
							<TabsTrigger value="tasks" className="border-2 border-black">
								📋 По типам задач
							</TabsTrigger>
							<TabsTrigger value="daily" className="border-2 border-black">
								📅 По дням
							</TabsTrigger>
						</TabsList>

						{/* Анализ по типам задач */}
						<TabsContent value="tasks" className="mt-6">
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h4 className="text-lg font-bold">Разбивка по типам задач</h4>
									<div className="flex gap-2">
										<PixelButton
											variant={sortBy === 'units' ? "primary" : "secondary"}
											size="sm"
											onClick={() => setSortBy('units')}
										>
											По единицам
										</PixelButton>
										<PixelButton
											variant={sortBy === 'time' ? "primary" : "secondary"}
											size="sm"
											onClick={() => setSortBy('time')}
										>
											По времени
										</PixelButton>
										<PixelButton
											variant={sortBy === 'efficiency' ? "primary" : "secondary"}
											size="sm"
											onClick={() => setSortBy('efficiency')}
										>
											По эффективности
										</PixelButton>
									</div>
								</div>

								{analytics.task_breakdown.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										Нет данных за выбранный период
									</div>
								) : (
									<div className="space-y-3">
										{analytics.task_breakdown.map((task) => (
											<div key={task.task_name} className="border border-gray-200 rounded-lg">
												<div
													className="p-4 cursor-pointer hover:bg-gray-50"
													onClick={() => setExpandedTask(expandedTask === task.task_name ? null : task.task_name)}
												>
													<div className="flex justify-between items-start">
														<div className="flex-1">
															<div className="flex items-center gap-3 mb-2">
																<h5 className="font-semibold text-lg">{task.task_name}</h5>
																<Badge
																	variant="outline"
																	style={{
																		borderColor: getTaskGroupColor(task.task_group),
																		color: getTaskGroupColor(task.task_group)
																	}}
																>
																	{task.task_group}
																</Badge>
																<div className="ml-auto">
																	{expandedTask === task.task_name ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
																</div>
															</div>

															<div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
																<div>
																	<p className="text-muted-foreground">Выполнено</p>
																	<p className="font-bold text-green-600">{task.total_count} раз</p>
																</div>
																<div>
																	<p className="text-muted-foreground">Единиц</p>
																	<p className="font-bold text-blue-600">{task.total_units}</p>
																</div>
																<div>
																	<p className="text-muted-foreground">Время</p>
																	<p className="font-bold text-orange-600">{formatDuration(task.total_time)}</p>
																</div>
																<div>
																	<p className="text-muted-foreground">Очков</p>
																	<p className="font-bold text-purple-600">{task.total_coins}</p>
																</div>
																<div>
																	<p className="text-muted-foreground">% работы</p>
																	<p className="font-bold">{task.percentage_of_work}%</p>
																</div>
															</div>
														</div>
													</div>
												</div>

												{expandedTask === task.task_name && (
													<div className="px-4 pb-4 border-t bg-gray-50">
														<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
															<div>
																<p className="text-muted-foreground mb-1">⏱️ Среднее время/единица</p>
																<p className="font-bold">{task.avg_time_per_unit} мин</p>
															</div>
															<div>
																<p className="text-muted-foreground mb-1">🎯 Эффективность</p>
																<p className="font-bold">
																	<span className={task.efficiency_score >= 80 ? 'text-green-600' : task.efficiency_score >= 60 ? 'text-orange-600' : 'text-red-600'}>
																		{task.efficiency_score}%
																	</span>
																</p>
															</div>
															<div>
																<p className="text-muted-foreground mb-1">🏆 Лучший день</p>
																<p className="font-bold">{task.best_day_units} ед. • {new Date(task.best_day_date).toLocaleDateString('ru-RU')}</p>
															</div>
															<div>
																<p className="text-muted-foreground mb-1">📅 Первое выполнение</p>
																<p className="font-bold">{new Date(task.first_completed).toLocaleDateString('ru-RU')}</p>
															</div>
															<div>
																<p className="text-muted-foreground mb-1">📅 Последнее выполнение</p>
																<p className="font-bold">{new Date(task.last_completed).toLocaleDateString('ru-RU')}</p>
															</div>
														</div>
													</div>
												)}
											</div>
										))}
									</div>
								)}
							</div>
						</TabsContent>

						{/* Анализ по дням */}
						<TabsContent value="daily" className="mt-6">
							<div className="space-y-4">
								<h4 className="text-lg font-bold">Работа по дням (последние 30 дней)</h4>

								{analytics.daily_breakdown.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										Нет данных за выбранный период
									</div>
								) : (
									<div className="space-y-3">
										{analytics.daily_breakdown.slice(0, 30).map((day) => (
											<div key={day.date} className="p-4 border border-gray-200 rounded-lg">
												<div className="flex justify-between items-start mb-3">
													<div>
														<h5 className="font-semibold text-lg">
															{new Date(day.date).toLocaleDateString('ru-RU', {
																weekday: 'long',
																day: 'numeric',
																month: 'long'
															})}
														</h5>
														<p className="text-sm text-muted-foreground">
															Самая продуктивная задача: <span className="font-medium">{day.most_productive_task}</span>
														</p>
													</div>
													<Badge variant="outline">{day.unique_task_types} типов задач</Badge>
												</div>

												<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
													<div>
														<p className="text-muted-foreground">Задач</p>
														<p className="font-bold text-blue-600">{day.total_tasks}</p>
													</div>
													<div>
														<p className="text-muted-foreground">Единиц</p>
														<p className="font-bold text-green-600">{day.total_units}</p>
													</div>
													<div>
														<p className="text-muted-foreground">Время</p>
														<p className="font-bold text-orange-600">{formatDuration(day.total_time)}</p>
													</div>
													<div>
														<p className="text-muted-foreground">Очков</p>
														<p className="font-bold text-purple-600">{day.total_coins}</p>
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						</TabsContent>
					</Tabs>
				</div>
			</PixelCard>
		</div>
	)
} 