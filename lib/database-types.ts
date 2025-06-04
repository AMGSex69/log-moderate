// Полная типизация базы данных Task Logger
// Автогенерируется из схемы Supabase

export interface Employee {
	id: number
	user_id: string
	full_name: string
	email?: string
	position: string
	is_admin: boolean
	is_active: boolean
	work_schedule: string
	work_hours: number
	is_online: boolean
	last_seen?: string
	created_at: string
	updated_at: string
}

export interface TaskType {
	id: number
	name: string
	description?: string
	is_active: boolean
	created_at: string
}

export interface TaskLog {
	id: number
	employee_id: number
	task_type_id: number
	units_completed: number
	time_spent_minutes: number
	work_date: string
	notes?: string
	is_active: boolean
	started_at: string
	completed_at: string
	created_at: string
	// Связанные данные
	employees?: Employee
	task_types?: TaskType
}

export interface WorkSession {
	id: number
	employee_id: number
	date: string
	clock_in_time?: string
	clock_out_time?: string
	expected_end_time?: string
	is_auto_clocked_out: boolean
	is_paused: boolean
	pause_start_time?: string
	total_work_minutes: number
	total_task_minutes: number
	total_idle_minutes: number
	total_break_minutes: number
	overtime_minutes: number
	break_duration_minutes: number
	is_active: boolean
	// Поля для совместимости
	start_time?: string
	end_time?: string
	session_date?: string
	created_at: string
	updated_at: string
	// Связанные данные
	employees?: Employee
}

export interface ActiveSession {
	id: number
	employee_id: number
	task_type_id: number
	started_at: string
	last_heartbeat: string
	current_units: number
	is_active: boolean
	created_at: string
	// Связанные данные
	employees?: Employee
	task_types?: TaskType
}

export interface BreakLog {
	id: number
	employee_id: number
	date: string
	start_time: string
	end_time?: string
	break_type: 'break' | 'lunch' | 'personal'
	duration_minutes?: number
	notes?: string
	created_at: string
	// Связанные данные
	employees?: Employee
}

export interface EmployeePrize {
	id: number
	employee_id: number
	prize_name: string
	prize_description?: string
	prize_icon?: string
	prize_rarity: 'common' | 'rare' | 'epic' | 'legendary'
	won_at: string
	is_claimed: boolean
	claimed_at?: string
	// Связанные данные
	employees?: Employee
}

// Представления
export interface EmployeeCurrentStatus {
	id: number
	user_id: string
	full_name: string
	position: string
	is_online: boolean
	last_seen?: string
	session_id?: number
	clock_in_time?: string
	clock_out_time?: string
	expected_end_time?: string
	is_paused: boolean
	is_working: boolean
	current_task_type_id?: number
	current_task_name?: string
}

export interface TaskLogDetailed {
	id: number
	employee_id: number
	task_type_id: number
	units_completed: number
	time_spent_minutes: number
	work_date: string
	notes?: string
	is_active: boolean
	started_at: string
	completed_at: string
	created_at: string
	employee_name: string
	employee_position: string
	task_type_name: string
	task_type_description?: string
}

// Типы для статистики и аналитики
export interface EmployeeStats {
	employee_id: number
	full_name: string
	total_tasks: number
	total_time: number
	total_units: number
	avg_time_per_unit: number
	today_tasks: number
	this_week_tasks: number
}

export interface TaskAnalytics {
	task_id: number
	task_name: string
	task_group: string
	total_performers: number
	total_count: number
	total_units: number
	total_time: number
	avg_time_per_unit: number
	total_coins_earned: number
	best_performer: string
	most_efficient: string
	performers: TaskPerformer[]
	period_stats: TaskPeriodStats[]
}

export interface TaskPerformer {
	employee_id: number
	full_name: string
	total_units: number
	total_time: number
	task_count: number
	avg_time_per_unit: number
	efficiency_score: number
	coins_earned: number
	best_day: string
	best_day_units: number
}

export interface TaskPeriodStats {
	period: string
	total_count: number
	total_units: number
	total_time: number
	unique_performers: number
	avg_time_per_unit: number
	best_performer: string
}

export interface DashboardStats {
	total_employees: number
	active_today: number
	total_tasks_today: number
	total_tasks_period: number
	total_units_today: number
	total_units_period: number
	total_time_today: number
	total_time_period: number
	total_coins_period: number
	avg_efficiency: number
	top_performers: TopPerformer[]
	task_distribution: TaskDistribution[]
	daily_trends: DailyTrend[]
	group_performance: GroupPerformance[]
}

export interface TopPerformer {
	employee_id: number
	full_name: string
	total_units: number
	total_time: number
	efficiency_score: number
	position: string
}

export interface TaskDistribution {
	task_name: string
	task_group: string
	count: number
	percentage: number
	total_time: number
	total_units: number
}

export interface DailyTrend {
	date: string
	total_tasks: number
	total_units: number
	total_time: number
	active_employees: number | Set<string>
}

export interface GroupPerformance {
	group_name: string
	total_time: number
	percentage: number
	tasks: string[]
	avg_efficiency: number
}

// Типы для работающих сотрудников
export interface WorkingEmployee {
	id: number
	full_name: string
	clock_in_time: string
	expected_end_time?: string
	is_paused: boolean
	current_task?: string
	work_time_minutes: number
}

// Типы для временных интервалов
export interface TimelineSegment {
	start: Date
	end: Date
	type: 'task' | 'break' | 'idle'
	taskName?: string
	breakType?: string
	duration: number
	units?: number
}

export interface EmployeeTimelineData {
	employeeId: number
	fullName: string
	position: string
	clockInTime?: Date
	clockOutTime?: Date
	expectedEndTime?: Date
	isCurrentlyWorking: boolean
	totalWorkTime: number
	totalTaskTime: number
	totalBreakTime: number
	totalIdleTime: number
	totalUnits: number
	segments: TimelineSegment[]
	workloadData: WorkloadData[]
}

export interface WorkloadData {
	hour: number
	tasks: number
	time_minutes: number
	units: number
}

// Типы для лидербордов
export interface TaskLeaderboardEntry {
	employee_id: number
	full_name: string
	total_units: number
	total_time: number
	task_count: number
	avg_time_per_unit: number
	efficiency_score: number
	coins_earned: number
}

// Утилитарные типы
export type DateRange = {
	start: string
	end: string
}

export type PeriodType = 'day' | 'week' | 'month' | 'year'

export type TaskGroup = 'development' | 'testing' | 'documentation' | 'analysis' | 'design' | 'other'

// Типы для ответов функций базы данных
export interface EmployeeStatsResponse {
	total_tasks: number
	total_units: number
	total_time: number
	today_tasks: number
	this_week_tasks: number
	avg_time_per_unit: number
}

export interface EmployeeDashboardStatsResponse {
	employee_id: number
	full_name: string
	position: string
	is_online: boolean
	today_stats: {
		tasks_completed: number
		units_completed: number
		time_spent: number
	}
	week_stats: {
		tasks_completed: number
		units_completed: number
		time_spent: number
	}
	total_stats: {
		tasks_completed: number
		units_completed: number
		time_spent: number
		avg_time_per_unit: number
	}
}

// Типы для запросов к базе данных
export interface CreateTaskLogRequest {
	employee_id: number
	task_type_id: number
	units_completed: number
	time_spent_minutes: number
	work_date?: string
	notes?: string
}

export interface CreateWorkSessionRequest {
	employee_id: number
	date?: string
	clock_in_time?: string
	expected_end_time?: string
}

export interface UpdateWorkSessionRequest {
	clock_out_time?: string
	total_work_minutes?: number
	total_task_minutes?: number
	total_idle_minutes?: number
	total_break_minutes?: number
	overtime_minutes?: number
	is_paused?: boolean
	pause_start_time?: string
}

export interface CreateActiveSessionRequest {
	employee_id: number
	task_type_id: number
}

export interface CreateBreakLogRequest {
	employee_id: number
	date?: string
	start_time: string
	break_type?: 'break' | 'lunch' | 'personal'
	notes?: string
}

// Типы для конфигурации игрофикации
export interface GameConfig {
	TASK_REWARDS: Record<string, number>
	TASK_GROUPS: Record<string, {
		name: string
		color: string
		tasks: string[]
	}>
	PRIZE_THRESHOLDS: Record<string, number>
	EFFICIENCY_BONUSES: Record<string, number>
}

// Экспорт всех типов для Database
export interface Database {
	public: {
		Tables: {
			employees: {
				Row: Employee
				Insert: Omit<Employee, 'id' | 'created_at' | 'updated_at'>
				Update: Partial<Omit<Employee, 'id' | 'created_at'>>
			}
			task_types: {
				Row: TaskType
				Insert: Omit<TaskType, 'id' | 'created_at'>
				Update: Partial<Omit<TaskType, 'id' | 'created_at'>>
			}
			task_logs: {
				Row: TaskLog
				Insert: Omit<TaskLog, 'id' | 'created_at' | 'started_at' | 'completed_at'>
				Update: Partial<Omit<TaskLog, 'id' | 'created_at'>>
			}
			work_sessions: {
				Row: WorkSession
				Insert: Omit<WorkSession, 'id' | 'created_at' | 'updated_at'>
				Update: Partial<Omit<WorkSession, 'id' | 'created_at'>>
			}
			active_sessions: {
				Row: ActiveSession
				Insert: Omit<ActiveSession, 'id' | 'created_at' | 'started_at' | 'last_heartbeat'>
				Update: Partial<Omit<ActiveSession, 'id' | 'created_at'>>
			}
			break_logs: {
				Row: BreakLog
				Insert: Omit<BreakLog, 'id' | 'created_at'>
				Update: Partial<Omit<BreakLog, 'id' | 'created_at'>>
			}
			employee_prizes: {
				Row: EmployeePrize
				Insert: Omit<EmployeePrize, 'id' | 'won_at'>
				Update: Partial<Omit<EmployeePrize, 'id' | 'won_at'>>
			}
		}
		Views: {
			employee_current_status: {
				Row: EmployeeCurrentStatus
			}
			task_logs_detailed: {
				Row: TaskLogDetailed
			}
		}
		Functions: {
			get_employee_stats: {
				Args: { employee_user_id: string }
				Returns: EmployeeStatsResponse
			}
			get_employee_dashboard_stats: {
				Args: { employee_user_id: string }
				Returns: EmployeeDashboardStatsResponse
			}
		}
	}
} 