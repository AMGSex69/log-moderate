"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DetailedProfileStats } from "@/components/detailed-profile-stats"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
import { formatDuration } from "@/lib/utils"
import { GAME_CONFIG, calculateLevel } from "@/lib/game-config"
import PixelCard from "@/components/pixel-card"
import PixelButton from "@/components/pixel-button"
import LevelDisplay from "@/components/level-display"
import CoinDisplay from "@/components/coin-display"
import Navigation from "@/components/navigation"
import AuthGuard from "@/components/auth/auth-guard"
import { Trophy, Target, Clock, TrendingUp, ArrowLeft, Edit } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import PrizeShop from "@/components/prize-shop"

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

export default function ProfilePage() {
	const { user, profile } = useAuth()
	const router = useRouter()
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
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		if (user) {
			fetchProfileData()
		}
	}, [user])

	const fetchProfileData = async () => {
		if (!user) return

		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
			if (empError || !employeeId) return

			// Получаем все логи задач
			const { data: logsData, error: logsError } = await supabase
				.from("task_logs")
				.select("time_spent_minutes, units_completed, work_date, task_types(name)")
				.eq("employee_id", employeeId)
				.order("work_date", { ascending: false })

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

			// Рассчитываем streak (упрощенно)
			const currentStreak = calculateCurrentStreak(logsData || [])

			// Получаем достижения (пока используем статичные)
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
		} catch (error) {
			console.error("Ошибка загрузки профиля:", error)
		} finally {
			setLoading(false)
		}
	}

	const handleCoinsSpent = (amount: number) => {
		setStats((prev) => ({
			...prev,
			total_coins: prev.total_coins - amount,
		}))
	}

	const calculateCurrentStreak = (logs: any[]) => {
		if (!logs.length) return 0

		const uniqueDays = [...new Set(logs.map((log) => log.work_date))].sort().reverse()
		let streak = 0
		const today = new Date().toISOString().split("T")[0]

		for (let i = 0; i < uniqueDays.length; i++) {
			const day = uniqueDays[i]
			const dayDate = new Date(day)
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
				id: "coin_collector",
				name: "Коллекционер монет",
				description: "Накопите 1000 монет",
				icon: "💰",
				unlocked_at: new Date().toISOString(),
			})
		}

		if (streak >= 7) {
			unlocked.push({
				id: "week_warrior",
				name: "Воин недели",
				description: "Работайте 7 дней подряд",
				icon: "🏆",
				unlocked_at: new Date().toISOString(),
			})
		}

		return unlocked
	}

	if (loading) {
		return (
			<AuthGuard>
				<main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4 flex items-center justify-center">
					<PixelCard>
						<div className="p-8 text-center">
							<div className="text-6xl animate-bounce mb-4">📊</div>
							<div className="text-2xl font-bold">Загрузка профиля...</div>
						</div>
					</PixelCard>
				</main>
			</AuthGuard>
		)
	}

	const currentLevel = calculateLevel(stats.total_coins)

	return (
		<AuthGuard>
			<main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4">
				<div className="container mx-auto py-6">
					<Navigation />

					{/* Заголовок профиля */}
					<div className="flex items-center justify-between mb-6">
						<div className="flex items-center gap-4">
							<PixelButton onClick={() => router.push("/")} variant="secondary">
								<ArrowLeft className="h-4 w-4 mr-2" />
								Назад
							</PixelButton>
							<Link href="/profile/edit">
								<PixelButton variant="secondary">
									<Edit className="h-4 w-4 mr-2" />
									Редактировать
								</PixelButton>
							</Link>
							<div className="text-white">
								<h1 className="text-4xl font-bold">👤 Мой профиль</h1>
								<p className="text-xl">{profile?.full_name || "Загрузка..."}</p>
							</div>
						</div>
						<PixelCard className="bg-gradient-to-r from-yellow-200 to-yellow-300">
							<div className="p-3">
								<CoinDisplay coins={stats.total_coins} />
							</div>
						</PixelCard>
					</div>

					{/* Уровень игрока */}
					<PixelCard className="mb-6 bg-gradient-to-r from-blue-200 to-purple-200">
						<div className="p-6">
							<div className="flex items-center justify-between">
								<LevelDisplay coins={stats.total_coins} />
								<div className="text-right">
									<div className="text-2xl font-bold">{currentLevel.level} уровень</div>
									<div className="text-muted-foreground">{currentLevel.name}</div>
								</div>
							</div>
						</div>
					</PixelCard>

					{/* Общая статистика */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
						<PixelCard className="bg-gradient-to-r from-green-200 to-green-300">
							<div className="p-4 text-center">
								<Target className="h-8 w-8 mx-auto mb-2 text-green-700" />
								<div className="text-3xl font-bold text-green-800">{stats.total_tasks}</div>
								<div className="text-sm font-medium text-green-700">Задач выполнено</div>
							</div>
						</PixelCard>

						<PixelCard className="bg-gradient-to-r from-blue-200 to-blue-300">
							<div className="p-4 text-center">
								<Clock className="h-8 w-8 mx-auto mb-2 text-blue-700" />
								<div className="text-3xl font-bold text-blue-800">{formatDuration(stats.total_time)}</div>
								<div className="text-sm font-medium text-blue-700">Общее время</div>
							</div>
						</PixelCard>

						<PixelCard className="bg-gradient-to-r from-orange-200 to-orange-300">
							<div className="p-4 text-center">
								<TrendingUp className="h-8 w-8 mx-auto mb-2 text-orange-700" />
								<div className="text-3xl font-bold text-orange-800">{stats.current_streak}</div>
								<div className="text-sm font-medium text-orange-700">Дней подряд</div>
							</div>
						</PixelCard>

						<PixelCard className="bg-gradient-to-r from-yellow-200 to-yellow-300">
							<div className="p-4 text-center">
								<Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-700" />
								<div className="text-3xl font-bold text-yellow-800">{stats.achievements_count}</div>
								<div className="text-sm font-medium text-yellow-700">Достижений</div>
							</div>
						</PixelCard>
					</div>

					{/* Дополнительная статистика */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
						<PixelCard>
							<div className="p-4 text-center">
								<div className="text-2xl font-bold">{stats.total_units}</div>
								<div className="text-sm text-muted-foreground">Единиц выполнено</div>
							</div>
						</PixelCard>

						<PixelCard>
							<div className="p-4 text-center">
								<div className="text-2xl font-bold">{formatDuration(stats.avg_time_per_task)}</div>
								<div className="text-sm text-muted-foreground">Среднее время на задачу</div>
							</div>
						</PixelCard>

						<PixelCard>
							<div className="p-4 text-center">
								<div className="text-2xl font-bold">{stats.most_productive_day}</div>
								<div className="text-sm text-muted-foreground">Самый продуктивный день</div>
							</div>
						</PixelCard>
					</div>

					{/* Вкладки */}
					<PixelCard>
						<div className="p-6">
							<Tabs defaultValue="achievements" className="w-full">
								<TabsList className="grid w-full grid-cols-3 border-2 border-black">
									<TabsTrigger value="achievements" className="border-2 border-black">
										🏆 Достижения
									</TabsTrigger>
									<TabsTrigger value="detailed" className="border-2 border-black">
										📊 Детальная статистика
									</TabsTrigger>
									<TabsTrigger value="prizes" className="border-2 border-black">
										🎰 Призы
									</TabsTrigger>
								</TabsList>

								<TabsContent value="achievements" className="mt-6">
									<div className="space-y-4">
										<h3 className="text-2xl font-bold flex items-center gap-2">
											<Trophy className="h-6 w-6" />
											Мои достижения
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

								<TabsContent value="detailed" className="mt-6">
									{user && <DetailedProfileStats userId={user.id} />}
								</TabsContent>
								<TabsContent value="prizes" className="mt-6">
									<PrizeShop currentCoins={stats.total_coins} onCoinsSpent={handleCoinsSpent} />
								</TabsContent>
							</Tabs>
						</div>
					</PixelCard>
				</div>
			</main>
		</AuthGuard>
	)
}
