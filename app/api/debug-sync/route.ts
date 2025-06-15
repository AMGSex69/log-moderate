import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
	try {
		// Получаем текущего пользователя
		const { data: { user }, error: userError } = await supabase.auth.getUser()

		if (userError || !user) {
			return NextResponse.json({ error: 'Пользователь не авторизован' }, { status: 401 })
		}

		// Получаем данные из user_profiles
		const { data: profileData, error: profileError } = await supabase
			.from('user_profiles')
			.select('*')
			.eq('id', user.id)
			.single()

		// Получаем данные из employees
		const { data: employeeData, error: employeeError } = await supabase
			.from('employees')
			.select('*, offices(name)')
			.eq('user_id', user.id)
			.single()

		// Получаем логи синхронизации
		const { data: syncLogs, error: logsError } = await supabase
			.from('sync_logs')
			.select('*')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false })
			.limit(10)

		return NextResponse.json({
			user_id: user.id,
			profile_data: profileData,
			profile_error: profileError,
			employee_data: employeeData,
			employee_error: employeeError,
			sync_logs: syncLogs,
			logs_error: logsError,
			timestamp: new Date().toISOString()
		})

	} catch (error) {
		console.error('Ошибка диагностики:', error)
		return NextResponse.json({
			error: 'Ошибка диагностики',
			details: error instanceof Error ? error.message : 'Неизвестная ошибка'
		}, { status: 500 })
	}
} 