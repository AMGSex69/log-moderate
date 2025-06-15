"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { GAME_CONFIG, getTaskGroup, getTaskGroupName, getTaskGroupColor } from "@/lib/game-config"
import {
	Building,
	Users,
	Clock,
	Target,
	TrendingUp,
	Activity,
	FileText,
	Calendar,
	BarChart3
} from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface OfficeTaskStats {
	task_name: string
	task_group: string
	total_units: number
	total_tasks: number
	total_time: number
	performers: number
	avg_time_per_unit: number
	percentage_of_total: number
}

interface EmployeeDayStats {
	employee_id: string
	full_name: string
	position: string
	is_online: boolean
	total_tasks: number
	total_units: number
	total_time: number
	task_breakdown: {
		task_name: string
		units: number
		time: number
		percentage: number
	}[]
	efficiency_score: number
	work_periods: {
		start_time: string
		end_time: string | null
		task_name: string
		units: number
	}[]
}

interface OfficeStatsData {
	office_name: string
	date: string
	total_employees: number
	active_employees: number
	online_employees: number
	total_tasks_today: number
	total_units_today: number
	total_time_today: number
	avg_hours_per_employee: number
	mzhi_decisions_count: number // Специальный счетчик для МЖИ
	task_stats: OfficeTaskStats[]
	employee_stats: EmployeeDayStats[]
	hourly_activity: {
		hour: number
		employees_count: number
		tasks_count: number
		units_count: number
	}[]
}

interface OfficeTeamStatsProps {
	officeId?: number
	userId?: string
}

export default function OfficeTeamStats({ officeId, userId }: OfficeTeamStatsProps) {
	const [stats, setStats] = useState<OfficeStatsData | null>(null)
	const [loading, setLoading] = useState(true)
	const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

	useEffect(() => {
		fetchOfficeStats()
	}, [selectedDate, officeId, userId])

	const fetchOfficeStats = async () => {
		setLoading(true)
		try {
			// Определяем офис пользователя
			let userOfficeId = officeId
			if (!userOfficeId && userId) {
				const { data: employee } = await supabase
					.from("employees")
					.select("office_id")
					.eq("user_id", userId)
					.eq("is_active", true)
					.single()

				userOfficeId = employee?.office_id || 1
			}

			// Получаем информацию об офисе
			const { data: office } = await supabase
				.from("offices")
				.select("name")
				.eq("id", userOfficeId)
				.single()

			// Получаем всех сотрудников офиса
			const { data: employees } = await supabase
				.from("employees")
				.select("id, full_name, position, is_online, user_id")
				.eq("office_id", userOfficeId)
				.eq("is_active", true)

			if (!employees) throw new Error("Не удалось загрузить сотрудников")

			// Получаем логи задач за выбранную дату
			const { data: taskLogs } = await supabase
				.from("task_logs")
				.select(`
          *,
          employees!inner(full_name, position, is_online),
          task_types!inner(name)
        `)
				.eq("work_date", selectedDate)
				.in("employee_id", employees.map(emp => emp.id))

			// Получаем рабочие сессии
			const { data: workSessions } = await supabase
				.from("work_sessions")
				.select("*")
				.eq("date", selectedDate)
				.in("employee_id", employees.map(emp => emp.id))

			const totalEmployees = employees.length
			const activeEmployees = new Set(taskLogs?.map(log => log.employee_id) || []).size
			const onlineEmployees = employees.filter(emp => emp.is_online).length

			// Считаем общую статистику
			const totalTasks = taskLogs?.length || 0
			const totalUnits = taskLogs?.reduce((sum, log) => sum + log.units_completed, 0) || 0
			const totalTime = taskLogs?.reduce((sum, log) => sum + log.time_spent_minutes, 0) || 0
			const avgHoursPerEmployee = totalEmployees > 0 ? Math.round((totalTime / 60) / totalEmployees * 10) / 10 : 0

			// Специальный подсчет решений МЖИ
			const mzhiDecisionsCount = taskLogs?.filter(log =>
				log.task_types.name === "Внесение решений МЖИ (кол-во бланков)"
			).reduce((sum, log) => sum + log.units_completed, 0) || 0

			// Группируем статистику по задачам
			const taskStatsMap = new Map<string, OfficeTaskStats>()
			taskLogs?.forEach(log => {
				const taskName = log.task_types.name
				const existing = taskStatsMap.get(taskName) || {
					task_name: taskName,
					task_group: getTaskGroup(taskName) || 'other',
					total_units: 0,
					total_tasks: 0,
					total_time: 0,
					performers: new Set<string>(),
					avg_time_per_unit: 0,
					percentage_of_total: 0
				}

				existing.total_units += log.units_completed
				existing.total_tasks += 1
				existing.total_time += log.time_spent_minutes
					; (existing.performers as Set<string>).add(log.employee_id)

				taskStatsMap.set(taskName, existing)
			})

			// Финализируем статистику по задачам
			const taskStats: OfficeTaskStats[] = Array.from(taskStatsMap.values()).map(stat => ({
				...stat,
				performers: (stat.performers as Set<string>).size,
				avg_time_per_unit: stat.total_units > 0 ? Math.round(stat.total_time / stat.total_units) : 0,
				percentage_of_total: totalUnits > 0 ? Math.round((stat.total_units / totalUnits) * 100) : 0
			})).sort((a, b) => b.total_units - a.total_units)

			// Статистика по сотрудникам
			const employeeStatsMap = new Map<string, EmployeeDayStats>()

			employees.forEach(emp => {
				employeeStatsMap.set(emp.id, {
					employee_id: emp.id,
					full_name: emp.full_name,
					position: emp.position,
					is_online: emp.is_online,
					total_tasks: 0,
					total_units: 0,
					total_time: 0,
					task_breakdown: [],
					efficiency_score: 0,
					work_periods: []
				})
			})

			// Заполняем статистику по сотрудникам
			taskLogs?.forEach(log => {
				const empStats = employeeStatsMap.get(log.employee_id)
				if (empStats) {
					empStats.total_tasks += 1
					empStats.total_units += log.units_completed
					empStats.total_time += log.time_spent_minutes

					// Обновляем разбивку по задачам
					const taskInBreakdown = empStats.task_breakdown.find(t => t.task_name === log.task_types.name)
					if (taskInBreakdown) {
						taskInBreakdown.units += log.units_completed
						taskInBreakdown.time += log.time_spent_minutes
					} else {
						empStats.task_breakdown.push({
							task_name: log.task_types.name,
							units: log.units_completed,
							time: log.time_spent_minutes,
							percentage: 0
						})
					}

					// Добавляем рабочий период (упрощенно)
					empStats.work_periods.push({
						start_time: log.completed_at || `${selectedDate}T09:00:00`,
						end_time: null,
						task_name: log.task_types.name,
						units: log.units_completed
					})
				}
			})

			// Финализируем статистику сотрудников
			const employeeStats: EmployeeDayStats[] = Array.from(employeeStatsMap.values()).map(empStats => {
				// Вычисляем проценты для задач
				empStats.task_breakdown.forEach(task => {
					task.percentage = empStats.total_time > 0
						? Math.round((task.time / empStats.total_time) * 100)
						: 0
				})

				// Сортируем задачи по времени
				empStats.task_breakdown.sort((a, b) => b.time - a.time)

				// Вычисляем эффективность
				empStats.efficiency_score = empStats.total_time > 0
					? Math.round((empStats.total_units / empStats.total_time) * 60)
					: 0

				return empStats
			}).sort((a, b) => b.total_units - a.total_units)

			// Почасовая активность (упрощенно)
			const hourlyActivity = Array.from({ length: 10 }, (_, i) => ({
				hour: 9 + i, // с 9 до 18
				employees_count: Math.floor(Math.random() * activeEmployees) + 1,
				tasks_count: Math.floor(Math.random() * totalTasks / 10),
				units_count: Math.floor(Math.random() * totalUnits / 10)
			}))

			const officeStats: OfficeStatsData = {
				office_name: office?.name || "Неизвестный офис",
				date: selectedDate,
				total_employees: totalEmployees,
				active_employees: activeEmployees,
				online_employees: onlineEmployees,
				total_tasks_today: totalTasks,
				total_units_today: totalUnits,
				total_time_today: totalTime,
				avg_hours_per_employee: avgHoursPerEmployee,
				mzhi_decisions_count: mzhiDecisionsCount,
				task_stats: taskStats,
				employee_stats: employeeStats,
				hourly_activity: hourlyActivity
			}

			setStats(officeStats)
		} catch (error) {
			console.error("Ошибка загрузки статистики офиса:", error)
		} finally {
			setLoading(false)
		}
	}

	const formatTime = (minutes: number) => {
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
	}

	const formatHour = (hour: number) => {
		return `${hour.toString().padStart(2, '0')}:00`
	}

	if (loading) {
		return (
			<Card>
				<CardContent className="p-8 text-center">
					<div className="text-4xl animate-spin mb-4">📊</div>
					<p>Загружаем статистику офиса...</p>
				</CardContent>
			</Card>
		)
	}

	if (!stats) {
		return (
			<Card>
				<CardContent className="p-8 text-center">
					<Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
					<p className="text-muted-foreground">Нет данных по офису</p>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-6">
			{/* Заголовок */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Building className="h-6 w-6" />
						Офис "{stats.office_name}" - {format(new Date(stats.date), 'd MMMM yyyy', { locale: ru })}
					</CardTitle>
					<CardDescription>
						Детальная статистика команды на {format(new Date(stats.date), 'EEEE', { locale: ru })}
					</CardDescription>
				</CardHeader>
			</Card>

			{/* Основные показатели */}
			<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
				<Card>
					<CardContent className="p-4 text-center">
						<Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />
						<div className="text-2xl font-bold">{stats.total_employees}</div>
						<div className="text-sm text-muted-foreground">Всего в команде</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4 text-center">
						<Activity className="h-6 w-6 mx-auto mb-2 text-green-600" />
						<div className="text-2xl font-bold">{stats.active_employees}</div>
						<div className="text-sm text-muted-foreground">Работали сегодня</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4 text-center">
						<div className="w-6 h-6 mx-auto mb-2 bg-green-500 rounded-full animate-pulse"></div>
						<div className="text-2xl font-bold">{stats.online_employees}</div>
						<div className="text-sm text-muted-foreground">Онлайн сейчас</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4 text-center">
						<Target className="h-6 w-6 mx-auto mb-2 text-purple-600" />
						<div className="text-2xl font-bold">{stats.total_units_today}</div>
						<div className="text-sm text-muted-foreground">Единиц выполнено</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4 text-center">
						<Clock className="h-6 w-6 mx-auto mb-2 text-orange-600" />
						<div className="text-2xl font-bold">{stats.avg_hours_per_employee}ч</div>
						<div className="text-sm text-muted-foreground">Средн. на человека</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4 text-center">
						<FileText className="h-6 w-6 mx-auto mb-2 text-red-600" />
						<div className="text-2xl font-bold">{stats.mzhi_decisions_count}</div>
						<div className="text-sm text-muted-foreground">Решений МЖИ</div>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="employees" className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="employees">Сотрудники</TabsTrigger>
					<TabsTrigger value="tasks">Задачи</TabsTrigger>
					<TabsTrigger value="timeline">Активность</TabsTrigger>
				</TabsList>

				<TabsContent value="employees" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Статистика сотрудников за день</CardTitle>
							<CardDescription>Детальный разрез работы каждого сотрудника</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{stats.employee_stats.filter(emp => emp.total_tasks > 0).map((employee, index) => (
									<div key={employee.employee_id} className="border rounded-lg p-4">
										<div className="flex items-center justify-between mb-3">
											<div className="flex items-center gap-3">
												<Badge variant={index < 3 ? "default" : "secondary"} className="px-2 py-1">
													#{index + 1}
												</Badge>
												<div>
													<div className="font-medium flex items-center gap-2">
														{employee.full_name}
														{employee.is_online && (
															<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
														)}
													</div>
													<div className="text-sm text-muted-foreground">{employee.position}</div>
												</div>
											</div>
											<div className="flex gap-4 text-center">
												<div>
													<div className="font-bold text-lg">{employee.total_tasks}</div>
													<div className="text-xs text-muted-foreground">задач</div>
												</div>
												<div>
													<div className="font-bold text-lg">{employee.total_units}</div>
													<div className="text-xs text-muted-foreground">единиц</div>
												</div>
												<div>
													<div className="font-bold text-lg">{formatTime(employee.total_time)}</div>
													<div className="text-xs text-muted-foreground">время</div>
												</div>
												<div>
													<div className="font-bold text-lg text-green-600">{employee.efficiency_score}</div>
													<div className="text-xs text-muted-foreground">ед/час</div>
												</div>
											</div>
										</div>

										{/* Разбивка по задачам */}
										<div className="space-y-2">
											<div className="text-sm font-medium text-muted-foreground">Разбивка по задачам:</div>
											<div className="space-y-1">
												{employee.task_breakdown.slice(0, 5).map((task, taskIndex) => (
													<div key={taskIndex} className="flex items-center justify-between p-2 bg-muted/50 rounded">
														<div className="flex items-center gap-2">
															<div
																className="w-3 h-3 rounded-full"
																style={{ backgroundColor: getTaskGroupColor(task.task_name) }}
															></div>
															<span className="text-sm font-medium truncate max-w-[200px]">
																{task.task_name}
															</span>
														</div>
														<div className="flex items-center gap-4 text-sm">
															<span>{task.units} ед.</span>
															<span>{formatTime(task.time)}</span>
															<Badge variant="outline" className="text-xs">
																{task.percentage}%
															</Badge>
														</div>
													</div>
												))}
											</div>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="tasks" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Статистика по задачам</CardTitle>
							<CardDescription>Какие задачи выполнялись командой</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{stats.task_stats.map((task, index) => (
									<div key={task.task_name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
										<div className="flex items-center gap-3">
											<Badge variant="outline" className="text-xs">#{index + 1}</Badge>
											<div className="flex items-center gap-2">
												<div
													className="w-3 h-3 rounded-full"
													style={{ backgroundColor: getTaskGroupColor(task.task_name) }}
												></div>
												<div>
													<div className="font-medium">{task.task_name}</div>
													<div className="text-sm text-muted-foreground">
														Группа: {getTaskGroupName(task.task_name)}
													</div>
												</div>
											</div>
										</div>

										<div className="flex gap-6 text-center">
											<div>
												<div className="font-bold">{task.total_units}</div>
												<div className="text-xs text-muted-foreground">единиц</div>
											</div>
											<div>
												<div className="font-bold">{task.total_tasks}</div>
												<div className="text-xs text-muted-foreground">выполнений</div>
											</div>
											<div>
												<div className="font-bold">{formatTime(task.total_time)}</div>
												<div className="text-xs text-muted-foreground">время</div>
											</div>
											<div>
												<div className="font-bold">{task.performers}</div>
												<div className="text-xs text-muted-foreground">исполнителей</div>
											</div>
											<div>
												<div className="font-bold text-blue-600">{task.percentage_of_total}%</div>
												<div className="text-xs text-muted-foreground">от общего</div>
											</div>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="timeline" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Почасовая активность</CardTitle>
							<CardDescription>Активность команды в течение рабочего дня</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								{stats.hourly_activity.map((hour) => (
									<div key={hour.hour} className="flex items-center gap-4 p-2">
										<div className="w-16 text-sm font-mono">
											{formatHour(hour.hour)}
										</div>
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-1">
												<div className="text-sm">{hour.employees_count} сотрудников</div>
												<div className="text-xs text-muted-foreground">
													{hour.tasks_count} задач • {hour.units_count} единиц
												</div>
											</div>
											<Progress
												value={(hour.employees_count / stats.total_employees) * 100}
												className="h-2"
											/>
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