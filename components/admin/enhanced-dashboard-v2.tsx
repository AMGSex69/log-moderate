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
import { CalendarIcon, Clock, Users, Target, TrendingUp, BarChart3, Activity, User, AlertTriangle, CheckCircle, ArrowLeft, Home } from "lucide-react"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfToday, subDays, subWeeks, subMonths, addDays } from "date-fns"
import { ru } from "date-fns/locale"
import { supabase } from "@/lib/supabase"

// Типы данных
interface TimelineSegment {
	start: Date
	end: Date
	type: "task" | "break" | "idle" | "offline"
	taskName?: string
	breakType?: string
	duration: number
	units?: number
}

interface EmployeeWorkday {
	employee_id: string
	full_name: string
	date: string
	clock_in_time: string | null
	clock_out_time: string | null
	total_work_minutes: number
	tasks: TaskActivity[]
	segments: TimelineSegment[]
	is_currently_working: boolean
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

interface OverallStats {
	total_employees: number
	active_employees: number
	total_tasks_completed: number
	total_units_completed: number
	total_work_time: number
	avg_efficiency: number
	top_performers: {
		by_units: { name: string; units: number; position: string }[]
		by_time: { name: string; time: number; position: string }[]
		by_efficiency: { name: string; efficiency: number; position: string }[]
		by_tasks: { name: string; tasks: number; position: string }[]
	}
	task_distribution: { task_name: string; percentage: number; total_units: number }[]
	daily_stats: { date: string; employees: number; tasks: number; units: number }[]
}

export default function EnhancedDashboardV2() {
	const [selectedDate, setSelectedDate] = useState<Date>(new Date())
	const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
		start: new Date(),
		end: new Date()
	})
	const [dateMode, setDateMode] = useState<"single" | "range" | "preset">("preset")
	const [selectedPreset, setSelectedPreset] = useState<string>("today")
	const [selectedEmployee, setSelectedEmployee] = useState<string>("all")
	const [activeTab, setActiveTab] = useState<string>("overall")
	const [employees, setEmployees] = useState<any[]>([])
	const [employeeWorkdays, setEmployeeWorkdays] = useState<EmployeeWorkday[]>([])
	const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([])
	const [taskStats, setTaskStats] = useState<TaskStats[]>([])
	const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		loadEmployees()
	}, [])

	useEffect(() => {
		loadAllData()
	}, [selectedDate, dateRange, dateMode, selectedPreset, selectedEmployee])

	const loadEmployees = async () => {
		try {
			const { data, error } = await supabase
				.from("employees")
				.select("id, full_name, position")
				.eq("is_active", true)
				.order("full_name")

			if (error) throw error
			setEmployees(data || [])
		} catch (error) {
			console.error("Ошибка загрузки сотрудников:", error)
		}
	}

	const getDateRange = () => {
		switch (dateMode) {
			case "single":
				return {
					start: format(selectedDate, "yyyy-MM-dd"),
					end: format(selectedDate, "yyyy-MM-dd"),
				}
			case "range":
				return {
					start: format(dateRange.start, "yyyy-MM-dd"),
					end: format(dateRange.end, "yyyy-MM-dd"),
				}
			case "preset":
				return getPresetDateRange(selectedPreset)
			default:
				return {
					start: format(new Date(), "yyyy-MM-dd"),
					end: format(new Date(), "yyyy-MM-dd"),
				}
		}
	}

	const getPresetDateRange = (preset: string) => {
		const today = startOfToday()

		switch (preset) {
			case "today":
				return {
					start: format(today, "yyyy-MM-dd"),
					end: format(today, "yyyy-MM-dd"),
				}
			case "yesterday":
				const yesterday = subDays(today, 1)
				return {
					start: format(yesterday, "yyyy-MM-dd"),
					end: format(yesterday, "yyyy-MM-dd"),
				}
			case "this-week":
				const weekStart = startOfWeek(today, { weekStartsOn: 1 })
				const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
				return {
					start: format(weekStart, "yyyy-MM-dd"),
					end: format(weekEnd, "yyyy-MM-dd"),
				}
			case "last-week":
				const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })
				const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })
				return {
					start: format(lastWeekStart, "yyyy-MM-dd"),
					end: format(lastWeekEnd, "yyyy-MM-dd"),
				}
			case "this-month":
				const monthStart = startOfMonth(today)
				const monthEnd = endOfMonth(today)
				return {
					start: format(monthStart, "yyyy-MM-dd"),
					end: format(monthEnd, "yyyy-MM-dd"),
				}
			case "last-month":
				const lastMonthStart = startOfMonth(subMonths(today, 1))
				const lastMonthEnd = endOfMonth(subMonths(today, 1))
				return {
					start: format(lastMonthStart, "yyyy-MM-dd"),
					end: format(lastMonthEnd, "yyyy-MM-dd"),
				}
			case "last-7-days":
				return {
					start: format(subDays(today, 6), "yyyy-MM-dd"),
					end: format(today, "yyyy-MM-dd"),
				}
			case "last-30-days":
				return {
					start: format(subDays(today, 29), "yyyy-MM-dd"),
					end: format(today, "yyyy-MM-dd"),
				}
			default:
				return {
					start: format(today, "yyyy-MM-dd"),
					end: format(today, "yyyy-MM-dd"),
				}
		}
	}

	const getDateRangeDescription = () => {
		const { start, end } = getDateRange()
		const startDate = new Date(start)
		const endDate = new Date(end)

		if (start === end) {
			return format(startDate, "dd MMMM yyyy", { locale: ru })
		} else {
			return `${format(startDate, "dd MMM", { locale: ru })} - ${format(endDate, "dd MMM yyyy", { locale: ru })}`
		}
	}

	const getPresetLabel = (preset: string) => {
		switch (preset) {
			case "today": return "Сегодня"
			case "yesterday": return "Вчера"
			case "this-week": return "Эта неделя"
			case "last-week": return "Прошлая неделя"
			case "this-month": return "Этот месяц"
			case "last-month": return "Прошлый месяц"
			case "last-7-days": return "Последние 7 дней"
			case "last-30-days": return "Последние 30 дней"
			default: return preset
		}
	}

	const loadAllData = async () => {
		setLoading(true)
		try {
			await Promise.all([
				loadEmployeeWorkdays(),
				loadEmployeeStats(),
				loadTaskStats(),
				loadOverallStats()
			])
		} catch (error) {
			console.error("Ошибка загрузки данных:", error)
		} finally {
			setLoading(false)
		}
	}

	const buildTimelineSegments = async (employeeId: string, date: string): Promise<TimelineSegment[]> => {
		const segments: TimelineSegment[] = []

		try {
			// Получаем рабочую сессию
			const { data: workSession } = await supabase
				.from("work_sessions")
				.select("*")
				.eq("employee_id", employeeId)
				.eq("date", date)
				.single()

			// Получаем задачи
			const { data: tasks } = await supabase
				.from("task_logs")
				.select("started_at, created_at, time_spent_minutes, units_completed, task_types(name)")
				.eq("employee_id", employeeId)
				.eq("work_date", date)
				.order("created_at")

			// Получаем перерывы
			const { data: breaks } = await supabase
				.from("break_logs")
				.select("*")
				.eq("employee_id", employeeId)
				.eq("date", date)
				.order("start_time")

			// Правильно парсим время - clock_in_time может быть полным timestamp'ом
			const clockIn = workSession?.clock_in_time ?
				new Date(workSession.clock_in_time) : null
			const clockOut = workSession?.clock_out_time ?
				new Date(workSession.clock_out_time) : null

			// Проверяем валидность дат
			if (clockIn && isNaN(clockIn.getTime())) {
				console.warn("Invalid clock_in_time:", workSession?.clock_in_time)
				return segments
			}
			if (clockOut && isNaN(clockOut.getTime())) {
				console.warn("Invalid clock_out_time:", workSession?.clock_out_time)
				// Не возвращаем, просто обнуляем
				const validClockOut = null
			}

			if (clockIn) {
				// Добавляем задачи с валидацией
				tasks?.forEach((task: any) => {
					try {
						const taskStart = new Date(task.started_at || task.created_at)
						if (isNaN(taskStart.getTime())) {
							console.warn("Invalid task start time:", task.started_at || task.created_at)
							return
						}

						const timeSpent = task.time_spent_minutes || 0
						const taskEnd = new Date(taskStart.getTime() + timeSpent * 60000)

						segments.push({
							start: taskStart,
							end: taskEnd,
							type: "task",
							taskName: task.task_types?.name || "Неизвестная задача",
							duration: timeSpent,
							units: task.units_completed || 0
						})
					} catch (error) {
						console.warn("Error processing task:", task, error)
					}
				})

				// Добавляем перерывы с валидацией
				breaks?.forEach((breakLog: any) => {
					try {
						// Перерывы могут быть как timestamp'ами, так и просто временем
						let breakStart: Date
						if (breakLog.start_time.includes('T')) {
							// Это полный timestamp
							breakStart = new Date(breakLog.start_time)
						} else {
							// Это просто время
							breakStart = new Date(`${date}T${breakLog.start_time}`)
						}

						if (isNaN(breakStart.getTime())) {
							console.warn("Invalid break start time:", breakLog.start_time)
							return
						}

						let breakEnd: Date
						if (breakLog.end_time) {
							if (breakLog.end_time.includes('T')) {
								// Это полный timestamp
								breakEnd = new Date(breakLog.end_time)
							} else {
								// Это просто время
								breakEnd = new Date(`${date}T${breakLog.end_time}`)
							}
						} else {
							breakEnd = new Date()
						}

						if (isNaN(breakEnd.getTime())) {
							console.warn("Invalid break end time:", breakLog.end_time)
							return
						}

						const breakDuration = Math.round((breakEnd.getTime() - breakStart.getTime()) / 60000)

						if (breakDuration >= 0) {
							segments.push({
								start: breakStart,
								end: breakEnd,
								type: "break",
								breakType: breakLog.break_type || "break",
								duration: breakDuration
							})
						}
					} catch (error) {
						console.warn("Error processing break:", breakLog, error)
					}
				})

				// Сортируем сегменты по времени
				segments.sort((a, b) => a.start.getTime() - b.start.getTime())

				// Добавляем сегменты простоя между задачами и перерывами
				const workEnd = (clockOut && !isNaN(clockOut.getTime())) ? clockOut : new Date()
				let lastTime = clockIn

				const sortedSegments = [...segments].sort((a, b) => a.start.getTime() - b.start.getTime())
				const finalSegments: TimelineSegment[] = []

				sortedSegments.forEach(segment => {
					// Добавляем простой перед сегментом если есть разрыв
					if (segment.start.getTime() > lastTime.getTime() + 60000) { // больше минуты
						const idleDuration = Math.round((segment.start.getTime() - lastTime.getTime()) / 60000)
						if (idleDuration > 0) {
							finalSegments.push({
								start: lastTime,
								end: segment.start,
								type: "idle",
								duration: idleDuration
							})
						}
					}

					finalSegments.push(segment)
					lastTime = segment.end
				})

				// Добавляем простой в конце если есть
				if (workEnd.getTime() > lastTime.getTime() + 60000) {
					const finalIdleDuration = Math.round((workEnd.getTime() - lastTime.getTime()) / 60000)
					if (finalIdleDuration > 0) {
						finalSegments.push({
							start: lastTime,
							end: workEnd,
							type: "idle",
							duration: finalIdleDuration
						})
					}
				}

				return finalSegments
			}
		} catch (error) {
			console.error("Ошибка построения временной шкалы:", error)
		}

		return segments
	}

	const loadEmployeeWorkdays = async () => {
		const { start, end } = getDateRange()

		try {
			// Загружаем рабочие сессии
			const { data: sessions, error: sessionsError } = await supabase
				.from("work_sessions")
				.select(`
          *, 
          employees!inner(full_name, position)
        `)
				.gte("date", start)
				.lte("date", end)

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

			if (tasksError) throw tasksError

			// Группируем данные по сотрудникам и дням
			const workdaysMap = new Map<string, EmployeeWorkday>()

			let filteredSessions = sessions || []
			if (selectedEmployee !== "all") {
				filteredSessions = filteredSessions.filter(session => session.employee_id === selectedEmployee)
			}

			for (const session of filteredSessions) {
				const key = `${session.employee_id}_${session.date}`
				const employeeTasks = tasks?.filter((task: any) =>
					task.employee_id === session.employee_id &&
					task.work_date === session.date
				) || []

				const taskActivities: TaskActivity[] = employeeTasks
					.filter((task: any) => {
						// Валидируем даты задач
						const taskDate = new Date(task.created_at)
						return !isNaN(taskDate.getTime())
					})
					.map((task: any) => ({
						id: task.id,
						task_name: task.task_types?.name || "Неизвестная задача",
						start_time: task.created_at,
						end_time: task.created_at,
						units_completed: task.units_completed || 0,
						time_spent_minutes: task.time_spent_minutes || 0,
						notes: task.notes
					}))

				// Строим временную шкалу
				const segments = await buildTimelineSegments(session.employee_id, session.date)

				workdaysMap.set(key, {
					employee_id: session.employee_id,
					full_name: session.employees.full_name,
					date: session.date,
					clock_in_time: session.clock_in_time,
					clock_out_time: session.clock_out_time,
					total_work_minutes: session.total_work_minutes || 0,
					tasks: taskActivities,
					segments: segments,
					is_currently_working: !!session.clock_in_time && !session.clock_out_time
				})
			}

			setEmployeeWorkdays(Array.from(workdaysMap.values()))
		} catch (error) {
			console.error("Ошибка загрузки рабочих дней:", error)
		}
	}

	const loadEmployeeStats = async () => {
		const { start, end } = getDateRange()

		try {
			let query = supabase
				.from("task_logs")
				.select(`
          *,
          employees!inner(full_name, position),
          task_types!inner(name)
        `)
				.gte("work_date", start)
				.lte("work_date", end)

			if (selectedEmployee !== "all") {
				query = query.eq("employee_id", selectedEmployee)
			}

			const { data: logs, error } = await query

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
			let query = supabase
				.from("task_logs")
				.select(`
          *,
          employees!inner(full_name),
          task_types!inner(name)
        `)
				.gte("work_date", start)
				.lte("work_date", end)

			if (selectedEmployee !== "all") {
				query = query.eq("employee_id", selectedEmployee)
			}

			const { data: logs, error } = await query

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

	const loadOverallStats = async () => {
		const { start, end } = getDateRange()

		try {
			// Загружаем базовые данные
			const { data: allEmployees } = await supabase
				.from("employees")
				.select("id, full_name, position, is_active")

			const { data: allTaskLogs } = await supabase
				.from("task_logs")
				.select(`
					*,
					employees!inner(full_name, position),
					task_types!inner(name)
				`)
				.gte("work_date", start)
				.lte("work_date", end)

			const { data: workSessions } = await supabase
				.from("work_sessions")
				.select("*")
				.gte("date", start)
				.lte("date", end)

			if (!allEmployees || !allTaskLogs) return

			// Основная статистика
			const totalEmployees = allEmployees.length
			const activeEmployees = allEmployees.filter(emp => emp.is_active).length
			const totalTasksCompleted = allTaskLogs.length
			const totalUnitsCompleted = allTaskLogs.reduce((sum, log) => sum + (log.units_completed || 0), 0)
			const totalWorkTime = allTaskLogs.reduce((sum, log) => sum + (log.time_spent_minutes || 0), 0)
			const avgEfficiency = totalWorkTime > 0 ? Math.round((totalUnitsCompleted / totalWorkTime) * 60) : 0

			// Группируем по сотрудникам для лидербордов
			const employeePerformance = new Map()

			allTaskLogs.forEach((log: any) => {
				const empId = log.employee_id
				const existing = employeePerformance.get(empId) || {
					name: log.employees.full_name,
					position: log.employees.position,
					units: 0,
					time: 0,
					tasks: 0,
					efficiency: 0
				}

				existing.units += log.units_completed || 0
				existing.time += log.time_spent_minutes || 0
				existing.tasks += 1
				existing.efficiency = existing.time > 0 ? Math.round((existing.units / existing.time) * 60) : 0

				employeePerformance.set(empId, existing)
			})

			const performers = Array.from(employeePerformance.values())

			// Топ исполнители
			const topPerformers = {
				by_units: performers
					.sort((a, b) => b.units - a.units)
					.slice(0, 10)
					.map(p => ({ name: p.name, units: p.units, position: p.position })),
				by_time: performers
					.sort((a, b) => b.time - a.time)
					.slice(0, 10)
					.map(p => ({ name: p.name, time: p.time, position: p.position })),
				by_efficiency: performers
					.filter(p => p.efficiency > 0)
					.sort((a, b) => b.efficiency - a.efficiency)
					.slice(0, 10)
					.map(p => ({ name: p.name, efficiency: p.efficiency, position: p.position })),
				by_tasks: performers
					.sort((a, b) => b.tasks - a.tasks)
					.slice(0, 10)
					.map(p => ({ name: p.name, tasks: p.tasks, position: p.position }))
			}

			// Распределение по задачам
			const taskDistribution = new Map()
			allTaskLogs.forEach((log: any) => {
				const taskName = log.task_types.name
				const existing = taskDistribution.get(taskName) || { total_units: 0 }
				existing.total_units += log.units_completed || 0
				taskDistribution.set(taskName, existing)
			})

			const taskDistributionArray = Array.from(taskDistribution.entries()).map(([taskName, data]) => ({
				task_name: taskName,
				total_units: data.total_units,
				percentage: Math.round((data.total_units / totalUnitsCompleted) * 100)
			})).sort((a, b) => b.total_units - a.total_units)

			// Статистика по дням
			const dailyStatsMap = new Map()

			// Добавляем данные из задач
			allTaskLogs.forEach((log: any) => {
				const date = log.work_date
				const existing = dailyStatsMap.get(date) || {
					date,
					employees: new Set(),
					tasks: 0,
					units: 0
				}
				existing.employees.add(log.employee_id)
				existing.tasks += 1
				existing.units += log.units_completed || 0
				dailyStatsMap.set(date, existing)
			})

			// Добавляем данные из рабочих сессий
			workSessions?.forEach((session: any) => {
				const date = session.date
				const existing = dailyStatsMap.get(date) || {
					date,
					employees: new Set(),
					tasks: 0,
					units: 0
				}
				existing.employees.add(session.employee_id)
				dailyStatsMap.set(date, existing)
			})

			const dailyStats = Array.from(dailyStatsMap.values())
				.map(stat => ({
					date: stat.date,
					employees: stat.employees.size,
					tasks: stat.tasks,
					units: stat.units
				}))
				.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
				.slice(0, 30) // Последние 30 дней

			setOverallStats({
				total_employees: totalEmployees,
				active_employees: activeEmployees,
				total_tasks_completed: totalTasksCompleted,
				total_units_completed: totalUnitsCompleted,
				total_work_time: totalWorkTime,
				avg_efficiency: avgEfficiency,
				top_performers: topPerformers,
				task_distribution: taskDistributionArray,
				daily_stats: dailyStats
			})

		} catch (error) {
			console.error("Ошибка загрузки общей статистики:", error)
		}
	}

	const formatTime = (minutes: number) => {
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
	}

	const getSegmentColor = (segment: TimelineSegment) => {
		switch (segment.type) {
			case "task":
				return "bg-blue-500"
			case "break":
				return segment.breakType === "lunch" ? "bg-orange-500" : "bg-yellow-500"
			case "idle":
				return "bg-gray-400"
			default:
				return "bg-gray-300"
		}
	}

	const renderAdvancedTimeline = (workday: EmployeeWorkday) => {
		if (!workday.clock_in_time) {
			return <div className="text-sm text-gray-500">Не отмечался</div>
		}

		try {
			const timelineWidth = 800

			// Правильно парсим время начала работы
			let workStartTime: Date
			if (workday.clock_in_time.includes('T')) {
				// Это полный timestamp
				workStartTime = new Date(workday.clock_in_time)
			} else {
				// Это просто время
				workStartTime = new Date(`${workday.date}T${workday.clock_in_time}`)
			}

			// Валидация времени начала работы
			if (isNaN(workStartTime.getTime())) {
				console.warn("Invalid work start time:", workday.clock_in_time)
				return <div className="text-sm text-red-500">Ошибка времени начала работы</div>
			}

			// Правильно парсим время окончания работы
			let workEndTime: Date
			if (workday.clock_out_time) {
				if (workday.clock_out_time.includes('T')) {
					// Это полный timestamp
					workEndTime = new Date(workday.clock_out_time)
				} else {
					// Это просто время
					workEndTime = new Date(`${workday.date}T${workday.clock_out_time}`)
				}
			} else {
				workEndTime = new Date()
			}

			// Валидация времени окончания работы
			if (isNaN(workEndTime.getTime())) {
				console.warn("Invalid work end time:", workday.clock_out_time)
				return <div className="text-sm text-red-500">Ошибка времени окончания работы</div>
			}

			const totalWorkMinutes = Math.max(1, (workEndTime.getTime() - workStartTime.getTime()) / (1000 * 60))

			// Функция для форматирования времени из timestamp'а или простого времени
			const formatTimeDisplay = (timeStr: string) => {
				try {
					if (timeStr.includes('T')) {
						// Это полный timestamp
						return format(new Date(timeStr), "HH:mm")
					} else {
						// Это просто время
						return timeStr.substring(0, 5) // Берем только HH:mm
					}
				} catch {
					return timeStr
				}
			}

			return (
				<div className="space-y-3">
					<div className="flex items-center gap-4 text-sm">
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4 text-gray-500" />
							<span className="font-medium">
								{formatTimeDisplay(workday.clock_in_time)} - {workday.clock_out_time ? formatTimeDisplay(workday.clock_out_time) : "В работе"}
							</span>
						</div>
						<div className="flex items-center gap-2">
							{workday.is_currently_working && (
								<Badge variant="secondary" className="bg-green-100 text-green-800">
									<Activity className="h-3 w-3 mr-1" />
									В работе
								</Badge>
							)}
							<span className="text-gray-600">
								{formatTime(workday.total_work_minutes)}
							</span>
						</div>
					</div>

					<div className="relative bg-gray-100 h-12 rounded-lg border" style={{ width: timelineWidth }}>
						{/* Фон рабочего времени */}
						<div className="absolute top-0 h-full bg-green-200 rounded-lg" style={{ width: '100%' }} />

						{/* Сегменты активности */}
						{workday.segments.filter(segment =>
							!isNaN(segment.start.getTime()) && !isNaN(segment.end.getTime())
						).map((segment, index) => {
							const segmentStart = (segment.start.getTime() - workStartTime.getTime()) / (1000 * 60)
							const segmentDuration = segment.duration
							const leftPercent = Math.max(0, Math.min(95, (segmentStart / totalWorkMinutes) * 100))
							const widthPercent = Math.max(1, Math.min(100 - leftPercent, (segmentDuration / totalWorkMinutes) * 100))

							return (
								<TooltipProvider key={index}>
									<Tooltip>
										<TooltipTrigger asChild>
											<div
												className={`absolute top-1 h-10 border border-white cursor-pointer hover:opacity-80 transition-opacity ${getSegmentColor(segment)}`}
												style={{
													left: `${leftPercent}%`,
													width: `${widthPercent}%`,
													borderRadius: '4px'
												}}
											/>
										</TooltipTrigger>
										<TooltipContent>
											<div className="text-xs space-y-1">
												<div className="font-medium">
													{segment.type === "task" && segment.taskName}
													{segment.type === "break" && `Перерыв (${segment.breakType})`}
													{segment.type === "idle" && "Простой"}
												</div>
												<div>
													{format(segment.start, "HH:mm")} - {format(segment.end, "HH:mm")}
												</div>
												<div>Длительность: {formatTime(segment.duration)}</div>
												{segment.units && <div>Единиц: {segment.units}</div>}
											</div>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)
						})}
					</div>

					{/* Временные метки */}
					<div className="flex justify-between text-xs text-gray-500">
						<span>{format(workStartTime, "HH:mm")}</span>
						<span>{format(new Date(workStartTime.getTime() + (totalWorkMinutes / 4) * 60000), "HH:mm")}</span>
						<span>{format(new Date(workStartTime.getTime() + (totalWorkMinutes / 2) * 60000), "HH:mm")}</span>
						<span>{format(new Date(workStartTime.getTime() + (totalWorkMinutes * 3 / 4) * 60000), "HH:mm")}</span>
						<span>{format(workEndTime, "HH:mm")}</span>
					</div>

					{/* Легенда */}
					<div className="flex flex-wrap gap-3 text-xs">
						<div className="flex items-center gap-1">
							<div className="w-3 h-3 bg-blue-500 rounded"></div>
							<span>Задачи</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="w-3 h-3 bg-orange-500 rounded"></div>
							<span>Обед</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="w-3 h-3 bg-yellow-500 rounded"></div>
							<span>Перерыв</span>
						</div>
						<div className="flex items-center gap-1">
							<div className="w-3 h-3 bg-gray-400 rounded"></div>
							<span>Простой</span>
						</div>
					</div>
				</div>
			)
		} catch (error) {
			console.error("Error rendering timeline:", error)
			return <div className="text-sm text-red-500">Ошибка отображения временной шкалы</div>
		}
	}

	const renderOverallStats = () => {
		if (!overallStats) {
			return (
				<div className="flex items-center justify-center py-8">
					<div className="text-center">
						<Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
						<p>Загрузка общей статистики...</p>
					</div>
				</div>
			)
		}

		return (
			<div className="space-y-6">
				{/* Основные показатели */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-muted-foreground">Всего сотрудников</p>
									<p className="text-2xl font-bold">{overallStats.total_employees}</p>
									<p className="text-xs text-green-600">
										{overallStats.active_employees} активных
									</p>
								</div>
								<Users className="h-8 w-8 text-blue-500" />
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-muted-foreground">Задач выполнено</p>
									<p className="text-2xl font-bold">{overallStats.total_tasks_completed.toLocaleString()}</p>
									<p className="text-xs text-muted-foreground">
										за {getDateRangeDescription()}
									</p>
								</div>
								<Target className="h-8 w-8 text-green-500" />
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-muted-foreground">Единиц выполнено</p>
									<p className="text-2xl font-bold">{overallStats.total_units_completed.toLocaleString()}</p>
									<p className="text-xs text-muted-foreground">
										общий объем работ
									</p>
								</div>
								<TrendingUp className="h-8 w-8 text-purple-500" />
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-muted-foreground">Общее время</p>
									<p className="text-2xl font-bold">{formatTime(overallStats.total_work_time)}</p>
									<p className="text-xs text-blue-600">
										{overallStats.avg_efficiency} ед/час
									</p>
								</div>
								<Clock className="h-8 w-8 text-orange-500" />
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Лидерборды */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Топ по единицам */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5" />
								Лидеры по объему работ
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{overallStats.top_performers.by_units.slice(0, 5).map((performer, index) => (
									<div key={performer.name} className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
										<div className="flex items-center gap-3">
											<div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-yellow-500' :
												index === 1 ? 'bg-gray-400' :
													index === 2 ? 'bg-orange-500' : 'bg-blue-500'
												}`}>
												{index + 1}
											</div>
											<div>
												<div className="font-medium">{performer.name}</div>
												<div className="text-sm text-muted-foreground">{performer.position}</div>
											</div>
										</div>
										<div className="text-right">
											<div className="font-bold text-purple-600">{performer.units}</div>
											<div className="text-xs text-muted-foreground">единиц</div>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* Топ по эффективности */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Activity className="h-5 w-5" />
								Лидеры по эффективности
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{overallStats.top_performers.by_efficiency.slice(0, 5).map((performer, index) => (
									<div key={performer.name} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
										<div className="flex items-center gap-3">
											<div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-yellow-500' :
												index === 1 ? 'bg-gray-400' :
													index === 2 ? 'bg-orange-500' : 'bg-green-500'
												}`}>
												{index + 1}
											</div>
											<div>
												<div className="font-medium">{performer.name}</div>
												<div className="text-sm text-muted-foreground">{performer.position}</div>
											</div>
										</div>
										<div className="text-right">
											<div className="font-bold text-green-600">{performer.efficiency}</div>
											<div className="text-xs text-muted-foreground">ед/час</div>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Распределение задач */}
				<Card>
					<CardHeader>
						<CardTitle>Распределение работ по типам задач</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{overallStats.task_distribution.slice(0, 8).map((task, index) => (
								<div key={task.task_name} className="space-y-2">
									<div className="flex justify-between items-center">
										<span className="font-medium">{task.task_name}</span>
										<div className="flex items-center gap-2">
											<span className="text-sm text-muted-foreground">
												{task.total_units.toLocaleString()} ед.
											</span>
											<Badge variant="outline">{task.percentage}%</Badge>
										</div>
									</div>
									<div className="w-full bg-gray-200 rounded-full h-2">
										<div
											className={`h-2 rounded-full ${index % 4 === 0 ? 'bg-blue-500' :
												index % 4 === 1 ? 'bg-green-500' :
													index % 4 === 2 ? 'bg-purple-500' : 'bg-orange-500'
												}`}
											style={{ width: `${Math.min(task.percentage, 100)}%` }}
										></div>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>

				{/* Дневная статистика */}
				<Card>
					<CardHeader>
						<CardTitle>Активность по дням</CardTitle>
						<CardDescription>
							Последние {Math.min(overallStats.daily_stats.length, 30)} дней
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{overallStats.daily_stats.slice(0, 10).map((day) => (
								<div key={day.date} className="flex items-center justify-between p-3 border rounded-lg">
									<div>
										<div className="font-medium">
											{format(new Date(day.date), "dd MMMM yyyy", { locale: ru })}
										</div>
										<div className="text-sm text-muted-foreground">
											{format(new Date(day.date), "EEEE", { locale: ru })}
										</div>
									</div>
									<div className="flex gap-6 text-center">
										<div>
											<div className="font-bold text-blue-600">{day.employees}</div>
											<div className="text-xs text-muted-foreground">сотр.</div>
										</div>
										<div>
											<div className="font-bold text-green-600">{day.tasks}</div>
											<div className="text-xs text-muted-foreground">задач</div>
										</div>
										<div>
											<div className="font-bold text-purple-600">{day.units}</div>
											<div className="text-xs text-muted-foreground">единиц</div>
										</div>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
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
						Детальный анализ работы сотрудников • {getDateRangeDescription()}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{/* Режим выбора даты */}
						<div className="flex flex-wrap gap-2">
							<Button
								variant={dateMode === "preset" ? "default" : "outline"}
								size="sm"
								onClick={() => setDateMode("preset")}
							>
								Быстрый выбор
							</Button>
							<Button
								variant={dateMode === "single" ? "default" : "outline"}
								size="sm"
								onClick={() => setDateMode("single")}
							>
								Конкретная дата
							</Button>
							<Button
								variant={dateMode === "range" ? "default" : "outline"}
								size="sm"
								onClick={() => setDateMode("range")}
							>
								Период
							</Button>
						</div>

						{/* Элементы управления в зависимости от режима */}
						<div className="flex flex-wrap gap-4 items-center">
							{dateMode === "preset" && (
								<Select value={selectedPreset} onValueChange={setSelectedPreset}>
									<SelectTrigger className="w-48">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="today">📅 Сегодня</SelectItem>
										<SelectItem value="yesterday">📅 Вчера</SelectItem>
										<SelectItem value="last-7-days">📊 Последние 7 дней</SelectItem>
										<SelectItem value="this-week">📆 Эта неделя</SelectItem>
										<SelectItem value="last-week">📆 Прошлая неделя</SelectItem>
										<SelectItem value="last-30-days">📊 Последние 30 дней</SelectItem>
										<SelectItem value="this-month">🗓️ Этот месяц</SelectItem>
										<SelectItem value="last-month">🗓️ Прошлый месяц</SelectItem>
									</SelectContent>
								</Select>
							)}

							{dateMode === "single" && (
								<Popover>
									<PopoverTrigger asChild>
										<Button variant="outline" className="w-48">
											<CalendarIcon className="mr-2 h-4 w-4" />
											{format(selectedDate, "dd.MM.yyyy")}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0" align="start">
										<Calendar
											mode="single"
											selected={selectedDate}
											onSelect={(date) => date && setSelectedDate(date)}
											locale={ru}
											weekStartsOn={1}
											className="rounded-md border"
										/>
									</PopoverContent>
								</Popover>
							)}

							{dateMode === "range" && (
								<div className="flex gap-2 items-center">
									<Popover>
										<PopoverTrigger asChild>
											<Button variant="outline" className="w-40">
												<CalendarIcon className="mr-2 h-4 w-4" />
												{format(dateRange.start, "dd.MM.yyyy")}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<Calendar
												mode="single"
												selected={dateRange.start}
												onSelect={(date) => date && setDateRange(prev => ({ ...prev, start: date }))}
												locale={ru}
												weekStartsOn={1}
												className="rounded-md border"
											/>
										</PopoverContent>
									</Popover>
									<span className="text-muted-foreground">—</span>
									<Popover>
										<PopoverTrigger asChild>
											<Button variant="outline" className="w-40">
												<CalendarIcon className="mr-2 h-4 w-4" />
												{format(dateRange.end, "dd.MM.yyyy")}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<Calendar
												mode="single"
												selected={dateRange.end}
												onSelect={(date) => date && setDateRange(prev => ({ ...prev, end: date }))}
												locale={ru}
												weekStartsOn={1}
												className="rounded-md border"
												disabled={(date) => date < dateRange.start}
											/>
										</PopoverContent>
									</Popover>
								</div>
							)}

							{/* Селектор сотрудника */}
							<Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
								<SelectTrigger className="w-48">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">
										<div className="flex items-center gap-2">
											<Users className="h-4 w-4" />
											Все сотрудники
										</div>
									</SelectItem>
									{employees.map((employee) => (
										<SelectItem key={employee.id} value={employee.id}>
											<div className="flex items-center gap-2">
												<User className="h-4 w-4" />
												{employee.full_name}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Информация о выбранном периоде */}
						<div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
							<div className="flex items-center gap-2">
								<CalendarIcon className="h-4 w-4" />
								<span>
									Анализ за: <strong>{getDateRangeDescription()}</strong>
									{selectedEmployee !== "all" && (
										<span> • Сотрудник: <strong>{employees.find(e => e.id === selectedEmployee)?.full_name}</strong></span>
									)}
								</span>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
				<TabsList>
					<TabsTrigger value="overall">Общая статистика</TabsTrigger>
					<TabsTrigger value="timeline">Временная шкала</TabsTrigger>
					<TabsTrigger value="employees">Сотрудники</TabsTrigger>
					<TabsTrigger value="tasks">Задачи</TabsTrigger>
				</TabsList>

				<TabsContent value="overall">
					<Card>
						<CardHeader>
							<CardTitle>Общая статистика и лидерборды</CardTitle>
							<CardDescription>
								Комплексная аналитика работы команды с ключевыми показателями эффективности
							</CardDescription>
						</CardHeader>
						<CardContent>
							{renderOverallStats()}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="timeline">
					<Card>
						<CardHeader>
							<CardTitle>Детальная временная шкала</CardTitle>
							<CardDescription>
								Расширенная визуализация рабочего дня с задачами, перерывами и простоями
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-8">
								{employeeWorkdays.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										Нет данных за выбранный период
									</div>
								) : (
									employeeWorkdays.map((workday) => {
										// Валидируем дату рабочего дня
										const workdayDate = new Date(workday.date)
										if (isNaN(workdayDate.getTime())) {
											console.warn("Invalid workday date:", workday.date)
											return null
										}

										return (
											<div key={`${workday.employee_id}_${workday.date}`} className="border rounded-lg p-6 space-y-4">
												<div className="flex justify-between items-start">
													<div>
														<h3 className="font-semibold text-lg">{workday.full_name}</h3>
														<p className="text-sm text-gray-500">
															{format(workdayDate, "dd MMMM yyyy", { locale: ru })}
														</p>
													</div>
													<div className="flex gap-3">
														<Badge variant="outline">
															{workday.tasks.length} задач
														</Badge>
														<Badge variant="outline">
															{workday.tasks.reduce((sum, task) => sum + task.units_completed, 0)} единиц
														</Badge>
														<Badge variant="outline">
															{workday.segments.filter(s => s.type === "break").length} перерывов
														</Badge>
													</div>
												</div>

												{renderAdvancedTimeline(workday)}

												{workday.tasks.length > 0 && (
													<div className="mt-6">
														<h4 className="font-medium mb-3">Выполненные задачи:</h4>
														<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
															{workday.tasks.map((task) => (
																<div key={task.id} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
																	<div className="font-medium text-sm text-blue-900">{task.task_name}</div>
																	<div className="text-xs text-blue-700 mt-1">
																		{task.units_completed} ед. • {formatTime(task.time_spent_minutes)}
																	</div>
																	{task.notes && (
																		<div className="text-xs text-gray-600 mt-1 italic">
																			{task.notes}
																		</div>
																	)}
																</div>
															))}
														</div>
													</div>
												)}
											</div>
										)
									}).filter(Boolean) // Убираем null элементы
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
								{employeeStats.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										Нет данных за выбранный период
									</div>
								) : (
									employeeStats.map((employee) => (
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
									))
								)}
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
								{taskStats.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										Нет данных за выбранный период
									</div>
								) : (
									taskStats.map((task) => (
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
									))
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	)
} 