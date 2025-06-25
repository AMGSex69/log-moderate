"use client"

import React from "react"
import { useState, useEffect, createContext, useContext, useRef, useMemo, useCallback } from "react"
import type { User } from "@supabase/supabase-js"
import { authService, type UserProfile } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { appCache } from "@/lib/cache"
import { useProfileSync } from "@/lib/profile-sync"

interface AuthContextType {
	user: User | null
	profile: UserProfile | null
	loading: boolean
	error: string | null
	signIn: (email: string, password: string) => Promise<{ error: any }>
	signUp: (email: string, password: string, fullName: string, workSchedule?: string, districtId?: number) => Promise<{ error: any }>
	signOut: () => Promise<void>
	refreshProfile: () => Promise<void>
	updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
	const context = useContext(AuthContext)
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider")
	}
	return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null)
	const [profile, setProfile] = useState<UserProfile | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const initialized = useRef(false)
	const authStateListenerRef = useRef<any>(null)
	const profileLoadingRef = useRef(false)

	useEffect(() => {
		// Предотвращаем повторную инициализацию
		if (initialized.current) return
		initialized.current = true

		const initializeAuth = async () => {
			try {
				console.log("🔄 Initializing auth...")
				setError(null)

				// Проверяем кэш сначала для быстрого отображения
				const cachedUser = appCache.get("current_user")
				const cachedProfile = appCache.get("user_profile")

				if (cachedUser && cachedProfile) {
					console.log("💾 Using cached auth data")
					setUser(cachedUser)
					setProfile(cachedProfile)
					setLoading(false)
					console.log("✅ Loaded from cache, loading set to false")
					return
				}

				// Проверяем конфигурацию Supabase
				console.log("⚙️ Checking Supabase configuration...")
				const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
				const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

				if (!supabaseUrl || !supabaseKey) {
					console.error("❌ Missing Supabase configuration")
					setError("Supabase не настроен. Проверьте файл .env.local")
					setLoading(false)
					return
				}

				console.log("✅ Supabase config OK")

				// Получаем текущую сессию с коротким таймаутом
				console.log("🔍 Getting current session...")

				const sessionPromise = supabase.auth.getSession()
				const timeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Session request timeout after 10 seconds")), 10000)
				)

				try {
					const { data: { session }, error: sessionError } = await Promise.race([
						sessionPromise,
						timeoutPromise
					]) as any

					console.log("📋 Session result:", { session: !!session, error: sessionError })

					if (sessionError) {
						console.error("❌ Session error:", sessionError)
						setError(sessionError.message)
						setLoading(false)
						return
					}

					if (session?.user) {
						console.log("✅ User found:", session.user.id)
						setUser(session.user)

						// Загружаем профиль с retry логикой
						const loadProfileWithRetry = async (retries = 3) => {
							// Предотвращаем множественные одновременные загрузки
							if (profileLoadingRef.current) {
								console.log("🔄 Profile already loading, skipping...")
								return
							}

							profileLoadingRef.current = true
							try {
								for (let i = 0; i < retries; i++) {
									try {
										console.log(`👤 Loading user profile... (attempt ${i + 1}/${retries})`)
										const { profile, error } = await authService.getUserProfile(session.user.id)

										if (error) {
											console.warn(`⚠️ Profile load error (attempt ${i + 1}):`, error)
											if (i === retries - 1) {
												// На последней попытке создаем базовый профиль
												console.log("🔧 Creating fallback profile...")
												const fallbackProfile = {
													id: session.user.id,
													full_name: session.user.user_metadata?.full_name || session.user.email || "Пользователь",
													position: "Сотрудник",
													is_admin: false,
													role: 'user',
													work_schedule: "5/2",
													work_hours: 9,
													is_online: false,
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
												setProfile(fallbackProfile)
												appCache.set("user_profile", fallbackProfile, 5) // Короткий кэш для fallback
												break
											}
											continue
										}

										console.log("👤 Profile loaded:", !!profile)
										setProfile(profile)

										// Кэшируем данные
										appCache.set("current_user", session.user, 30)
										appCache.set("user_profile", profile, 30)
										console.log("💾 Auth data cached")
										break
									} catch (profileError) {
										console.error(`❌ Profile error (attempt ${i + 1}):`, profileError)
										if (i < retries - 1) {
											// Ждем перед следующей попыткой
											await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
										} else {
											console.log("⚠️ All profile load attempts failed, user authenticated without profile")
										}
									}
								}
							} finally {
								profileLoadingRef.current = false
							}
						}

						await loadProfileWithRetry()
					} else {
						console.log("👤 No user session found")
					}
				} catch (timeoutError) {
					console.warn("⚠️ Supabase timeout - activating development mode")

					const mockUser = {
						id: "dev-user-123",
						email: "dev@example.com",
						user_metadata: { full_name: "Разработчик" }
					} as any

					const mockProfile = {
						id: "dev-user-123",
						full_name: "Разработчик",
						position: "Developer",
						is_admin: true,
						work_schedule: "5/2",
						work_hours: 9,
						is_online: true,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString()
					}

					setUser(mockUser)
					setProfile(mockProfile)
					appCache.set("current_user", mockUser, 30)
					appCache.set("user_profile", mockProfile, 30)

					console.log("🛠️ Development mode activated - mock user created")
				}
			} catch (error: any) {
				console.error("❌ Auth initialization error:", error)
				if (error.message?.includes('timeout')) {
					setError("Проблемы с подключением. Активирован режим разработки.")
				} else if (error.message && !error.message.includes('timeout')) {
					setError(error.message || "Ошибка инициализации аутентификации")
				}
			} finally {
				console.log("🏁 Auth initialization complete - setting loading to false")
				setLoading(false)
				console.log("✅ Auth initialization complete, loading state:", false)
			}
		}

		// Создаем флаг для отслеживания монтирования компонента
		let isMounted = true

		// Инициализируем аутентификацию
		initializeAuth()

		// Устанавливаем слушатель только если он еще не установлен
		if (!authStateListenerRef.current) {
			console.log("👂 Setting up auth state listener")

			const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
				// Проверяем, что компонент все еще смонтирован
				if (!isMounted) return

				console.log("🔄 Auth state changed:", event, session?.user?.id)
				setError(null)

				if (event === 'SIGNED_OUT') {
					setUser(null)
					setProfile(null)
					appCache.clear()
					setLoading(false)
					return
				}

				if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
					setUser(session?.user ?? null)
					setLoading(false)

					if (session?.user) {
						// Используем Promise для асинхронной загрузки профиля с защитой от дублирования
						if (!profileLoadingRef.current) {
							profileLoadingRef.current = true
							authService.getUserProfile(session.user.id)
								.then(({ profile }) => {
									if (isMounted) {
										setProfile(profile)
										appCache.set("current_user", session.user, 30)
										appCache.set("user_profile", profile, 30)
									}
								})
								.catch(error => {
									console.error("❌ Profile fetch error:", error)
								})
								.finally(() => {
									profileLoadingRef.current = false
								})
						}
					}
					return
				}

				if (event === 'INITIAL_SESSION') {
					setUser(session?.user ?? null)
					setLoading(false)
					return
				}

				setUser(session?.user ?? null)
				if (!session?.user) {
					setProfile(null)
					appCache.clear()
				}
				setLoading(false)
			})

			authStateListenerRef.current = subscription
		}

		// Очистка при размонтировании
		return () => {
			isMounted = false
			if (authStateListenerRef.current) {
				authStateListenerRef.current.unsubscribe()
				authStateListenerRef.current = null
			}
		}
	}, [])

	const handleSignIn = async (email: string, password: string) => {
		setError(null)
		setLoading(true)
		try {
			const { error } = await authService.signIn(email, password)
			if (error) {
				setError(error.message)
			}
			return { error }
		} finally {
			setLoading(false)
		}
	}

	const handleSignUp = async (email: string, password: string, fullName: string, workSchedule?: string, districtId?: number) => {
		setError(null)
		setLoading(true)
		try {
			const { error } = await authService.signUp(email, password, fullName, workSchedule, districtId)
			if (error) {
				setError(error.message)
			}
			return { error }
		} finally {
			setLoading(false)
		}
	}

	const handleSignOut = async () => {
		setLoading(true)
		try {
			await authService.signOut()
			setUser(null)
			setProfile(null)
			setError(null)
			appCache.clear()
		} catch (error: any) {
			console.error("❌ Sign out error:", error)
		} finally {
			setLoading(false)
		}
	}

	const refreshProfile = useCallback(async () => {
		if (user) {
			try {
				console.log("🔄 [REFRESH] Refreshing profile from database...")

				// Сначала пробуем загрузить из user_profiles
				const { data: userProfileData, error: userProfileError } = await supabase
					.from("user_profiles")
					.select("*")
					.eq("id", user.id)
					.maybeSingle()

				console.log("📊 [REFRESH] user_profiles result:", { userProfileData, userProfileError })

				// Если user_profiles не найден, создаем базовый профиль
				let profileSource = userProfileData
				if (userProfileError || !userProfileData) {
					console.log("🔄 [REFRESH] No profile found, creating default...")
					// Создаем базовый профиль
					profileSource = {
						id: user.id,
						full_name: user.email || "Пользователь",
						position: "Сотрудник",
						is_admin: false,
						role: 'user',
						work_schedule: "5/2",
						work_hours: 9,
						is_online: false,
						office_name: "Рассвет",
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString()
					}
					console.log("✅ [REFRESH] Using default profile")
				} else {
					console.log("✅ [REFRESH] Using data from user_profiles")
				}

				if (profileSource) {
					// Преобразуем в формат UserProfile
					const refreshedProfile = {
						id: profileSource.id || user.id,
						full_name: profileSource.full_name || user.email || "Пользователь",
						position: profileSource.position || "Сотрудник",
						is_admin: profileSource.is_admin || false,
						role: profileSource.role || 'user',
						work_schedule: profileSource.work_schedule || "8+1",
						work_hours: profileSource.work_hours || 9,
						is_online: profileSource.is_online || false,
						last_seen: profileSource.last_seen,
						created_at: profileSource.created_at || new Date().toISOString(),
						updated_at: profileSource.updated_at || new Date().toISOString(),
						office_id: profileSource.office_id,
						office_name: profileSource.office_name || "Не указан",
						avatar_url: profileSource.avatar_url,
						office_stats: profileSource.office_stats
					}

					console.log("📋 [REFRESH] Refreshed profile:", refreshedProfile)
					setProfile(refreshedProfile)
					appCache.set("user_profile", refreshedProfile, 30)
					console.log("✅ [REFRESH] Profile updated in context and cache")
				} else {
					console.warn("⚠️ [REFRESH] No profile data found")
					// Используем fallback данные
					const { profile } = await authService.getUserProfile(user.id)
					setProfile(profile)
					appCache.set("user_profile", profile, 30)
				}
			} catch (error: any) {
				console.error("❌ Profile refresh error:", error)
				setError(error.message)
			}
		}
	}, [user])

	const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
		if (!user) return { error: new Error("No user logged in") }

		try {
			setError(null)
			const { error } = await authService.updateProfile(user.id, updates)
			if (!error) {
				await refreshProfile()
			}
			return { error }
		} catch (error: any) {
			setError(error.message)
			return { error }
		}
	}

	const contextValue = useMemo(() => ({
		user,
		profile,
		loading,
		error,
		signIn: handleSignIn,
		signUp: handleSignUp,
		signOut: handleSignOut,
		refreshProfile,
		updateProfile: handleUpdateProfile,
	}), [user, profile, loading, error])

	// Подписка на обновления профиля через систему синхронизации
	useProfileSync(user?.id || null, refreshProfile)

	return React.createElement(AuthContext.Provider, { value: contextValue }, children)
}
