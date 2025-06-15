"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { supabase, type TaskType } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
import { useActiveSessions } from "@/hooks/use-active-sessions"
import { useWorkSession } from "@/hooks/use-work-session"
import { useMultiTimer } from "@/hooks/use-multi-timer"
import TaskGroup from "@/components/task-group"
import ActiveTasksPanel from "@/components/active-tasks-panel"
import CompletionDialog from "@/components/completion-dialog"
import StatsPanel from "@/components/stats-panel"
import PixelCard from "@/components/pixel-card"
import PixelButton from "@/components/pixel-button"
import CoinDisplay from "@/components/coin-display"
import PostFactumDialog from "@/components/post-factum-dialog"
import LevelDisplay from "@/components/level-display"
import AchievementPopup from "@/components/achievement-popup"
import Navigation from "@/components/navigation"
import AuthGuard from "@/components/auth/auth-guard"
import WorkSessionEnhanced from "@/components/work-session-enhanced"
import BreakControls from "@/components/break-controls"
import ScheduleSelector from "@/components/schedule-selector"
import OfficeSelector from "@/components/office-selector"
import { Clock, Trophy, LogOut, Square } from "lucide-react"
import { GAME_CONFIG } from "@/lib/game-config"
import { calculateLevel, getNextLevel } from "@/lib/level-utils"
import { appCache } from "@/lib/cache"
import { RewardSystem } from "@/lib/reward-system"
import PrizeWheel, { type Prize } from "@/components/prize-wheel"
import UserProfileModal from "@/components/user-profile-modal"
import { useUserProfileModal } from "@/hooks/use-user-profile-modal"
import { useFreshUserData } from "@/hooks/use-fresh-user-data"

export default function Home() {
	const router = useRouter()
	const { user, profile, signOut, loading: authLoading } = useAuth()
	const { refresh: refreshUserData, ...freshUserData } = useFreshUserData()

	// Все хуки должны быть вызваны безусловно
	const { startSession, endSession } = useActiveSessions()
	const { isWorking, updateSessionCache, forceUpdateWorkingStatus } = useWorkSession()

	const {
		activeTasks,
		timers,
		startTask,
		stopTask,
		updateUnits,
		getFormattedTime,
		getMinutes,
		pauseAllTasks,
		resumeAllTasks,
	} = useMultiTimer()

	const { toast } = useToast()

	const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
	const [completingTask, setCompletingTask] = useState<any>(null)
	const [showCompletionDialog, setShowCompletionDialog] = useState(false)
	const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString())
	const [playerCoins, setPlayerCoins] = useState(0)
	const [newAchievement, setNewAchievement] = useState<any>(null)
	const [isOnBreak, setIsOnBreak] = useState(false)
	const [needsScheduleSetup, setNeedsScheduleSetup] = useState(false)
	const [needsDistrictSetup, setNeedsDistrictSetup] = useState(false)
	const [pageLoading, setPageLoading] = useState(true)
	const [localIsWorking, setLocalIsWorking] = useState(false)
	const [localIsPaused, setLocalIsPaused] = useState(false)
	const [showPrizeWheel, setShowPrizeWheel] = useState(false)
	const [wonPrize, setWonPrize] = useState<Prize | null>(null)
	const [leaderboard, setLeaderboard] = useState<Array<{
		name: string,
		score: string,
		rank: number,
		isCurrentUser: boolean,
		userId?: string,
		position?: string,
		isOnline?: boolean,
		totalTasks?: number,
		totalUnits?: number,
		totalTime?: number,
		workDays?: number,
		todayUnits?: number
	}>>([])
	const [mzhiDecisionsToday, setMzhiDecisionsToday] = useState(0)
	const [currentOfficeName, setCurrentOfficeName] = useState("РАССВЕТ")

	const [showPostFactumDialog, setShowPostFactumDialog] = useState(false)
	const { userId: selectedUserId, isOpen: profileModalOpen, showFullStats, openProfile, closeProfile } = useUserProfileModal()

	const initializingRef = useRef(false)
	const timeUpdateRef = useRef<NodeJS.Timeout | null>(null)
	const achievementTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const dataInitTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	// Оптимизированное обновление времени с учетом видимости вкладки
	useEffect(() => {
		const updateTime = () => {
			setCurrentTime(new Date().toLocaleTimeString())
		}

		const handleVisibilityChange = () => {
			if (document.hidden) {
				if (timeUpdateRef.current) {
					clearInterval(timeUpdateRef.current)
				}
			} else {
				updateTime()
				timeUpdateRef.current = setInterval(updateTime, 1000) // ИСПРАВЛЕНО: Каждую секунду
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)
		handleVisibilityChange()

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			if (timeUpdateRef.current) {
				clearInterval(timeUpdateRef.current)
			}
		}
	}, [])

	// Инициализация данных только после загрузки auth - ОПТИМИЗИРОВАНО
	useEffect(() => {
		if (!authLoading && user && profile && !initializingRef.current) {
			console.log("🚀 Starting data initialization...")
			initializingRef.current = true
			initializeData()
		} else if (!authLoading && !user) {
			// Если нет пользователя, сразу убираем загрузку
			setPageLoading(false)
		}
	}, [authLoading, !!user, !!profile]) // Используем !! для boolean значений



	useEffect(() => {
		setLocalIsWorking(isWorking)
	}, [isWorking])

	// Очистка таймеров при размонтировании
	useEffect(() => {
		return () => {
			if (achievementTimeoutRef.current) {
				clearTimeout(achievementTimeoutRef.current)
			}
			if (dataInitTimeoutRef.current) {
				clearTimeout(dataInitTimeoutRef.current)
			}
		}
	}, [])

	const initializeData = useCallback(async () => {
		setPageLoading(true)

		// Устанавливаем таймаут для принудительного завершения загрузки данных
		dataInitTimeoutRef.current = setTimeout(() => {
			console.log("⏰ Data initialization timeout")
			setPageLoading(false)
		}, 8000) // 8 секунд максимум

		try {
			console.log("📊 Loading cached data...")
			// Проверяем кэш для быстрой загрузки
			const cachedTaskTypes = appCache.get("task_types")
			const cachedCoins = appCache.get(`player_coins_${user?.id}`)

			if (cachedTaskTypes) {
				setTaskTypes(cachedTaskTypes)
				console.log("💾 Task types loaded from cache")
			}
			if (cachedCoins !== null) {
				setPlayerCoins(cachedCoins)
				console.log("💾 Coins loaded from cache")
			}

			// Загружаем данные параллельно с таймаутами
			const promises = []

			if (!cachedTaskTypes) {
				promises.push(
					fetchTaskTypes().catch((error) => {
						console.error("❌ Task types error:", error)
						return [] // Fallback to empty array
					}),
				)
			}

			if (cachedCoins === null) {
				promises.push(
					fetchPlayerCoins().catch((error) => {
						console.error("❌ Player coins error:", error)
						return 0 // Fallback to 0
					}),
				)
			}

			promises.push(
				checkScheduleSetup()
			)

			promises.push(
				checkDistrictSetup()
			)

			promises.push(
				fetchLeaderboard().catch((error) => {
					console.error("❌ Leaderboard error:", error)
					return [] // Fallback to empty array
				})
			)

			console.log("⏳ Waiting for data promises...")
			await Promise.allSettled(promises)
			console.log("✅ Data initialization complete")
		} catch (error) {
			console.error("❌ Data initialization error:", error)
		} finally {
			setPageLoading(false)
			if (dataInitTimeoutRef.current) {
				clearTimeout(dataInitTimeoutRef.current)
			}
		}
	}, [user?.id]) // Только зависимость от ID пользователя

	const fetchTaskTypes = useCallback(async () => {
		try {
			console.log("📋 Fetching task types...")
			const { data, error } = await supabase.from("task_types").select("*").order("name")

			if (error) throw error

			setTaskTypes(data || [])
			appCache.set("task_types", data || [], 60) // Кэш на час
			console.log("✅ Task types loaded:", data?.length || 0)
		} catch (error) {
			console.error("❌ Error loading task types:", error)
			throw error
		}
	}, [])

	const fetchPlayerCoins = useCallback(async () => {
		if (!user) return

		try {
			console.log("🪙 Fetching player coins...")
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) {
				console.log("⚠️ No employee ID found")
				return
			}

			const { data: logs, error: logsError } = await supabase
				.from("task_logs")
				.select("units_completed, task_types!inner(name)")
				.eq("employee_id", employeeId)

			if (logsError) {
				console.error("❌ Logs error:", logsError)
				return
			}

			let totalCoins = 0
			logs?.forEach((log: any) => {
				const taskName = log.task_types.name
				const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
				totalCoins += log.units_completed * coinsPerUnit
			})

			setPlayerCoins(totalCoins)
			appCache.set(`player_coins_${user.id}`, totalCoins, 10) // Кэш на 10 минут
			console.log("✅ Player coins loaded:", totalCoins)
		} catch (error) {
			console.error("❌ Error loading coins:", error)
			throw error
		}
	}, [user?.id])

	const checkScheduleSetup = useCallback(() => {
		console.log("📅 Checking schedule setup...")
		if (profile && !profile.work_schedule) {
			console.log("⚠️ Schedule setup needed")
			setNeedsScheduleSetup(true)
			return true
		}
		console.log("✅ Schedule check complete")
		return false
	}, [profile?.work_schedule])

	const checkDistrictSetup = useCallback(async () => {
		console.log("🏢 Checking office setup...")
		if (!user) return false

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) {
				console.log("⚠️ No employee ID found")
				return false
			}

			const { data: employee, error: employeeError } = await supabase
				.from("employees")
				.select("office_id")
				.eq("id", employeeId)
				.single()

			if (employeeError) {
				console.error("❌ Error checking office:", employeeError)
				return false
			}

			if (!employee?.office_id) {
				console.log("⚠️ Office setup needed")
				setNeedsDistrictSetup(true)
				return true
			}

			console.log("✅ Office check complete")
			return false
		} catch (error) {
			console.error("❌ Error in office check:", error)
			return false
		}
	}, [user?.id])

	// Функция для правильного склонения слова "день"
	const getDaysText = (count: number): string => {
		if (count % 10 === 1 && count % 100 !== 11) {
			return `${count} день`
		} else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
			return `${count} дня`
		} else {
			return `${count} дней`
		}
	}

	const fetchLeaderboard = useCallback(async () => {
		try {
			console.log("📋 Fetching leaderboard...")
			const todayStr = new Date().toISOString().split('T')[0]

			// Получаем офис текущего пользователя
			let userOfficeId = 1 // По умолчанию офис "Рассвет"

			if (user) {
				console.log("🔍 Поиск офиса пользователя:", { userId: user.id, email: user.email })

				// Получаем СВЕЖИЕ данные офиса пользователя из employees (админка)
				const { data: employeeData, error: employeeError } = await supabase
					.from("employees")
					.select("office_id, full_name, user_id")
					.eq("user_id", user.id)
					.maybeSingle()

				console.log("🔄 Загружаем данные из employees (админка):", employeeData, employeeError)

				if (employeeData?.office_id) {
					userOfficeId = employeeData.office_id
					console.log("🏢 User office from employees:", employeeData)
					console.log("🏢 НАЙДЕН ОФИС:", userOfficeId)
				} else {
					console.log("⚠️ Сотрудник не найден в employees, используем офис по умолчанию:", userOfficeId)
					console.log("⚠️ Пытаемся найти в user_profiles:")

					// Fallback: попробуем найти в user_profiles
					const { data: profileData } = await supabase
						.from("user_profiles")
						.select("office_id, office_name")
						.eq("id", user.id)
						.maybeSingle()

					console.log("📋 Данные из user_profiles:", profileData)
				}
			}

			console.log("🏢 Loading leaderboard for office_id:", userOfficeId)

			// Получаем название офиса из таблицы offices
			console.log("🔍 Ищем название офиса для office_id:", userOfficeId)
			const { data: officeInfo } = await supabase
				.from("offices")
				.select("id, name")
				.eq("id", userOfficeId)
				.maybeSingle()

			console.log("🏢 Результат поиска офиса:", officeInfo)

			if (officeInfo?.name) {
				console.log("🏢 УСТАНАВЛИВАЕМ НАЗВАНИЕ ОФИСА:", officeInfo.name)
				setCurrentOfficeName(officeInfo.name.toUpperCase())
				console.log("🏢 Office name from offices table:", officeInfo.name)
			} else {
				console.log("❌ Офис не найден, используем по умолчанию")
			}

			// Получаем всех сотрудников из офиса (из админки)
			const { data: allEmployees } = await supabase
				.from("employees")
				.select(`
					id,
					user_id,
					full_name,
					position,
					office_id,
					avatar_url,
					is_active
				`)
				.eq("office_id", userOfficeId)
				.eq("is_active", true)

			if (!allEmployees) {
				console.error("❌ No employees found")
				setLeaderboard([])
				return
			}

			// Получаем статистику за СЕГОДНЯ для верхней панели (топ активных)
			const { data: todayStats } = await supabase
				.from("task_logs")
				.select(`
					employee_id,
					units_completed,
					time_spent_minutes,
					task_types!inner(name)
				`)
				.eq("work_date", todayStr)
				.in("employee_id", allEmployees.map(emp => emp.id))

			// Получаем статистику за ВСЕ ВРЕМЯ для нижней панели лидеров
			const { data: allTimeStats } = await supabase
				.from("task_logs")
				.select(`
					employee_id,
					units_completed,
					time_spent_minutes,
					work_date
				`)
				.in("employee_id", allEmployees.map(emp => emp.id))

			// Группируем статистику за СЕГОДНЯ для топ активных
			const todayStatsMap = new Map<number, any>()

			todayStats?.forEach((log: any) => {
				const empId = log.employee_id
				const existing = todayStatsMap.get(empId) || {
					totalUnits: 0,
					totalTime: 0,
					totalTasks: 0
				}

				existing.totalUnits += log.units_completed
				existing.totalTime += log.time_spent_minutes
				existing.totalTasks += 1

				todayStatsMap.set(empId, existing)
			})

			// Группируем статистику за ВСЕ ВРЕМЯ для лидерборда
			const allTimeStatsMap = new Map<number, any>()
			const workDaysMap = new Map<number, Set<string>>()

			allTimeStats?.forEach((log: any) => {
				const empId = log.employee_id
				const existing = allTimeStatsMap.get(empId) || {
					totalUnits: 0,
					totalTime: 0,
					totalTasks: 0
				}

				existing.totalUnits += log.units_completed
				existing.totalTime += log.time_spent_minutes
				existing.totalTasks += 1

				allTimeStatsMap.set(empId, existing)

				// Считаем уникальные дни работы
				if (!workDaysMap.has(empId)) {
					workDaysMap.set(empId, new Set())
				}
				workDaysMap.get(empId)!.add(log.work_date)
			})

			// Формируем лидерборд за ВСЕ ВРЕМЯ (для нижней панели)
			const leaderboardData = allEmployees.map((employee: any) => {
				const allTimeStats = allTimeStatsMap.get(employee.id) || {
					totalUnits: 0,
					totalTime: 0,
					totalTasks: 0
				}
				const todayStats = todayStatsMap.get(employee.id) || {
					totalUnits: 0,
					totalTime: 0,
					totalTasks: 0
				}
				const workDays = workDaysMap.get(employee.id)?.size || 0

				return {
					name: employee.full_name,
					userId: employee.user_id,
					position: employee.position,
					isOnline: false,
					score: `${allTimeStats.totalUnits} ед. • ${workDays} дн.`,
					totalTasks: allTimeStats.totalTasks,
					totalUnits: allTimeStats.totalUnits, // За все время для нижней панели
					totalTime: allTimeStats.totalTime,
					workDays: workDays,
					todayUnits: todayStats.totalUnits, // За сегодня для верхней панели
					isCurrentUser: employee.user_id === user?.id,
					rank: 0 // Будет установлен после сортировки
				}
			})
				// Сортируем по количеству единиц за все время
				.sort((a, b) => b.totalUnits - a.totalUnits)
				.map((leader, index) => ({
					...leader,
					rank: index + 1
				}))

			setLeaderboard(leaderboardData)

			// Считаем МЖИ решения за сегодня отдельно
			const mzhiCount = todayStats?.filter((log: any) =>
				log.task_types.name === "Внесение решений МЖИ (кол-во бланков)"
			).reduce((sum: number, log: any) => sum + log.units_completed, 0) || 0
			setMzhiDecisionsToday(mzhiCount)

			// Детальное логирование для отладки
			console.log("✅ Leaderboard loaded:", leaderboardData.length, "employees from office_id:", userOfficeId)
			console.log("👤 Current user ID:", user?.id)
			console.log("📋 All employees in office:", allEmployees?.map(e => ({
				id: e.id,
				user_id: e.user_id,
				name: e.full_name,
				office_id: e.office_id
			})))
			console.log("🎯 Current user in leaderboard:", leaderboardData.find(l => l.isCurrentUser))
			console.log("📊 МЖИ решений за сегодня:", mzhiCount)
		} catch (error) {
			console.error("❌ Error loading leaderboard:", error)
			setLeaderboard([])
		}
	}, [user?.id])

	const handleBreakStart = useCallback(async () => {
		// Приостанавливаем все активные задачи
		// (Только если еще не приостановлены паузой рабочей сессии)
		if (!localIsPaused) {
			pauseAllTasks()
		}

		setIsOnBreak(true)

		toast({
			title: "🍽️ Перерыв начат",
			description: "Активные задачи приостановлены",
		})
	}, [localIsPaused, pauseAllTasks, toast])

	const handleBreakEnd = useCallback(async () => {
		// Возобновляем все приостановленные задачи
		// (Только если рабочая сессия НЕ на паузе)
		if (!localIsPaused) {
			resumeAllTasks()
		}

		setIsOnBreak(false)

		toast({
			title: "🍽️ Перерыв завершен",
			description: localIsPaused
				? "Задачи остаются на паузе (рабочая сессия приостановлена)"
				: "Активные задачи возобновлены",
		})
	}, [localIsPaused, resumeAllTasks, toast])

	const handleScheduleSelect = async (schedule: string, hours: number) => {
		if (!user) return

		try {
			const { error } = await supabase
				.from("user_profiles")
				.update({
					work_schedule: schedule,
					work_hours: hours,
				})
				.eq("id", user.id)

			if (error) throw error

			setNeedsScheduleSetup(false)

			// Обновляем кэш профиля
			if (profile) {
				const updatedProfile = { ...profile, work_schedule: schedule, work_hours: hours }
				appCache.set("user_profile", updatedProfile, 30)
			}

			toast({
				title: "График сохранен!",
				description: `Установлен график ${schedule}`,
			})
		} catch (error) {
			console.error("Ошибка сохранения графика:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось сохранить график",
				variant: "destructive",
			})
		}
	}

	const handleDistrictSelect = async (districtId: number, districtName: string) => {
		if (!user) return

		try {
			// Используем безопасную функцию для обновления офиса
			const { data: updateResult, error: updateError } = await supabase
				.rpc('update_user_office', {
					user_uuid: user.id,
					new_office_id: districtId
				})

			if (updateError || !updateResult) {
				throw new Error(updateError?.message || "Не удалось обновить офис")
			}

			setNeedsDistrictSetup(false)

			// Обновляем лидерборд для нового офиса
			await fetchLeaderboard()

			// Обновляем данные пользователя для отображения нового офиса
			refreshUserData()

			toast({
				title: "Офис сохранен!",
				description: `Выбран офис: ${districtName}`,
			})
		} catch (error) {
			console.error("Ошибка сохранения офиса:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось сохранить офис",
				variant: "destructive",
			})
		}
	}

	// Обработчик начала задачи (теперь поддерживает множественные задачи)
	const handleStartTask = useCallback(
		async (taskId: number, taskName: string) => {
			// Проверяем состояние работы
			if (!localIsWorking && !isWorking) {
				toast({
					title: "⚠️ Начните рабочий день",
					description: "Сначала отметьтесь на работе",
					variant: "destructive",
				})
				return
			}

			// Проверяем паузу
			if (localIsPaused) {
				toast({
					title: "⏸️ Работа на паузе",
					description: "Возобновите работу перед началом задачи",
					variant: "destructive",
				})
				return
			}

			// Проверяем перерыв
			if (isOnBreak) {
				toast({
					title: "☕ Перерыв активен",
					description: "Завершите перерыв перед началом задачи",
					variant: "destructive",
				})
				return
			}

			try {
				// ИСПРАВЛЕНО: добавляем await для асинхронной функции
				const success = await startTask(taskId, taskName)

				if (!success) {
					return // startTask уже показал toast с ошибкой
				}

				toast({
					title: "🎮 Задача начата!",
					description: `Начато выполнение: ${taskName}`,
				})

				// Создаем сессию асинхронно
				startSession(taskId).catch((error) => {
					console.error("Ошибка создания сессии:", error)
					// Откатываем UI при ошибке
					stopTask(taskId)

					toast({
						title: "Ошибка",
						description: "Не удалось начать задачу",
						variant: "destructive",
					})
				})

				// Проверяем достижение мультизадачности (теперь 4+ задач)
				if (activeTasks.length >= 4) {
					checkForMultitaskingAchievement()
				}
			} catch (error) {
				console.error("Ошибка начала задачи:", error)
				toast({
					title: "Ошибка",
					description: "Не удалось начать задачу",
					variant: "destructive",
				})
			}
		},
		[localIsWorking, isWorking, localIsPaused, activeTasks.length, isOnBreak, startTask, startSession, stopTask, toast],
	)

	const handleStopTask = async (taskId: number) => {
		const task = activeTasks.find((t) => t.taskTypeId === taskId)
		if (!task) return

		// Устанавливаем задачу для завершения с текущим количеством единиц
		setCompletingTask({
			taskTypeId: task.taskTypeId,
			taskName: task.taskName,
			startTime: task.startTime,
			currentUnits: task.units, // Сохраняем текущее количество единиц
		})
		setShowCompletionDialog(true)
	}

	const handleSaveCompletion = async (units: number, notes: string) => {
		if (!completingTask || !user) return

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) {
				throw new Error("Не удалось найти профиль сотрудника")
			}

			// Получаем задачи за сегодня для расчета бонусов
			const today = new Date().toISOString().split("T")[0]
			const { data: todayTasks } = await supabase
				.from("task_logs")
				.select("task_types!inner(name), units_completed, time_spent_minutes, work_date")
				.eq("employee_id", employeeId)
				.eq("work_date", today)

			const dailyTasksForBonus =
				todayTasks?.map((t: any) => ({
					taskName: t.task_types?.name,
					units: t.units_completed,
					timeMinutes: t.time_spent_minutes,
					date: t.work_date,
				})) || []

			// Рассчитываем время выполнения задачи
			const elapsedMinutes = Math.floor((Date.now() - completingTask.startTime.getTime()) / 60000)

			// Рассчитываем очки с бонусами
			const rewardCalc = RewardSystem.calculateReward(
				completingTask.taskName,
				units,
				elapsedMinutes,
				dailyTasksForBonus,
			)

			// Сохраняем результат в базу данных
			const { error: logError } = await supabase.from("task_logs").insert({
				employee_id: employeeId,
				task_type_id: completingTask.taskTypeId,
				units_completed: units,
				time_spent_minutes: elapsedMinutes,
				work_date: new Date().toISOString().split("T")[0],
				notes: notes || null,
				is_active: false,
				started_at: completingTask.startTime.toISOString(),
			})

			if (logError) throw logError

			// ВАЖНО: Останавливаем активную задачу и таймер
			await endSession(completingTask.taskTypeId)
			stopTask(completingTask.taskTypeId)

			const coinsEarned = rewardCalc.totalPoints
			const newTotalCoins = playerCoins + coinsEarned
			setPlayerCoins(newTotalCoins)

			// Обновляем кэш монет
			appCache.set(`player_coins_${user.id}`, newTotalCoins, 10)

			const timeFormatted = `${Math.floor(elapsedMinutes / 60)}:${(elapsedMinutes % 60).toString().padStart(2, '0')}`

			toast({
				title: "🎉 Задача завершена!",
				description: `+${coinsEarned} очков! ${rewardCalc.bonusReasons.length > 0 ? `Бонусы: ${rewardCalc.bonusReasons.join(", ")}` : ""} Время: ${timeFormatted}`,
			})

			checkForAchievements(newTotalCoins)

			setCompletingTask(null)
			setShowCompletionDialog(false)

			// Проверяем, есть ли выигрыш колесом фортуны (случайность 5%)
			if (Math.random() < 0.05) {
				setShowPrizeWheel(true)
			}
		} catch (error) {
			console.error("Ошибка сохранения задачи:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось сохранить результат задачи",
				variant: "destructive",
			})
		}
	}

	const checkForAchievements = (coins: number) => {
		if (coins >= 1000 && playerCoins < 1000) {
			const achievement = GAME_CONFIG.ACHIEVEMENTS["thousand_club"]
			if (achievement) {
				setNewAchievement({ id: "thousand_club", ...achievement })
				// Показываем крутилку вместо обычной награды
				achievementTimeoutRef.current = setTimeout(() => {
					setShowPrizeWheel(true)
				}, 2000) // Показываем после попапа достижения
			}
		}
	}

	const checkForMultitaskingAchievement = () => {
		const achievement = GAME_CONFIG.ACHIEVEMENTS["multitasker"]
		if (achievement) {
			setNewAchievement({ id: "multitasker", ...achievement })
		}
	}

	const handleSignOut = async () => {
		// Останавливаем все активные задачи
		activeTasks.forEach((task) => {
			endSession(task.taskTypeId)
		})
		await signOut()
		toast({
			title: "До свидания!",
			description: "Вы успешно вышли из системы",
		})
	}

	// Функция принудительной остановки всех активных задач
	const handleForceStopAllTasks = () => {
		console.log("🛑 Принудительная остановка всех задач:", activeTasks.length)

		activeTasks.forEach((task) => {
			console.log("🛑 Останавливаем задачу:", task.taskName)
			stopTask(task.taskTypeId)
			endSession(task.taskTypeId)
		})

		toast({
			title: "⏹️ Задачи остановлены",
			description: "Все активные задачи были завершены без сохранения прогресса",
			variant: "destructive",
		})
	}

	// Мемоизируем обработчик изменения сессии
	const handleWorkSessionChange = useCallback((working: boolean, paused?: boolean) => {
		// Проверяем изменение состояния паузы
		const wasPaused = localIsPaused
		const isPausedNow = paused || false

		setLocalIsWorking(working)
		setLocalIsPaused(isPausedNow)

		// Если состояние паузы изменилось, управляем таймерами задач
		if (wasPaused !== isPausedNow) {
			if (isPausedNow) {
				// Рабочая сессия поставлена на паузу - приостанавливаем все таймеры задач
				pauseAllTasks()
			} else {
				// Рабочая сессия снята с паузы - возобновляем все таймеры задач
				// Возобновляем только если НЕ на обеде
				if (!isOnBreak) {
					resumeAllTasks()
				}
			}
		}

		// Синхронизируем с useWorkSession
		forceUpdateWorkingStatus(working)
	}, [localIsPaused, isOnBreak, pauseAllTasks, resumeAllTasks, forceUpdateWorkingStatus])

	const handlePrizeWon = async (prize: Prize) => {
		setWonPrize(prize)

		// Сохраняем выигранный приз в базу данных
		if (user) {
			try {
				const { employeeId } = await authService.getEmployeeId(user.id)
				if (employeeId) {
					await supabase.from("employee_prizes").insert({
						employee_id: employeeId,
						prize_name: prize.name,
						prize_description: prize.description,
						prize_icon: prize.icon,
						prize_rarity: prize.rarity,
						won_at: new Date().toISOString(),
						is_claimed: false,
					})
				}
			} catch (error) {
				console.error("Ошибка сохранения приза:", error)
			}
		}

		toast({
			title: "🎉 Поздравляем!",
			description: `Вы выиграли: ${prize.name}!`,
		})
	}

	const handleCloseWheel = () => {
		setShowPrizeWheel(false)
		setWonPrize(null)
	}

	// Обработчик закрытия достижения
	const handleAchievementClose = () => {
		setNewAchievement(null)
		// Очищаем таймер если он есть
		if (achievementTimeoutRef.current) {
			clearTimeout(achievementTimeoutRef.current)
			achievementTimeoutRef.current = null
		}
	}

	// Обработчик сохранения постфактум задачи
	const handleSavePostFactumTask = async (taskData: {
		taskTypeId: number
		taskName: string
		units: number
		timeSpent: number
		workDate: string
		startTime: string
		endTime: string
	}) => {
		try {
			console.log("💾 Saving post-factum task:", taskData)

			const { employeeId, error: empError } = await authService.getEmployeeId(user!.id)
			if (empError || !employeeId) {
				throw new Error("Employee ID not found")
			}

			// Сохраняем в task_logs
			const { error: logError } = await supabase.from("task_logs").insert({
				employee_id: employeeId,
				task_type_id: taskData.taskTypeId,
				units_completed: taskData.units,
				time_spent_minutes: taskData.timeSpent,
				work_date: taskData.workDate,
				created_at: new Date().toISOString(),
				notes: `Добавлено постфактум: ${taskData.startTime} - ${taskData.endTime}`,
			})

			if (logError) {
				console.error("❌ Error saving task log:", logError)
				throw logError
			}

			// Рассчитываем монеты
			const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskData.taskName] || 5
			const coinsEarned = taskData.units * coinsPerUnit
			const newTotalCoins = playerCoins + coinsEarned
			setPlayerCoins(newTotalCoins)

			// Обновляем кэш монет
			appCache.set(`player_coins_${user!.id}`, newTotalCoins, 10)

			// Обновляем статистику
			fetchLeaderboard()

			const timeFormatted = `${Math.floor(taskData.timeSpent / 60)}:${(taskData.timeSpent % 60).toString().padStart(2, '0')}`

			toast({
				title: "✅ Задача добавлена!",
				description: `${taskData.taskName}: ${taskData.units} ед., ${timeFormatted}, +${coinsEarned} очков`,
			})

			console.log("✅ Post-factum task saved successfully")
		} catch (error) {
			console.error("❌ Error saving post-factum task:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось сохранить задачу",
				variant: "destructive",
			})
			throw error
		}
	}

	// Группируем задачи по категориям - МЕМОИЗИРУЕМ
	const groupedTasks = useMemo(() => {
		return Object.entries(GAME_CONFIG.TASK_GROUPS)
			.map(([groupKey, groupData]) => ({
				key: groupKey,
				name: groupData.name,
				icon: groupData.icon,
				color: groupData.color,
				tasks: taskTypes.filter((task) => groupData.tasks.includes(task.name)),
			}))
			.filter((group) => group.tasks.length > 0) // Показываем только группы с задачами
	}, [taskTypes])

	// Активные задачи с таймерами для компонента - МЕМОИЗИРУЕМ
	const activeTasksWithTimers = useMemo(() => {
		return activeTasks.map((task) => ({
			id: task.id,
			taskTypeId: task.taskTypeId,
			name: task.taskName,
			startTime: task.startTime,
			elapsedTime: task.elapsedTime,
			units: task.units,
			isActive: task.isActive,
		}))
	}, [activeTasks])

	// Слушатель изменений офиса из админки
	useEffect(() => {
		if (!user) return

		const handleOfficeChange = async (event: Event) => {
			const customEvent = event as CustomEvent
			const { userId, oldOfficeId, newOfficeId } = customEvent.detail

			console.log("🏢 [ГЛАВНАЯ] Получено событие изменения офиса:", customEvent.detail)

			// Если изменён офис текущего пользователя, обновляем все данные
			if (userId === user.id) {
				console.log("✨ [ГЛАВНАЯ] Офис текущего пользователя изменён, перезагружаем данные...")

				// Обновляем данные пользователя
				await refreshUserData()

				// Перезагружаем лидерборд
				await fetchLeaderboard()

				// Показываем уведомление
				toast({
					title: "Офис обновлён",
					description: "Ваши данные синхронизированы с новым офисом",
				})
			} else {
				console.log("📊 [ГЛАВНАЯ] Офис другого пользователя изменён, обновляем лидерборд...")

				// Если изменён офис другого пользователя, просто обновляем лидерборд
				await fetchLeaderboard()
			}
		}

		// Добавляем слушатель события
		window.addEventListener('officeChanged', handleOfficeChange)

		// Убираем слушатель при размонтировании
		return () => {
			window.removeEventListener('officeChanged', handleOfficeChange)
		}
	}, [user?.id, refreshUserData, fetchLeaderboard, toast])

	// Показываем загрузку только если auth загружается ИЛИ данные загружаются
	if (authLoading || (user && profile && pageLoading)) {
		return (
			<AuthGuard>
				<main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4 flex items-center justify-center">
					<PixelCard>
						<div className="p-8 text-center">
							<div className="text-6xl animate-bounce mb-4">🎮</div>
							<div className="text-2xl font-bold">{authLoading ? "Загрузка игры..." : "Подготовка данных..."}</div>
							<div className="text-lg mt-2 opacity-80">
								{authLoading ? "Подключаемся к серверу" : "Загружаем ваш прогресс"}
							</div>
							<div className="mt-4">
								<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
							</div>
						</div>
					</PixelCard>
					<Toaster />
				</main>
			</AuthGuard>
		)
	}

	// Условный рендеринг только JSX, не хуков
	if (needsScheduleSetup) {
		return (
			<AuthGuard>
				<main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4 flex items-center justify-center">
					<ScheduleSelector onScheduleSelect={handleScheduleSelect} loading={false} />
					<Toaster />
				</main>
			</AuthGuard>
		)
	}

	if (needsDistrictSetup) {
		return (
			<AuthGuard>
				<main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4 flex items-center justify-center">
					<OfficeSelector onOfficeSelect={handleDistrictSelect} loading={false} />
					<Toaster />
				</main>
			</AuthGuard>
		)
	}

	return (
		<AuthGuard>
			<main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4">
				<div className="container mx-auto py-6">
					<Navigation />

					{/* Игровой заголовок */}
					<div className="flex items-center justify-between mb-6">
						<div className="text-white">
							<h1 className="text-4xl font-bold">🎮 Рабочая станция</h1>
							<p className="text-xl">Игрок: {freshUserData.full_name || "Загрузка..."}</p>
						</div>
						<div className="flex items-center gap-4">
							{/* Дата */}
							<PixelCard className="bg-gradient-to-r from-blue-200 to-blue-300">
								<div className="p-3 flex items-center gap-2 text-lg font-mono">
									<span className="text-xl">📅</span>
									{new Date().toLocaleDateString('ru-RU', {
										day: '2-digit',
										month: '2-digit',
										year: 'numeric'
									})}
								</div>
							</PixelCard>
							{/* Время */}
							<PixelCard>
								<div className="p-3 flex items-center gap-2 text-lg font-mono">
									<Clock className="h-5 w-5" />
									{currentTime}
								</div>
							</PixelCard>
							<PixelButton onClick={handleSignOut} variant="secondary" size="sm">
								<LogOut className="h-4 w-4 mr-2" />
								Выйти
							</PixelButton>
						</div>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
						{/* Панель задач */}
						<div className="lg:col-span-3 space-y-6">
							{/* Панель активных задач - пиксельный стиль */}
							{activeTasks.length > 0 ? (
								<div className="relative">
									<div className="
										bg-gradient-to-br from-green-200 to-green-300
										border-4 border-black rounded-none
										shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
										p-4
									">
										{/* Декоративные пиксели */}
										<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
										<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

										<div className="flex items-center gap-3 mb-4">
											<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
												<span className="text-xl">⚡</span>
											</div>
											<div>
												<h3 className="font-mono font-black text-xl text-black uppercase tracking-wide">
													АКТИВНЫЕ ЗАДАЧИ
												</h3>
												<p className="font-mono text-sm text-black font-semibold">
													{activeTasks.length} из 5 слотов заняты
												</p>
											</div>
										</div>

										{/* Список активных задач */}
										<div className="space-y-3">
											{activeTasks.map((task) => {
												const formattedTime = getFormattedTime(task.taskTypeId)
												const minutes = getMinutes(task.taskTypeId)

												return (
													<div
														key={task.taskTypeId}
														className="bg-black border-2 border-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
													>
														<div className="flex items-center justify-between">
															<div className="flex items-center gap-3">
																<div className="flex items-center gap-2">
																	<div className="w-2 h-2 bg-green-400 animate-pulse"></div>
																	<span className="font-mono font-black text-green-400 uppercase text-sm">
																		{task.taskName}
																	</span>
																</div>

																{/* Счетчик единиц с кнопками */}
																<div className="flex items-center gap-1 bg-gray-800 border border-gray-600 rounded p-1">
																	<button
																		onClick={() => {
																			const newUnits = Math.max(0, task.units - 1)
																			updateUnits(task.taskTypeId, newUnits)
																		}}
																		disabled={task.units <= 0}
																		className="w-6 h-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 border border-white text-white text-xs flex items-center justify-center"
																	>
																		-
																	</button>

																	<div className="flex items-center gap-1 min-w-[60px] justify-center">
																		<input
																			type="number"
																			min="0"
																			value={task.units}
																			onChange={(e) => {
																				const value = parseInt(e.target.value) || 0
																				updateUnits(task.taskTypeId, value)
																			}}
																			className="w-10 h-6 bg-transparent text-center text-sm text-green-400 font-mono font-black border-0 outline-none"
																		/>
																		<span className="text-xs text-gray-400">ед</span>
																	</div>

																	<button
																		onClick={() => {
																			const newUnits = task.units + 1
																			updateUnits(task.taskTypeId, newUnits)
																		}}
																		className="w-6 h-6 bg-green-600 hover:bg-green-700 border border-white text-white text-xs flex items-center justify-center"
																	>
																		+
																	</button>
																</div>
															</div>

															<div className="flex items-center gap-3">
																<div className="text-right">
																	<div className="font-mono font-black text-lg text-green-400">
																		{formattedTime}
																	</div>
																	<div className="font-mono text-xs text-gray-300">
																		{minutes} мин
																	</div>
																</div>

																<button
																	onClick={() => handleStopTask(task.taskTypeId)}
																	className="
																		bg-red-500 hover:bg-red-600 
																		border-2 border-white rounded-none
																		shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
																		hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
																		hover:translate-x-[1px] hover:translate-y-[1px]
																		transition-all duration-100
																		p-2
																	"
																>
																	<Square className="h-4 w-4 text-white" />
																</button>
															</div>
														</div>
													</div>
												)
											})}
										</div>

										{/* Подсказка */}
										<div className="mt-4 bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
											<div className="font-mono text-xs text-black text-center">
												💡 Максимум 5 задач одновременно
											</div>
										</div>

										{/* Нижние декоративные пиксели */}
										<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
										<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
									</div>
									<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
								</div>
							) : (
								<div className="relative">
									<div className="
										bg-gradient-to-br from-gray-200 to-gray-300
										border-4 border-black rounded-none
										shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
										p-4
									">
										{/* Декоративные пиксели */}
										<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
										<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

										<div className="flex items-center gap-3 mb-4">
											<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
												<span className="text-xl">⏸️</span>
											</div>
											<div>
												<h3 className="font-mono font-black text-xl text-black uppercase tracking-wide">
													АКТИВНЫЕ ЗАДАЧИ
												</h3>
												<p className="font-mono text-sm text-black font-semibold">
													Нет активных задач
												</p>
											</div>
										</div>

										<div className="bg-black border-2 border-white p-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-center">
											<div className="text-4xl mb-2">🎮</div>
											<div className="font-mono text-white font-black">ВЫБЕРИТЕ ЗАДАЧУ</div>
											<div className="font-mono text-gray-300 text-sm mt-1">Начните выполнение снизу</div>
										</div>

										{/* Нижние декоративные пиксели */}
										<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
										<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
									</div>
									<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
								</div>
							)}

							{/* Статус работы - пиксельный стиль */}
							<div className="relative">
								<div className={`
									${(localIsWorking || isWorking)
										? 'bg-gradient-to-br from-green-200 to-green-300'
										: 'bg-gradient-to-br from-red-200 to-red-300'
									}
									border-4 border-black rounded-none
									shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
									p-4
								`}>
									{/* Декоративные пиксели */}
									<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
									<div className="absolute top-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>

									<div className="flex items-center justify-center gap-4">
										<div className="flex items-center gap-3">
											<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
												<span className="text-2xl">⚡</span>
											</div>
											<div>
												<h2 className="font-mono font-black text-2xl text-black uppercase tracking-wide">
													КВЕСТЫ
												</h2>
												<p className="font-mono text-sm text-black font-semibold">
													Игровые задания
												</p>
											</div>
										</div>

										{/* Статусы в пиксельном стиле */}
										<div className="flex gap-2">
											{!localIsWorking && !isWorking && (
												<div className="bg-red-500 border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
													<span className="font-mono text-sm font-black text-white uppercase">НЕ НА РАБОТЕ</span>
												</div>
											)}
											{(localIsWorking || isWorking) && !localIsPaused && (
												<div className="bg-green-500 border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
													<span className="font-mono text-sm font-black text-white uppercase">НА РАБОТЕ</span>
												</div>
											)}
											{(localIsWorking || isWorking) && localIsPaused && (
												<div className="bg-yellow-500 border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
													<span className="font-mono text-sm font-black text-white uppercase">НА ПАУЗЕ</span>
												</div>
											)}
											{activeTasks.length > 0 && (
												<div className="bg-blue-500 border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
													<span className="font-mono text-sm font-black text-white uppercase">
														{activeTasks.length} АКТИВНЫХ
													</span>
												</div>
											)}
										</div>
									</div>

									{/* Нижние декоративные пиксели */}
									<div className="absolute bottom-1 left-1 w-2 h-2 bg-red-400 border border-black"></div>
									<div className="absolute bottom-1 right-1 w-2 h-2 bg-green-400 border border-black"></div>
								</div>
								<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
							</div>

							{/* Группы задач */}
							{groupedTasks.map((group) => (
								<TaskGroup
									key={group.key}
									groupName={group.name}
									groupIcon={group.icon}
									groupColor={group.color}
									tasks={group.tasks}
									activeTasks={activeTasks.map((task) => task.taskTypeId)}
									onStartTask={handleStartTask}
									onStopTask={handleStopTask}
									getTaskTime={getFormattedTime}
								/>
							))}
						</div>

						{/* Боковая панель */}
						<div className="space-y-6">
							{/* Профиль игрока - пиксельный стиль */}
							<div className="relative">
								<div className="
									bg-gradient-to-br from-purple-300 to-pink-300 
									border-4 border-black rounded-none
									shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
									p-4
									transition-all duration-100
									hover:translate-x-[1px] hover:translate-y-[1px] 
									hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
								">
									{/* Декоративные пиксели */}
									<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
									<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

									<button
										onClick={() => router.push("/profile")}
										className="w-full text-left group"
									>
										<div className="flex items-center gap-3 mb-3">
											<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
												<Trophy className="h-6 w-6 text-yellow-600" />
											</div>
											<div>
												<h3 className="font-mono font-black text-lg text-black uppercase tracking-wide">
													ПРОФИЛЬ
												</h3>
												<p className="font-mono text-sm text-black font-semibold">
													{freshUserData.full_name || "Игрок"}
												</p>
											</div>
										</div>

										{/* Монетки под ФИО */}
										<div className="mb-3">
											<div className="bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-600 border-2 border-yellow-800 px-3 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
												<CoinDisplay coins={playerCoins} animated />
											</div>
										</div>

										{/* Информация об уровне с новой системой */}
										<div className="bg-black border-2 border-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
											{(() => {
												const currentLevel = calculateLevel(playerCoins)
												const nextLevel = getNextLevel(playerCoins)

												return (
													<>
														<div className="flex items-center justify-between">
															<div className="flex items-center gap-2">
																<span className="text-2xl">{currentLevel.icon}</span>
																<div className="text-white">
																	<div className="font-mono font-black text-sm uppercase">{currentLevel.name}</div>
																	<div className="font-mono text-xs">Уровень {currentLevel.level}</div>
																</div>
															</div>
															<div className="text-right text-white">
																<div className="font-mono font-black text-lg">{playerCoins}</div>
																<div className="font-mono text-xs">очков</div>
															</div>
														</div>

														{/* Прогресс бар с новой системой */}
														<div className="mt-3">
															{nextLevel ? (
																<>
																	<div className="bg-gray-800 border-2 border-gray-600 h-4 relative overflow-hidden">
																		<div
																			className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-full transition-all duration-500"
																			style={{
																				width: `${Math.max(0, Math.min(100, ((playerCoins - currentLevel.minCoins) / (nextLevel.minCoins - currentLevel.minCoins)) * 100))}%`
																			}}
																		></div>
																		<div className="absolute inset-0 bg-black/10" style={{
																			background: 'repeating-linear-gradient(90deg, transparent 0px, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 6px)'
																		}}></div>
																	</div>
																	<div className="font-mono text-xs text-gray-300 mt-1 flex justify-between">
																		<span>Уровень {currentLevel.level}</span>
																		<span>До {nextLevel.level}: {nextLevel.minCoins - playerCoins} 🪙</span>
																	</div>
																</>
															) : (
																<div className="text-xs text-yellow-400 font-mono text-center">
																	🏆 МАКСИМАЛЬНЫЙ УРОВЕНЬ 🏆
																</div>
															)}
														</div>
													</>
												)
											})()}
										</div>
									</button>

									{/* Нижние декоративные пиксели */}
									<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
									<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
								</div>
								<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
							</div>

							{/* Кнопка добавления задачи постфактум */}
							<div className="relative">
								<div className="
									bg-gradient-to-br from-orange-300 to-red-300 
									border-4 border-black rounded-none
									shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
									p-4
									transition-all duration-100
									hover:translate-x-[1px] hover:translate-y-[1px] 
									hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
								">
									{/* Декоративные пиксели */}
									<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
									<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

									<button
										onClick={() => setShowPostFactumDialog(true)}
										className="w-full text-left group"
									>
										<div className="flex items-center gap-3 mb-3">
											<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
												<span className="text-xl">⏰</span>
											</div>
											<div>
												<h3 className="font-mono font-black text-lg text-black uppercase tracking-wide">
													ОТЛОЖЕННЫЕ ЗАДАЧИ
												</h3>
												<p className="font-mono text-sm text-black font-semibold">
													Добавить задачу
												</p>
											</div>
										</div>

										<div className="bg-black border-2 border-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
											<div className="text-center">
												<div className="font-mono font-black text-sm text-white uppercase mb-1">
													Забыли включить таймер?
												</div>
												<div className="font-mono text-xs text-gray-300">
													Укажите время и количество
												</div>
											</div>
										</div>
									</button>

									{/* Нижние декоративные пиксели */}
									<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
									<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
								</div>
								<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
							</div>

							{/* Рабочая смена - пиксельный стиль */}
							<div className="relative">
								<div className={`
									${localIsWorking || isWorking
										? localIsPaused
											? 'bg-gradient-to-br from-yellow-300 to-yellow-400'  // Желтый для паузы
											: 'bg-gradient-to-br from-green-300 to-green-400'   // Зеленый для работы
										: 'bg-gradient-to-br from-gray-300 to-gray-400'        // Серый для не работы
									}
									border-4 border-black rounded-none
									shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
									p-4
								`}>
									{/* Декоративные пиксели */}
									<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
									<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

									<div className="flex items-center gap-3 mb-3">
										<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
											<span className="text-xl">
												{localIsPaused ? '⏸️' : (localIsWorking || isWorking) ? '🟢' : '🔴'}
											</span>
										</div>
										<div>
											<h3 className="font-mono font-black text-base text-black uppercase tracking-wide">
												{localIsPaused ? 'НА ПАУЗЕ' : (localIsWorking || isWorking) ? 'НА РАБОТЕ' : 'НЕ НА РАБОТЕ'}
											</h3>
											<p className="font-mono text-sm text-black font-semibold">
												{localIsPaused
													? 'Работа приостановлена'
													: (localIsWorking || isWorking)
														? 'Можно начинать задачи'
														: 'Время начать работу'
												}
											</p>
										</div>
									</div>

									<WorkSessionEnhanced
										onSessionChange={handleWorkSessionChange}
										activeTasks={activeTasks.map(task => ({
											id: task.id,
											taskTypeId: task.taskTypeId,
											taskName: task.taskName
										}))}
										onForceStopAllTasks={handleForceStopAllTasks}
									/>

									{/* Нижние декоративные пиксели */}
									<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
									<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
								</div>
								<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
							</div>

							{/* Расширенная статистика офиса - пиксельный стиль */}
							<div className="relative">
								<div className="
									bg-gradient-to-br from-purple-300 to-purple-400 
									border-4 border-black rounded-none
									shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
									p-4
								">
									{/* Декоративные пиксели */}
									<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
									<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

									<div className="flex items-center gap-3 mb-3">
										<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
											<span className="text-xl">🏢</span>
										</div>
										<div>
											<h3 className="font-mono font-black text-base text-black uppercase tracking-wide">
												ОФИС {currentOfficeName}
											</h3>
											<p className="font-mono text-sm text-black font-semibold">
												Сводка команды за сегодня
											</p>
										</div>
									</div>

									{/* Основная статистика в пиксельном стиле */}
									<div className="bg-black border-2 border-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-3">
										<div className="grid grid-cols-3 gap-4 text-white font-mono">
											<div>
												<div className="text-xs text-gray-300">ВСЕГО</div>
												<div className="font-black text-lg text-green-400">
													{leaderboard.reduce((sum, member) => sum + (member.todayUnits || 0), 0)}
												</div>
											</div>
											<div>
												<div className="text-xs text-gray-300">ОНЛАЙН</div>
												<div className="font-black text-lg text-blue-400">
													{leaderboard.filter(member => member.isOnline).length || "0"}
												</div>
											</div>
											<div>
												<div className="text-xs text-gray-300">МЖИ РЕШЕНИЙ</div>
												<div className="font-black text-lg text-red-400">
													{mzhiDecisionsToday}
												</div>
											</div>
										</div>
									</div>

									{/* Топ активных сегодня */}
									<div className="bg-gray-800 border-2 border-gray-600 p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
										<div className="text-xs text-gray-300 font-mono mb-2 uppercase">Топ активных:</div>
										<div className="space-y-1">
											{leaderboard
												.filter(member => (member.todayUnits || 0) > 0)
												.sort((a, b) => (b.todayUnits || 0) - (a.todayUnits || 0))
												.slice(0, 3)
												.map((member, index) => (
													<div key={index} className="flex items-center justify-between text-xs font-mono">
														<div className="flex items-center gap-2">
															<div className={`w-1 h-1 rounded-full ${member.isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
															<span className={`${member.isCurrentUser ? 'text-yellow-400 font-black' : 'text-white'} truncate max-w-[80px]`}>
																{member.name.split(' ')[0]}
															</span>
														</div>
														<div className="text-green-400 font-black">
															{member.todayUnits || 0}
														</div>
													</div>
												))}
										</div>
									</div>

									{/* Нижние декоративные пиксели */}
									<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
									<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
								</div>
								<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
							</div>

							{/* Перерыв/Обед - пиксельный стиль */}
							<div className="relative">
								<div className={`
									${isOnBreak
										? 'bg-gradient-to-br from-orange-300 to-orange-400'
										: 'bg-gradient-to-br from-gray-300 to-gray-400'
									}
									border-4 border-black rounded-none
									shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
									p-4
								`}>
									{/* Декоративные пиксели */}
									<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
									<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

									<div className="flex items-center gap-3 mb-3">
										<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
											<span className="text-xl">🍽️</span>
										</div>
										<div>
											<h3 className="font-mono font-black text-base text-black uppercase tracking-wide">
												{isOnBreak ? 'НА ПЕРЕРЫВЕ' : 'ОБЕД'}
											</h3>
											<p className="font-mono text-sm text-black font-semibold">
												{isOnBreak ? 'Отдыхаем' : 'Доступен перерыв'}
											</p>
										</div>
									</div>

									<BreakControls
										onBreakStart={handleBreakStart}
										onBreakEnd={handleBreakEnd}
										isOnBreak={isOnBreak}
										isWorking={localIsWorking || isWorking}
									/>

									{/* Нижние декоративные пиксели */}
									<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
									<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
								</div>
								<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
							</div>

							{/* Лидеры недели - пиксельный стиль */}
							<div className="relative">
								<div className="
									bg-gradient-to-br from-yellow-300 to-yellow-400 
									border-4 border-black rounded-none
									shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
									p-4
								">
									{/* Декоративные пиксели */}
									<div className="absolute top-1 left-1 w-2 h-2 bg-red-400 border border-black"></div>
									<div className="absolute top-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>

									<div className="flex items-center gap-3 mb-3">
										<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
											<span className="text-xl">👑</span>
										</div>
										<div>
											<h3 className="font-mono font-black text-base text-black uppercase tracking-wide">
												ЛИДЕРЫ
											</h3>
											<p className="font-mono text-sm text-black font-semibold">
												Все сотрудники офиса
											</p>
										</div>
									</div>

									{/* Список лидеров в пиксельном стиле */}
									<div className="bg-black border-2 border-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
										<div className="space-y-2">
											{leaderboard.length > 0 ? leaderboard.map((leader, index) => (
												<div key={index} className="flex items-center justify-between text-white font-mono">
													<div className="flex items-center gap-2">
														<span className={`text-sm ${leader.rank === 1 ? 'text-yellow-400' :
															leader.rank === 2 ? 'text-gray-300' :
																leader.rank === 3 ? 'text-orange-400' :
																	'text-gray-400'
															}`}>
															#{leader.rank}
														</span>
														<div className="flex flex-col">
															<span
																className={`text-sm font-black cursor-pointer hover:text-blue-300 transition-colors ${leader.isCurrentUser ? 'text-green-400' : 'text-white'
																	}`}
																onClick={() => leader.userId && openProfile(leader.userId, true)}
															>
																{leader.name} {!leader.isCurrentUser && '👤'}
																{leader.isOnline && <span className="text-green-400 text-xs ml-1">●</span>}
															</span>
															<span className="text-xs text-gray-400">{leader.position}</span>
														</div>
													</div>
													<div className="text-right">
														<div className="text-xs text-yellow-300">{leader.totalUnits} единиц</div>
														<div className="text-xs text-gray-300">{getDaysText(leader.workDays || 0)}</div>
													</div>
												</div>
											)) : (
												<div className="text-center py-4">
													<div className="text-2xl mb-2">🏆</div>
													<div className="font-mono text-gray-300 text-sm">
														Пока нет данных
													</div>
													<div className="font-mono text-gray-400 text-xs mt-1">
														Выполните задачи для участия
													</div>
												</div>
											)}
										</div>
									</div>

									{/* Нижние декоративные пиксели */}
									<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
									<div className="absolute bottom-1 right-1 w-2 h-2 bg-purple-400 border border-black"></div>
								</div>
								<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
							</div>
						</div>
					</div>

					{/* Диалог завершения */}
					<CompletionDialog
						isOpen={showCompletionDialog}
						onClose={() => setShowCompletionDialog(false)}
						onSave={handleSaveCompletion}
						taskName={completingTask?.taskName || ""}
						timeSpent={completingTask ? getFormattedTime(completingTask.taskTypeId) : "00:00"}
						taskId={completingTask?.taskTypeId}
						initialUnits={completingTask?.currentUnits || 1} // Передаем количество единиц из активной задачи
					/>

					{/* Попап достижений */}
					<AchievementPopup achievement={newAchievement} onClose={handleAchievementClose} />
				</div>
				<Toaster />
				{/* Крутилка призов */}
				<PrizeWheel isOpen={showPrizeWheel} onClose={handleCloseWheel} onPrizeWon={handlePrizeWon} />

				{/* Модальное окно профиля пользователя */}
				<UserProfileModal
					userId={selectedUserId}
					isOpen={profileModalOpen}
					onClose={closeProfile}
					showFullStats={showFullStats}
				/>

				{/* Диалог добавления задачи постфактум */}
				<PostFactumDialog
					isOpen={showPostFactumDialog}
					onClose={() => setShowPostFactumDialog(false)}
					onSave={handleSavePostFactumTask}
					taskTypes={taskTypes}
				/>
			</main>
		</AuthGuard>
	)
}
