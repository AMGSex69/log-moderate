"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabase } from "@/lib/supabase"
import { getTaskGroup } from "@/lib/game-config"
import {
	CalendarIcon,
	Clock,
	Target,
	User,
	BarChart3,
	AlertTriangle,
	CheckCircle2,
	XCircle
} from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface EmployeeWorkLog {
	employee_id: string
	full_name: string
	position: string
	total_tasks: number
	total_units: number
	total_time: number
	completion_percentage: number
	status: 'normal' | 'critical_underwork' | 'close_to_norm' | 'exceed_norm'
	task_breakdown: {
		task_name: string
		units: number
		time: number
		percentage: number
	}[]
}

export default function DetailedEmployeeReport() {
	const [selectedDate, setSelectedDate] = useState<Date>(new Date())
	const [reportData, setReportData] = useState<{
		total_employees: number
		working_employees: number
		total_units: number
		mzhi_decisions: number
		employee_logs: EmployeeWorkLog[]
	} | null>(null)
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		loadReportData()
	}, [selectedDate])

	const loadReportData = async () => {
		setLoading(true)
		try {
			const dateStr = format(selectedDate, 'yyyy-MM-dd')

			const { data: employees } = await supabase
				.from("employees")
				.select("id, full_name, position, work_hours")
				.eq("is_active", true)

			if (!employees) return

			const { data: taskLogs } = await supabase
				.from("task_logs")
				.select(`
          *,
          employees!inner(full_name, position),
          task_types!inner(name)
        `)
				.eq("work_date", dateStr)
				.in("employee_id", employees.map(emp => emp.id))

			const employeeLogs: EmployeeWorkLog[] = employees.map(employee => {
				const employeeTasks = taskLogs?.filter(log => log.employee_id === employee.id) || []

				const totalTasks = employeeTasks.length
				const totalUnits = employeeTasks.reduce((sum, task) => sum + task.units_completed, 0)
				const totalTime = employeeTasks.reduce((sum, task) => sum + task.time_spent_minutes, 0)
				const workNormMinutes = (employee.work_hours || 8) * 60
				const completionPercentage = Math.round((totalTime / workNormMinutes) * 100)

				let status: EmployeeWorkLog['status'] = 'normal'
				if (completionPercentage < 50) {
					status = 'critical_underwork'
				} else if (completionPercentage < 80) {
					status = 'close_to_norm'
				} else if (completionPercentage > 120) {
					status = 'exceed_norm'
				}

				const taskBreakdownMap = new Map()
				employeeTasks.forEach(task => {
					const taskName = task.task_types.name
					const existing = taskBreakdownMap.get(taskName) || {
						task_name: taskName,
						units: 0,
						time: 0,
						percentage: 0
					}

					existing.units += task.units_completed
					existing.time += task.time_spent_minutes

					taskBreakdownMap.set(taskName, existing)
				})

				const taskBreakdown = Array.from(taskBreakdownMap.values()).map(task => ({
					...task,
					percentage: totalTime > 0 ? Math.round((task.time / totalTime) * 100) : 0
				})).sort((a, b) => b.time - a.time)

				return {
					employee_id: employee.id,
					full_name: employee.full_name,
					position: employee.position,
					total_tasks: totalTasks,
					total_units: totalUnits,
					total_time: totalTime,
					completion_percentage: completionPercentage,
					status,
					task_breakdown: taskBreakdown
				}
			})

			const mzhiDecisions = taskLogs?.filter(log =>
				log.task_types.name === "Внесение решений МЖИ (кол-во бланков)"
			).reduce((sum, log) => sum + log.units_completed, 0) || 0

			setReportData({
				total_employees: employees.length,
				working_employees: employeeLogs.filter(log => log.total_tasks > 0).length,
				total_units: employeeLogs.reduce((sum, log) => sum + log.total_units, 0),
				mzhi_decisions: mzhiDecisions,
				employee_logs: employeeLogs.sort((a, b) => b.total_units - a.total_units)
			})

		} catch (error) {
			console.error("Ошибка загрузки отчета:", error)
		} finally {
			setLoading(false)
		}
	}

	const formatTime = (minutes: number) => {
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
	}

	const getStatusColor = (status: EmployeeWorkLog['status']) => {
		switch (status) {
			case 'critical_underwork': return 'bg-red-100 text-red-800'
			case 'close_to_norm': return 'bg-yellow-100 text-yellow-800'
			case 'exceed_norm': return 'bg-blue-100 text-blue-800'
			default: return 'bg-green-100 text-green-800'
		}
	}

	const getStatusIcon = (status: EmployeeWorkLog['status']) => {
		switch (status) {
			case 'critical_underwork': return <XCircle className="h-4 w-4" />
			case 'close_to_norm': return <AlertTriangle className="h-4 w-4" />
			case 'exceed_norm': return <BarChart3 className="h-4 w-4" />
			default: return <CheckCircle2 className="h-4 w-4" />
		}
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<User className="h-6 w-6" />
						Детальный отчет по сотрудникам
					</CardTitle>
					<CardDescription>
						Полная статистика работы команды как в вашей Google Sheets таблице
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline" className="w-[240px]">
								<CalendarIcon className="mr-2 h-4 w-4" />
								{format(selectedDate, "d MMMM yyyy", { locale: ru })}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0">
							<Calendar
								mode="single"
								selected={selectedDate}
								onSelect={(date) => date && setSelectedDate(date)}
								disabled={(date) => date > new Date()}
								initialFocus
							/>
						</PopoverContent>
					</Popover>
				</CardContent>
			</Card>

			{loading ? (
				<Card>
					<CardContent className="p-8 text-center">
						<div className="text-4xl animate-spin mb-4">📊</div>
						<p>Загружаем отчет...</p>
					</CardContent>
				</Card>
			) : reportData ? (
				<>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<Card>
							<CardContent className="p-4 text-center">
								<User className="h-6 w-6 mx-auto mb-2 text-blue-600" />
								<div className="text-2xl font-bold">{reportData.total_employees}</div>
								<div className="text-sm text-muted-foreground">Всего сотрудников</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4 text-center">
								<CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
								<div className="text-2xl font-bold">{reportData.working_employees}</div>
								<div className="text-sm text-muted-foreground">Работали</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4 text-center">
								<Target className="h-6 w-6 mx-auto mb-2 text-purple-600" />
								<div className="text-2xl font-bold">{reportData.total_units}</div>
								<div className="text-sm text-muted-foreground">Единиц выполнено</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4 text-center">
								<div className="w-6 h-6 mx-auto mb-2 bg-red-600 rounded text-white text-xs flex items-center justify-center font-bold">
									МЖ
								</div>
								<div className="text-2xl font-bold">{reportData.mzhi_decisions}</div>
								<div className="text-sm text-muted-foreground">Решений МЖИ</div>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Детализация по сотрудникам</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{reportData.employee_logs.map((employee, index) => (
									<div key={employee.employee_id} className="border rounded-lg p-4">
										<div className="flex items-center justify-between mb-4">
											<div className="flex items-center gap-3">
												<Badge variant={index < 3 ? "default" : "secondary"}>
													#{index + 1}
												</Badge>
												<div>
													<div className="font-medium">{employee.full_name}</div>
													<div className="text-sm text-muted-foreground">{employee.position}</div>
												</div>
												<Badge className={getStatusColor(employee.status)}>
													{getStatusIcon(employee.status)}
													<span className="ml-1">
														{employee.status === 'critical_underwork' ? 'Критическая недоработка' :
															employee.status === 'close_to_norm' ? 'Близко к норме' :
																employee.status === 'exceed_norm' ? 'Превышение нормы' : 'Нормально'}
													</span>
												</Badge>
											</div>

											<div className="flex gap-6 text-center">
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
													<div className={`font-bold text-lg ${employee.completion_percentage < 50 ? 'text-red-600' :
														employee.completion_percentage < 80 ? 'text-yellow-600' :
															employee.completion_percentage > 120 ? 'text-blue-600' : 'text-green-600'
														}`}>
														{employee.completion_percentage}%
													</div>
													<div className="text-xs text-muted-foreground">от нормы</div>
												</div>
											</div>
										</div>

										{employee.task_breakdown.length > 0 && (
											<div className="mt-3">
												<div className="text-sm font-medium text-muted-foreground mb-2">
													Разбивка по задачам:
												</div>
												<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
													{employee.task_breakdown.slice(0, 6).map((task, taskIndex) => (
														<div key={taskIndex} className="p-2 bg-muted/50 rounded text-sm">
															<div className="font-medium truncate" title={task.task_name}>
																{task.task_name}
															</div>
															<div className="flex justify-between text-xs text-muted-foreground">
																<span>{task.units} ед.</span>
																<span>{formatTime(task.time)}</span>
																<span>{task.percentage}%</span>
															</div>
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</>
			) : (
				<Card>
					<CardContent className="p-8 text-center">
						<CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
						<p className="text-muted-foreground">Выберите дату для загрузки отчета</p>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
