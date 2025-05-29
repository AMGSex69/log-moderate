import { getSupabaseClient } from "./supabase"

const supabase = getSupabaseClient()

export type UserProfile = {
	id: string
	full_name: string
	position: string
	is_admin: boolean
	work_schedule?: string
	work_hours?: number
	is_online?: boolean
	last_seen?: string
	created_at: string
	updated_at: string
}

export type AuthUser = {
	id: string
	email: string
	profile: UserProfile
}

// Функции аутентификации
export const authService = {
	// Регистрация
	async signUp(email: string, password: string, fullName: string, workSchedule?: string) {
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					full_name: fullName,
					work_schedule: workSchedule || "8+1",
				},
			},
		})
		return { data, error }
	},

	// Вход
	async signIn(email: string, password: string) {
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		})
		return { data, error }
	},

	// Выход
	async signOut() {
		const { error } = await supabase.auth.signOut()
		return { error }
	},

	// Получить текущего пользователя
	async getCurrentUser() {
		const {
			data: { user },
			error,
		} = await supabase.auth.getUser()
		return { user, error }
	},

	// Получить профиль пользователя
	async getUserProfile(userId: string): Promise<{ profile: UserProfile | null; error: any }> {
		try {
			// Сначала пробуем загрузить из user_profiles (если таблица существует)
			const { data: userProfile, error: userProfileError } = await supabase
				.from("user_profiles")
				.select("*")
				.eq("id", userId)
				.single()

			if (!userProfileError && userProfile) {
				return { profile: userProfile as UserProfile, error: null }
			}

			// Если user_profiles не найден, пробуем найти в employees
			console.log("🔄 User profile not found, trying employees table...")
			const { data: employeeData, error: employeeError } = await supabase
				.from("employees")
				.select("*")
				.eq("user_id", userId)
				.single()

			if (!employeeError && employeeData) {
				// Преобразуем данные сотрудника в формат профиля
				const profile: UserProfile = {
					id: userId,
					full_name: (employeeData as any)?.full_name || "Сотрудник",
					position: (employeeData as any)?.position || "Сотрудник",
					is_admin: (employeeData as any)?.is_admin || false,
					work_schedule: (employeeData as any)?.work_schedule || "8+1",
					work_hours: (employeeData as any)?.work_hours || 8,
					is_online: (employeeData as any)?.is_online || false,
					last_seen: (employeeData as any)?.last_seen,
					created_at: (employeeData as any)?.created_at || new Date().toISOString(),
					updated_at: (employeeData as any)?.updated_at || new Date().toISOString(),
				}
				return { profile, error: null }
			}

			// Если ничего не найдено, создаем базовый профиль
			console.log("🔄 No profile found, creating default profile...")
			const { data: userData } = await supabase.auth.getUser()
			const defaultProfile: UserProfile = {
				id: userId,
				full_name: userData.user?.user_metadata?.full_name || userData.user?.email || "Пользователь",
				position: "Сотрудник",
				is_admin: false,
				work_schedule: "8+1",
				work_hours: 8,
				is_online: false,
				last_seen: undefined,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			}

			return { profile: defaultProfile, error: null }
		} catch (error) {
			console.error("❌ Error loading user profile:", error)
			return { profile: null, error }
		}
	},

	// Обновить профиль
	async updateProfile(userId: string, updates: Partial<UserProfile>) {
		try {
			// Пробуем обновить в user_profiles
			const { data: userProfileData, error: userProfileError } = await supabase
				.from("user_profiles")
				.update(updates)
				.eq("id", userId)
				.select()
				.single()

			if (!userProfileError && userProfileData) {
				return { data: userProfileData, error: null }
			}

			// Если user_profiles не работает, пробуем employees
			console.log("🔄 Updating employee profile...")
			const { data: employeeData, error: employeeError } = await supabase
				.from("employees")
				.update({
					full_name: updates.full_name,
					position: updates.position,
					work_schedule: updates.work_schedule,
					work_hours: updates.work_hours,
					is_online: updates.is_online,
					last_seen: updates.last_seen,
					updated_at: new Date().toISOString(),
				})
				.eq("user_id", userId)
				.select()
				.single()

			return { data: employeeData, error: employeeError }
		} catch (error) {
			console.error("❌ Error updating profile:", error)
			return { data: null, error }
		}
	},

	// Получить employee ID для текущего пользователя
	async getEmployeeId(userId: string) {
		const { data, error } = await supabase.from("employees").select("id").eq("user_id", userId).single()

		return { employeeId: data?.id, error }
	},

	// Обновить статус онлайн
	async updateOnlineStatus(userId: string, isOnline: boolean) {
		try {
			// Пробуем обновить в user_profiles
			const { error: userProfileError } = await supabase
				.from("user_profiles")
				.update({
					is_online: isOnline,
					last_seen: new Date().toISOString(),
				})
				.eq("id", userId)

			if (!userProfileError) {
				return { error: null }
			}

			// Если user_profiles не работает, пробуем employees
			const { error: employeeError } = await supabase
				.from("employees")
				.update({
					is_online: isOnline,
					last_seen: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				})
				.eq("user_id", userId)

			return { error: employeeError }
		} catch (error) {
			console.error("❌ Error updating online status:", error)
			return { error }
		}
	},
}

// Экспортируем supabase клиент для использования в других модулях
export { supabase }
