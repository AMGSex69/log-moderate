"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
import LevelDisplay from "@/components/level-display"
import AchievementPopup from "@/components/achievement-popup"
import Navigation from "@/components/navigation"
import AuthGuard from "@/components/auth/auth-guard"
import WorkSessionEnhanced from "@/components/work-session-enhanced"
import BreakControls from "@/components/break-controls"
import ScheduleSelector from "@/components/schedule-selector"
import { Clock, Trophy, LogOut } from "lucide-react"
import { GAME_CONFIG } from "@/lib/game-config"
import { appCache } from "@/lib/cache"
import { RewardSystem } from "@/lib/reward-system"
import PrizeWheel, { type Prize } from "@/components/prize-wheel"

export default function Home() {
	const router = useRouter()
	const { user, profile, signOut, loading: authLoading } = useAuth()

	// Все хуки должны быть вызваны безусловно
	const { startSession, endSession } = useActiveSessions()
	const { isWorking, updateSessionCache } = useWorkSession()
	const {
		activeTasks,
		startTask,
		stopTask,
		removeTask,
		stopAllTasks,
		startAllTasks,
		getTaskTimer,
		getActiveTasksWithTimers,
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
	const [pageLoading, setPageLoading] = useState(true)
	const [localIsWorking, setLocalIsWorking] = useState(false)
	const [showPrizeWheel, setShowPrizeWheel] = useState(false)
	const [wonPrize, setWonPrize] = useState<Prize | null>(null)

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
				timeUpdateRef.current = setInterval(updateTime, 60000) // Каждую минуту
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

	// Инициализация данных только после загрузки auth
	useEffect(() => {
		if (!authLoading && user && profile && !initializingRef.current) {
			console.log("🚀 Starting data initialization...")
			initializingRef.current = true
			initializeData()
		} else if (!authLoading && !user) {
			// Если нет пользователя, сразу убираем загрузку
			setPageLoading(false)
		}
	}, [authLoading, user, profile])

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

	const initializeData = async () => {
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
	}

	const fetchTaskTypes = async () => {
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
	}

	const fetchPlayerCoins = async () => {
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
	}

	const checkScheduleSetup = () => {
		console.log("📅 Checking schedule setup...")
		if (profile && !profile.work_schedule) {
			console.log("⚠️ Schedule setup needed")
			setNeedsScheduleSetup(true)
			return true
		}
		console.log("✅ Schedule check complete")
		return false
	}

	const handleBreakStart = async () => {
		// Останавливаем все активные задачи
		stopAllTasks()
		activeTasks.forEach((task) => {
			endSession(task.id)
		})
		setIsOnBreak(true)
	}

	const handleBreakEnd = async () => {
		setIsOnBreak(false)
		// Возобновляем все активные задачи
		startAllTasks()
		activeTasks.forEach((task) => {
			startSession(task.id)
		})
	}

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

	// Обработчик начала задачи (теперь поддерживает множественные задачи)
	const handleStartTask = useCallback(
		async (taskId: number, taskName: string) => {
			if (!localIsWorking && !isWorking) {
				toast({
					title: "Не на работе",
					description: "Сначала отметьтесь на рабочем месте",
					variant: "destructive",
				})
				return
			}

			if (isOnBreak) {
				toast({
					title: "Перерыв",
					description: "Сначала завершите обед",
					variant: "destructive",
				})
				return
			}

			try {
				// Пытаемся начать задачу
				const success = startTask(taskId, taskName)

				if (!success) {
					toast({
						title: "Внимание",
						description: "Эта задача уже активна",
						variant: "destructive",
					})
					return
				}

				toast({
					title: "🎮 Задача начата!",
					description: `Начато выполнение: ${taskName}`,
				})

				// Создаем сессию асинхронно
				startSession(taskId).catch((error) => {
					console.error("Ошибка создания сессии:", error)
					// Откатываем UI при ошибке
					removeTask(taskId)

					toast({
						title: "Ошибка",
						description: "Не удалось начать задачу",
						variant: "destructive",
					})
				})

				// Проверяем достижение мультизадачности
				if (activeTasks.length >= 2) {
					// +1 за новую задачу = 3
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
		[localIsWorking, isWorking, activeTasks, isOnBreak, startTask, startSession, removeTask, toast],
	)

	const handleStopTask = async (taskId: number) => {
		const task = stopTask(taskId)
		if (!task) return

		const timer = getTaskTimer(taskId)
		if (!timer) return

		await endSession(taskId)

		setCompletingTask({
			...task,
			timer,
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

			// Рассчитываем очки с бонусами
			const rewardCalc = RewardSystem.calculateReward(
				completingTask.name,
				units,
				completingTask.timer.getMinutes(),
				dailyTasksForBonus,
			)

			const { error: logError } = await supabase.from("task_logs").insert({
				employee_id: employeeId,
				task_type_id: completingTask.id,
				units_completed: units,
				time_spent_minutes: completingTask.timer.getMinutes(),
				work_date: new Date().toISOString().split("T")[0],
				notes: notes || null,
				is_active: false,
				started_at: completingTask.startTime.toISOString(),
			})

			if (logError) throw logError

			const coinsEarned = rewardCalc.totalPoints
			const newTotalCoins = playerCoins + coinsEarned
			setPlayerCoins(newTotalCoins)

			// Обновляем кэш монет
			appCache.set(`player_coins_${user.id}`, newTotalCoins, 10)

			toast({
				title: "🎉 Задача завершена!",
				description: `+${coinsEarned} очков! ${rewardCalc.bonusReasons.length > 0 ? `Бонусы: ${rewardCalc.bonusReasons.join(", ")}` : ""} Время: ${completingTask.timer.formatTime()}`,
			})

			checkForAchievements(newTotalCoins)

			// Удаляем задачу из активных
			removeTask(completingTask.id)
			setCompletingTask(null)
			setShowCompletionDialog(false)
		} catch (error) {
			console.error("Ошибка сохранения:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось сохранить результат",
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
			endSession(task.id)
		})
		await signOut()
		toast({
			title: "До свидания!",
			description: "Вы успешно вышли из системы",
		})
	}

	const handleWorkSessionChange = useCallback((working: boolean) => {
		setLocalIsWorking(working)
	}, [])

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

	// Группируем задачи по категориям
	const groupedTasks = Object.entries(GAME_CONFIG.TASK_GROUPS).map(([groupName, groupData]) => ({
		name: groupName,
		icon: groupData.icon,
		color: groupData.color,
		tasks: taskTypes.filter((task) => groupData.tasks.includes(task.name)),
	}))

	// Получаем активные задачи с таймерами
	const activeTasksWithTimers = getActiveTasksWithTimers()

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

	return (
		<AuthGuard>
			<main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4">
				<div className="container mx-auto py-6">
					<Navigation />

					{/* Игровой заголовок */}
					<div className="flex items-center justify-between mb-6">
						<div className="text-white">
							<h1 className="text-4xl font-bold">🎮 Рабочая станция</h1>
							<p className="text-xl">Игрок: {profile?.full_name || "Загрузка..."}</p>
						</div>
						<div className="flex items-center gap-4">
							<PixelCard className="bg-gradient-to-r from-yellow-200 to-yellow-300">
								<div className="p-3">
									<CoinDisplay coins={playerCoins} animated />
								</div>
							</PixelCard>
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
							{/* Панель активных задач */}
							<ActiveTasksPanel activeTasks={activeTasksWithTimers} onStopTask={handleStopTask} />

							{/* Статус работы */}
							<PixelCard>
								<div className="p-4 text-center">
									<div className="flex items-center justify-center gap-4">
										<div className="flex items-center gap-2">
											<span className="text-2xl">⚡</span>
											<h2 className="text-2xl font-bold">Квесты</h2>
										</div>
										{!localIsWorking && !isWorking && (
											<span className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded-full">Не на работе</span>
										)}
										{(localIsWorking || isWorking) && (
											<span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full">На работе</span>
										)}
										{activeTasks.length > 0 && (
											<span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
												{activeTasks.length} активных задач
											</span>
										)}
									</div>
								</div>
							</PixelCard>

							{/* Группы задач */}
							{groupedTasks.map((group) => (
								<TaskGroup
									key={group.name}
									groupName={group.name}
									groupIcon={group.icon}
									groupColor={group.color}
									tasks={group.tasks}
									activeTasks={activeTasks.map((task) => task.id)}
									onStartTask={handleStartTask}
									onStopTask={handleStopTask}
									getTaskTime={(taskId) => {
										const timer = getTaskTimer(taskId)
										return timer?.formatTime()
									}}
								/>
							))}
						</div>

						{/* Боковая панель */}
						<div className="space-y-6">
							{/* Профиль и Уровень рядом */}
							<div className="grid grid-cols-2 gap-3">
								{/* Кнопка профиля */}
								<PixelButton onClick={() => router.push("/profile")} className="w-full" variant="success">
									<Trophy className="h-4 w-4 mr-2" />
									Профиль
								</PixelButton>

								{/* Уровень игрока */}
								<PixelCard>
									<div className="p-3">
										<div className="flex items-center gap-1 mb-2">
											<span className="text-sm">⭐</span>
											<h3 className="font-bold text-sm">Уровень</h3>
										</div>
										<LevelDisplay coins={playerCoins} />
									</div>
								</PixelCard>
							</div>

							{/* Отметка прихода/ухода */}
							<WorkSessionEnhanced onSessionChange={handleWorkSessionChange} />

							{/* Контроль перерывов - сразу под рабочей сменой */}
							<BreakControls onBreakStart={handleBreakStart} onBreakEnd={handleBreakEnd} isOnBreak={isOnBreak} />

							{/* Мини статистика */}
							<StatsPanel />
						</div>
					</div>

					{/* Диалог завершения */}
					<CompletionDialog
						isOpen={showCompletionDialog}
						onClose={() => setShowCompletionDialog(false)}
						onSave={handleSaveCompletion}
						taskName={completingTask?.name || ""}
						timeSpent={completingTask?.timer?.formatTime() || ""}
						taskId={completingTask?.id}
					/>

					{/* Попап достижений */}
					<AchievementPopup achievement={newAchievement} onClose={handleAchievementClose} />
				</div>
				<Toaster />
				{/* Крутилка призов */}
				<PrizeWheel isOpen={showPrizeWheel} onClose={handleCloseWheel} onPrizeWon={handlePrizeWon} />
			</main>
		</AuthGuard>
	)
}
