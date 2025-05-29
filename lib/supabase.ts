import { createClient } from "@supabase/supabase-js"

// Суpabase конфигурация
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error("Missing Supabase environment variables")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const getSupabaseClient = () => supabase

export type TaskType = {
	id: number
	name: string
	description: string
}

export type Employee = {
	id: string
	email: string
	full_name: string
	position: string
	is_active: boolean
	is_online?: boolean
	last_seen?: string
}

export type TaskLog = {
	id: number
	employee_id: string
	task_type_id: number
	units_completed: number
	time_spent_minutes: number
	work_date: string
	notes?: string
	created_at: string
	task_types?: TaskType
	employees?: Employee
}

export type EmployeeStats = {
	employee_id: string
	full_name: string
	total_tasks: number
	total_time: number
	total_units: number
}
