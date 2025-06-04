import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
	try {
		console.log('🔄 Keep-alive check started:', new Date().toISOString())

		// Простой запрос к базе данных для поддержания активности
		const { data, error } = await supabase
			.from('task_types')
			.select('id')
			.limit(1)

		if (error) {
			console.error('❌ Keep-alive database error:', error)
			return NextResponse.json({
				error: error.message,
				timestamp: new Date().toISOString()
			}, { status: 500 })
		}

		console.log('✅ Keep-alive successful:', data?.length || 0, 'records found')

		return NextResponse.json({
			status: 'success',
			timestamp: new Date().toISOString(),
			message: 'Database is active',
			recordsFound: data?.length || 0
		})
	} catch (error) {
		console.error('❌ Keep-alive failed:', error)

		return NextResponse.json({
			error: 'Keep alive failed',
			details: error instanceof Error ? error.message : 'Unknown error',
			timestamp: new Date().toISOString()
		}, { status: 500 })
	}
} 