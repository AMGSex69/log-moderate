import { createClient } from "@supabase/supabase-js"

// Оптимизированный клиент с пулом подключений
class OptimizedSupabaseClient {
	private static instance: OptimizedSupabaseClient
	private baseClient: any
	private realtimeChannels = new Map<string, any>()

	constructor() {
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"
		const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"

		this.baseClient = createClient(supabaseUrl, supabaseAnonKey, {
			realtime: {
				params: {
					eventsPerSecond: 2, // Ограничиваем частоту событий
				},
			},
			db: {
				schema: "public",
			},
			auth: {
				persistSession: true,
				autoRefreshToken: true,
			},
		})
	}

	static getInstance() {
		if (!OptimizedSupabaseClient.instance) {
			OptimizedSupabaseClient.instance = new OptimizedSupabaseClient()
		}
		return OptimizedSupabaseClient.instance
	}

	// Объединение real-time подписок
	subscribeToChannel(channelName: string, config: any) {
		if (this.realtimeChannels.has(channelName)) {
			return this.realtimeChannels.get(channelName)
		}

		const channel = this.baseClient.channel(channelName).on("postgres_changes", config).subscribe()

		this.realtimeChannels.set(channelName, channel)
		return channel
	}

	// Пакетные запросы для экономии подключений
	async batchQuery(queries: Array<() => Promise<any>>) {
		const results = await Promise.all(queries.map((query) => query()))
		return results
	}

	// Стандартные методы с оптимизацией
	from(table: string) {
		return this.baseClient.from(table)
	}

	get auth() {
		return this.baseClient.auth
	}

	// Очистка ресурсов
	cleanup() {
		this.realtimeChannels.forEach((channel) => {
			channel.unsubscribe()
		})
		this.realtimeChannels.clear()
	}
}

export const optimizedSupabase = OptimizedSupabaseClient.getInstance()
