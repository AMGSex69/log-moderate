"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
import { Clock, Play, Pause, LogOut, AlertTriangle, CheckCircle, Users } from "lucide-react"
import { format } from "date-fns"
import { useProfileSync } from "@/lib/profile-sync"

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

interface WorkSessionEnhancedProps {
	onSessionChange: (isWorking: boolean, isPaused?: boolean) => void
	activeTasks?: Array<{ id: number; taskTypeId: number; taskName: string }>
	onForceStopAllTasks?: () => void
}

export default function WorkSessionEnhanced({ onSessionChange, activeTasks = [], onForceStopAllTasks }: WorkSessionEnhancedProps) {
	const { user, profile, refreshProfile } = useAuth()
	const { toast } = useToast()

	// Подписка на обновления профиля
	useProfileSync(user?.id || null, refreshProfile)

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

	const [loading, setLoading] = useState(true)
	const [showEndDialog, setShowEndDialog] = useState(false)
	const [showResumeDialog, setShowResumeDialog] = useState(false)
	const [showActiveTasksWarning, setShowActiveTasksWarning] = useState(false)
	const [currentTime, setCurrentTime] = useState(new Date())

	// Refs для предотвращения повторных вызовов
	const sessionLoadingRef = useRef(false)
	const lastSessionLoad = useRef(0)

	// Обновляем время каждую секунду
	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(new Date())
		}, 1000)
		return () => clearInterval(interval)
	}, [])

	// Мемоизированная функция для получения рабочих часов
	const getWorkHours = useCallback(() => {
		if (!profile?.work_schedule) {
			return 9
		}

		const hours = profile.work_schedule === "2/2" ? 12 : 9
		return hours
	}, [profile?.work_schedule])

	// ИСПРАВЛЕНО: Загружаем данные только при монтировании и изменении пользователя
	useEffect(() => {
		if (user) {
			loadSessionData()
		}
	}, [user])

	// Пересчитываем время окончания при изменении графика работы
	useEffect(() => {
		if (sessionData.clockInTime && profile?.work_schedule) {
			const workHours = getWorkHours()
			const newExpectedEnd = new Date(sessionData.clockInTime.getTime() + workHours * 60 * 60 * 1000)

			if (sessionData.expectedEndTime?.getTime() !== newExpectedEnd.getTime()) {
				setSessionData(prev => ({
					...prev,
					expectedEndTime: newExpectedEnd
				}))
			}
		}
	}, [profile?.work_schedule, sessionData.clockInTime, getWorkHours])

	// Мемоизированная функция загрузки данных сессии - ИСПРАВЛЕНО: убираем циклические зависимости
	const loadSessionData = useCallback(async () => {
		if (!user || sessionLoadingRef.current) return

		// Предотвращаем частые запросы (не чаще раза в 30 секунд для автоматических обновлений)
		const now = Date.now()
		if (now - lastSessionLoad.current < 30000) return

		sessionLoadingRef.current = true
		lastSessionLoad.current = now

		try {
			setLoading(true)

			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) {
				console.error("❌ Ошибка получения employee_id:", empError)
				return
			}

			const today = new Date().toISOString().split("T")[0]

			const { data: session, error: sessionError } = await supabase
				.from("work_sessions")
				.select("*")
				.eq("employee_id", employeeId)
				.eq("date", today)
				.maybeSingle()

			if (sessionError && sessionError.code !== "PGRST116") {
				console.error("❌ Ошибка загрузки сессии:", sessionError)
				throw sessionError
			}

			if (session) {
				const workHours = getWorkHours()
				const expectedEnd = session.clock_in_time
					? new Date(new Date(session.clock_in_time).getTime() + workHours * 60 * 60 * 1000)
					: null

				const newSessionData = {
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
				}

				setSessionData(newSessionData)

				// Уведомляем родительский компонент о статусе работы
				const isWorking = session.clock_in_time && !session.clock_out_time
				onSessionChange(isWorking, session.is_paused || false)
			} else {
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
				onSessionChange(false, false)
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
	}, [user, toast])

	// Функция для принудительного обновления данных (без ограничений по времени)
	const forceLoadSessionData = useCallback(async () => {
		if (!user || sessionLoadingRef.current) return

		sessionLoadingRef.current = true

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) return

			const today = new Date().toISOString().split("T")[0]

			const { data: session, error: sessionError } = await supabase
				.from("work_sessions")
				.select("*")
				.eq("employee_id", employeeId)
				.eq("date", today)
				.maybeSingle()

			if (sessionError && sessionError.code !== "PGRST116") {
				console.error("❌ Ошибка принудительной загрузки сессии:", sessionError)
				return
			}

			if (session) {
				const workHours = getWorkHours()
				const expectedEnd = session.clock_in_time
					? new Date(new Date(session.clock_in_time).getTime() + workHours * 60 * 60 * 1000)
					: null

				const newSessionData = {
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
				}

				setSessionData(newSessionData)
				onSessionChange(session.clock_in_time && !session.clock_out_time, session.is_paused || false)
			} else {
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
				onSessionChange(false, false)
			}
		} catch (error) {
			console.error("💥 Ошибка принудительной загрузки сессии:", error)
		} finally {
			sessionLoadingRef.current = false
		}
	}, [user, onSessionChange, toast])

	const handleClockIn = async (confirmed = false) => {
		console.log("🎯 handleClockIn: Начало функции, confirmed =", confirmed)
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

			// Сначала проверяем, есть ли уже сессия на сегодня
			console.log("🔍 handleClockIn: Проверяем существующую сессию")
			const { data: existingSession, error: checkError } = await supabase
				.from("work_sessions")
				.select("id, clock_out_time, clock_in_time")
				.eq("employee_id", employeeId)
				.eq("date", now.toISOString().split("T")[0])
				.maybeSingle()

			console.log("📊 handleClockIn: existingSession =", existingSession, "checkError =", checkError)

			// Если есть завершенная сессия и нет подтверждения - показываем диалог
			if (existingSession?.clock_out_time && !confirmed) {
				console.log("🔄 handleClockIn: Показываем диалог подтверждения возобновления")
				setShowResumeDialog(true)
				return
			}

			const workHours = getWorkHours()
			const expectedEnd = new Date(now.getTime() + workHours * 60 * 60 * 1000)
			console.log("⏰ handleClockIn: workHours =", workHours, "expectedEnd =", expectedEnd)

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
					start_time: now.toISOString(), // Для синхронизации с триггером
					end_time: null, // ВАЖНО: Сбрасываем end_time чтобы триггер не перезаписал clock_out_time
					expected_end_time: expectedEnd.toISOString(),
					is_paused: false,
					pause_start_time: null,
					// При возобновлении НЕ сбрасываем статистику
					...(existingSession.clock_out_time ? {} : {
						total_work_minutes: 0,
						total_break_minutes: 0,
						overtime_minutes: 0,
					}),
					is_auto_clocked_out: false,
					updated_at: now.toISOString(),
				}

				console.log("📝 handleClockIn: Данные для обновления:", updateData)

				console.log("🔍 handleClockIn: Выполняем UPDATE запрос...")
				const { data, error } = await supabase
					.from("work_sessions")
					.update(updateData)
					.eq("id", existingSession.id)
					.select()
					.single()

				console.log("📊 handleClockIn: Результат UPDATE:", { data, error })

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
				totalWorkMinutes: sessionData.total_work_minutes || 0,
				totalBreakMinutes: sessionData.total_break_minutes || 0,
				overtimeMinutes: sessionData.overtime_minutes || 0,
				isAutoClockOut: false,
			}

			setSessionData(newSessionData)
			console.log("✅ handleClockIn: Локальное состояние обновлено", newSessionData)

			// Уведомляем родительский компонент НЕМЕДЛЕННО
			// console.log("🔄 handleClockIn: Уведомляем о смене статуса работы")
			onSessionChange(true, false)

			// Закрываем диалог подтверждения если он был открыт
			setShowResumeDialog(false)

			// Сразу перезагружаем данные чтобы синхронизироваться с БД
			// ИСПРАВЛЕНО: Используем принудительное обновление только после изменений в БД
			setTimeout(() => {
				forceLoadSessionData().catch(console.error)
			}, 500) // Уменьшили задержку

			// console.log("✅ handleClockIn: Всё успешно!")
			const isResuming = existingSession?.clock_out_time
			toast({
				title: isResuming ? "🔄 Рабочий день возобновлен!" : "🎯 Рабочий день начат!",
				description: isResuming
					? "Статистика выполненных задач сохранена"
					: `Ожидаемое окончание: ${expectedEnd.toLocaleTimeString()}`,
			})

			// Уведомляем родительский компонент об изменении состояния паузы
			onSessionChange(true, false)
		} catch (error) {
			console.error("💥 handleClockIn: Критическая ошибка:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось начать рабочий день",
				variant: "destructive" as const,
			})
			setShowResumeDialog(false)
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

			await forceLoadSessionData()

			toast({
				title: newPausedState ? "⏸️ Работа приостановлена" : "▶️ Работа возобновлена",
				description: newPausedState ? "Время паузы учитывается отдельно" : "Продолжаем работу",
			})

			// Уведомляем родительский компонент об изменении состояния паузы
			onSessionChange(true, newPausedState)
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

		// ПРОВЕРКА АКТИВНЫХ ЗАДАЧ
		if (activeTasks && activeTasks.length > 0) {
			setShowActiveTasksWarning(true)
			return
		}

		await performEndDay()
	}

	// Выделяем логику завершения дня в отдельную функцию
	const performEndDay = async () => {
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

			// ОТКЛЮЧЕНО: Убираем обновление статуса онлайн
			// if (user) {
			//	await authService.updateOnlineStatus(user.id, false)
			// }

			await forceLoadSessionData()
			setShowEndDialog(false)
			setShowActiveTasksWarning(false) // Закрываем диалог предупреждения

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

	// Обработчик принудительного завершения с остановкой задач
	const handleForceEndWithStopTasks = async () => {
		if (onForceStopAllTasks) {
			onForceStopAllTasks() // Останавливаем все активные задачи
		}

		// Ждем немного чтобы задачи успели остановиться
		setTimeout(() => {
			performEndDay()
		}, 500)
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

	// Функция для получения текущего времени перерывов в реальном времени
	const getCurrentBreakTime = () => {
		let totalBreakMinutes = sessionData.totalBreakMinutes

		// Если сейчас на паузе, добавляем время текущей паузы
		if (sessionData.isPaused && sessionData.pauseStartTime) {
			const currentPauseDuration = Math.floor((currentTime.getTime() - sessionData.pauseStartTime.getTime()) / 60000)
			totalBreakMinutes += currentPauseDuration
		}

		return totalBreakMinutes
	}

	// Функция для получения текущей переработки в реальном времени
	const getCurrentOvertimeMinutes = () => {
		const currentWorkMinutes = getCurrentWorkTime()
		const expectedWorkMinutes = getWorkHours() * 60
		return Math.max(0, currentWorkMinutes - expectedWorkMinutes)
	}

	// ИСПРАВЛЕНО: Мемоизируем вычисление isWorking чтобы избежать бесконечного рендеринга
	const isWorking = useMemo(() => {
		const working = !!(sessionData.clockInTime && !sessionData.clockOutTime)
		// Убираем избыточное логирование, которое может вызывать частые обновления
		// console.log("🎯 isWorking calculation:", {
		//	clockInTime: !!sessionData.clockInTime,
		//	clockOutTime: !!sessionData.clockOutTime,
		//	isWorking: working
		// })
		return working
	}, [sessionData.clockInTime, sessionData.clockOutTime])

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
			{/* Основная панель управления */}
			<PixelCard>
				<div className="p-4">
					<div className="flex items-center gap-2 mb-4">
						<div className="flex items-center gap-3">
							<div className={`w-3 h-3 rounded-full ${sessionData.isAutoClockOut ? "bg-red-500" : sessionData.clockInTime ? "bg-green-500" : "bg-gray-500"}`} />
							<div>
								<div className="font-bold text-lg">
									{sessionData.clockInTime ? (sessionData.clockOutTime ? "Рабочий день завершен" : "На работе") : "Не на работе"}
								</div>
								<div className="text-sm text-muted-foreground">
									{sessionData.clockInTime
										? sessionData.clockOutTime
											? `Работал ${formatDuration(sessionData.totalWorkMinutes)}`
											: `В работе ${formatDuration(getCurrentWorkTime())}`
										: "Время начать работу"}
								</div>
							</div>
						</div>
					</div>

					{sessionData.clockInTime && sessionData.clockOutTime && (
						<div className="space-y-4">
							<div className="text-center py-3 bg-green-50 rounded-lg border border-green-200">
								<div className="text-green-800 font-semibold">Рабочий день завершен! 🎉</div>
								<div className="text-green-600 text-sm">
									Отработано: {formatDuration(sessionData.totalWorkMinutes)} •{" "}
									{sessionData.overtimeMinutes > 0 ? `Переработка: ${formatDuration(sessionData.overtimeMinutes)}` : "В норме"}
								</div>
							</div>

							<div className="text-center">
								<PixelButton onClick={() => handleClockIn(false)} disabled={loading} className="w-full mb-2" variant="default">
									🔄 Возобновить рабочий день
								</PixelButton>
								<p className="text-sm text-muted-foreground">
									При возобновлении статистика выполненных задач сохранится
								</p>
							</div>
						</div>
					)}

					{!sessionData.clockInTime && (
						<div className="text-center py-8">
							<div className="text-4xl mb-3">🏢</div>
							<PixelButton onClick={() => handleClockIn(false)} disabled={loading} className="w-full mb-2">
								{loading ? "Отмечаемся..." : "Начать рабочий день"}
							</PixelButton>
							<p className="text-sm text-muted-foreground">
								График: {profile?.work_schedule || "8+1"} • {getWorkHours()} ч/день
							</p>
						</div>
					)}

					{sessionData.clockInTime && !sessionData.clockOutTime && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4 text-center">
								<div className="p-3 bg-blue-50 rounded-lg">
									<div className="text-2xl font-bold text-blue-600">{formatTime(new Date(sessionData.clockInTime))}</div>
									<div className="text-xs text-blue-800">Начало</div>
								</div>
								<div className="p-3 bg-purple-50 rounded-lg">
									<div className="text-2xl font-bold text-purple-600">
										{sessionData.expectedEndTime ? formatTime(new Date(sessionData.expectedEndTime)) : "—"}
									</div>
									<div className="text-xs text-purple-800">Планируемый конец</div>
								</div>
							</div>

							{sessionData.isPaused && (
								<div className="text-center py-3 bg-yellow-50 rounded-lg border border-yellow-200">
									<div className="text-yellow-800 font-semibold">⏸️ Пауза</div>
									<div className="text-yellow-600 text-sm">
										{sessionData.pauseStartTime && (
											<>С {formatTime(new Date(sessionData.pauseStartTime))} • {formatDuration(sessionData.totalBreakMinutes)} перерыв</>
										)}
									</div>
								</div>
							)}

							<div className="flex gap-2">
								{!sessionData.isPaused ? (
									<button
										onClick={handleTogglePause}
										className="
											flex-1 font-mono font-black text-black uppercase tracking-wider text-sm
											bg-yellow-300 hover:bg-yellow-400 
											border-4 border-black rounded-none
											shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
											hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
											hover:translate-x-[2px] hover:translate-y-[2px]
											transition-all duration-100
											p-3
										"
									>
										⏸️ ПАУЗА
									</button>
								) : (
									<button
										onClick={handleTogglePause}
										className="
											flex-1 font-mono font-black text-white uppercase tracking-wider text-sm
											bg-green-500 hover:bg-green-600 
											border-4 border-black rounded-none
											shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
											hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
											hover:translate-x-[2px] hover:translate-y-[2px]
											transition-all duration-100
											p-3
										"
									>
										▶️ ПРОДОЛЖИТЬ
									</button>
								)}

								<button
									onClick={() => setShowEndDialog(true)}
									className="
										flex-1 font-mono font-black text-white uppercase tracking-wider text-sm
										bg-red-500 hover:bg-red-600 
										border-4 border-black rounded-none
										shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
										hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
										hover:translate-x-[2px] hover:translate-y-[2px]
										transition-all duration-100
										p-3
									"
								>
									🏁 ЗАВЕРШИТЬ
								</button>
							</div>

							{/* Статистика */}
							<div className="grid grid-cols-3 gap-2 text-xs">
								<div className="text-center p-2 bg-gray-50 rounded">
									<div className="font-bold">{formatDuration(getCurrentWorkTime())}</div>
									<div className="text-muted-foreground">Работы</div>
								</div>
								<div className="text-center p-2 bg-gray-50 rounded">
									<div className="font-bold">{formatDuration(getCurrentBreakTime())}</div>
									<div className="text-muted-foreground">Перерыв</div>
								</div>
								<div className="text-center p-2 bg-gray-50 rounded">
									<div className="font-bold text-green-600">
										{getCurrentOvertimeMinutes() > 0 ? `+${formatDuration(getCurrentOvertimeMinutes())}` : "В норме"}
									</div>
									<div className="text-muted-foreground">Переработка</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</PixelCard>

			{/* Диалог подтверждения возобновления */}
			<Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Clock className="h-5 w-5 text-blue-500" />
							Возобновить рабочий день?
						</DialogTitle>
						<DialogDescription>
							Вы уверены, что хотите возобновить рабочий день? При возобновлении вся статистика выполненных задач сохранится.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						{sessionData.clockOutTime && (
							<div className="p-3 bg-blue-50 border border-blue-200 rounded">
								<div className="text-sm text-blue-800">
									<div className="font-semibold">Статистика предыдущей сессии:</div>
									<div>• Отработано: {formatDuration(sessionData.totalWorkMinutes)}</div>
									<div>• Перерывы: {formatDuration(sessionData.totalBreakMinutes)}</div>
									{sessionData.overtimeMinutes > 0 && (
										<div>• Переработка: {formatDuration(sessionData.overtimeMinutes)}</div>
									)}
								</div>
							</div>
						)}

						<div className="p-3 bg-green-50 border border-green-200 rounded">
							<div className="text-sm text-green-800">
								✅ Вся статистика будет сохранена при возобновлении
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowResumeDialog(false)}>
							Отмена
						</Button>
						<Button onClick={() => handleClockIn(true)} className="bg-blue-600 hover:bg-blue-700">
							<Clock className="h-4 w-4 mr-2" />
							Да, возобновить
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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
								<div className="font-bold">{formatDuration(getCurrentBreakTime())}</div>
							</div>
						</div>

						{getCurrentOvertimeMinutes() > 0 && (
							<div className="p-3 bg-orange-50 border border-orange-200 rounded">
								<div className="flex items-center gap-2 text-orange-700">
									<AlertTriangle className="h-4 w-4" />
									<span className="font-medium">Переработка: {formatDuration(getCurrentOvertimeMinutes())}</span>
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

			{/* Диалог предупреждения об активных задачах */}
			<Dialog open={showActiveTasksWarning} onOpenChange={setShowActiveTasksWarning}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-red-500" />
							Внимание! Активные задачи
						</DialogTitle>
						<DialogDescription>
							У вас есть активные задачи. Завершите их или прогресс будет утерян.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						{/* Список активных задач */}
						<div className="p-4 bg-red-50 border border-red-200 rounded">
							<div className="font-medium text-red-800 mb-2">Активные задачи ({activeTasks.length}):</div>
							<div className="space-y-1">
								{activeTasks.map((task) => (
									<div key={task.taskTypeId} className="text-sm text-red-700">
										• {task.taskName}
									</div>
								))}
							</div>
						</div>

						<div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
							<div className="text-sm text-yellow-800">
								⚠️ <strong>Важно:</strong> Если завершить рабочий день с активными задачами,
								весь их прогресс будет потерян без возможности восстановления.
							</div>
						</div>

						<div className="p-3 bg-blue-50 border border-blue-200 rounded">
							<div className="text-sm text-blue-800">
								💡 <strong>Рекомендация:</strong> Сначала завершите все активные задачи,
								а затем завершите рабочий день.
							</div>
						</div>
					</div>

					<DialogFooter className="flex-col sm:flex-row gap-2">
						<Button
							variant="outline"
							onClick={() => setShowActiveTasksWarning(false)}
							className="w-full sm:w-auto"
						>
							Отмена
						</Button>
						<Button
							onClick={handleForceEndWithStopTasks}
							className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
						>
							<AlertTriangle className="h-4 w-4 mr-2" />
							Завершить и удалить прогресс
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
