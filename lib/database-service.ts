import { supabase } from "./supabase"
import type {
	CreateTaskLogRequest,
	CreateWorkSessionRequest,
	UpdateWorkSessionRequest,
	CreateActiveSessionRequest,
	CreateBreakLogRequest,
	ActiveSession
} from "./database-types"

// Сервис для работы с базой данных
export class DatabaseService {
	// Employees
	static async getEmployeeByUserId(userId: string) {
		return await supabase
			.from("user_profiles")
			.select("*")
			.eq("id", userId)
			.single()
	}

	static async getAllEmployees() {
		return await supabase
			.from("user_profiles")
			.select("*")
			.eq("is_active", true)
			.order("full_name")
	}

	// ОТКЛЮЧЕНО: Обновление онлайн статуса сотрудника
	static async updateEmployeeOnlineStatus(userId: string, isOnline: boolean) {
		// Больше не обновляем онлайн статус для улучшения производительности
		return { data: null, error: null }

		/* ОТКЛЮЧЕННЫЙ КОД:
		return await supabase
			.from("user_profiles")
			.update({
				is_online: isOnline,
				last_seen: new Date().toISOString(),
				updated_at: new Date().toISOString()
			})
			.eq("id", userId)
		*/
	}

	// Task Types
	static async getAllTaskTypes() {
		return await supabase
			.from("task_types")
			.select("*")
			.eq("is_active", true)
			.order("name")
	}

	static async getTaskTypesByGroup() {
		const { data, error } = await this.getAllTaskTypes()
		if (error) return { data: null, error }

		// Группируем задачи по группам (импортируем функцию группировки)
		const { getTaskGroup, GAME_CONFIG } = await import('./game-config')

		const grouped = Object.keys(GAME_CONFIG.TASK_GROUPS).reduce((acc, groupKey) => {
			acc[groupKey] = {
				...GAME_CONFIG.TASK_GROUPS[groupKey],
				tasks: data?.filter(task =>
					GAME_CONFIG.TASK_GROUPS[groupKey].tasks.includes(task.name)
				) || []
			}
			return acc
		}, {} as Record<string, any>)

		return { data: grouped, error: null }
	}

	// Task Logs
	static async createTaskLog(data: CreateTaskLogRequest) {
		return await supabase
			.from("task_logs")
			.insert(data)
			.select()
			.single()
	}

	static async getTaskLogsByEmployee(employeeId: number, startDate?: string, endDate?: string) {
		let query = supabase
			.from("task_logs")
			.select("*, user_profiles(*), task_types(*)")
			.eq("employee_id", employeeId)
			.order("created_at", { ascending: false })

		if (startDate) query = query.gte("work_date", startDate)
		if (endDate) query = query.lte("work_date", endDate)

		return await query
	}

	static async getTaskLogsDetailed(startDate?: string, endDate?: string, limit = 100) {
		let query = supabase
			.from("task_logs_detailed")
			.select("*")
			.order("created_at", { ascending: false })
			.limit(limit)

		if (startDate) query = query.gte("work_date", startDate)
		if (endDate) query = query.lte("work_date", endDate)

		return await query
	}

	// Work Sessions
	static async getCurrentWorkSession(employeeId: number) {
		const today = new Date().toISOString().split("T")[0]

		return await supabase
			.from("work_sessions")
			.select("*")
			.eq("employee_id", employeeId)
			.eq("date", today)
			.maybeSingle()
	}

	static async createWorkSession(data: CreateWorkSessionRequest) {
		return await supabase
			.from("work_sessions")
			.insert({
				...data,
				date: data.date || new Date().toISOString().split("T")[0]
			})
			.select()
			.single()
	}

	static async updateWorkSession(sessionId: number, data: UpdateWorkSessionRequest) {
		return await supabase
			.from("work_sessions")
			.update(data)
			.eq("id", sessionId)
			.select()
			.single()
	}

	static async getWorkingEmployeesToday() {
		const today = new Date().toISOString().split("T")[0]

		return await supabase
			.from("work_sessions")
			.select("*, user_profiles(*)")
			.eq("date", today)
			.not("clock_in_time", "is", null)
			.is("clock_out_time", null)
	}

	// Active Sessions - обновленные методы для поддержки многозадачности
	static async getActiveTaskSessions() {
		return await supabase
			.from("active_sessions")
			.select("*, user_profiles(*), task_types(*)")
			.eq("is_active", true)
			.order("started_at", { ascending: false })
	}

	static async getActiveSessionsByEmployee(employeeId: number) {
		return await supabase
			.from("active_sessions")
			.select("*, task_types(*)")
			.eq("employee_id", employeeId)
			.eq("is_active", true)
			.order("last_heartbeat", { ascending: false })
	}

	static async createActiveSession(data: CreateActiveSessionRequest) {
		// Проверяем лимит одновременных задач
		const { data: existingSessions } = await this.getActiveSessionsByEmployee(data.employee_id)
		const { GAME_CONFIG } = await import('./game-config')

		if (existingSessions && existingSessions.length >= GAME_CONFIG.MULTITASK_CONFIG.max_concurrent_tasks) {
			return {
				data: null,
				error: {
					message: `Максимальное количество одновременных задач: ${GAME_CONFIG.MULTITASK_CONFIG.max_concurrent_tasks}`,
					code: 'MAX_TASKS_EXCEEDED'
				}
			}
		}

		return await supabase
			.from("active_sessions")
			.insert(data)
			.select()
			.single()
	}

	// ОТКЛЮЧЕНО: Обновление heartbeat активной сессии
	static async updateActiveSessionHeartbeat(sessionId: number, currentUnits?: number) {
		// Больше не обновляем heartbeat для улучшения производительности
		return { data: null, error: null }

		/* ОТКЛЮЧЕННЫЙ КОД:
		return await supabase
			.from("active_sessions")
			.update({
				last_heartbeat: new Date().toISOString(),
				...(currentUnits !== undefined && { current_units: currentUnits })
			})
			.eq("id", sessionId)
		*/
	}

	// ОТКЛЮЧЕНО: Пауза активной сессии
	static async pauseActiveSession(sessionId: number) {
		// Больше не обновляем heartbeat
		return { data: null, error: null }
	}

	// ОТКЛЮЧЕНО: Возобновление активной сессии
	static async resumeActiveSession(sessionId: number) {
		// Больше не обновляем heartbeat
		return { data: null, error: null }
	}

	static async endActiveSession(sessionId: number) {
		return await supabase
			.from("active_sessions")
			.update({ is_active: false })
			.eq("id", sessionId)
	}

	static async endAllActiveSessionsForEmployee(employeeId: number) {
		return await supabase
			.from("active_sessions")
			.update({ is_active: false })
			.eq("employee_id", employeeId)
			.eq("is_active", true)
	}

	// ОТКЛЮЧЕНО: Переключение активной задачи
	static async switchActiveTask(employeeId: number, newTaskTypeId: number) {
		// Упрощенная версия без heartbeat обновлений
		const { data: currentSessions } = await this.getActiveSessionsByEmployee(employeeId)

		if (!currentSessions?.length) {
			return await this.createActiveSession({
				employee_id: employeeId,
				task_type_id: newTaskTypeId
			})
		}

		const existingSession = currentSessions.find(s => s.task_type_id === newTaskTypeId)

		if (existingSession) {
			// Просто возвращаем существующую сессию без обновления heartbeat
			return { data: existingSession, error: null }
		} else {
			return await this.createActiveSession({
				employee_id: employeeId,
				task_type_id: newTaskTypeId
			})
		}
	}

	// ОТКЛЮЧЕНО: Очистка неактивных сессий
	static async cleanupIdleSessions() {
		// Больше не очищаем сессии автоматически
		return { data: null, error: null }

		/* ОТКЛЮЧЕННЫЙ КОД:
		const { GAME_CONFIG } = await import('./game-config')
		const timeoutMinutes = GAME_CONFIG.MULTITASK_CONFIG.idle_task_timeout
		const timeoutThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()

		return await supabase
			.from("active_sessions")
			.update({ is_active: false })
			.eq("is_active", true)
			.lt("last_heartbeat", timeoutThreshold)
		*/
	}

	// Break Logs
	static async createBreakLog(data: CreateBreakLogRequest) {
		return await supabase
			.from("break_logs")
			.insert({
				...data,
				date: data.date || new Date().toISOString().split("T")[0]
			})
			.select()
			.single()
	}

	static async endBreakLog(breakId: number) {
		const endTime = new Date().toISOString()

		return await supabase
			.from("break_logs")
			.update({ end_time: endTime })
			.eq("id", breakId)
			.select()
			.single()
	}

	static async getCurrentBreak(employeeId: number) {
		const today = new Date().toISOString().split("T")[0]

		return await supabase
			.from("break_logs")
			.select("*")
			.eq("employee_id", employeeId)
			.eq("date", today)
			.is("end_time", null)
			.order("created_at", { ascending: false })
			.maybeSingle()
	}

	// Employee Current Status (представление)
	static async getEmployeeCurrentStatus() {
		return await supabase
			.from("employee_current_status")
			.select("*")
			.order("full_name")
	}

	static async getEmployeeCurrentStatusById(employeeId: number) {
		return await supabase
			.from("employee_current_status")
			.select("*")
			.eq("id", employeeId)
			.single()
	}

	// Statistics Functions
	static async getEmployeeStats(userId: string) {
		const { data, error } = await supabase
			.rpc("get_employee_stats", { employee_user_id: userId })

		return { data, error }
	}

	static async getEmployeeDashboardStats(userId: string) {
		const { data, error } = await supabase
			.rpc("get_employee_dashboard_stats", { employee_user_id: userId })

		return { data, error }
	}

	// Analytics queries
	static async getTaskAnalytics(taskTypeId?: number, startDate?: string, endDate?: string) {
		let query = supabase
			.from("task_logs")
			.select("*, user_profiles(full_name), task_types(name)")
			.order("work_date", { ascending: false })

		if (taskTypeId) query = query.eq("task_type_id", taskTypeId)
		if (startDate) query = query.gte("work_date", startDate)
		if (endDate) query = query.lte("work_date", endDate)

		return await query
	}

	static async getEmployeeAnalytics(employeeId?: number, startDate?: string, endDate?: string) {
		let query = supabase
			.from("task_logs")
			.select("*, user_profiles(full_name, position), task_types(name)")
			.order("work_date", { ascending: false })

		if (employeeId) query = query.eq("employee_id", employeeId)
		if (startDate) query = query.gte("work_date", startDate)
		if (endDate) query = query.lte("work_date", endDate)

		return await query
	}

	static async getDashboardStats(startDate?: string, endDate?: string) {
		const today = new Date().toISOString().split("T")[0]

		// Получаем базовую статистику
		const [
			{ data: employees },
			{ data: todayTasks },
			{ data: periodTasks },
			{ data: workingSessions }
		] = await Promise.all([
			supabase.from("user_profiles").select("id").eq("is_active", true),
			supabase.from("task_logs").select("*").eq("work_date", today),
			DatabaseService.getTaskAnalytics(undefined, startDate, endDate),
			DatabaseService.getWorkingEmployeesToday()
		])

		return {
			employees: employees || [],
			todayTasks: todayTasks || [],
			periodTasks: periodTasks || [],
			workingSessions: workingSessions || []
		}
	}

	// Аналитика по группам задач
	static async getGroupAnalytics(startDate?: string, endDate?: string) {
		const { data: taskLogs, error } = await this.getTaskAnalytics(undefined, startDate, endDate)
		if (error || !taskLogs) return { data: null, error }

		const { getTaskGroup, GAME_CONFIG } = await import('./game-config')

		// Группируем логи по группам задач
		const groupStats = Object.keys(GAME_CONFIG.TASK_GROUPS).reduce((acc, groupKey) => {
			const groupTasks = taskLogs.filter(log =>
				GAME_CONFIG.TASK_GROUPS[groupKey].tasks.includes(log.task_types?.name || '')
			)

			acc[groupKey] = {
				name: GAME_CONFIG.TASK_GROUPS[groupKey].name,
				color: GAME_CONFIG.TASK_GROUPS[groupKey].color,
				total_tasks: groupTasks.length,
				total_units: groupTasks.reduce((sum, log) => sum + log.units_completed, 0),
				total_time: groupTasks.reduce((sum, log) => sum + log.time_spent_minutes, 0),
				unique_performers: new Set(groupTasks.map(log => log.employee_id)).size,
				avg_time_per_unit: groupTasks.length > 0
					? Math.round(groupTasks.reduce((sum, log) => sum + log.time_spent_minutes, 0) /
						groupTasks.reduce((sum, log) => sum + log.units_completed, 1))
					: 0
			}
			return acc
		}, {} as Record<string, any>)

		return { data: groupStats, error: null }
	}

	// Методы для работы с многозадачностью
	static async getMultitaskingStats(employeeId: number, startDate?: string, endDate?: string) {
		// Получаем все активные сессии за период
		let query = supabase
			.from("active_sessions")
			.select("*, task_types(name)")
			.eq("employee_id", employeeId)
			.order("started_at", { ascending: false })

		if (startDate) query = query.gte("started_at", startDate)
		if (endDate) query = query.lte("started_at", endDate)

		const { data: sessions, error } = await query

		if (error || !sessions) return { data: null, error }

		// Анализируем многозадачность
		const multitaskingStats = {
			total_sessions: sessions.length,
			concurrent_sessions: 0,
			task_switches: 0,
			max_concurrent: 0,
			avg_session_duration: 0,
			most_used_task: '',
			efficiency_score: 0
		}

		// Дополнительная логика анализа...
		// Это можно расширить для более детального анализа

		return { data: multitaskingStats, error: null }
	}

	// Метод для получения рекомендаций по оптимизации работы
	static async getWorkOptimizationSuggestions(employeeId: number) {
		const { data: employee } = await supabase
			.from("user_profiles")
			.select("*")
			.eq("id", employeeId)
			.single()

		if (!employee) return { data: null, error: { message: "Employee not found" } }

		const suggestions = []

		// Получаем активные сессии
		const { data: activeSessions } = await this.getActiveSessionsByEmployee(employeeId)

		if (activeSessions && activeSessions.length > 2) {
			suggestions.push({
				type: 'multitask_warning',
				message: 'У вас много активных задач. Рассмотрите возможность завершения некоторых для повышения эффективности.',
				priority: 'medium'
			})
		}

		// Можно добавить больше логики для рекомендаций...

		return { data: suggestions, error: null }
	}
} 