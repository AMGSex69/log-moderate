import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database-types"

// Supabase конфигурация
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error("Missing Supabase environment variables")
}

// Создаем типизированный клиент
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

export const getSupabaseClient = () => supabase

// Реэкспортируем все типы из database-types
export type {
	Employee,
	TaskType,
	TaskLog,
	WorkSession,
	ActiveSession,
	BreakLog,
	EmployeePrize,
	EmployeeCurrentStatus,
	TaskLogDetailed,
	EmployeeStats,
	TaskAnalytics,
	TaskPerformer,
	TaskPeriodStats,
	DashboardStats,
	TopPerformer,
	TaskDistribution,
	DailyTrend,
	GroupPerformance,
	WorkingEmployee,
	TimelineSegment,
	EmployeeTimelineData,
	WorkloadData,
	TaskLeaderboardEntry,
	DateRange,
	PeriodType,
	TaskGroup,
	EmployeeStatsResponse,
	EmployeeDashboardStatsResponse,
	CreateTaskLogRequest,
	CreateWorkSessionRequest,
	UpdateWorkSessionRequest,
	CreateActiveSessionRequest,
	CreateBreakLogRequest,
	GameConfig,
	Database
} from "./database-types"

// Экспортируем сервис базы данных
export { DatabaseService } from "./database-service"
