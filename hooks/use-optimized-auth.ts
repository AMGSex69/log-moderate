"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { optimizedCache } from "@/lib/cache-optimized"
import { dbPool } from "@/lib/database-pool"
import { perfMonitor } from "@/lib/performance"

export function useOptimizedAuth() {
	const [user, setUser] = useState<any>(null)
	const [profile, setProfile] = useState<any>(null)
	const [loading, setLoading] = useState(true)

	// Мемоизируем функции
	const fetchProfile = useCallback(async (userId: string) => {
		const endTimer = perfMonitor.startTimer("fetchProfile")

		try {
			return await dbPool.executeQuery(
				`profile_${userId}`,
				async () => {
					// ИСПРАВЛЕНО: Используем таблицу employees вместо user_profiles
					const { data, error } = await supabase
						.from("employees")
						.select(`
							id,
							full_name,
							position,
							user_id,
							office_id,
							work_schedule,
							work_hours,
							is_online,
							last_seen,
							created_at,
							offices(name)
						`)
						.eq("user_id", userId)
						.maybeSingle()

					if (error && error.code !== "PGRST116") throw error

					// Преобразуем данные в формат профиля
					if (data) {
						return {
							id: data.user_id,
							full_name: data.full_name,
							position: data.position,
							office_id: data.office_id,
							work_schedule: data.work_schedule,
							work_hours: data.work_hours,
							is_online: data.is_online,
							last_seen: data.last_seen,
							created_at: data.created_at,
							office_name: (data.offices as any)?.name
						}
					}

					return data
				},
				60000, // 1 минута кэш
			)
		} finally {
			endTimer()
		}
	}, [])

	const signOut = useCallback(async () => {
		const endTimer = perfMonitor.startTimer("signOut")

		try {
			await supabase.auth.signOut()
			setUser(null)
			setProfile(null)
			optimizedCache.clear()
			dbPool.clearCache()
		} finally {
			endTimer()
		}
	}, [])

	useEffect(() => {
		const endTimer = perfMonitor.startTimer("authInitialization")

		// Получаем текущего пользователя
		supabase.auth.getUser().then(({ data: { user } }) => {
			setUser(user)

			if (user) {
				fetchProfile(user.id)
					.then((profile) => {
						setProfile(profile)
						setLoading(false)
						endTimer()
					})
					.catch((error) => {
						console.error("Error fetching profile:", error)
						setLoading(false)
						endTimer()
					})
			} else {
				setLoading(false)
				endTimer()
			}
		})

		// Слушаем изменения аутентификации
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			setUser(session?.user ?? null)

			if (session?.user) {
				const profile = await fetchProfile(session.user.id)
				setProfile(profile)
			} else {
				setProfile(null)
			}
		})

		return () => subscription.unsubscribe()
	}, [fetchProfile])

	// Мемоизируем возвращаемый объект
	return useMemo(
		() => ({
			user,
			profile,
			loading,
			signOut,
		}),
		[user, profile, loading, signOut],
	)
}
