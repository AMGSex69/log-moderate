"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DetailedProfileStats } from "@/components/detailed-profile-stats"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
import { useFreshUserData } from "@/hooks/use-fresh-user-data"
import { formatDuration } from "@/lib/utils"
import { GAME_CONFIG, calculateLevel } from "@/lib/game-config"
import PixelCard from "@/components/pixel-card"
import PixelButton from "@/components/pixel-button"
import LevelDisplay from "@/components/level-display"
import CoinDisplay from "@/components/coin-display"
import Navigation from "@/components/navigation"
import AuthGuard from "@/components/auth/auth-guard"
import PrizeWheel from "@/components/prize-wheel"
import AvatarUploadWithCrop from "@/components/avatar-upload-with-crop"
import DailyTaskStats from "@/components/daily-task-stats"
import { Trophy, Target, Clock, TrendingUp, ArrowLeft, Edit, Users, Building, Calendar, Activity } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface Achievement {
	id: string
	name: string
	description: string
	icon: string
	unlocked_at: string
}

interface UserStats {
	total_tasks: number
	total_time: number
	total_units: number
	total_coins: number
	current_streak: number
	achievements_count: number
	avg_time_per_task: number
	most_productive_day: string
}

interface TaskHistory {
	id: number
	task_name: string
	units_completed: number
	time_spent_minutes: number
	work_date: string
	notes?: string
}



interface OfficeStats {
	office_name: string
	total_employees: number
	working_employees: number
	total_hours_today: number
	avg_hours_today: number
}

interface Office {
	id: number
	name: string
	description: string
}

interface ProfileData {
	full_name: string
	last_name: string
	first_name: string
	middle_name: string
	position: string
	email: string
	office_name: string
	avatar_url?: string
}

export default function ProfilePage() {
	const { user, profile, refreshProfile } = useAuth()
	const { refresh: refreshUserData, ...freshUserData } = useFreshUserData()
	const router = useRouter()
	const { toast } = useToast()
	const [achievements, setAchievements] = useState<Achievement[]>([])
	const [stats, setStats] = useState<UserStats>({
		total_tasks: 0,
		total_time: 0,
		total_units: 0,
		total_coins: 0,
		current_streak: 0,
		achievements_count: 0,
		avg_time_per_task: 0,
		most_productive_day: "Нет данных",
	})
	const [taskHistory, setTaskHistory] = useState<TaskHistory[]>([])
	const [dailyStats, setDailyStats] = useState<Array<{
		date: string,
		units: number,
		tasks: number,
		time: number
	}>>([])
	const [officeStats, setOfficeStats] = useState<OfficeStats>({
		office_name: "Загрузка...",
		total_employees: 0,
		working_employees: 0,
		total_hours_today: 0,
		avg_hours_today: 0
	})
	const [profileData, setProfileData] = useState<ProfileData>({
		full_name: "",
		last_name: "",
		first_name: "",
		middle_name: "",
		position: "",
		email: "",
		office_name: "",
		avatar_url: ""
	})
	const [editingProfile, setEditingProfile] = useState(false)
	const [loading, setLoading] = useState(true)
	const [savingProfile, setSavingProfile] = useState(false)
	const [saveSuccess, setSaveSuccess] = useState(false)
	const [showWheel, setShowWheel] = useState(false)
	const [showLevelModal, setShowLevelModal] = useState(false)
	const [offices, setOffices] = useState<Office[]>([])

	useEffect(() => {
		if (user) {
			fetchAllProfileData()
		}
	}, [user])

	// Отдельный useEffect для обновления профиля
	useEffect(() => {
		if (profile) {
			fetchProfileInfo()
		}
	}, [profile])

	// useEffect для синхронизации freshUserData после обновления profileData
	useEffect(() => {
		if (profileData.avatar_url || profileData.full_name) {
			console.log("🔄 [SYNC] Синхронизируем freshUserData с profileData")
			refreshUserData()
		}
	}, [profileData.avatar_url, profileData.full_name, profileData.position, profileData.office_name])

	// Слушатель изменений офиса из админки
	useEffect(() => {
		if (!user) return

		const handleOfficeChange = async (event: Event) => {
			const customEvent = event as CustomEvent
			const { userId, oldOfficeId, newOfficeId } = customEvent.detail

			console.log("🏢 [ПРОФИЛЬ] Получено событие изменения офиса:", customEvent.detail)

			// Если изменён офис текущего пользователя, обновляем все данные
			if (userId === user.id) {
				console.log("✨ [ПРОФИЛЬ] Офис текущего пользователя изменён, перезагружаем данные...")

				// Обновляем данные пользователя
				await refreshUserData()

				// Обновляем статистику офиса
				await fetchOfficeStats()

				// Обновляем статистику по дням (графики)
				await fetchDailyStats()

				// Обновляем информацию профиля
				await fetchProfileInfo()

				// Показываем уведомление
				toast({
					title: "Офис обновлён",
					description: "Ваши данные и графики синхронизированы с новым офисом",
				})
			}
		}

		// Добавляем слушатель
		window.addEventListener('officeChanged', handleOfficeChange)

		// Очистка при размонтировании
		return () => {
			window.removeEventListener('officeChanged', handleOfficeChange)
		}
	}, [user])

	const fetchOffices = async () => {
		try {
			const { data, error } = await supabase
				.from("offices")
				.select("*")
				.order("name")

			if (error) throw error
			setOffices(data || [])
		} catch (error) {
			console.error("Ошибка загрузки офисов:", error)
		}
	}

	const fetchAllProfileData = async () => {
		if (!user) return

		try {
			await Promise.all([
				fetchUserStats(),
				fetchTaskHistory(),
				fetchDailyStats(),
				fetchOfficeStats(),
				fetchProfileInfo(),
				fetchOffices()
			])
		} catch (error) {
			console.error("Ошибка загрузки данных профиля:", error)
		} finally {
			setLoading(false)
		}
	}

	const forceSyncData = async () => {
		if (!user) return

		try {
			console.log("🔄 [ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ] Запускаем принудительную синхронизацию...")

			// Вызываем API для принудительной синхронизации
			const syncResponse = await fetch('/api/sync-user-data', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				}
			})

			if (syncResponse.ok) {
				const syncResult = await syncResponse.json()
				console.log("✅ [ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ] Результат:", syncResult)

				toast({
					title: "✅ Синхронизация выполнена",
					description: "Данные обновлены из админ-панели",
				})
			} else {
				console.warn("⚠️ [ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ] Ошибка API:", syncResponse.status)
			}

			// В любом случае обновляем данные
			await fetchProfileInfo()
			await fetchOfficeStats()
			refreshUserData()

		} catch (error) {
			console.error("❌ [ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ] Ошибка:", error)
			toast({
				title: "⚠️ Ошибка синхронизации",
				description: "Попробуйте обновить страницу",
				variant: "destructive",
			})
		}
	}

	const fetchUserStats = async () => {
		const { employeeId, error: empError } = await authService.getEmployeeId(user!.id)
		if (empError || !employeeId) return

		// Получаем текущий офис пользователя
		let currentOfficeId = profile?.office_id

		// Если офис не найден, получаем из employees
		if (!currentOfficeId) {
			const { data: empData } = await supabase
				.from("employees")
				.select("office_id")
				.eq("user_id", user!.id)
				.single()

			currentOfficeId = empData?.office_id
		}

		console.log("📊 [PROFILE-STATS] Загружаем статистику для офиса:", currentOfficeId)

		// Выполняем запрос в зависимости от наличия офиса
		let logsData, logsError

		if (!currentOfficeId) {
			console.warn("⚠️ [PROFILE-STATS] Офис не найден, загружаем все данные")
			const result = await supabase
				.from("task_logs")
				.select("time_spent_minutes, units_completed, work_date, task_types(name)")
				.eq("employee_id", employeeId)
				.order("work_date", { ascending: false })

			logsData = result.data
			logsError = result.error
		} else {
			const result = await supabase
				.from("task_logs")
				.select(`
					time_spent_minutes, 
					units_completed, 
					work_date, 
					task_types(name),
					employees!inner(office_id)
				`)
				.eq("employee_id", employeeId)
				.eq("employees.office_id", currentOfficeId) // Фильтр по текущему офису
				.order("work_date", { ascending: false })

			logsData = result.data
			logsError = result.error
		}

		if (logsError) throw logsError

		const totalTasks = logsData?.length || 0
		const totalTime = logsData?.reduce((sum, log) => sum + log.time_spent_minutes, 0) || 0
		const totalUnits = logsData?.reduce((sum, log) => sum + log.units_completed, 0) || 0

		// Рассчитываем монеты
		let totalCoins = 0
		logsData?.forEach((log: any) => {
			const taskName = log.task_types?.name
			const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
			totalCoins += log.units_completed * coinsPerUnit
		})

		// Находим самый продуктивный день
		const dayStats = new Map<string, number>()
		logsData?.forEach((log) => {
			const day = log.work_date
			dayStats.set(day, (dayStats.get(day) || 0) + log.units_completed)
		})

		const mostProductiveDay = Array.from(dayStats.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Нет данных"
		const currentStreak = calculateCurrentStreak(logsData || [])
		const unlockedAchievements = getUnlockedAchievements(totalCoins, totalTasks, currentStreak)

		setStats({
			total_tasks: totalTasks,
			total_time: totalTime,
			total_units: totalUnits,
			total_coins: totalCoins,
			current_streak: currentStreak,
			achievements_count: unlockedAchievements.length,
			avg_time_per_task: totalTasks > 0 ? Math.round(totalTime / totalTasks) : 0,
			most_productive_day:
				mostProductiveDay !== "Нет данных" ? new Date(mostProductiveDay).toLocaleDateString("ru-RU") : "Нет данных",
		})

		setAchievements(unlockedAchievements)
	}

	const fetchTaskHistory = async () => {
		const { employeeId, error: empError } = await authService.getEmployeeId(user!.id)
		if (empError || !employeeId) return

		// Получаем текущий офис пользователя
		let currentOfficeId = profile?.office_id

		// Если офис не найден, получаем из employees
		if (!currentOfficeId) {
			const { data: empData } = await supabase
				.from("employees")
				.select("office_id")
				.eq("user_id", user!.id)
				.single()

			currentOfficeId = empData?.office_id
		}

		console.log("📊 [PROFILE-HISTORY] Загружаем историю задач для офиса:", currentOfficeId)

		// Выполняем запрос в зависимости от наличия офиса
		let data, error

		if (!currentOfficeId) {
			console.warn("⚠️ [PROFILE-HISTORY] Офис не найден, загружаем все данные")
			const result = await supabase
				.from("task_logs")
				.select(`
					id,
					units_completed,
					time_spent_minutes,
					work_date,
					notes,
					task_types(name)
				`)
				.eq("employee_id", employeeId)
				.order("work_date", { ascending: false })
				.limit(20)

			data = result.data
			error = result.error
		} else {
			const result = await supabase
				.from("task_logs")
				.select(`
					id,
					units_completed,
					time_spent_minutes,
					work_date,
					notes,
					task_types(name),
					employees!inner(office_id)
				`)
				.eq("employee_id", employeeId)
				.eq("employees.office_id", currentOfficeId) // Фильтр по текущему офису
				.order("work_date", { ascending: false })
				.limit(20)

			data = result.data
			error = result.error
		}

		if (error) throw error

		const history = data?.map(log => ({
			id: log.id,
			task_name: (log.task_types as any)?.name || "Неизвестная задача",
			units_completed: log.units_completed,
			time_spent_minutes: log.time_spent_minutes,
			work_date: log.work_date,
			notes: log.notes
		})) || []

		setTaskHistory(history)
	}

	const fetchDailyStats = async () => {
		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user!.id)
			if (empError || !employeeId) return

			// Получаем данные за последние 7 дней
			const sevenDaysAgo = new Date()
			sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
			const startDate = sevenDaysAgo.toISOString().split('T')[0]

			// Получаем текущий офис пользователя из разных источников
			let currentOfficeId = profile?.office_id

			// Если офис все еще не найден, получаем из employees
			if (!currentOfficeId) {
				const { data: empData } = await supabase
					.from("employees")
					.select("office_id")
					.eq("user_id", user!.id)
					.single()

				currentOfficeId = empData?.office_id
			}

			console.log("📊 [PROFILE-DAILY] Загружаем статистику по дням для офиса:", currentOfficeId)

			// Выполняем запрос в зависимости от наличия офиса
			let data, error

			if (!currentOfficeId) {
				console.warn("⚠️ [PROFILE-DAILY] Офис не найден, загружаем все данные")
				const result = await supabase
					.from("task_logs")
					.select("work_date, units_completed, time_spent_minutes")
					.eq("employee_id", employeeId)
					.gte("work_date", startDate)
					.order("work_date", { ascending: true })

				data = result.data
				error = result.error
			} else {
				// Запрос с фильтрацией по офису через JOIN с employees
				const result = await supabase
					.from("task_logs")
					.select(`
					work_date, 
					units_completed, 
					time_spent_minutes,
					employees!inner(office_id)
				`)
					.eq("employee_id", employeeId)
					.eq("employees.office_id", currentOfficeId) // Фильтр по текущему офису
					.gte("work_date", startDate)
					.order("work_date", { ascending: true })

				data = result.data
				error = result.error
			}

			if (error) throw error

			// Группируем по дням
			const dailyStatsMap = new Map<string, { units: number, tasks: number, time: number }>()

			data?.forEach((log: any) => {
				const date = log.work_date
				const existing = dailyStatsMap.get(date) || { units: 0, tasks: 0, time: 0 }

				existing.units += log.units_completed
				existing.tasks += 1
				existing.time += log.time_spent_minutes

				dailyStatsMap.set(date, existing)
			})

			// Создаем массив за последние 7 дней (включая дни без работы)
			const statsArray = []
			for (let i = 6; i >= 0; i--) {
				const date = new Date()
				date.setDate(date.getDate() - i)
				const dateStr = date.toISOString().split('T')[0]
				const stats = dailyStatsMap.get(dateStr) || { units: 0, tasks: 0, time: 0 }

				statsArray.push({
					date: dateStr,
					...stats
				})
			}

			setDailyStats(statsArray)
		} catch (error) {
			console.error("Ошибка загрузки статистики по дням:", error)
			setDailyStats([])
		}
	}

	const fetchOfficeStats = async () => {
		try {
			const { data, error } = await supabase
				.rpc('get_office_statistics', {
					requesting_user_uuid: user!.id
				})

			if (error) throw error

			if (data && data.length > 0) {
				const stats = data[0]
				setOfficeStats({
					office_name: stats.office_name || "Неизвестный офис",
					total_employees: stats.total_employees || 0,
					working_employees: stats.working_employees || 0,
					total_hours_today: parseFloat(stats.total_hours_today) || 0,
					avg_hours_today: parseFloat(stats.avg_hours_today) || 0
				})
			}
		} catch (error) {
			console.error("Ошибка загрузки статистики офиса:", error)
		}
	}

	const loadFreshProfileDataForEditing = async () => {
		if (!user) return

		console.log("🔄 [EDIT-LOAD] Загружаем свежие данные для редактирования...")

		try {
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
				console.log("✅ [EDIT-LOAD] Employee data loaded:", employeeData)

				// Парсим полное имя на части
				const nameParts = (employeeData.full_name || "").split(' ')
				const lastName = nameParts[0] || ""
				const firstName = nameParts[1] || ""
				const middleName = nameParts[2] || ""

				const freshProfileData = {
					full_name: employeeData.full_name || "",
					last_name: lastName,
					first_name: firstName,
					middle_name: middleName,
					position: employeeData.position || "Сотрудник",
					email: user.email || "",
					office_name: employeeData.offices?.name || employeeData.office_name || "Не указан",
					avatar_url: employeeData.avatar_url || ""
				}

				console.log("📋 [EDIT-LOAD] Устанавливаем свежие данные в форму:", freshProfileData)
				setProfileData(freshProfileData)
				return
			}

			console.log("🔄 [EDIT-LOAD] Employee not found, trying user_profiles...")

			// Fallback на user_profiles
			const { data: profileData, error: profileError } = await supabase
				.from("user_profiles")
				.select("*")
				.eq("id", user.id)
				.maybeSingle()

			if (!profileError && profileData) {
				console.log("✅ [EDIT-LOAD] Profile data loaded:", profileData)

				const nameParts = (profileData.full_name || "").split(' ')
				const lastName = nameParts[0] || ""
				const firstName = nameParts[1] || ""
				const middleName = nameParts[2] || ""

				const freshProfileData = {
					full_name: profileData.full_name || "",
					last_name: lastName,
					first_name: firstName,
					middle_name: middleName,
					position: profileData.position || "Сотрудник",
					email: user.email || "",
					office_name: profileData.office_name || "Не указан",
					avatar_url: profileData.avatar_url || ""
				}

				console.log("📋 [EDIT-LOAD] Устанавливаем данные профиля в форму:", freshProfileData)
				setProfileData(freshProfileData)
			} else {
				console.warn("⚠️ [EDIT-LOAD] Не удалось загрузить данные")
			}
		} catch (error) {
			console.error("❌ [EDIT-LOAD] Ошибка загрузки данных для редактирования:", error)
		}
	}

	const fetchProfileInfo = async () => {
		if (!user) return

		console.log("🔄 [PROFILE] Загружаем свежие данные профиля из БД...")

		try {
			// ПРИОРИТЕТ: Сначала пробуем загрузить из employees (актуальные данные)
			const { data: employeeData, error: employeeError } = await supabase
				.from("employees")
				.select(`
					*,
					offices(name)
				`)
				.eq("user_id", user.id)
				.maybeSingle()

			console.log("📊 [PROFILE] employees result:", { employeeData, employeeError })

			let profileSource = null
			if (!employeeError && employeeData) {
				// Используем данные employees как приоритетные
				profileSource = {
					...employeeData,
					office_name: employeeData.offices?.name || employeeData.office_name || "Не указан"
				}
				console.log("✅ [PROFILE] Использем данные из employees (приоритет)")
			} else {
				console.log("🔄 [PROFILE] Employees не найден, пробуем user_profiles...")

				// Fallback на user_profiles
				const { data: userProfileData, error: userProfileError } = await supabase
					.from("user_profiles")
					.select("*")
					.eq("id", user.id)
					.maybeSingle()

				console.log("📊 [PROFILE] user_profiles result:", { userProfileData, userProfileError })

				if (!userProfileError && userProfileData) {
					profileSource = userProfileData
					console.log("✅ [PROFILE] Использем данные из user_profiles (fallback)")
				}
			}

			if (profileSource) {
				// Парсим полное имя на части
				const nameParts = (profileSource.full_name || "").split(' ')
				const lastName = nameParts[0] || ""
				const firstName = nameParts[1] || ""
				const middleName = nameParts[2] || ""

				const newProfileData = {
					full_name: profileSource.full_name || "",
					last_name: lastName,
					first_name: firstName,
					middle_name: middleName,
					position: profileSource.position || "Сотрудник",
					email: user.email || "",
					office_name: profileSource.office_name || "Не указан",
					avatar_url: profileSource.avatar_url || ""
				}

				console.log("📋 [PROFILE] Новые данные профиля:", newProfileData)
				setProfileData(newProfileData)
			} else {
				console.warn("⚠️ [PROFILE] Не удалось загрузить данные профиля")
				// Фоллбэк на старые данные из profile
				if (profile) {
					const nameParts = (profile.full_name || "").split(' ')
					const lastName = nameParts[0] || ""
					const firstName = nameParts[1] || ""
					const middleName = nameParts[2] || ""

					setProfileData({
						full_name: profile.full_name || "",
						last_name: lastName,
						first_name: firstName,
						middle_name: middleName,
						position: profile.position || "Сотрудник",
						email: user.email || "",
						office_name: profile.office_name || "Не указан",
						avatar_url: profile.avatar_url || ""
					})
				}
			}
		} catch (error) {
			console.error("❌ [PROFILE] Ошибка загрузки профиля:", error)
		}
	}

	const handleSaveProfile = async () => {
		console.log("🚀 [СОХРАНЕНИЕ] Начинаем сохранение профиля...")
		console.log("📋 [ДАННЫЕ] Текущие данные профиля:", profileData)
		console.log("👤 [ПОЛЬЗОВАТЕЛЬ] ID пользователя:", user?.id)

		setSavingProfile(true)
		setSaveSuccess(false)

		try {
			console.log("📤 [API] Отправляем запрос в authService.updateProfile...")

			// Базовые данные для обновления (офис исключается - изменяется только через админку)
			const updateData: any = {
				full_name: profileData.full_name?.trim() || undefined,
				position: profileData.position?.trim() || undefined,
			}

			// Добавляем avatar_url только если он есть
			if (profileData.avatar_url) {
				updateData.avatar_url = profileData.avatar_url
			}

			console.log("📤 [ДАННЫЕ] Отправляемые данные:", updateData)

			// Обновляем профиль
			const { data: updatedProfile, error } = await authService.updateProfile(user!.id, updateData)

			console.log("📨 [ОТВЕТ] Результат authService.updateProfile:", { updatedProfile, error })

			if (error) {
				console.error("❌ [ОШИБКА] Ошибка в authService.updateProfile:", error)

				// Показываем более детальную информацию об ошибке
				const errorMessage = (error as any)?.message || String(error)
				toast({
					title: "❌ Ошибка сохранения",
					description: `Не удалось сохранить профиль: ${errorMessage}`,
					variant: "destructive",
				})
				return
			}

			console.log("✅ [УСПЕХ] authService.updateProfile выполнен успешно")

			// Email не изменяется из профиля - только через админку

			console.log("🎉 [УСПЕХ] Показываем уведомление об успехе")
			setSaveSuccess(true)
			console.log("✅ [АНИМАЦИЯ] setSaveSuccess(true) - состояние успеха установлено")
			toast({
				title: "✅ Профиль обновлен",
				description: "Изменения сохранены успешно",
			})

			console.log("🔄 [ОБНОВЛЕНИЕ] Обновляем профиль в контексте...")
			// Обновляем профиль в контексте auth
			await refreshProfile()
			console.log("✅ [ОБНОВЛЕНИЕ] Профиль в контексте обновлен")

			console.log("🔄 [ОБНОВЛЕНИЕ] Обновляем свежие данные...")
			// Обновляем свежие данные пользователя
			refreshUserData()
			console.log("✅ [ОБНОВЛЕНИЕ] Свежие данные обновлены")

			console.log("🔄 [ОБНОВЛЕНИЕ] Перезагружаем локальные данные...")
			// ПРИНУДИТЕЛЬНО синхронизируем данные между таблицами
			try {
				console.log("🔄 [СИНХРОНИЗАЦИЯ] Принудительная синхронизация данных...")

				// Вызываем API для синхронизации
				const syncResponse = await fetch('/api/sync-user-data', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					}
				})

				if (syncResponse.ok) {
					const syncResult = await syncResponse.json()
					console.log("✅ [СИНХРОНИЗАЦИЯ] API результат:", syncResult)
				} else {
					console.warn("⚠️ [СИНХРОНИЗАЦИЯ] API ошибка:", syncResponse.status)

					// Fallback на прямой вызов RPC
					const { data: rpcResult, error: rpcError } = await supabase
						.rpc('sync_employee_to_userprofile', {
							target_user_id: user!.id
						})

					if (rpcError) {
						console.warn("⚠️ [СИНХРОНИЗАЦИЯ] RPC ошибка:", rpcError)
					} else {
						console.log("✅ [СИНХРОНИЗАЦИЯ] RPC результат:", rpcResult)
					}
				}
			} catch (syncErr) {
				console.warn("⚠️ [СИНХРОНИЗАЦИЯ] Критическая ошибка:", syncErr)
			}

			// Обновляем локальные данные профиля
			await fetchProfileInfo()
			console.log("✅ [ОБНОВЛЕНИЕ] Локальные данные обновлены")

			// Обновляем статистику офиса (офис может измениться через админку)
			console.log("🏢 [ОБНОВЛЕНИЕ] Обновляем статистику офиса...")
			await fetchOfficeStats()
			console.log("✅ [ОБНОВЛЕНИЕ] Статистика офиса обновлена")

			console.log("🔄 [ОБНОВЛЕНИЕ] Закрываем режим редактирования")
			// Увеличиваем задержку для лучшей видимости анимации
			setTimeout(() => {
				console.log("🔄 [АНИМАЦИЯ] Закрываем редактирование и сбрасываем success")
				setEditingProfile(false)
				setSaveSuccess(false) // Сбрасываем состояние успеха
			}, 2500)

		} catch (error) {
			console.error("❌ [КРИТИЧЕСКАЯ ОШИБКА] Ошибка в handleSaveProfile:", error)
			console.log("📋 [ОТЛАДКА] Стек ошибки:", error)

			toast({
				title: "❌ Ошибка",
				description: "Не удалось обновить профиль",
				variant: "destructive",
			})
		} finally {
			setSavingProfile(false)
		}

		console.log("🏁 [ЗАВЕРШЕНИЕ] handleSaveProfile завершен")
	}

	const calculateCurrentStreak = (logs: any[]) => {
		if (!logs.length) return 0

		const uniqueDays = [...new Set(logs.map((log) => log.work_date))].sort().reverse()
		let streak = 0

		for (let i = 0; i < uniqueDays.length; i++) {
			const day = uniqueDays[i]
			const expectedDate = new Date()
			expectedDate.setDate(expectedDate.getDate() - i)

			if (day === expectedDate.toISOString().split("T")[0]) {
				streak++
			} else {
				break
			}
		}

		return streak
	}

	// Функция расчета настоящего уровня игрока от 1 до 100


	const getUnlockedAchievements = (coins: number, tasks: number, streak: number) => {
		const unlocked = []

		if (tasks >= 1) {
			unlocked.push({
				id: "first_task",
				name: "Первые шаги",
				description: "Выполните первую задачу",
				icon: "🎯",
				unlocked_at: new Date().toISOString(),
			})
		}

		if (coins >= 1000) {
			unlocked.push({
				id: "thousand_club",
				name: "Клуб тысячи",
				description: "Заработайте 1000+ очков",
				icon: "💎",
				unlocked_at: new Date().toISOString(),
			})
		}

		if (streak >= 7) {
			unlocked.push({
				id: "week_streak",
				name: "Неделя подряд",
				description: "Работайте 7 дней подряд",
				icon: "🔥",
				unlocked_at: new Date().toISOString(),
			})
		}

		if (tasks >= 50) {
			unlocked.push({
				id: "fifty_tasks",
				name: "Полтинник",
				description: "Выполните 50 задач",
				icon: "🏆",
				unlocked_at: new Date().toISOString(),
			})
		}

		return unlocked
	}

	const currentLevel = calculateLevel(stats.total_coins)

	if (loading) {
		return (
			<AuthGuard>
				<main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4">
					<div className="container mx-auto py-6">
						<Navigation />
						<PixelCard className="mt-6">
							<div className="p-8 text-center">
								<div className="text-4xl mb-4">⏳</div>
								<div className="text-2xl font-bold">Загрузка профиля...</div>
							</div>
						</PixelCard>
					</div>
				</main>
			</AuthGuard>
		)
	}

	return (
		<AuthGuard>
			<main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4">
				<div className="container mx-auto py-6 space-y-6">
					<Navigation />

					{/* Компактная панель профиля */}
					<div className="relative">
						<div className="bg-gradient-to-br from-purple-300 to-pink-300 border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
							{/* Декоративные пиксели */}
							<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
							<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

							<div className="flex items-center justify-between">
								<div className="flex items-center gap-4">
									<Avatar className="h-16 w-16 border-3 border-yellow-400 shadow-lg">
										<AvatarImage src={freshUserData.avatar_url || profileData.avatar_url} />
										<AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white text-xl font-bold">
											{(freshUserData.full_name || profileData.full_name || 'Пользователь').split(' ').map(n => n[0]).join('').toUpperCase() || 'П'}
										</AvatarFallback>
									</Avatar>
									<div>
										<h1 className="font-mono font-black text-2xl text-black uppercase tracking-wide">
											{freshUserData.full_name || profileData.full_name || "ЗАГРУЗКА..."}
										</h1>
										<div className="bg-white border border-black px-2 py-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
											<span className="font-mono text-sm font-semibold text-black uppercase">{freshUserData.position || profileData.position || "Сотрудник"}</span>
										</div>
									</div>
								</div>

								{/* Название офиса в центре */}
								<div className="flex-1 flex justify-center">
									<div className="bg-gradient-to-r from-indigo-400 to-purple-500 border-2 border-white px-4 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
										<div className="flex items-center gap-2">
											<span className="text-xl">🏢</span>
											<div className="text-white">
												<div className="font-mono font-black text-xs uppercase">ОФИС</div>
												<div className="font-mono font-black text-lg">{freshUserData.office_name || profileData.office_name || "Рассвет"}</div>
											</div>
										</div>
									</div>
								</div>

								<div className="flex items-center gap-3">
									{/* Красивые анимированные монеты */}
									<div className="bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 border-2 border-yellow-800 px-4 py-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-lg">
										<div className="flex items-center gap-3">
											<CoinDisplay coins={stats.total_coins} animated={true} />
										</div>
									</div>

									{/* Красивый уровень с градиентом */}
									<div
										className={`px-4 py-3 border-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:scale-105 transition-all duration-200 rounded-lg ${calculateLevel(stats.total_coins).level >= 91
											? "bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 border-yellow-700"
											: calculateLevel(stats.total_coins).level >= 71
												? "bg-gradient-to-br from-purple-400 via-purple-500 to-pink-500 border-purple-700"
												: calculateLevel(stats.total_coins).level >= 51
													? "bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-500 border-blue-700"
													: calculateLevel(stats.total_coins).level >= 31
														? "bg-gradient-to-br from-green-400 via-green-500 to-emerald-500 border-green-700"
														: "bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 border-gray-700"
											}`}
										onClick={() => setShowLevelModal(true)}
									>
										<div className="flex items-center gap-3">
											<div className="relative">
												<span className="text-2xl drop-shadow-lg">
													{calculateLevel(stats.total_coins).icon}
												</span>
												{/* Анимированное свечение для высоких уровней */}
												{calculateLevel(stats.total_coins).level >= 71 && (
													<div className="absolute inset-0 animate-pulse">
														<span className="text-2xl opacity-50">
															{calculateLevel(stats.total_coins).icon}
														</span>
													</div>
												)}
											</div>
											<div className="text-white drop-shadow-lg">
												<div className="font-mono font-black text-xs uppercase tracking-wider">
													{calculateLevel(stats.total_coins).name}
												</div>
												<div className="font-mono font-black text-xl">
													LVL {calculateLevel(stats.total_coins).level}
												</div>
											</div>
										</div>
									</div>

									{/* Кнопка редактирования */}
									<PixelButton
										onClick={async () => {
											if (!editingProfile) {
												console.log("🔄 [EDIT] Открываем режим редактирования, загружаем свежие данные...")
												// При открытии режима редактирования загружаем свежие данные для формы
												await loadFreshProfileDataForEditing()
												// Также обновляем freshUserData для отображения
												await refreshUserData()
												console.log("✅ [EDIT] Свежие данные загружены")
											}
											setEditingProfile(!editingProfile)
										}}
										variant={editingProfile ? "danger" : "default"}
										className="px-3 py-2"
									>
										{editingProfile ? "❌" : "✏️"}
									</PixelButton>
								</div>
							</div>

							{/* Нижние декоративные пиксели */}
							<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
							<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
						</div>
						<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
					</div>

					{/* Форма редактирования профиля - пиксельный стиль */}
					{editingProfile && (
						<div className="relative">
							<div className="bg-gradient-to-br from-yellow-300 to-orange-300 border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 space-y-6">
								{/* Декоративные пиксели */}
								<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
								<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

								<div className="flex items-center gap-3 mb-6">
									<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
										<span className="text-xl">✏️</span>
									</div>
									<div>
										<h3 className="font-mono font-black text-2xl text-black uppercase tracking-wide">
											РЕДАКТИРОВАНИЕ ПРОФИЛЯ
										</h3>
										<p className="font-mono text-sm text-black font-semibold">
											Обновите свои данные
										</p>
									</div>
								</div>

								{/* Аватар */}
								<div>
									<AvatarUploadWithCrop
										currentUrl={profileData.avatar_url || ''}
										fullName={profileData.full_name}
										onAvatarChange={(newUrl: string) => setProfileData(prev => ({ ...prev, avatar_url: newUrl }))}
									/>
								</div>

								{/* ФИО - отдельные поля */}
								<div className="bg-white border-2 border-black p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-3">
									<Label className="font-mono font-black text-black uppercase mb-2 block">
										👤 ПЕРСОНАЛЬНЫЕ ДАННЫЕ
									</Label>

									<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
										<div>
											<Label htmlFor="lastname" className="font-mono text-xs text-black uppercase mb-1 block">
												Фамилия
											</Label>
											<Input
												id="lastname"
												value={profileData.last_name}
												onChange={(e) => {
													const newLastName = e.target.value
													setProfileData(prev => ({
														...prev,
														last_name: newLastName,
														full_name: `${newLastName} ${prev.first_name} ${prev.middle_name}`.trim()
													}))
												}}
												placeholder="Иванов"
												className="border-2 border-black font-mono text-sm p-2 w-full"
											/>
										</div>

										<div>
											<Label htmlFor="firstname" className="font-mono text-xs text-black uppercase mb-1 block">
												Имя
											</Label>
											<Input
												id="firstname"
												value={profileData.first_name}
												onChange={(e) => {
													const newFirstName = e.target.value
													setProfileData(prev => ({
														...prev,
														first_name: newFirstName,
														full_name: `${prev.last_name} ${newFirstName} ${prev.middle_name}`.trim()
													}))
												}}
												placeholder="Иван"
												className="border-2 border-black font-mono text-sm p-2 w-full"
											/>
										</div>

										<div>
											<Label htmlFor="middlename" className="font-mono text-xs text-black uppercase mb-1 block">
												Отчество
											</Label>
											<Input
												id="middlename"
												value={profileData.middle_name}
												onChange={(e) => {
													const newMiddleName = e.target.value
													setProfileData(prev => ({
														...prev,
														middle_name: newMiddleName,
														full_name: `${prev.last_name} ${prev.first_name} ${newMiddleName}`.trim()
													}))
												}}
												placeholder="Иванович"
												className="border-2 border-black font-mono text-sm p-2 w-full"
											/>
										</div>
									</div>
								</div>

								{/* Должность */}
								<div className="bg-white border-2 border-black p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
									<Label htmlFor="position" className="font-mono font-black text-black uppercase mb-2 block">
										💼 ДОЛЖНОСТЬ
									</Label>
									<Input
										id="position"
										value={profileData.position}
										onChange={(e) => setProfileData(prev => ({
											...prev,
											position: e.target.value
										}))}
										placeholder="Ваша должность"
										className="border-2 border-black font-mono text-sm p-2 w-full"
									/>
								</div>

								{/* Системная информация */}
								<div className="bg-gray-100 border-2 border-black p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-3">
									<Label className="font-mono font-black text-black uppercase mb-2 block">
										📋 СИСТЕМНАЯ ИНФОРМАЦИЯ
										{user?.email === 'egordolgih@mail.ru' && (
											<span className="text-red-600 ml-2 text-xs">👑 АДМИН</span>
										)}
									</Label>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										<div>
											<Label className="font-mono text-xs text-gray-600 uppercase mb-1 block">
												📧 Email
											</Label>
											{user?.email === 'egordolgih@mail.ru' ? (
												<Input
													value={profileData.email}
													onChange={(e) => setProfileData(prev => ({
														...prev,
														email: e.target.value
													}))}
													placeholder="Ваш email"
													className="border-2 border-black font-mono text-sm p-2 w-full"
												/>
											) : (
												<div className="bg-gray-200 border-2 border-gray-400 font-mono text-sm p-2 text-gray-700">
													{profileData.email || "Не указан"}
												</div>
											)}
										</div>

										<div>
											<Label className="font-mono text-xs text-gray-600 uppercase mb-1 block">
												🏢 Офис
											</Label>
											<div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 font-mono text-sm p-3 rounded-lg flex items-center gap-2">
												<span className="text-lg">
													{(() => {
														switch (profileData.office_name) {
															case 'Рассвет': return '🌅'
															case 'Будапешт': return '🏢'
															case 'Янтарь': return '💎'
															case 'Саяны': return '🏔️'
															case 'Бирюсинка': return '💧'
															case 'Витязь': return '⚔️'
															case 'Планета': return '🌍'
															case 'Зеленоград': return '🌲'
															case 'Тульская': return '🚇'
															case 'Чистые пруды': return '💎'
															default: return '🏢'
														}
													})()}
												</span>
												<div className="flex flex-col">
													<span className="font-bold text-blue-800">
														{profileData.office_name || "Не указан"}
													</span>
													<span className="text-xs text-blue-600">
														Офис назначается администратором
													</span>
												</div>
											</div>
										</div>
									</div>

									<p className="text-xs text-gray-500 font-mono mt-2">
										{user?.email === 'egordolgih@mail.ru'
											? "👑 Вы администратор - можете редактировать все поля"
											: "ℹ️ Данные поля изменяются только администратором системы"
										}
									</p>
								</div>

								{/* Кнопки сохранения */}
								<div className="flex gap-4 pt-4">
									<PixelButton
										onClick={handleSaveProfile}
										loading={savingProfile}
										success={saveSuccess}
										loadingText="💾 Сохранение..."
										successText="✅ Сохранено!"
										className="shadow-lg hover:shadow-xl transition-shadow"
									>
										💾 Сохранить изменения
									</PixelButton>
									<PixelButton
										variant="secondary"
										onClick={() => {
											setEditingProfile(false)
											fetchProfileInfo() // Сбрасываем изменения
										}}
										className="shadow-lg hover:shadow-xl transition-shadow"
									>
										🔄 Отменить
									</PixelButton>
								</div>

								{/* Нижние декоративные пиксели */}
								<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
								<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
							</div>
							<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
						</div>
					)}

					{/* Основная статистика */}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<PixelCard className="bg-gradient-to-r from-green-200 to-green-300">
							<div className="p-4 text-center">
								<Target className="h-8 w-8 mx-auto mb-2 text-green-700" />
								<div className="text-2xl font-bold text-green-800">{stats.total_tasks}</div>
								<div className="text-sm font-medium text-green-700">Задач выполнено</div>
							</div>
						</PixelCard>

						<PixelCard className="bg-gradient-to-r from-blue-200 to-blue-300">
							<div className="p-4 text-center">
								<Clock className="h-8 w-8 mx-auto mb-2 text-blue-700" />
								<div className="text-xl font-bold text-blue-800">{formatDuration(stats.total_time)}</div>
								<div className="text-sm font-medium text-blue-700">Общее время</div>
							</div>
						</PixelCard>

						<PixelCard className="bg-gradient-to-r from-orange-200 to-orange-300">
							<div className="p-4 text-center">
								<TrendingUp className="h-8 w-8 mx-auto mb-2 text-orange-700" />
								<div className="text-2xl font-bold text-orange-800">{stats.current_streak}</div>
								<div className="text-sm font-medium text-orange-700">Дней подряд</div>
							</div>
						</PixelCard>

						<PixelCard className="bg-gradient-to-r from-yellow-200 to-yellow-300">
							<div className="p-4 text-center">
								<Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-700" />
								<div className="text-2xl font-bold text-yellow-800">{stats.achievements_count}</div>
								<div className="text-sm font-medium text-yellow-700">Достижений</div>
							</div>
						</PixelCard>
					</div>

					{/* Главные вкладки */}
					<PixelCard>
						<div className="p-6">
							<Tabs defaultValue="tasks" className="w-full">
								<TabsList className="grid w-full grid-cols-4 border-2 border-black">
									<TabsTrigger value="tasks" className="border-2 border-black text-xs md:text-sm">
										📋 Мои задачи
									</TabsTrigger>
									<TabsTrigger value="office" className="border-2 border-black text-xs md:text-sm">
										🏢 Офис
									</TabsTrigger>
									<TabsTrigger value="achievements" className="border-2 border-black text-xs md:text-sm">
										🏆 Достижения
									</TabsTrigger>
									<TabsTrigger value="wheel" className="border-2 border-black text-xs md:text-sm">
										🎰 Крутилка
									</TabsTrigger>
								</TabsList>

								{/* Вкладка "Мои задачи" */}
								<TabsContent value="tasks" className="mt-6 space-y-6">
									<DailyTaskStats userId={user!.id} />
								</TabsContent>

								{/* Вкладка "Офис" */}
								<TabsContent value="office" className="mt-6 space-y-6">
									<PixelCard className="bg-gradient-to-r from-blue-100 to-indigo-100">
										<div className="p-6">
											<h3 className="text-xl font-bold mb-4 flex items-center gap-2">
												<Building className="h-5 w-5" />
												Статистика офиса "{officeStats.office_name}"
											</h3>

											<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
												<div className="text-center">
													<div className="text-2xl font-bold text-blue-600">{officeStats.total_employees}</div>
													<div className="text-sm text-muted-foreground">Всего сотрудников</div>
												</div>
												<div className="text-center">
													<div className="text-2xl font-bold text-green-600">{officeStats.working_employees}</div>
													<div className="text-sm text-muted-foreground">Работают сейчас</div>
												</div>
												<div className="text-center">
													<div className="text-xl font-bold text-orange-600">{officeStats.total_hours_today.toFixed(1)}ч</div>
													<div className="text-sm text-muted-foreground">Часов сегодня</div>
												</div>
												<div className="text-center">
													<div className="text-xl font-bold text-purple-600">{officeStats.avg_hours_today.toFixed(1)}ч</div>
													<div className="text-sm text-muted-foreground">Среднее на человека</div>
												</div>
											</div>
										</div>
									</PixelCard>

									<PixelCard>
										<div className="p-6">
											<h3 className="text-xl font-bold mb-4 flex items-center gap-2">
												<Users className="h-5 w-5" />
												Статистика по дням
											</h3>

											{dailyStats.length > 0 ? (
												<div className="space-y-6">
													{/* График единиц */}
													<div>
														<h4 className="font-semibold mb-2">📊 Единицы работы</h4>
														<div className="relative h-32 bg-gray-50 p-4 rounded border-2 border-black">
															<svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
																{/* Сетка */}
																<defs>
																	<pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
																		<path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
																	</pattern>
																</defs>
																<rect width="100" height="100" fill="url(#grid)" />

																{/* Линия графика */}
																<polyline
																	fill="none"
																	stroke="#3b82f6"
																	strokeWidth="2"
																	points={dailyStats.map((day, index) => {
																		const maxUnits = Math.max(...dailyStats.map(d => d.units), 1)
																		const x = (index / (dailyStats.length - 1)) * 100
																		const y = 100 - (day.units / maxUnits) * 80
																		return `${x},${y}`
																	}).join(' ')}
																/>

																{/* Точки */}
																{dailyStats.map((day, index) => {
																	const maxUnits = Math.max(...dailyStats.map(d => d.units), 1)
																	const x = (index / (dailyStats.length - 1)) * 100
																	const y = 100 - (day.units / maxUnits) * 80
																	return (
																		<circle
																			key={index}
																			cx={x}
																			cy={y}
																			r="2"
																			fill="#3b82f6"
																			className="hover:r-3 transition-all cursor-pointer"
																		>
																			<title>{`${day.units} единиц`}</title>
																		</circle>
																	)
																})}
															</svg>

															{/* Подписи дат */}
															<div className="flex justify-between mt-2">
																{dailyStats.map((day, index) => (
																	<div key={index} className="text-xs text-center">
																		<div>{new Date(day.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</div>
																		<div className="font-bold text-blue-600">{day.units}</div>
																	</div>
																))}
															</div>
														</div>
													</div>

													{/* График времени */}
													<div>
														<h4 className="font-semibold mb-2">⏱️ Время работы (мин)</h4>
														<div className="relative h-32 bg-gray-50 p-4 rounded border-2 border-black">
															<svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
																{/* Сетка */}
																<rect width="100" height="100" fill="url(#grid)" />

																{/* Линия графика */}
																<polyline
																	fill="none"
																	stroke="#10b981"
																	strokeWidth="2"
																	points={dailyStats.map((day, index) => {
																		const maxTime = Math.max(...dailyStats.map(d => d.time), 1)
																		const x = (index / (dailyStats.length - 1)) * 100
																		const y = 100 - (day.time / maxTime) * 80
																		return `${x},${y}`
																	}).join(' ')}
																/>

																{/* Точки */}
																{dailyStats.map((day, index) => {
																	const maxTime = Math.max(...dailyStats.map(d => d.time), 1)
																	const x = (index / (dailyStats.length - 1)) * 100
																	const y = 100 - (day.time / maxTime) * 80
																	return (
																		<circle
																			key={index}
																			cx={x}
																			cy={y}
																			r="2"
																			fill="#10b981"
																			className="hover:r-3 transition-all cursor-pointer"
																		>
																			<title>{`${day.time} минут`}</title>
																		</circle>
																	)
																})}
															</svg>

															{/* Подписи дат */}
															<div className="flex justify-between mt-2">
																{dailyStats.map((day, index) => (
																	<div key={index} className="text-xs text-center">
																		<div>{new Date(day.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</div>
																		<div className="font-bold text-green-600">{day.time}</div>
																	</div>
																))}
															</div>
														</div>
													</div>

													{/* График задач */}
													<div>
														<h4 className="font-semibold mb-2">📋 Количество задач</h4>
														<div className="relative h-32 bg-gray-50 p-4 rounded border-2 border-black">
															<svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
																{/* Сетка */}
																<rect width="100" height="100" fill="url(#grid)" />

																{/* Линия графика */}
																<polyline
																	fill="none"
																	stroke="#8b5cf6"
																	strokeWidth="2"
																	points={dailyStats.map((day, index) => {
																		const maxTasks = Math.max(...dailyStats.map(d => d.tasks), 1)
																		const x = (index / (dailyStats.length - 1)) * 100
																		const y = 100 - (day.tasks / maxTasks) * 80
																		return `${x},${y}`
																	}).join(' ')}
																/>

																{/* Точки */}
																{dailyStats.map((day, index) => {
																	const maxTasks = Math.max(...dailyStats.map(d => d.tasks), 1)
																	const x = (index / (dailyStats.length - 1)) * 100
																	const y = 100 - (day.tasks / maxTasks) * 80
																	return (
																		<circle
																			key={index}
																			cx={x}
																			cy={y}
																			r="2"
																			fill="#8b5cf6"
																			className="hover:r-3 transition-all cursor-pointer"
																		>
																			<title>{`${day.tasks} задач`}</title>
																		</circle>
																	)
																})}
															</svg>

															{/* Подписи дат */}
															<div className="flex justify-between mt-2">
																{dailyStats.map((day, index) => (
																	<div key={index} className="text-xs text-center">
																		<div>{new Date(day.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</div>
																		<div className="font-bold text-purple-600">{day.tasks}</div>
																	</div>
																))}
															</div>
														</div>
													</div>
												</div>
											) : (
												<div className="text-center py-8">
													<div className="text-4xl mb-2">📈</div>
													<div className="text-lg font-semibold">Нет данных</div>
													<div className="text-muted-foreground">Пока нет статистики по дням</div>
												</div>
											)}
										</div>
									</PixelCard>
								</TabsContent>

								{/* Вкладка "Достижения" */}
								<TabsContent value="achievements" className="mt-6">
									<div className="space-y-6">
										<h3 className="text-2xl font-bold flex items-center gap-2">
											<Trophy className="h-6 w-6" />
											Мои достижения ({achievements.length})
										</h3>

										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
											{achievements.map((achievement) => (
												<PixelCard
													key={achievement.id}
													className="bg-gradient-to-r from-yellow-200 to-yellow-300"
													glowing
												>
													<div className="p-4">
														<div className="flex items-center gap-3">
															<div className="text-3xl">{achievement.icon}</div>
															<div className="flex-1">
																<div className="font-bold text-lg">{achievement.name}</div>
																<div className="text-sm text-muted-foreground">{achievement.description}</div>
																<div className="text-xs text-muted-foreground mt-1">
																	Получено: {new Date(achievement.unlocked_at).toLocaleDateString("ru-RU")}
																</div>
															</div>
														</div>
													</div>
												</PixelCard>
											))}
										</div>

										{achievements.length === 0 && (
											<PixelCard>
												<div className="p-8 text-center">
													<div className="text-6xl mb-4">🎯</div>
													<div className="text-xl font-bold mb-2">Пока нет достижений</div>
													<div className="text-muted-foreground">Выполняйте задачи, чтобы их получить!</div>
												</div>
											</PixelCard>
										)}

										{/* Доступные достижения */}
										<div className="mt-8">
											<h4 className="text-xl font-bold mb-4">🎮 Доступные достижения</h4>
											<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
												{Object.entries(GAME_CONFIG.ACHIEVEMENTS).map(([achievementId, achievement]) => {
													const isUnlocked = achievements.some((a) => a.id === achievementId)
													return (
														<PixelCard
															key={achievementId}
															className={isUnlocked ? "opacity-50" : "bg-gradient-to-r from-gray-200 to-gray-300"}
														>
															<div className="p-4">
																<div className="flex items-center gap-3">
																	<div className="text-2xl">{achievement.badge}</div>
																	<div className="flex-1">
																		<div className="font-bold">{achievement.name}</div>
																		<div className="text-sm text-muted-foreground">{achievement.description}</div>
																		{achievement.points > 0 && (
																			<div className="text-xs text-yellow-600 font-bold">
																				Награда: +{achievement.points} очков
																			</div>
																		)}
																	</div>
																	{isUnlocked && <Badge className="bg-green-500 text-white">✓</Badge>}
																</div>
															</div>
														</PixelCard>
													)
												})}
											</div>
										</div>
									</div>
								</TabsContent>

								{/* Вкладка "Крутилка" */}
								<TabsContent value="wheel" className="mt-6">
									<PixelCard>
										<div className="p-6 text-center">
											<h3 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
												🎰 Колесо фортуны
											</h3>
											<p className="text-muted-foreground mb-6">
												Потратьте очки на вращение колеса и получите призы!
											</p>

											<div className="mb-6">
												<CoinDisplay coins={stats.total_coins} animated />
											</div>

											<PixelButton
												onClick={() => setShowWheel(true)}
												disabled={stats.total_coins < 100}
												className="text-lg px-8 py-4"
											>
												{stats.total_coins >= 100 ? "🎲 Крутить колесо (100 очков)" : "❌ Недостаточно очков"}
											</PixelButton>

											{stats.total_coins < 100 && (
												<p className="text-sm text-muted-foreground mt-4">
													Нужно минимум 100 очков для вращения
												</p>
											)}
										</div>
									</PixelCard>

									{showWheel && (
										<PrizeWheel
											currentCoins={stats.total_coins}
											onClose={() => setShowWheel(false)}
											onPrizeWon={(prize) => {
												console.log("Выигран приз:", prize)
											}}
											onCoinsSpent={(amount) => {
												setStats(prev => ({
													...prev,
													total_coins: prev.total_coins - amount
												}))
											}}
										/>
									)}
								</TabsContent>


							</Tabs>
						</div>
					</PixelCard>
				</div>

				{/* Модальное окно с уровнями */}
				{showLevelModal && (
					<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
						<div className="bg-gradient-to-br from-purple-200 to-pink-200 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-4xl w-full max-h-[80vh] overflow-hidden">
							{/* Заголовок модалки */}
							<div className="bg-black text-white p-4 border-b-4 border-white">
								<div className="flex items-center justify-between">
									<h2 className="font-mono font-black text-xl uppercase">🎯 СИСТЕМА УРОВНЕЙ</h2>
									<button
										onClick={() => setShowLevelModal(false)}
										className="bg-red-500 hover:bg-red-600 border-2 border-white text-white font-mono font-black px-3 py-1 transition-colors"
									>
										❌
									</button>
								</div>
							</div>

							{/* Содержимое */}
							<div className="p-6 overflow-y-auto max-h-[60vh]">
								{/* Текущий уровень пользователя */}
								<div className="mb-6 bg-yellow-300 border-2 border-black p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
									<div className="flex items-center gap-4">
										<span className="text-4xl">
											{calculateLevel(stats.total_coins).icon}
										</span>
										<div>
											<div className="font-mono font-black text-2xl text-black">
												ВАШИ ТЕКУЩИЙ УРОВЕНЬ: {calculateLevel(stats.total_coins).level} - {calculateLevel(stats.total_coins).name}
											</div>
											<div className="font-mono text-sm text-black">
												Задач: {stats.total_tasks} | Монеты: {stats.total_coins} | Серия: {stats.current_streak}
											</div>
										</div>
									</div>
								</div>

								{/* Таблица уровней */}
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
									{[
										{ range: "1-5", icon: "🌱", title: "НОВИЧОК", color: "bg-green-200", desc: "Изучаете основы работы" },
										{ range: "6-10", icon: "📚", title: "СТАЖЕР", color: "bg-blue-200", desc: "Осваиваете рабочие процессы" },
										{ range: "11-20", icon: "💼", title: "РАБОТНИК", color: "bg-gray-200", desc: "Стабильно выполняете задачи" },
										{ range: "21-30", icon: "🔧", title: "СПЕЦИАЛИСТ", color: "bg-yellow-200", desc: "Опытный сотрудник" },
										{ range: "31-40", icon: "🎯", title: "ЭКСПЕРТ", color: "bg-orange-200", desc: "Высокая квалификация" },
										{ range: "41-50", icon: "⚡", title: "МАСТЕР", color: "bg-red-200", desc: "Профессионал своего дела" },
										{ range: "51-60", icon: "🎨", title: "ВИРТУОЗ", color: "bg-purple-200", desc: "Творческий подход к работе" },
										{ range: "61-70", icon: "🧠", title: "ГЕНИЙ", color: "bg-indigo-200", desc: "Выдающиеся способности" },
										{ range: "71-80", icon: "🏆", title: "ЛЕГЕНДА", color: "bg-pink-200", desc: "Легендарные достижения" },
										{ range: "81-90", icon: "💎", title: "ТИТАН", color: "bg-cyan-200", desc: "Титанический уровень мастерства" },
										{ range: "91-100", icon: "👑", title: "БОГ", color: "bg-gradient-to-r from-yellow-300 to-yellow-400", desc: "Божественное совершенство" }
									].map((group, index) => (
										<div key={index} className={`${group.color} border-2 border-black p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
											<div className="flex items-center gap-3 mb-2">
												<span className="text-2xl">{group.icon}</span>
												<div>
													<div className="font-mono font-black text-lg text-black">{group.title}</div>
													<div className="font-mono text-sm text-black">Уровни {group.range}</div>
												</div>
											</div>
											<div className="font-mono text-xs text-black">
												{group.desc}
											</div>
										</div>
									))}
								</div>

								{/* Формула расчета */}
								<div className="mt-6 bg-white border-2 border-black p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
									<div className="font-mono font-black text-lg text-black mb-2">📊 ФОРМУЛА РАСЧЕТА УРОВНЯ:</div>
									<div className="font-mono text-sm text-black space-y-1">
										<div>• Опыт за задачи: количество задач × 10</div>
										<div>• Опыт за монеты: количество монет × 0.5</div>
										<div>• Бонус за серию: дни подряд × 50</div>
										<div>• Прогрессивная система: каждый уровень требует больше опыта</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</main>
		</AuthGuard>
	)
}
