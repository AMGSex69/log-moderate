"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface ActiveTask {
	id: number
	taskTypeId: number
	taskName: string
	startTime: Date
	elapsedTime: number
	units: number
	isActive: boolean
}

interface Timer {
	startTime: Date
	elapsedTime: number
	isRunning: boolean
	isPaused?: boolean
	pauseStartTime?: Date
	totalPausedTime?: number
}

export function useMultiTimer() {
	const { user } = useAuth()
	const { toast } = useToast()
	const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([])
	const [timers, setTimers] = useState<Map<number, Timer>>(new Map())
	const intervalRefs = useRef<Map<number, NodeJS.Timeout>>(new Map())
	const initializedRef = useRef(false)
	const mainTimerRef = useRef<NodeJS.Timeout | null>(null)
	const activeTasksRef = useRef<ActiveTask[]>([])

	// Синхронизируем ref с состоянием для избежания замыканий
	useEffect(() => {
		activeTasksRef.current = activeTasks
	}, [activeTasks])

	// Восстанавливаем активные сессии при загрузке
	useEffect(() => {
		if (user && !initializedRef.current) {
			initializedRef.current = true
			restoreActiveSessions()
		}
	}, [user])

	// Главный таймер для обновления всех активных задач - ИСПРАВЛЕНО
	useEffect(() => {
		const hasActiveTasks = activeTasks.length > 0

		if (hasActiveTasks) {
			// Запускаем только если еще не запущен
			if (!mainTimerRef.current) {
				mainTimerRef.current = setInterval(() => {
					updateAllTimers()
				}, 1000) // Обновляем каждую секунду
			}
		} else {
			// Останавливаем если нет активных задач
			if (mainTimerRef.current) {
				clearInterval(mainTimerRef.current)
				mainTimerRef.current = null
			}
		}

		return () => {
			if (mainTimerRef.current) {
				clearInterval(mainTimerRef.current)
				mainTimerRef.current = null
			}
		}
	}, [activeTasks.length]) // Только зависимость от длины массива

	// ИСПРАВЛЕНО: убираем зависимость от activeTasks, используем ref
	const updateAllTimers = useCallback(() => {
		const now = Date.now()
		const currentTasks = activeTasksRef.current

		// Сначала обновляем таймеры и запоминаем новое состояние
		let updatedTimers: Map<number, Timer> | null = null

		setTimers((prevTimers) => {
			const newTimers = new Map(prevTimers)

			currentTasks.forEach((task) => {
				if (task.isActive) {
					const timer = prevTimers.get(task.taskTypeId)
					if (!timer) return

					// Если таймер на паузе, не обновляем время
					if (timer.isPaused) {
						newTimers.set(task.taskTypeId, {
							...timer,
							isRunning: false
						})
					} else {
						// Вычисляем время с учетом пауз
						const totalElapsed = Math.floor((now - task.startTime.getTime()) / 1000)
						const totalPausedTime = timer.totalPausedTime || 0
						const effectiveElapsed = Math.max(0, totalElapsed - totalPausedTime)

						newTimers.set(task.taskTypeId, {
							...timer,
							elapsedTime: effectiveElapsed,
							isRunning: true,
							isPaused: false,
						})
					}
				}
			})

			updatedTimers = newTimers
			return newTimers
		})

		// Обновляем elapsed time в задачах с учетом пауз
		setActiveTasks((currentTasks) => {
			return currentTasks.map((task) => {
				const currentTimer = updatedTimers?.get(task.taskTypeId)
				if (!currentTimer) return task

				if (currentTimer.isPaused) {
					return task // Не обновляем время если на паузе
				}

				// Вычисляем эффективное время с учетом пауз
				const totalElapsed = Math.floor((now - task.startTime.getTime()) / 1000)
				const totalPausedTime = currentTimer.totalPausedTime || 0
				const effectiveElapsed = Math.max(0, totalElapsed - totalPausedTime)

				return {
					...task,
					elapsedTime: effectiveElapsed,
				}
			})
		})
	}, []) // ИСПРАВЛЕНО: убираем все зависимости, используем замыкания

	const restoreActiveSessions = async () => {
		if (!user) return

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) {
				return
			}

			// Получаем активные сессии из базы данных
			const { data: activeSessions, error } = await supabase
				.from("active_sessions")
				.select(`
					id,
					task_type_id,
					started_at,
					last_heartbeat,
					current_units,
					task_types(name)
				`)
				.eq("employee_id", employeeId)
				.eq("is_active", true)
				.gte("last_heartbeat", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Активные за последние 2 часа

			if (error) {
				console.error("❌ Ошибка восстановления активных сессий:", error)
				return
			}

			if (!activeSessions || activeSessions.length === 0) {
				return
			}

			// Восстанавливаем активные задачи
			const restoredTasks: ActiveTask[] = activeSessions.map((session: any) => {
				const startTime = new Date(session.started_at)
				const elapsedTime = Math.floor((Date.now() - startTime.getTime()) / 1000)

				return {
					id: session.id,
					taskTypeId: session.task_type_id,
					taskName: session.task_types?.name || "Неизвестная задача",
					startTime,
					elapsedTime,
					units: session.current_units || 0, // Восстанавливаем сохраненное количество единиц
					isActive: true,
				}
			})

			// ВАЖНО: сначала устанавливаем задачи
			setActiveTasks(restoredTasks)

			// Затем восстанавливаем таймеры
			const newTimers = new Map<number, Timer>()
			restoredTasks.forEach((task) => {
				newTimers.set(task.taskTypeId, {
					startTime: task.startTime,
					elapsedTime: task.elapsedTime,
					isRunning: true,
				})
			})
			setTimers(newTimers)

			if (restoredTasks.length > 0) {
				toast({
					title: "🔄 Таймеры восстановлены",
					description: `Найдено ${restoredTasks.length} активных задач`,
				})
			}
		} catch (error) {
			console.error("❌ Ошибка восстановления активных сессий:", error)
		}
	}

	const startTask = async (taskTypeId: number, taskName: string) => {
		if (!user) return

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) throw new Error("Employee not found")

			// Проверяем, не запущена ли уже эта задача
			const existingTask = activeTasks.find((task) => task.taskTypeId === taskTypeId)
			if (existingTask) {
				toast({
					title: "Задача уже активна",
					description: taskName,
					variant: "destructive",
				})
				return false
			}

			// Проверяем лимит одновременных задач (максимум 5)
			if (activeTasks.length >= 5) {
				toast({
					title: "Превышен лимит",
					description: "Максимум 5 задач одновременно",
					variant: "destructive",
				})
				return false
			}

			const now = new Date()

			// Создаем активную сессию в базе данных
			const { data, error } = await supabase
				.from("active_sessions")
				.insert({
					employee_id: employeeId,
					task_type_id: taskTypeId,
					started_at: now.toISOString(),
					last_heartbeat: now.toISOString(),
					is_active: true,
				})
				.select()
				.single()

			if (error) throw error

			const newTask: ActiveTask = {
				id: data.id,
				taskTypeId,
				taskName,
				startTime: now,
				elapsedTime: 0,
				units: 0,
				isActive: true,
			}

			// Добавляем задачу в состояние
			setActiveTasks((prev) => {
				const updated = [...prev, newTask]
				return updated
			})

			// Запускаем таймер для новой задачи
			const timer: Timer = {
				startTime: now,
				elapsedTime: 0,
				isRunning: true,
			}

			setTimers((prev) => {
				const updated = new Map(prev).set(taskTypeId, timer)
				return updated
			})

			toast({
				title: "⏱️ Задача запущена",
				description: taskName,
			})

			return true
		} catch (error) {
			console.error("❌ Ошибка запуска задачи:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось запустить задачу",
				variant: "destructive",
			})
			return false
		}
	}

	const stopTask = async (taskTypeId: number) => {
		try {
			// Удаляем активную сессию из базы данных
			const task = activeTasks.find((t) => t.taskTypeId === taskTypeId)
			if (task) {
				await supabase.from("active_sessions").delete().eq("id", task.id)
			}

			// Останавливаем локальные таймеры
			const intervalRef = intervalRefs.current.get(taskTypeId)
			if (intervalRef) {
				clearInterval(intervalRef)
				intervalRefs.current.delete(taskTypeId)
			}

			// Удаляем задачу из состояния
			setActiveTasks((prev) => {
				const updated = prev.filter((task) => task.taskTypeId !== taskTypeId)
				return updated
			})

			setTimers((prev) => {
				const newTimers = new Map(prev)
				newTimers.delete(taskTypeId)
				return newTimers
			})
		} catch (error) {
			console.error("❌ Ошибка остановки задачи:", error)
		}
	}

	const updateUnits = async (taskTypeId: number, units: number) => {
		// Обновляем локальное состояние
		setActiveTasks((prev) =>
			prev.map((task) => (task.taskTypeId === taskTypeId ? { ...task, units } : task))
		)

		// Сохраняем в базе данных
		try {
			const task = activeTasks.find((t) => t.taskTypeId === taskTypeId)
			if (task && task.id) {
				await supabase
					.from("active_sessions")
					.update({ current_units: units })
					.eq("id", task.id)
			}
		} catch (error) {
			console.error("❌ Ошибка обновления единиц в БД:", error)
		}
	}

	// Функция для получения форматированного времени
	const getFormattedTime = (taskTypeId: number): string => {
		const timer = timers.get(taskTypeId)
		if (!timer) return "00:00"

		const totalSeconds = timer.elapsedTime
		const hours = Math.floor(totalSeconds / 3600)
		const minutes = Math.floor((totalSeconds % 3600) / 60)
		const seconds = totalSeconds % 60

		if (hours > 0) {
			return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
		}
		return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
	}

	// Функция для получения времени в минутах
	const getMinutes = (taskTypeId: number): number => {
		const timer = timers.get(taskTypeId)
		if (!timer) return 0
		return Math.ceil(timer.elapsedTime / 60)
	}

	// Функция приостановки задачи
	const pauseTask = (taskTypeId: number) => {
		setTimers((prev) => {
			const timer = prev.get(taskTypeId)
			if (!timer || timer.isPaused) return prev

			const newTimers = new Map(prev)
			newTimers.set(taskTypeId, {
				...timer,
				isPaused: true,
				isRunning: false,
				pauseStartTime: new Date()
			})
			return newTimers
		})
	}

	// Функция возобновления задачи
	const resumeTask = (taskTypeId: number) => {
		setTimers((prev) => {
			const timer = prev.get(taskTypeId)
			if (!timer || !timer.isPaused || !timer.pauseStartTime) return prev

			// Вычисляем время паузы
			const pauseDuration = Math.floor((Date.now() - timer.pauseStartTime.getTime()) / 1000)
			const totalPausedTime = (timer.totalPausedTime || 0) + pauseDuration

			const newTimers = new Map(prev)
			newTimers.set(taskTypeId, {
				...timer,
				isPaused: false,
				isRunning: true,
				pauseStartTime: undefined,
				totalPausedTime: totalPausedTime
			})
			return newTimers
		})
	}

	// Функция приостановки всех задач
	const pauseAllTasks = () => {
		setTimers((prev) => {
			const newTimers = new Map()
			prev.forEach((timer, taskTypeId) => {
				if (!timer.isPaused) {
					newTimers.set(taskTypeId, {
						...timer,
						isPaused: true,
						isRunning: false,
						pauseStartTime: new Date()
					})
				} else {
					newTimers.set(taskTypeId, timer)
				}
			})
			return newTimers
		})
	}

	// Функция возобновления всех задач
	const resumeAllTasks = () => {
		setTimers((prev) => {
			const newTimers = new Map()
			prev.forEach((timer, taskTypeId) => {
				if (timer.isPaused && timer.pauseStartTime) {
					// Вычисляем время паузы
					const pauseDuration = Math.floor((Date.now() - timer.pauseStartTime.getTime()) / 1000)
					const totalPausedTime = (timer.totalPausedTime || 0) + pauseDuration

					newTimers.set(taskTypeId, {
						...timer,
						isPaused: false,
						isRunning: true,
						pauseStartTime: undefined,
						totalPausedTime: totalPausedTime
					})
				} else {
					newTimers.set(taskTypeId, timer)
				}
			})
			return newTimers
		})
	}

	// Периодически обновляем heartbeat в базе данных
	useEffect(() => {
		const currentTasks = activeTasksRef.current
		if (currentTasks.length === 0) return

		const heartbeatInterval = setInterval(async () => {
			if (!user) return

			try {
				const { employeeId } = await authService.getEmployeeId(user.id)
				if (!employeeId) return

				const currentActiveTasks = activeTasksRef.current
				const activeTaskIds = currentActiveTasks.map(task => task.id)
				if (activeTaskIds.length > 0) {
					await supabase
						.from("active_sessions")
						.update({ last_heartbeat: new Date().toISOString() })
						.in("id", activeTaskIds)
				}
			} catch (error) {
				console.error("❌ Ошибка обновления heartbeat:", error)
			}
		}, 30000) // Каждые 30 секунд

		return () => {
			clearInterval(heartbeatInterval)
		}
	}, [activeTasks.length, user]) // ИСПРАВЛЕНО: зависимость только от длины массива

	// Очистка при размонтировании
	useEffect(() => {
		return () => {
			intervalRefs.current.forEach((interval) => clearInterval(interval))
			intervalRefs.current.clear()

			if (mainTimerRef.current) {
				clearInterval(mainTimerRef.current)
			}
		}
	}, [])

	// Логирование для диагностики - УБИРАЕМ, ЧТОБЫ НЕ ВЫЗЫВАТЬ ЛИШНИЕ РЕНДЕРЫ
	useEffect(() => {
	}, [activeTasks.length, timers.size])

	return {
		activeTasks,
		timers,
		startTask,
		stopTask,
		updateUnits,
		getFormattedTime,
		getMinutes,
		restoreActiveSessions,
		pauseTask,
		resumeTask,
		pauseAllTasks,
		resumeAllTasks,
	}
}
