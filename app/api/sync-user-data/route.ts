import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
	try {
		// Получаем токен из заголовков
		const authHeader = request.headers.get('authorization')
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return NextResponse.json({ error: 'No authorization token' }, { status: 401 })
		}

		const token = authHeader.substring(7)

		// Получаем данные пользователя с токеном
		const { data: { user }, error: authError } = await supabase.auth.getUser(token)

		if (authError || !user) {
			console.error('❌ [SYNC-API] Auth error:', authError)
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		console.log('🔄 [SYNC-API] Starting sync for user:', user.id)

		// Вызываем функцию синхронизации в базе данных
		const { data, error } = await supabase.rpc('sync_employee_to_userprofile', {
			target_user_id: user.id
		})

		if (error) {
			console.error('❌ [SYNC-API] Sync error:', error)
			return NextResponse.json({ error: error.message }, { status: 500 })
		}

		console.log('✅ [SYNC-API] Sync result:', data)

		return NextResponse.json({
			success: true,
			message: data || 'Синхронизация выполнена успешно'
		})

	} catch (error) {
		console.error('❌ [SYNC-API] Unexpected error:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		)
	}
} 