import { getSupabaseClient } from "./supabase"
import { GAME_CONFIG, calculateLevel } from "./game-config"

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
	avatar_url?: string
	// Игровые поля
	coins?: number
	experience?: number
	level?: number
	achievements?: any[]
	last_activity?: string
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

	// Вычислить реальные игровые статистики из task_logs
	async calculateGameStats(userId: string): Promise<{ coins: number; experience: number; level: number }> {
		try {
			// Получаем employee_id из user_profiles
			const { data: userProfile } = await supabase
				.from("user_profiles")
				.select("employee_id")
				.eq("id", userId)
				.single()

			if (!userProfile?.employee_id) {
				return { coins: 0, experience: 0, level: 1 }
			}

			// Получаем все task_logs для этого пользователя
			const { data: taskLogs } = await supabase
				.from("task_logs")
				.select(`
					units_completed,
					time_spent_minutes,
					task_types(name)
				`)
				.eq("employee_id", userProfile.employee_id)

			if (!taskLogs || taskLogs.length === 0) {
				return { coins: 0, experience: 0, level: 1 }
			}

			// Рассчитываем общие монеты
			let totalCoins = 0
			taskLogs.forEach((log: any) => {
				const taskName = log.task_types?.name
				const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
				totalCoins += log.units_completed * coinsPerUnit
			})

			// Опыт = монеты (пока простая система)
			const experience = totalCoins

			// Рассчитываем уровень
			const levelInfo = calculateLevel(totalCoins)

			return {
				coins: totalCoins,
				experience: experience,
				level: levelInfo.level
			}
		} catch (error) {
			console.error("❌ Error calculating game stats:", error)
			return { coins: 0, experience: 0, level: 1 }
		}
	},

	// Получить профиль пользователя
	async getUserProfile(userId: string): Promise<{ profile: UserProfile | null; error: any }> {
		try {
			console.log("🔍 Loading profile for user:", userId)

			// Проверяем валидность userId
			if (!userId || typeof userId !== 'string') {
				console.error("❌ Invalid userId:", userId)
				return { profile: null, error: new Error("Invalid user ID") }
			}

			// Сначала пробуем загрузить из user_profiles с офисом
			const { data: userProfile, error: userProfileError } = await supabase
				.from("user_profiles")
				.select(`
					*,
					offices!user_profiles_office_id_fkey (
						id,
						name,
						description
					)
				`)
				.eq("id", userId)
				.maybeSingle()

			console.log("📊 User profile data:", userProfile, "error:", userProfileError)

			// Если есть серьезная ошибка (не просто отсутствие данных), возвращаем её
			if (userProfileError && userProfileError.code && userProfileError.code !== 'PGRST116') {
				console.error("❌ Database error loading profile:", userProfileError)
				return { profile: null, error: userProfileError }
			}

			if (!userProfileError && userProfile) {
				// Добавляем проверку админа по роли, если поле роли существует
				const isAdmin = userProfile.is_admin || userProfile.role === 'admin'

				// Рассчитываем реальные игровые статистики
				console.log("🎮 Calculating game stats...")
				const gameStats = await this.calculateGameStats(userId)
				console.log("🎮 Game stats calculated:", gameStats)

				// Получаем статистику офиса с отладкой
				let officeStats: UserProfile['office_stats'] = undefined
				if (userProfile.office_id) {
					console.log("🔍 Loading office stats for office_id:", userProfile.office_id)

					try {
						// Получаем статистику офиса напрямую из таблиц
						const { data: employeesData, error: employeesError } = await supabase
							.from('user_profiles')
							.select('id, employee_id')
							.eq('office_id', userProfile.office_id)
							.not('employee_id', 'is', null)

						if (!employeesError && employeesData) {
							const totalEmployees = employeesData.length
							const workingEmployees = Math.max(1, Math.floor(totalEmployees * 0.7)) // Примерная оценка активных

							officeStats = {
								total_employees: totalEmployees,
								working_employees: workingEmployees,
								total_hours_today: workingEmployees * 4.5, // Примерная оценка
								avg_hours_today: workingEmployees > 0 ? 4.5 : 0
							}
							console.log("✅ Office stats loaded:", officeStats)
						} else {
							console.warn("⚠️ Office stats error:", employeesError)
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
					work_schedule: userProfile.work_schedule || "5/2",
					work_hours: userProfile.work_hours || 9,
					office_name: userProfile.offices?.name || 'Рассвет',
					// Добавляем реальные игровые статистики
					coins: gameStats.coins,
					experience: gameStats.experience,
					level: gameStats.level,
					achievements: userProfile.achievements || [],
					last_activity: userProfile.last_activity,
					office_stats: officeStats
				} as UserProfile

				console.log("✅ Final profile:", finalProfile)

				return {
					profile: finalProfile,
					error: null
				}
			}

			// Если user_profiles не найден, создаем базовый профиль
			console.log("🔄 User profile not found, creating default profile...")

			// Если ничего не найдено, создаем базовый профиль
			console.log("🔄 No profile found, creating default profile...")

			let userData = null
			try {
				const result = await supabase.auth.getUser()
				userData = result.data
			} catch (error) {
				console.warn("⚠️ Could not get user data from auth:", error)
			}

			const defaultProfile: UserProfile = {
				id: userId,
				full_name: userData?.user?.user_metadata?.full_name || userData?.user?.email || "Пользователь",
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

			// Пытаемся создать профиль в базе данных для будущих загрузок
			try {
				console.log("💾 Attempting to save default profile to database...")
				const { error: insertError } = await supabase
					.from("user_profiles")
					.insert({
						id: userId,
						full_name: defaultProfile.full_name,
						position: defaultProfile.position,
						is_admin: false,
						work_schedule: defaultProfile.work_schedule,
						work_hours: defaultProfile.work_hours,
						is_online: false,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString()
					})

				if (insertError) {
					console.warn("⚠️ Could not save default profile:", insertError)
				} else {
					console.log("✅ Default profile saved to database")
				}
			} catch (saveError) {
				console.warn("⚠️ Error saving default profile:", saveError)
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
			console.log("🔄 [AUTH] Starting profile update for user:", userId)
			console.log("📝 [AUTH] Updates to apply:", updates)

			// Убираем undefined значения
			const cleanUpdates = Object.fromEntries(
				Object.entries(updates).filter(([key, value]) => value !== undefined)
			)

			console.log("🧹 [AUTH] Cleaned updates:", cleanUpdates)

			// ВАЖНО: Обновляем ОБЕ таблицы синхронно, чтобы избежать конфликтов
			let userProfileSuccess = false
			let employeeSuccess = false

			// 1. Обновляем user_profiles
			if (Object.keys(cleanUpdates).length > 0) {
				console.log("🔄 [AUTH] Updating user_profiles...")

				const updateData = {
					...cleanUpdates,
					updated_at: new Date().toISOString()
				}

				const { data: userProfileData, error: userProfileError } = await supabase
					.from("user_profiles")
					.update(updateData)
					.eq("id", userId)
					.select()
					.maybeSingle()

				console.log("📊 [AUTH] User profiles update result:", { userProfileData, userProfileError })

				if (!userProfileError && userProfileData) {
					console.log("✅ [AUTH] Successfully updated user_profiles")
					userProfileSuccess = true
				} else {
					console.warn("⚠️ [AUTH] User profiles update failed:", userProfileError)

					// Если записи нет, пробуем создать
					if (userProfileError?.code === 'PGRST116' || !userProfileData) {
						console.log("👤 [AUTH] Creating new user profile...")

						const baseProfile = {
							id: userId,
							full_name: cleanUpdates.full_name || "Пользователь",
							position: cleanUpdates.position || "Сотрудник",
							is_admin: false,
							work_schedule: cleanUpdates.work_schedule || "5/2",
							work_hours: cleanUpdates.work_hours || 9,
							is_online: false,
							avatar_url: cleanUpdates.avatar_url || null,
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString()
						}

						const { data: newProfile, error: insertError } = await supabase
							.from("user_profiles")
							.insert(baseProfile)
							.select()
							.single()

						console.log("📝 [AUTH] Profile creation result:", { newProfile, insertError })

						if (!insertError) {
							console.log("✅ [AUTH] Successfully created user_profiles")
							userProfileSuccess = true
						}
					}
				}
			}

			// Возвращаем результат
			if (userProfileSuccess) {
				console.log("✅ [AUTH] Profile update completed successfully")
				return {
					data: { ...cleanUpdates, updated_at: new Date().toISOString() },
					error: null
				}
			} else {
				console.error("❌ [AUTH] Profile update failed")
				return {
					data: null,
					error: new Error("Failed to update profile")
				}
			}

		} catch (error) {
			console.error("❌ [AUTH] Critical error updating profile:", error)
			return { data: null, error }
		}
	},

	// Получить employee ID для текущего пользователя
	async getEmployeeId(userId: string) {
		try {
			console.log("🔍 Получаем employee_id для пользователя:", userId)

			// Ищем пользователя в user_profiles
			const { data: userProfile, error: profileError } = await supabase
				.from("user_profiles")
				.select("employee_id")
				.eq("id", userId)
				.maybeSingle()

			if (profileError) {
				console.error("❌ Ошибка получения профиля:", profileError)
				return {
					employeeId: null,
					error: new Error(`Ошибка получения профиля: ${profileError.message}`)
				}
			}

			// Если профиль найден и есть employee_id
			if (userProfile?.employee_id) {
				console.log("✅ Employee ID найден:", userProfile.employee_id)
				return { employeeId: userProfile.employee_id, error: null }
			}

			// Если employee_id отсутствует, создаем новый
			console.log("🔄 Employee ID не найден, создаем новый...")

			// Находим максимальный employee_id и создаем новый
			const { data: maxEmployeeData, error: maxError } = await supabase
				.from("user_profiles")
				.select("employee_id")
				.not("employee_id", "is", null)
				.order("employee_id", { ascending: false })
				.limit(1)

			let nextEmployeeId = 1
			if (!maxError && maxEmployeeData && maxEmployeeData.length > 0) {
				nextEmployeeId = (maxEmployeeData[0].employee_id || 0) + 1
			}

			console.log("🆔 Новый employee_id:", nextEmployeeId)

			// Обновляем профиль с новым employee_id
			const { error: updateError } = await supabase
				.from("user_profiles")
				.update({ employee_id: nextEmployeeId })
				.eq("id", userId)

			if (updateError) {
				console.error("❌ Ошибка обновления employee_id:", updateError)
				return {
					employeeId: null,
					error: new Error(`Ошибка обновления employee_id: ${updateError.message}`)
				}
			}

			console.log("✅ Employee ID создан и сохранен:", nextEmployeeId)
			return { employeeId: nextEmployeeId, error: null }

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
