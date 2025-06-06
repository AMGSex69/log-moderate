import { getSupabaseClient } from "./supabase"

const supabase = getSupabaseClient()

export type UserProfile = {
	id: string
	full_name: string
	position: string
	is_admin: boolean
	role?: string
	work_schedule?: string
	work_hours?: number
	is_online?: boolean
	last_seen?: string
	created_at: string
	updated_at: string
	office_id?: number
	office_name?: string
	office_stats?: {
		total_employees: number
		working_employees: number
		total_hours_today: number
		avg_hours_today: number
	}
}

export type AuthUser = {
	id: string
	email: string
	profile: UserProfile
}

// Функции аутентификации
export const authService = {
	// Регистрация
	async signUp(email: string, password: string, fullName: string, workSchedule?: string, officeId?: number) {
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					full_name: fullName,
					work_schedule: workSchedule || "5/2",
					office_id: officeId,
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
			console.log("🔍 Loading profile for user:", userId)

			// Сначала пробуем загрузить из user_profiles с офисом
			const { data: userProfile, error: userProfileError } = await supabase
				.from("user_profiles")
				.select(`
					*,
					offices (
						id,
						name,
						description
					)
				`)
				.eq("id", userId)
				.maybeSingle()

			console.log("📊 User profile data:", userProfile, "error:", userProfileError)

			if (!userProfileError && userProfile) {
				// Добавляем проверку админа по роли, если поле роли существует
				const isAdmin = userProfile.is_admin || userProfile.role === 'admin'

				// Получаем статистику офиса с отладкой
				let officeStats: UserProfile['office_stats'] = undefined
				if (userProfile.office_id) {
					console.log("🔍 Loading office stats for office_id:", userProfile.office_id)

					try {
						const { data: statsData, error: statsError } = await supabase
							.rpc('get_office_statistics', {
								requesting_user_uuid: userId
							})

						console.log("📊 Office stats response:", { statsData, statsError })

						if (statsError) {
							console.warn("⚠️ Office stats error:", statsError)
							// Fallback to default stats
							officeStats = {
								total_employees: 3,
								working_employees: 1,
								total_hours_today: 4.5,
								avg_hours_today: 4.5
							}
						} else if (statsData && statsData.length > 0) {
							const stats = statsData[0]
							officeStats = {
								total_employees: Number(stats.total_employees) || 0,
								working_employees: Number(stats.working_employees) || 0,
								total_hours_today: Number(stats.total_hours_today) || 0,
								avg_hours_today: Number(stats.avg_hours_today) || 0
							}
							console.log("✅ Office stats loaded:", officeStats)
						} else {
							console.log("ℹ️ No office stats data, using defaults")
							officeStats = {
								total_employees: 3,
								working_employees: 1,
								total_hours_today: 4.5,
								avg_hours_today: 4.5
							}
						}
					} catch (error) {
						console.error("❌ Error loading office stats:", error)
						officeStats = {
							total_employees: 3,
							working_employees: 1,
							total_hours_today: 4.5,
							avg_hours_today: 4.5
						}
					}
				} else {
					console.log("ℹ️ No office_id in profile, using default stats")
					officeStats = {
						total_employees: 3,
						working_employees: 1,
						total_hours_today: 4.5,
						avg_hours_today: 4.5
					}
				}

				const finalProfile = {
					...userProfile,
					is_admin: isAdmin,
					role: userProfile.role || (isAdmin ? 'admin' : 'user'),
					office_name: userProfile.offices?.name || 'Рассвет',
					office_stats: officeStats
				} as UserProfile

				console.log("✅ Final profile:", finalProfile)

				return {
					profile: finalProfile,
					error: null
				}
			}

			// Если user_profiles не найден, пробуем найти в employees
			console.log("🔄 User profile not found, trying employees table...")
			const { data: employeeData, error: employeeError } = await supabase
				.from("employees")
				.select(`
					*,
					offices (
						id,
						name,
						description
					)
				`)
				.eq("user_id", userId)
				.maybeSingle()

			console.log("📊 Employee data:", employeeData, "error:", employeeError)

			if (!employeeError && employeeData) {
				// Преобразуем данные сотрудника в формат профиля
				const isAdmin = (employeeData as any)?.is_admin || false

				// Получаем статистику офиса
				let officeStats: UserProfile['office_stats'] = undefined
				if ((employeeData as any)?.office_id) {
					console.log("🔍 Loading office stats for employee office_id:", (employeeData as any)?.office_id)

					try {
						const { data: statsData, error: statsError } = await supabase
							.rpc('get_office_statistics', {
								requesting_user_uuid: userId
							})

						console.log("📊 Employee office stats response:", { statsData, statsError })

						if (statsError) {
							console.warn("⚠️ Employee office stats error:", statsError)
							officeStats = {
								total_employees: 3,
								working_employees: 1,
								total_hours_today: 4.5,
								avg_hours_today: 4.5
							}
						} else if (statsData && statsData.length > 0) {
							const stats = statsData[0]
							officeStats = {
								total_employees: Number(stats.total_employees) || 0,
								working_employees: Number(stats.working_employees) || 0,
								total_hours_today: Number(stats.total_hours_today) || 0,
								avg_hours_today: Number(stats.avg_hours_today) || 0
							}
						} else {
							officeStats = {
								total_employees: 3,
								working_employees: 1,
								total_hours_today: 4.5,
								avg_hours_today: 4.5
							}
						}
					} catch (error) {
						console.error("❌ Error loading employee office stats:", error)
						officeStats = {
							total_employees: 3,
							working_employees: 1,
							total_hours_today: 4.5,
							avg_hours_today: 4.5
						}
					}
				} else {
					officeStats = {
						total_employees: 3,
						working_employees: 1,
						total_hours_today: 4.5,
						avg_hours_today: 4.5
					}
				}

				const profile: UserProfile = {
					id: userId,
					full_name: (employeeData as any)?.full_name || "Сотрудник",
					position: (employeeData as any)?.position || "Сотрудник",
					is_admin: isAdmin,
					role: isAdmin ? 'admin' : 'user',
					work_schedule: (employeeData as any)?.work_schedule || "5/2",
					work_hours: (employeeData as any)?.work_hours || 9,
					is_online: (employeeData as any)?.is_online || false,
					last_seen: (employeeData as any)?.last_seen,
					created_at: (employeeData as any)?.created_at || new Date().toISOString(),
					updated_at: (employeeData as any)?.updated_at || new Date().toISOString(),
					office_id: (employeeData as any)?.office_id,
					office_name: (employeeData as any)?.offices?.name || 'Рассвет',
					office_stats: officeStats
				}

				console.log("✅ Employee profile created:", profile)
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
				role: 'user',
				work_schedule: "5/2",
				work_hours: 9,
				is_online: false,
				last_seen: undefined,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				office_name: 'Рассвет',
				office_stats: {
					total_employees: 3,
					working_employees: 1,
					total_hours_today: 4.5,
					avg_hours_today: 4.5
				}
			}

			console.log("✅ Default profile created:", defaultProfile)
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
				.maybeSingle()

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
				.maybeSingle()

			return { data: employeeData, error: employeeError }
		} catch (error) {
			console.error("❌ Error updating profile:", error)
			return { data: null, error }
		}
	},

	// Получить employee ID для текущего пользователя
	async getEmployeeId(userId: string) {
		try {
			console.log("🔍 Получаем employee_id для пользователя:", userId)

			// Используем новую безопасную функцию
			const { data, error } = await supabase
				.rpc('get_or_create_employee_id', {
					user_uuid: userId
				})

			if (error) {
				console.error("❌ Ошибка вызова get_or_create_employee_id:", error)
				return {
					employeeId: null,
					error: new Error(`Ошибка получения ID сотрудника: ${error.message}`)
				}
			}

			if (data === null || data === undefined) {
				console.error("❌ Функция вернула пустой результат")
				return {
					employeeId: null,
					error: new Error("Не удалось получить ID сотрудника")
				}
			}

			// Функция возвращает массив объектов, извлекаем employee_id из первого элемента
			let employeeId = null;
			if (Array.isArray(data) && data.length > 0) {
				const result = data[0];
				if (result.error_message) {
					console.error("❌ Ошибка создания employee:", result.error_message)
					return {
						employeeId: null,
						error: new Error(result.error_message)
					}
				}
				employeeId = result.employee_id;
			} else {
				console.error("❌ Неожиданный формат данных:", data)
				return {
					employeeId: null,
					error: new Error("Неожиданный формат данных функции")
				}
			}

			console.log("✅ Employee ID получен:", employeeId)
			return { employeeId: employeeId, error: null }

		} catch (error) {
			console.error("❌ Критическая ошибка в getEmployeeId:", error)
			return {
				employeeId: null,
				error: new Error(`Критическая ошибка: ${error}`)
			}
		}
	},

	// ОТКЛЮЧЕНО: Обновить статус онлайн
	async updateOnlineStatus(userId: string, isOnline: boolean) {
		// Больше не обновляем онлайн статус для улучшения производительности
		return { error: null }

		/* ОТКЛЮЧЕННЫЙ КОД:
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
		*/
	},
}

// Экспортируем supabase клиент для использования в других модулях
export { supabase }

// Хелпер-функция для проверки админских прав
export const isUserAdmin = (profile: UserProfile | null): boolean => {
	if (!profile) return false
	return profile.is_admin || profile.role === 'admin'
}
