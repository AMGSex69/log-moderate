"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import PixelButton from "./pixel-button"
import PixelCard from "./pixel-card"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Clock, Play, Pause, LogOut, AlertTriangle, CheckCircle, Briefcase } from "lucide-react"

interface WorkSessionData {
	id?: string
	clockInTime: Date | null
	clockOutTime: Date | null
	expectedEndTime: Date | null
	isPaused: boolean
	pauseStartTime: Date | null
	totalWorkMinutes: number
	totalBreakMinutes: number
	overtimeMinutes: number
	isAutoClockOut: boolean
}

interface WorkingEmployee {
	id: string
	full_name: string
	clock_in_time: string
	expected_end_time: string | null
	is_paused: boolean
	current_task?: string
	work_time_minutes: number
}

interface WorkSessionEnhancedProps {
	onSessionChange: (isWorking: boolean) => void
}

export default function WorkSessionEnhanced({ onSessionChange }: WorkSessionEnhancedProps) {
	const { user, profile } = useAuth()
	const { toast } = useToast()

	const [sessionData, setSessionData] = useState<WorkSessionData>({
		clockInTime: null,
		clockOutTime: null,
		expectedEndTime: null,
		isPaused: false,
		pauseStartTime: null,
		totalWorkMinutes: 0,
		totalBreakMinutes: 0,
		overtimeMinutes: 0,
		isAutoClockOut: false,
	})

	const [workingEmployees, setWorkingEmployees] = useState<WorkingEmployee[]>([])
	const [loading, setLoading] = useState(true)
	const [showEndDialog, setShowEndDialog] = useState(false)
	const [currentTime, setCurrentTime] = useState(new Date())

	// Refs для предотвращения повторных вызовов
	const sessionLoadingRef = useRef(false)
	const employeesLoadingRef = useRef(false)
	const lastSessionLoad = useRef(0)
	const lastEmployeesLoad = useRef(0)

	// Обновляем время каждую секунду
	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(new Date())
		}, 1000)
		return () => clearInterval(interval)
	}, [])

	// Мемоизированная функция загрузки данных сессии
	const loadSessionData = useCallback(async () => {
		if (!user || sessionLoadingRef.current) return

		// Предотвращаем частые запросы (не чаще раза в 5 секунд)
		const now = Date.now()
		if (now - lastSessionLoad.current < 5000) return

		sessionLoadingRef.current = true
		lastSessionLoad.current = now

		try {
			setLoading(true)
			console.log("🔍 Загружаем данные сессии для пользователя:", user.id)

			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) {
				console.error("❌ Ошибка получения employee_id:", empError)
				return
			}

			console.log("✅ Employee ID найден:", employeeId)

			const today = new Date().toISOString().split("T")[0]
			console.log("📅 Ищем сессию на дату:", today)

			const { data: session, error: sessionError } = await supabase
				.from("work_sessions")
				.select("*")
				.eq("employee_id", employeeId)
				.eq("date", today)
				.single()

			if (sessionError && sessionError.code !== "PGRST116") {
				console.error("❌ Ошибка загрузки сессии:", sessionError)
				throw sessionError
			}

			console.log("📊 Данные сессии:", session)

			if (session) {
				const workHours = getWorkHours()
				const expectedEnd = session.clock_in_time
					? new Date(new Date(session.clock_in_time).getTime() + workHours * 60 * 60 * 1000)
					: null

				setSessionData({
					id: session.id,
					clockInTime: session.clock_in_time ? new Date(session.clock_in_time) : null,
					clockOutTime: session.clock_out_time ? new Date(session.clock_out_time) : null,
					expectedEndTime: expectedEnd,
					isPaused: session.is_paused || false,
					pauseStartTime: session.pause_start_time ? new Date(session.pause_start_time) : null,
					totalWorkMinutes: session.total_work_minutes || 0,
					totalBreakMinutes: session.total_break_minutes || 0,
					overtimeMinutes: session.overtime_minutes || 0,
					isAutoClockOut: session.is_auto_clocked_out || false,
				})

				// Уведомляем родительский компонент о статусе работы
				const isWorking = session.clock_in_time && !session.clock_out_time
				onSessionChange(isWorking)
				console.log("🎯 Статус работы:", isWorking ? "Работает" : "Не работает")
			} else {
				console.log("📝 Сессия не найдена, создаем пустую")
				setSessionData({
					clockInTime: null,
					clockOutTime: null,
					expectedEndTime: null,
					isPaused: false,
					pauseStartTime: null,
					totalWorkMinutes: 0,
					totalBreakMinutes: 0,
					overtimeMinutes: 0,
					isAutoClockOut: false,
				})
				onSessionChange(false)
			}
		} catch (error) {
			console.error("💥 Критическая ошибка загрузки сессии:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось загрузить данные рабочей смены",
				variant: "destructive" as const,
			})
		} finally {
			setLoading(false)
			sessionLoadingRef.current = false
		}
	}, [user, onSessionChange, toast])

	// Мемоизированная функция загрузки работающих сотрудников
	const loadWorkingEmployees = useCallback(async () => {
		if (employeesLoadingRef.current) return

		// Предотвращаем частые запросы (не чаще раза в 10 секунд)
		const now = Date.now()
		if (now - lastEmployeesLoad.current < 10000) return

		employeesLoadingRef.current = true
		lastEmployeesLoad.current = now

		try {
			console.log("👥 Загружаем работающих сотрудников...")

			const today = new Date().toISOString().split("T")[0]

			// Упрощенный запрос - сначала получаем рабочие сессии
			const { data: workingSessions, error: sessionsError } = await supabase
				.from("work_sessions")
				.select("employee_id, clock_in_time, expected_end_time, is_paused, total_break_minutes")
				.eq("date", today)
				.not("clock_in_time", "is", null)
				.is("clock_out_time", null)

			if (sessionsError) {
				console.error("❌ Ошибка загрузки рабочих сессий:", sessionsError)
				return
			}

			console.log("💼 Найдено работающих сессий:", workingSessions?.length || 0)

			if (!workingSessions || workingSessions.length === 0) {
				setWorkingEmployees([])
				return
			}

			// Получаем информацию о сотрудниках отдельным запросом
			const employeeIds = workingSessions.map((session) => session.employee_id)
			const { data: employees, error: employeesError } = await supabase
				.from("employees")
				.select("id, full_name")
				.in("id", employeeIds)

			if (employeesError) {
				console.error("❌ Ошибка загрузки сотрудников:", employeesError)
				return
			}

			// Получаем активные задачи отдельным запросом
			const { data: activeTasks, error: tasksError } = await supabase
				.from("active_sessions")
				.select("employee_id, task_type_id")
				.in("employee_id", employeeIds)

			if (tasksError) {
				console.error("❌ Ошибка загрузки активных задач:", tasksError)
			}

			// Получаем типы задач если есть активные задачи
			let taskTypes: any[] = []
			if (activeTasks && activeTasks.length > 0) {
				const taskTypeIds = activeTasks.map((task) => task.task_type_id)
				const { data: types, error: typesError } = await supabase
					.from("task_types")
					.select("id, name")
					.in("id", taskTypeIds)

				if (!typesError) {
					taskTypes = types || []
				}
			}

			// Создаем карты для быстрого поиска
			const employeesMap = new Map()
			employees?.forEach((emp) => {
				employeesMap.set(emp.id, emp.full_name)
			})

			const taskTypesMap = new Map()
			taskTypes.forEach((type) => {
				taskTypesMap.set(type.id, type.name)
			})

			const employeeTasksMap = new Map()
			activeTasks?.forEach((task) => {
				const taskName = taskTypesMap.get(task.task_type_id)
				if (taskName) {
					employeeTasksMap.set(task.employee_id, taskName)
				}
			})

			// Формируем список работающих сотрудников
			const workingList: WorkingEmployee[] = workingSessions.map((session) => {
				const clockInTime = new Date(session.clock_in_time)
				const workTimeMinutes = Math.floor((currentTime.getTime() - clockInTime.getTime()) / 60000)
				const effectiveWorkTime = Math.max(0, workTimeMinutes - (session.total_break_minutes || 0))

				return {
					id: session.employee_id,
					full_name: employeesMap.get(session.employee_id) || "Неизвестный сотрудник",
					clock_in_time: session.clock_in_time,
					expected_end_time: session.expected_end_time,
					is_paused: session.is_paused,
					current_task: employeeTasksMap.get(session.employee_id),
					work_time_minutes: effectiveWorkTime,
				}
			})

			console.log("✅ Обработано работающих сотрудников:", workingList.length)
			setWorkingEmployees(workingList)
		} catch (error) {
			console.error("💥 Критическая ошибка загрузки работающих сотрудников:", error)
			setWorkingEmployees([])
		} finally {
			employeesLoadingRef.current = false
		}
	}, [currentTime])

	// Загружаем данные при монтировании и изменении пользователя
	useEffect(() => {
		if (user) {
			loadSessionData()
		}
	}, [user, loadSessionData])

	// Загружаем работающих сотрудников с интервалом
	useEffect(() => {
		if (user) {
			loadWorkingEmployees()

			// Обновляем список работающих сотрудников каждые 30 секунд
			const interval = setInterval(loadWorkingEmployees, 30000)
			return () => clearInterval(interval)
		}
	}, [user, loadWorkingEmployees])

	const getWorkHours = () => {
		if (!profile?.work_schedule) return 9
		return profile.work_schedule === "12" ? 12 : 9 // 8+1 = 9 часов
	}

	const handleClockIn = async () => {
		console.log("🎯 handleClockIn: Начало функции")
		console.log("🎯 handleClockIn: user =", !!user, "profile =", !!profile)

		if (!user || !profile) {
			console.error("❌ handleClockIn: Нет пользователя или профиля")
			return
		}

		try {
			console.log("🔍 handleClockIn: Получаем employeeId для user:", user.id)
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			console.log("🔍 handleClockIn: employeeId =", employeeId, "error =", empError)

			if (empError || !employeeId) {
				console.error("❌ handleClockIn: Employee not found", empError)
				throw new Error("Employee not found")
			}

			const now = new Date()
			const workHours = getWorkHours()
			const expectedEnd = new Date(now.getTime() + workHours * 60 * 60 * 1000)
			console.log("⏰ handleClockIn: workHours =", workHours, "expectedEnd =", expectedEnd)

			// Сначала проверяем, есть ли уже сессия на сегодня
			console.log("🔍 handleClockIn: Проверяем существующую сессию")
			const { data: existingSession, error: checkError } = await supabase
				.from("work_sessions")
				.select("id, clock_out_time, clock_in_time")
				.eq("employee_id", employeeId)
				.eq("date", now.toISOString().split("T")[0])
				.single()

			console.log("📊 handleClockIn: existingSession =", existingSession, "checkError =", checkError)

			let sessionData
			if (existingSession) {
				console.log("🔄 handleClockIn: Обновляем существующую сессию")
				console.log("📝 handleClockIn: Сессия ДО обновления:", {
					id: existingSession.id,
					clock_in_time: existingSession.clock_in_time,
					clock_out_time: existingSession.clock_out_time
				})

				// Если сессия существует, обновляем её (повторное начало дня)
				const updateData = {
					clock_in_time: now.toISOString(),
					clock_out_time: null, // Сбрасываем время окончания
					expected_end_time: expectedEnd.toISOString(),
					is_paused: false,
					pause_start_time: null,
					total_work_minutes: 0,
					total_break_minutes: 0,
					overtime_minutes: 0,
					is_auto_clocked_out: false,
					updated_at: now.toISOString(),
				}

				console.log("📝 handleClockIn: Данные для обновления:", updateData)

				const { data, error } = await supabase
					.from("work_sessions")
					.update(updateData)
					.eq("id", existingSession.id)
					.select()
					.single()

				if (error) {
					console.error("❌ handleClockIn: Ошибка обновления сессии", error)
					throw error
				}
				sessionData = data
				console.log("✅ handleClockIn: Сессия ПОСЛЕ обновления:", sessionData)
			} else {
				console.log("➕ handleClockIn: Создаём новую сессию")
				// Если сессии нет, создаем новую
				const { data, error } = await supabase
					.from("work_sessions")
					.insert({
						employee_id: employeeId,
						date: now.toISOString().split("T")[0],
						clock_in_time: now.toISOString(),
						expected_end_time: expectedEnd.toISOString(),
						is_paused: false,
						total_work_minutes: 0,
						total_break_minutes: 0,
						overtime_minutes: 0,
					})
					.select()
					.single()

				if (error) {
					console.error("❌ handleClockIn: Ошибка создания сессии", error)
					throw error
				}
				sessionData = data
				console.log("✅ handleClockIn: Новая сессия создана", sessionData)
			}

			// ВАЖНО: Немедленно обновляем локальное состояние
			console.log("🔄 handleClockIn: Обновляем локальное состояние")
			const newSessionData: WorkSessionData = {
				id: sessionData.id,
				clockInTime: new Date(sessionData.clock_in_time),
				clockOutTime: sessionData.clock_out_time ? new Date(sessionData.clock_out_time) : null,
				expectedEndTime: expectedEnd,
				isPaused: false,
				pauseStartTime: null,
				totalWorkMinutes: 0,
				totalBreakMinutes: 0,
				overtimeMinutes: 0,
				isAutoClockOut: false,
			}

			setSessionData(newSessionData)
			console.log("✅ handleClockIn: Локальное состояние обновлено", newSessionData)

			// Уведомляем родительский компонент НЕМЕДЛЕННО
			console.log("🔄 handleClockIn: Уведомляем о смене статуса работы")
			onSessionChange(true)

			// Обновляем статус онлайн
			console.log("🔄 handleClockIn: Обновляем статус онлайн")
			if (user) {
				await authService.updateOnlineStatus(user.id, true)
			}

			// Загружаем данные асинхронно (не блокируя UI) с задержкой для уверенности что данные обновились
			console.log("🔄 handleClockIn: Запускаем фоновое обновление данных через 2 секунды")
			setTimeout(() => {
				loadSessionData().catch(console.error)
				loadWorkingEmployees().catch(console.error)
			}, 2000)

			console.log("✅ handleClockIn: Всё успешно!")
			toast({
				title: "🎯 Рабочий день начат!",
				description: `Ожидаемое окончание: ${expectedEnd.toLocaleTimeString()}`,
			})
		} catch (error) {
			console.error("💥 handleClockIn: Критическая ошибка:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось начать рабочий день",
				variant: "destructive" as const,
			})
		}
	}

	const handleTogglePause = async () => {
		if (!sessionData.id) return

		try {
			const now = new Date()
			const newPausedState = !sessionData.isPaused

			const updateData: any = {
				is_paused: newPausedState,
				updated_at: now.toISOString(),
			}

			if (newPausedState) {
				// Начинаем паузу
				updateData.pause_start_time = now.toISOString()
			} else {
				// Заканчиваем паузу
				if (sessionData.pauseStartTime) {
					const pauseDuration = Math.floor((now.getTime() - sessionData.pauseStartTime.getTime()) / 60000)
					updateData.total_break_minutes = sessionData.totalBreakMinutes + pauseDuration
				}
				updateData.pause_start_time = null
			}

			const { error } = await supabase.from("work_sessions").update(updateData).eq("id", sessionData.id)

			if (error) throw error

			await loadSessionData()
			await loadWorkingEmployees() // Обновляем список работающих

			toast({
				title: newPausedState ? "⏸️ Работа приостановлена" : "▶️ Работа возобновлена",
				description: newPausedState ? "Время паузы учитывается отдельно" : "Продолжаем работу",
			})
		} catch (error) {
			console.error("Ошибка переключения паузы:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось изменить статус паузы",
				variant: "destructive" as const,
			})
		}
	}

	const handleEndDay = async () => {
		if (!sessionData.id) return

		try {
			const now = new Date()
			let totalBreakMinutes = sessionData.totalBreakMinutes

			// Если сейчас на паузе, добавляем время текущей паузы
			if (sessionData.isPaused && sessionData.pauseStartTime) {
				const currentPauseDuration = Math.floor((now.getTime() - sessionData.pauseStartTime.getTime()) / 60000)
				totalBreakMinutes += currentPauseDuration
			}

			// Рассчитываем общее рабочее время
			const totalWorkMinutes = sessionData.clockInTime
				? Math.floor((now.getTime() - sessionData.clockInTime.getTime()) / 60000)
				: 0

			// Рассчитываем эффективное рабочее время (без перерывов)
			const effectiveWorkMinutes = totalWorkMinutes - totalBreakMinutes

			// Рассчитываем переработки
			const expectedWorkMinutes = getWorkHours() * 60
			const overtimeMinutes = Math.max(0, effectiveWorkMinutes - expectedWorkMinutes)

			const { error } = await supabase
				.from("work_sessions")
				.update({
					clock_out_time: now.toISOString(),
					total_work_minutes: totalWorkMinutes,
					total_break_minutes: totalBreakMinutes,
					overtime_minutes: overtimeMinutes,
					is_paused: false,
					pause_start_time: null,
					updated_at: now.toISOString(),
				})
				.eq("id", sessionData.id)

			if (error) throw error

			// Обновляем статус онлайн
			if (user) {
				await authService.updateOnlineStatus(user.id, false)
			}

			await loadSessionData()
			await loadWorkingEmployees() // Обновляем список работающих
			setShowEndDialog(false)

			toast({
				title: "🏁 Рабочий день завершен!",
				description: `Отработано: ${Math.floor(effectiveWorkMinutes / 60)}ч ${effectiveWorkMinutes % 60}м`,
			})
		} catch (error) {
			console.error("Ошибка завершения смены:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось завершить рабочий день",
				variant: "destructive" as const,
			})
		}
	}

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString("ru-RU", {
			hour: "2-digit",
			minute: "2-digit",
		})
	}

	const formatDuration = (minutes: number) => {
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
	}

	const getCurrentWorkTime = () => {
		if (!sessionData.clockInTime || sessionData.clockOutTime) return 0

		let workTime = Math.floor((currentTime.getTime() - sessionData.clockInTime.getTime()) / 60000)

		// Вычитаем время перерывов
		workTime -= sessionData.totalBreakMinutes

		// Если сейчас на паузе, вычитаем время текущей паузы
		if (sessionData.isPaused && sessionData.pauseStartTime) {
			const currentPauseDuration = Math.floor((currentTime.getTime() - sessionData.pauseStartTime.getTime()) / 60000)
			workTime -= currentPauseDuration
		}

		return Math.max(0, workTime)
	}

	const getOvertimeMinutes = () => {
		const currentWorkMinutes = getCurrentWorkTime()
		const expectedWorkMinutes = getWorkHours() * 60
		return Math.max(0, currentWorkMinutes - expectedWorkMinutes)
	}

	const isWorking = sessionData.clockInTime && !sessionData.clockOutTime
	console.log("🎯 isWorking calculation:", {
		clockInTime: !!sessionData.clockInTime,
		clockOutTime: !!sessionData.clockOutTime,
		isWorking: isWorking
	})

	if (loading) {
		return (
			<PixelCard>
				<div className="p-4 text-center">
					<div className="text-2xl animate-spin mb-2">⏰</div>
					<div>Загрузка...</div>
				</div>
			</PixelCard>
		)
	}

	return (
		<div className="space-y-4">
			{/* Основная панель рабочей смены */}
			<PixelCard
				className={`${isWorking ? (sessionData.isPaused ? "border-yellow-400" : "border-green-400") : "border-gray-300"} border-2`}
			>
				<div className="p-4">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<Clock className="h-5 w-5" />
							<span className="font-bold">Рабочая смена</span>
						</div>
						{isWorking && (
							<Badge variant={sessionData.isPaused ? "secondary" : "default"}>
								{sessionData.isPaused ? "На паузе" : "Работаю"}
							</Badge>
						)}
					</div>

					{!isWorking ? (
						<div className="text-center py-4">
							<div className="text-4xl mb-2">🏠</div>
							<div className="text-muted-foreground mb-4">Рабочий день не начат</div>
							<PixelButton onClick={handleClockIn} className="w-full">
								<Play className="h-4 w-4 mr-2" />
								Начать рабочий день
							</PixelButton>
						</div>
					) : (
						<div className="space-y-4">
							{/* Информация о времени */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
								<div className="space-y-2">
									<div className="text-sm text-muted-foreground">Время начала</div>
									<div className="text-lg font-mono">{sessionData.clockInTime ? formatTime(sessionData.clockInTime) : "—"}</div>
								</div>
								<div className="space-y-2">
									<div className="text-sm text-muted-foreground">Ожидаемое окончание</div>
									<div className="text-lg font-mono">
										{sessionData.expectedEndTime ? formatTime(sessionData.expectedEndTime) : "—"}
									</div>
								</div>
								<div className="space-y-2">
									<div className="text-sm text-muted-foreground">Отработано</div>
									<div className="text-lg font-mono">{formatDuration(getCurrentWorkTime())}</div>
								</div>
								<div className="space-y-2">
									<div className="text-sm text-muted-foreground">Переработки</div>
									<div className={`text-lg font-mono ${getOvertimeMinutes() > 0 ? "text-red-600" : ""}`}>
										{formatDuration(getOvertimeMinutes())}
									</div>
								</div>
							</div>

							{sessionData.clockOutTime && (
								<div className="mb-4 p-3 bg-muted rounded-lg">
									<div className="text-sm text-muted-foreground mb-1">Рабочий день завершен</div>
									<div className="text-lg font-mono">{formatTime(sessionData.clockOutTime)}</div>
								</div>
							)}

							{/* Центральный таймер */}
							<PixelCard className="bg-gradient-to-r from-blue-50 to-purple-50">
								<div className="p-4 text-center">
									<div className="text-3xl font-bold font-mono mb-1">{formatDuration(getCurrentWorkTime())}</div>
									<div className="text-sm text-muted-foreground">
										{sessionData.isPaused ? "работа приостановлена" : "эффективно отработано"}
									</div>
									{getOvertimeMinutes() > 0 && (
										<div className="text-sm text-orange-600 mt-1">
											⚠️ Переработка: {formatDuration(getOvertimeMinutes())}
										</div>
									)}
								</div>
							</PixelCard>

							{/* Кнопки управления */}
							<div className="space-y-2">
								<PixelButton
									onClick={handleTogglePause}
									variant={sessionData.isPaused ? "success" : "secondary"}
									className="w-full"
								>
									{sessionData.isPaused ? (
										<>
											<Play className="h-4 w-4 mr-2" />
											Продолжить работу
										</>
									) : (
										<>
											<Pause className="h-4 w-4 mr-2" />
											Поставить на паузу
										</>
									)}
								</PixelButton>

								<PixelButton onClick={() => setShowEndDialog(true)} variant="danger" className="w-full">
									<LogOut className="h-4 w-4 mr-2" />
									Завершить день
								</PixelButton>
							</div>
						</div>
					)}
				</div>
			</PixelCard>

			{/* Панель работающих сотрудников */}
			<PixelCard>
				<div className="p-4">
					<div className="flex items-center gap-2 mb-3">
						<Briefcase className="h-5 w-5" />
						<span className="font-bold">Сейчас работают</span>
						<Badge variant="outline">{workingEmployees.length}</Badge>
					</div>

					{workingEmployees.length === 0 ? (
						<div className="text-center py-4 text-muted-foreground">
							<div className="text-2xl mb-2">💤</div>
							<div className="text-sm">Никто не работает</div>
						</div>
					) : (
						<div className="space-y-2 max-h-40 overflow-y-auto">
							{workingEmployees.map((employee) => (
								<div key={employee.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
									<div className="flex items-center gap-2">
										<div className={`w-2 h-2 rounded-full ${employee.is_paused ? "bg-yellow-500" : "bg-green-500"}`} />
										<div>
											<div className="font-medium text-sm">{employee.full_name}</div>
											{employee.current_task && (
												<div className="text-xs text-muted-foreground">{employee.current_task}</div>
											)}
											<div className="text-xs text-muted-foreground">
												Работает: {formatDuration(employee.work_time_minutes)}
											</div>
										</div>
									</div>
									<div className="text-xs text-muted-foreground text-right">
										<div>
											Начал:{" "}
											{new Date(employee.clock_in_time).toLocaleTimeString("ru-RU", {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</div>
										<div>
											До:{" "}
											{employee.expected_end_time ? new Date(employee.expected_end_time).toLocaleTimeString("ru-RU", {
												hour: "2-digit",
												minute: "2-digit",
											}) : "—"}
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</PixelCard>

			{/* Диалог завершения дня */}
			<Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-orange-500" />
							Завершить рабочий день?
						</DialogTitle>
						<DialogDescription>Подтвердите завершение рабочего дня. Статистика будет сохранена.</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<div className="text-muted-foreground">Время работы</div>
								<div className="font-bold">{formatDuration(getCurrentWorkTime())}</div>
							</div>
							<div>
								<div className="text-muted-foreground">Перерывы</div>
								<div className="font-bold">{formatDuration(sessionData.totalBreakMinutes)}</div>
							</div>
						</div>

						{getOvertimeMinutes() > 0 && (
							<div className="p-3 bg-orange-50 border border-orange-200 rounded">
								<div className="flex items-center gap-2 text-orange-700">
									<AlertTriangle className="h-4 w-4" />
									<span className="font-medium">Переработка: {formatDuration(getOvertimeMinutes())}</span>
								</div>
							</div>
						)}
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowEndDialog(false)}>
							Отмена
						</Button>
						<Button onClick={handleEndDay} className="bg-red-600 hover:bg-red-700">
							<CheckCircle className="h-4 w-4 mr-2" />
							Завершить день
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
