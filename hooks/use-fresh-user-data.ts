"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"

interface FreshUserData {
	full_name: string | null
	position: string | null
	avatar_url: string | null
	office_name: string | null
	is_admin: boolean
	loading: boolean
}

export function useFreshUserData() {
	const { user } = useAuth()
	const [freshData, setFreshData] = useState<FreshUserData>({
		full_name: null,
		position: null,
		avatar_url: null,
		office_name: null,
		is_admin: false,
		loading: true
	})
	const [refreshCounter, setRefreshCounter] = useState(0)

	useEffect(() => {
		if (!user) {
			setFreshData({
				full_name: null,
				position: null,
				avatar_url: null,
				office_name: null,
				is_admin: false,
				loading: false
			})
			return
		}

		const fetchFreshData = async () => {
			try {
				console.log("🔄 [FRESH] Loading fresh user data...")

				// Загружаем из employees таблицы с подключением к offices
				const { data: employeeData, error: employeeError } = await supabase
					.from("employees")
					.select(`
						*,
						offices(name)
					`)
					.eq("user_id", user.id)
					.maybeSingle()

				if (!employeeError && employeeData) {
					console.log("✅ [FRESH] Employee data loaded:", employeeData)
					setFreshData({
						full_name: employeeData.full_name || null,
						position: employeeData.position || null,
						avatar_url: employeeData.avatar_url || null,
						office_name: employeeData.offices?.name || employeeData.office_name || null,
						is_admin: employeeData.is_admin || false,
						loading: false
					})
					return
				}

				console.log("🔄 [FRESH] Employee not found, trying user_profiles...")

				// Fallback на user_profiles
				const { data: profileData, error: profileError } = await supabase
					.from("user_profiles")
					.select("*")
					.eq("id", user.id)
					.maybeSingle()

				if (!profileError && profileData) {
					console.log("✅ [FRESH] Profile data loaded:", profileData)
					setFreshData({
						full_name: profileData.full_name || null,
						position: profileData.position || null,
						avatar_url: profileData.avatar_url || null,
						office_name: profileData.office_name || null,
						is_admin: profileData.is_admin || false,
						loading: false
					})
				} else {
					console.warn("⚠️ [FRESH] No data found")
					setFreshData({
						full_name: user.email || null,
						position: "Сотрудник",
						avatar_url: null,
						office_name: "Не указан",
						is_admin: user.email === 'egordolgih@mail.ru',
						loading: false
					})
				}
			} catch (error) {
				console.error("❌ [FRESH] Error loading fresh data:", error)
				setFreshData(prev => ({ ...prev, loading: false }))
			}
		}

		fetchFreshData()
	}, [user, refreshCounter])

	const refresh = async () => {
		console.log("🔄 [FRESH] Manual refresh triggered")
		setRefreshCounter(prev => prev + 1)

		// Ждем, пока данные обновятся
		return new Promise<void>((resolve) => {
			const timeoutId = setTimeout(() => {
				console.log("✅ [FRESH] Manual refresh completed")
				resolve()
			}, 100) // Небольшая задержка для обновления состояния
		})
	}

	return { ...freshData, refresh }
} 