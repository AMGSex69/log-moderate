"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"

interface ActiveColleague {
	employee_id: string
	full_name: string
	started_at: string
	duration_minutes: number
}

export function useActiveSessions(taskTypeId?: number) {
	const { user } = useAuth()
	const [activeColleagues, setActiveColleagues] = useState<ActiveColleague[]>([])
	const [mySessionId, setMySessionId] = useState<number | null>(null)

	// Получаем активных коллег для конкретной задачи
	const fetchActiveColleagues = useCallback(async () => {
		if (!taskTypeId) {
			setActiveColleagues([])
			return
		}

		try {
			const { data, error } = await supabase
				.from("active_sessions")
				.select("employee_id, started_at, employees!inner(full_name)")
				.eq("task_type_id", taskTypeId)
				.gte("last_heartbeat", new Date(Date.now() - 2 * 60 * 1000).toISOString()) // Активные за последние 2 минуты

			if (error) throw error

			const colleagues =
				data?.map((session: any) => {
					const startTime = new Date(session.started_at)
					const durationMinutes = Math.floor((Date.now() - startTime.getTime()) / 60000)

					return {
						employee_id: session.employee_id,
						full_name: session.employees.full_name,
						started_at: session.started_at,
						duration_minutes: durationMinutes,
					}
				}) || []

			setActiveColleagues(colleagues)
		} catch (error) {
			console.error("Ошибка загрузки активных коллег:", error)
		}
	}, [taskTypeId])

	// Real-time подписка на изменения активных сессий
	useEffect(() => {
		if (!taskTypeId) return

		const channel = supabase
			.channel(`active_sessions_${taskTypeId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "active_sessions",
					filter: `task_type_id=eq.${taskTypeId}`,
				},
				() => {
					// Обновляем список при любых изменениях
					fetchActiveColleagues()
				},
			)
			.subscribe()

		return () => {
			supabase.removeChannel(channel)
		}
	}, [taskTypeId, fetchActiveColleagues])

	// Создаем активную сессию
	const startSession = async (taskTypeId: number) => {
		if (!user) return null

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) throw new Error("Employee not found")

			// Проверяем, есть ли уже активная сессия для этой задачи
			const { data: existingSession } = await supabase
				.from("active_sessions")
				.select("id")
				.eq("employee_id", employeeId)
				.eq("task_type_id", taskTypeId)
				.eq("is_active", true)
				.single()

			if (existingSession) {
				// Если сессия уже существует, просто обновляем heartbeat
				await supabase
					.from("active_sessions")
					.update({ last_heartbeat: new Date().toISOString() })
					.eq("id", existingSession.id)

				setMySessionId(existingSession.id)
				return existingSession.id
			}

			// Создаем новую сессию только если её нет
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

			setMySessionId(data.id)

			// Обновляем онлайн статус
			await authService.updateOnlineStatus(user.id, true)

			return data.id
		} catch (error) {
			console.error("Ошибка создания сессии:", error)
			return null
		}
	}

	// Обновляем heartbeat
	const updateHeartbeat = useCallback(async () => {
		if (!mySessionId) return

		try {
			await supabase.from("active_sessions").update({ last_heartbeat: new Date().toISOString() }).eq("id", mySessionId)
		} catch (error) {
			console.error("Ошибка обновления heartbeat:", error)
		}
	}, [mySessionId])

	// Завершаем сессию
	const endSession = async (taskTypeId?: number) => {
		if (!user) return

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) return

			if (taskTypeId) {
				// Завершаем конкретную сессию
				await supabase
					.from("active_sessions")
					.delete()
					.eq("employee_id", employeeId)
					.eq("task_type_id", taskTypeId)
			} else if (mySessionId) {
				// Завершаем сессию по ID
				await supabase.from("active_sessions").delete().eq("id", mySessionId)
			}

			setMySessionId(null)

			// Проверяем, остались ли другие активные сессии
			const { data: remainingSessions } = await supabase
				.from("active_sessions")
				.select("id")
				.eq("employee_id", employeeId)
				.eq("is_active", true)

			// Обновляем онлайн статус только если нет других активных сессий
			if (!remainingSessions || remainingSessions.length === 0) {
				await authService.updateOnlineStatus(user.id, false)
			}
		} catch (error) {
			console.error("Ошибка завершения сессии:", error)
		}
	}

	// Автоматическое обновление heartbeat каждые 30 секунд
	useEffect(() => {
		if (!mySessionId) return

		const interval = setInterval(updateHeartbeat, 30000)
		return () => clearInterval(interval)
	}, [mySessionId, updateHeartbeat])

	// Автоматическое обновление списка коллег каждые 10 секунд
	useEffect(() => {
		fetchActiveColleagues()
		const interval = setInterval(fetchActiveColleagues, 10000)
		return () => clearInterval(interval)
	}, [fetchActiveColleagues])

	// Очистка при размонтировании
	useEffect(() => {
		return () => {
			if (mySessionId) {
				supabase.from("active_sessions").delete().eq("id", mySessionId)
			}
		}
	}, [mySessionId])

	return {
		activeColleagues,
		startSession,
		endSession,
		updateHeartbeat,
		isActive: !!mySessionId,
	}
}
