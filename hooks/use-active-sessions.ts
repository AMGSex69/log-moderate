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

	const fetchActiveColleagues = useCallback(async () => {
		setActiveColleagues([])
		return
	}, [taskTypeId])

	const startSession = async (taskTypeId: number) => {
		if (!user) return null

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) throw new Error("Employee not found")

			const { data: existingSession } = await supabase
				.from("active_sessions")
				.select("id")
				.eq("employee_id", employeeId)
				.eq("task_type_id", taskTypeId)
				.eq("is_active", true)
				.single()

			if (existingSession) {
				setMySessionId(existingSession.id)
				return existingSession.id
			}

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

			return data.id
		} catch (error) {
			console.error("Ошибка создания сессии:", error)
			return null
		}
	}

	const updateHeartbeat = useCallback(async () => {
		return
	}, [mySessionId])

	const endSession = async (taskTypeId?: number) => {
		if (!user) return

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) return

			if (taskTypeId) {
				await supabase
					.from("active_sessions")
					.delete()
					.eq("employee_id", employeeId)
					.eq("task_type_id", taskTypeId)
			} else if (mySessionId) {
				await supabase.from("active_sessions").delete().eq("id", mySessionId)
			}

			setMySessionId(null)
		} catch (error) {
			console.error("Ошибка завершения сессии:", error)
		}
	}

	return {
		activeColleagues: [],
		startSession,
		endSession,
		updateHeartbeat,
		isActive: !!mySessionId,
	}
}
