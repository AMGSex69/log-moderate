"use client"

import { useState, useEffect, useRef } from "react"
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
}

export function useMultiTimer() {
	const { user } = useAuth()
	const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([])
	const [timers, setTimers] = useState<Map<number, Timer>>(new Map())
	const intervalRefs = useRef<Map<number, NodeJS.Timeout>>(new Map())
	const initializedRef = useRef(false)

	// ОТКЛЮЧЕНО: Восстановление активных сессий из базы данных
	/*
	useEffect(() => {
		if (user && !initializedRef.current) {
			initializedRef.current = true
			restoreActiveSessions()
		}
	}, [user])

	const restoreActiveSessions = async () => {
		if (!user) return

		try {
			console.log("🔄 Восстанавливаем активные сессии...")

			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) {
				console.log("❌ Не найден employee_id для восстановления сессий")
				return
			}

			// Получаем активные сессии из базы данных
			const { data: activeSessions, error } = await supabase
				.from("active_sessions")
				.select(`
			 id,
			 task_type_id,
			 started_at,
			 task_types(name)
		  `)
				.eq("employee_id", employeeId)
				.eq("is_active", true)
				.gte("last_heartbeat", new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Активные за последние 5 минут

			if (error) {
				console.error("❌ Ошибка восстановления активных сессий:", error)
				return
			}

			if (!activeSessions || activeSessions.length === 0) {
				console.log("ℹ️ Нет активных сессий для восстановления")
				return
			}

			console.log("✅ Найдено активных сессий:", activeSessions.length)

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
					units: 0,
					isActive: true,
				}
			})

			setActiveTasks(restoredTasks)

			// Восстанавливаем таймеры
			const newTimers = new Map<number, Timer>()
			restoredTasks.forEach((task) => {
				newTimers.set(task.taskTypeId, {
					startTime: task.startTime,
					elapsedTime: task.elapsedTime,
					isRunning: true,
				})
			})
			setTimers(newTimers)

			console.log("✅ Активные сессии восстановлены:", restoredTasks.length)
		} catch (error) {
			console.error("❌ Ошибка восстановления активных сессий:", error)
		}
	}
	*/

	const startTask = async (taskTypeId: number, taskName: string) => {
		if (!user) return

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) throw new Error("Employee not found")

			// Проверяем, не запущена ли уже эта задача
			const existingTask = activeTasks.find((task) => task.taskTypeId === taskTypeId)
			if (existingTask) {
				console.log("⚠️ Задача уже запущена:", taskName)
				return
			}

			// Создаем активную сессию в базе данных (без heartbeat)
			const { data, error } = await supabase
				.from("active_sessions")
				.insert({
					employee_id: employeeId,
					task_type_id: taskTypeId,
					started_at: new Date().toISOString(),
					last_heartbeat: new Date().toISOString(),
				})
				.select()
				.single()

			if (error) throw error

			const newTask: ActiveTask = {
				id: data.id,
				taskTypeId,
				taskName,
				startTime: new Date(),
				elapsedTime: 0,
				units: 0,
				isActive: true,
			}

			setActiveTasks((prev) => [...prev, newTask])

			// Запускаем таймер
			const timer: Timer = {
				startTime: new Date(),
				elapsedTime: 0,
				isRunning: true,
			}

			setTimers((prev) => new Map(prev).set(taskTypeId, timer))

			console.log("✅ Задача запущена:", taskName)
		} catch (error) {
			console.error("❌ Ошибка запуска задачи:", error)
		}
	}

	const stopTask = async (taskTypeId: number) => {
		try {
			// Удаляем активную сессию из базы данных
			const task = activeTasks.find((t) => t.taskTypeId === taskTypeId)
			if (task) {
				await supabase.from("active_sessions").delete().eq("id", task.id)
			}

			// Останавливаем таймер
			const intervalRef = intervalRefs.current.get(taskTypeId)
			if (intervalRef) {
				clearInterval(intervalRef)
				intervalRefs.current.delete(taskTypeId)
			}

			// Удаляем задачу из состояния
			setActiveTasks((prev) => prev.filter((task) => task.taskTypeId !== taskTypeId))
			setTimers((prev) => {
				const newTimers = new Map(prev)
				newTimers.delete(taskTypeId)
				return newTimers
			})

			console.log("✅ Задача остановлена:", taskTypeId)
		} catch (error) {
			console.error("❌ Ошибка остановки задачи:", error)
		}
	}

	const updateUnits = (taskTypeId: number, units: number) => {
		setActiveTasks((prev) =>
			prev.map((task) => (task.taskTypeId === taskTypeId ? { ...task, units } : task))
		)
	}

	// Очистка при размонтировании
	useEffect(() => {
		return () => {
			intervalRefs.current.forEach((interval) => clearInterval(interval))
			intervalRefs.current.clear()
		}
	}, [])

	return {
		activeTasks,
		timers,
		startTask,
		stopTask,
		updateUnits,
	}
}
