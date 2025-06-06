"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CalendarIcon, Clock, Users, Target, TrendingUp, BarChart3, Activity, Coffee, Play, Pause, Square } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { supabase } from "@/lib/supabase"

// Типы данных
interface EmployeeWorkday {
	employee_id: string
	full_name: string
	date: string
	clock_in_time: string | null
	clock_out_time: string | null
	total_work_minutes: number
	tasks: TaskActivity[]
	breaks: BreakActivity[]
}

interface TaskActivity {
	id: string
	task_name: string
	start_time: string
	end_time: string
	units_completed: number
	time_spent_minutes: number
	notes?: string
}

interface BreakActivity {
	start_time: string
	end_time: string
	type: 'break' | 'lunch' | 'idle'
}

interface EmployeeStats {
	employee_id: string
	full_name: string
	position: string
	period_stats: {
		total_tasks: number
		total_units: number
		total_time: number
		total_coins: number
		avg_efficiency: number
	}
	task_breakdown: TaskBreakdown[]
}

interface TaskBreakdown {
	task_name: string
	task_count: number
	total_units: number
	total_time: number
	avg_time_per_unit: number
}

interface TaskStats {
	task_name: string
	total_performers: number
	total_units: number
	total_time: number
	avg_time_per_unit: number
	top_performers: { name: string; units: number; time: number }[]
}

export default function EnhancedDashboard() {
	const [selectedDate, setSelectedDate] = useState<Date>(new Date())
	const [period, setPeriod] = useState<string>("day")
	const [employeeWorkdays, setEmployeeWorkdays] = useState<EmployeeWorkday[]>([])
	const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([])
	const [taskStats, setTaskStats] = useState<TaskStats[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		loadAllData()
	}, [selectedDate, period])

	const getDateRange = () => {
		const today = selectedDate
		switch (period) {
			case "day":
				return {
					start: format(today, "yyyy-MM-dd"),
					end: format(today, "yyyy-MM-dd"),
				}
			case "week":
				const weekStart = new Date(today)
				weekStart.setDate(today.getDate() - today.getDay() + 1) // Понедельник
				const weekEnd = new Date(weekStart)
				weekEnd.setDate(weekStart.getDate() + 6) // Воскресенье
				return {
					start: format(weekStart, "yyyy-MM-dd"),
					end: format(weekEnd, "yyyy-MM-dd"),
				}
			case "month":
				const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
				const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
				return {
					start: format(monthStart, "yyyy-MM-dd"),
					end: format(monthEnd, "yyyy-MM-dd"),
				}
			default:
				return {
					start: format(today, "yyyy-MM-dd"),
					end: format(today, "yyyy-MM-dd"),
				}
		}
	}

	const loadAllData = async () => {
		setLoading(true)
		try {
			await Promise.all([
				loadEmployeeWorkdays(),
				loadEmployeeStats(),
				loadTaskStats()
			])
		} catch (error) {
			console.error("Ошибка загрузки данных:", error)
		} finally {
			setLoading(false)
		}
	}

	const loadEmployeeWorkdays = async () => {
		const { start, end } = getDateRange()

		try {
			// Загружаем рабочие сессии
			const { data: sessions, error: sessionsError } = await supabase
				.from("work_sessions")
				.select(`
          *, 
          employees!inner(full_name)
        `)
				.gte("date", start)
				.lte("date", end)
				.order("date", { ascending: false })

			if (sessionsError) throw sessionsError

			// Загружаем задачи за этот период
			const { data: tasks, error: tasksError } = await supabase
				.from("task_logs")
				.select(`
          *,
          employees!inner(full_name),
          task_types!inner(name)
        `)
				.gte("work_date", start)
				.lte("work_date", end)
				.order("created_at", { ascending: true })

			if (tasksError) throw tasksError

			// Группируем данные по сотрудникам и дням
			const workdaysMap = new Map<string, EmployeeWorkday>()

			sessions?.forEach((session: any) => {
				const key = `${session.employee_id}_${session.date}`
				const employeeTasks = tasks?.filter((task: any) =>
					task.employee_id === session.employee_id &&
					task.work_date === session.date
				) || []

				const taskActivities: TaskActivity[] = employeeTasks.map((task: any) => ({
					id: task.id,
					task_name: task.task_types.name,
					start_time: task.created_at,
					end_time: task.created_at, // Приблизительно
					units_completed: task.units_completed,
					time_spent_minutes: task.time_spent_minutes,
					notes: task.notes
				}))

				workdaysMap.set(key, {
					employee_id: session.employee_id,
					full_name: session.employees.full_name,
					date: session.date,
					clock_in_time: session.clock_in_time,
					clock_out_time: session.clock_out_time,
					total_work_minutes: session.total_work_minutes || 0,
					tasks: taskActivities,
					breaks: [] // Пока пустые, можно добавить логику перерывов
				})
			})

			setEmployeeWorkdays(Array.from(workdaysMap.values()))
		} catch (error) {
			console.error("Ошибка загрузки рабочих дней:", error)
		}
	}

	const loadEmployeeStats = async () => {
		const { start, end } = getDateRange()

		try {
			const { data: logs, error } = await supabase
				.from("task_logs")
				.select(`
          *,
          employees!inner(full_name, position),
          task_types!inner(name)
        `)
				.gte("work_date", start)
				.lte("work_date", end)

			if (error) throw error

			const statsMap = new Map<string, EmployeeStats>()

			logs?.forEach((log: any) => {
				const employeeId = log.employee_id
				const existing = statsMap.get(employeeId) || {
					employee_id: employeeId,
					full_name: log.employees.full_name,
					position: log.employees.position,
					period_stats: {
						total_tasks: 0,
						total_units: 0,
						total_time: 0,
						total_coins: 0,
						avg_efficiency: 0
					},
					task_breakdown: [] as TaskBreakdown[]
				}

				existing.period_stats.total_tasks += 1
				existing.period_stats.total_units += log.units_completed
				existing.period_stats.total_time += log.time_spent_minutes

				// Простой расчет монет (можно улучшить)
				existing.period_stats.total_coins += Math.floor(log.units_completed * 10)

				// Обновляем разбивку по задачам
				const taskBreakdown = existing.task_breakdown.find(t => t.task_name === log.task_types.name)
				if (taskBreakdown) {
					taskBreakdown.task_count += 1
					taskBreakdown.total_units += log.units_completed
					taskBreakdown.total_time += log.time_spent_minutes
					taskBreakdown.avg_time_per_unit = taskBreakdown.total_time / taskBreakdown.total_units
				} else {
					const newTaskBreakdown: TaskBreakdown = {
						task_name: log.task_types.name,
						task_count: 1,
						total_units: log.units_completed,
						total_time: log.time_spent_minutes,
						avg_time_per_unit: log.time_spent_minutes / log.units_completed
					}
					existing.task_breakdown.push(newTaskBreakdown)
				}

				statsMap.set(employeeId, existing)
			})

			// Рассчитываем эффективность
			Array.from(statsMap.values()).forEach(stat => {
				stat.period_stats.avg_efficiency = stat.period_stats.total_time > 0
					? Math.round((stat.period_stats.total_units / stat.period_stats.total_time) * 60)
					: 0
			})

			setEmployeeStats(Array.from(statsMap.values()).sort((a, b) => b.period_stats.total_units - a.period_stats.total_units))
		} catch (error) {
			console.error("Ошибка загрузки статистики сотрудников:", error)
		}
	}

	const loadTaskStats = async () => {
		const { start, end } = getDateRange()

		try {
			const { data: logs, error } = await supabase
				.from("task_logs")
				.select(`
          *,
          employees!inner(full_name),
          task_types!inner(name)
        `)
				.gte("work_date", start)
				.lte("work_date", end)

			if (error) throw error

			const taskStatsMap = new Map<string, TaskStats>()

			logs?.forEach((log: any) => {
				const taskName = log.task_types.name
				const existing = taskStatsMap.get(taskName) || {
					task_name: taskName,
					total_performers: 0,
					total_units: 0,
					total_time: 0,
					avg_time_per_unit: 0,
					top_performers: [] as { name: string; units: number; time: number }[]
				}

				existing.total_units += log.units_completed
				existing.total_time += log.time_spent_minutes

				// Обновляем топ исполнителей
				const performer = existing.top_performers.find(p => p.name === log.employees.full_name)
				if (performer) {
					performer.units += log.units_completed
					performer.time += log.time_spent_minutes
				} else {
					const newPerformer = {
						name: log.employees.full_name,
						units: log.units_completed,
						time: log.time_spent_minutes
					}
					existing.top_performers.push(newPerformer)
				}

				taskStatsMap.set(taskName, existing)
			})

			// Завершаем обработку
			Array.from(taskStatsMap.values()).forEach(stat => {
				stat.avg_time_per_unit = stat.total_units > 0 ? Math.round(stat.total_time / stat.total_units) : 0
				stat.total_performers = stat.top_performers.length
				stat.top_performers.sort((a, b) => b.units - a.units).splice(5) // Топ 5
			})

			setTaskStats(Array.from(taskStatsMap.values()).sort((a, b) => b.total_units - a.total_units))
		} catch (error) {
			console.error("Ошибка загрузки статистики задач:", error)
		}
	}

	const formatTime = (minutes: number) => {
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
	}

	const renderWorkdayTimeline = (workday: EmployeeWorkday) => {
		const workStart = workday.clock_in_time ? new Date(`2024-01-01T${workday.clock_in_time}`) : null
		const workEnd = workday.clock_out_time ? new Date(`2024-01-01T${workday.clock_out_time}`) : null

		if (!workStart) return <div className="text-sm text-gray-500">Не отмечался</div>

		const totalMinutes = workEnd ? (workEnd.getTime() - workStart.getTime()) / (1000 * 60) : 480 // 8 часов по умолчанию
		const timelineWidth = 300 // px

		return (
			<div className="relative">
				<div className="flex items-center gap-2 mb-2">
					<Clock className="h-4 w-4 text-gray-500" />
					<span className="text-sm font-medium">
						{workday.clock_in_time} - {workday.clock_out_time || "В работе"}
					</span>
					<span className="text-xs text-gray-500">
						({formatTime(workday.total_work_minutes)})
					</span>
				</div>

				<div className="relative bg-gray-200 h-8 rounded" style={{ width: timelineWidth }}>
					{/* Рабочее время */}
					<div
						className="absolute top-0 h-full bg-green-400 rounded"
						style={{ width: '100%' }}
					/>

					{/* Задачи */}
					{workday.tasks.map((task, index) => {
						const taskStart = new Date(`2024-01-01T${task.start_time.split('T')[1]?.split('.')[0] || '09:00:00'}`)
						const taskDuration = task.time_spent_minutes
						const leftPercent = workStart ? ((taskStart.getTime() - workStart.getTime()) / (1000 * 60)) / totalMinutes * 100 : 0
						const widthPercent = (taskDuration / totalMinutes) * 100

						return (
							<TooltipProvider key={task.id}>
								<Tooltip>
									<TooltipTrigger asChild>
										<div
											className="absolute top-1 h-6 bg-blue-500 border border-blue-600 cursor-pointer hover:bg-blue-600 transition-colors"
											style={{
												left: `${Math.max(0, leftPercent)}%`,
												width: `${Math.min(widthPercent, 100 - leftPercent)}%`,
												borderRadius: '3px'
											}}
										/>
									</TooltipTrigger>
									<TooltipContent>
										<div className="text-xs">
											<div className="font-medium">{task.task_name}</div>
											<div>Единиц: {task.units_completed}</div>
											<div>Время: {formatTime(task.time_spent_minutes)}</div>
											{task.notes && <div>Заметки: {task.notes}</div>}
										</div>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)
					})}
				</div>

				<div className="flex justify-between text-xs text-gray-500 mt-1">
					<span>09:00</span>
					<span>12:00</span>
					<span>15:00</span>
					<span>18:00</span>
				</div>
			</div>
		)
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
					<p>Загрузка расширенной аналитики...</p>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			{/* Заголовок и фильтры */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<BarChart3 className="h-5 w-5" />
						Расширенная аналитика
					</CardTitle>
					<CardDescription>
						Детальный анализ работы сотрудников с временной шкалой и статистикой
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-4">
						<Select value={period} onValueChange={setPeriod}>
							<SelectTrigger className="w-40">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="day">День</SelectItem>
								<SelectItem value="week">Неделя</SelectItem>
								<SelectItem value="month">Месяц</SelectItem>
							</SelectContent>
						</Select>

						<Popover>
							<PopoverTrigger asChild>
								<Button variant="outline" className="w-40">
									<CalendarIcon className="mr-2 h-4 w-4" />
									{format(selectedDate, "dd.MM.yyyy")}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0">
								<Calendar
									mode="single"
									selected={selectedDate}
									onSelect={(date) => date && setSelectedDate(date)}
									locale={ru}
								/>
							</PopoverContent>
						</Popover>
					</div>
				</CardContent>
			</Card>

			<Tabs defaultValue="timeline" className="space-y-4">
				<TabsList>
					<TabsTrigger value="timeline">Временная шкала</TabsTrigger>
					<TabsTrigger value="employees">Сотрудники</TabsTrigger>
					<TabsTrigger value="tasks">Задачи</TabsTrigger>
				</TabsList>

				<TabsContent value="timeline">
					<Card>
						<CardHeader>
							<CardTitle>Рабочие дни сотрудников</CardTitle>
							<CardDescription>
								Временная шкала с разбивкой по задачам. Наведите на задачу для деталей.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-6">
								{employeeWorkdays.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										Нет данных за выбранный период
									</div>
								) : (
									employeeWorkdays.map((workday) => (
										<div key={`${workday.employee_id}_${workday.date}`} className="border rounded-lg p-4">
											<div className="flex justify-between items-start mb-4">
												<div>
													<h3 className="font-medium">{workday.full_name}</h3>
													<p className="text-sm text-gray-500">{workday.date}</p>
												</div>
												<div className="text-right">
													<Badge variant="outline">
														{workday.tasks.length} задач
													</Badge>
													<p className="text-sm text-gray-500 mt-1">
														{workday.tasks.reduce((sum, task) => sum + task.units_completed, 0)} единиц
													</p>
												</div>
											</div>

											{renderWorkdayTimeline(workday)}

											{workday.tasks.length > 0 && (
												<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
													{workday.tasks.map((task) => (
														<div key={task.id} className="text-xs bg-gray-50 p-2 rounded">
															<div className="font-medium">{task.task_name}</div>
															<div className="text-gray-600">
																{task.units_completed} ед. • {formatTime(task.time_spent_minutes)}
															</div>
														</div>
													))}
												</div>
											)}
										</div>
									))
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="employees">
					<Card>
						<CardHeader>
							<CardTitle>Статистика сотрудников</CardTitle>
							<CardDescription>
								Детальная аналитика по каждому сотруднику за выбранный период
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-6">
								{employeeStats.map((employee) => (
									<div key={employee.employee_id} className="border rounded-lg p-4">
										<div className="flex justify-between items-start mb-4">
											<div>
												<h3 className="font-medium">{employee.full_name}</h3>
												<p className="text-sm text-gray-500">{employee.position}</p>
											</div>
											<div className="grid grid-cols-4 gap-4 text-center">
												<div>
													<div className="font-bold text-lg">{employee.period_stats.total_tasks}</div>
													<div className="text-xs text-gray-500">Задач</div>
												</div>
												<div>
													<div className="font-bold text-lg">{employee.period_stats.total_units}</div>
													<div className="text-xs text-gray-500">Единиц</div>
												</div>
												<div>
													<div className="font-bold text-lg">{formatTime(employee.period_stats.total_time)}</div>
													<div className="text-xs text-gray-500">Время</div>
												</div>
												<div>
													<div className="font-bold text-lg">{employee.period_stats.avg_efficiency}</div>
													<div className="text-xs text-gray-500">Ед/час</div>
												</div>
											</div>
										</div>

										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
											{employee.task_breakdown.map((task) => (
												<div key={task.task_name} className="bg-gray-50 p-3 rounded">
													<div className="font-medium text-sm">{task.task_name}</div>
													<div className="text-xs text-gray-600 mt-1">
														{task.total_units} ед. • {formatTime(task.total_time)} • {Math.round(task.avg_time_per_unit)} мин/ед
													</div>
												</div>
											))}
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="tasks">
					<Card>
						<CardHeader>
							<CardTitle>Статистика задач</CardTitle>
							<CardDescription>
								Анализ эффективности выполнения различных типов задач
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{taskStats.map((task) => (
									<div key={task.task_name} className="border rounded-lg p-4">
										<div className="flex justify-between items-start mb-3">
											<div>
												<h3 className="font-medium">{task.task_name}</h3>
												<p className="text-sm text-gray-500">{task.total_performers} исполнителей</p>
											</div>
											<div className="grid grid-cols-3 gap-4 text-center">
												<div>
													<div className="font-bold text-lg">{task.total_units}</div>
													<div className="text-xs text-gray-500">Единиц</div>
												</div>
												<div>
													<div className="font-bold text-lg">{formatTime(task.total_time)}</div>
													<div className="text-xs text-gray-500">Время</div>
												</div>
												<div>
													<div className="font-bold text-lg">{task.avg_time_per_unit}</div>
													<div className="text-xs text-gray-500">Мин/ед</div>
												</div>
											</div>
										</div>

										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
											{task.top_performers.map((performer) => (
												<div key={performer.name} className="bg-blue-50 p-3 rounded">
													<div className="font-medium text-sm">{performer.name}</div>
													<div className="text-xs text-blue-600 mt-1">
														{performer.units} ед. • {formatTime(performer.time)}
													</div>
												</div>
											))}
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	)
} 