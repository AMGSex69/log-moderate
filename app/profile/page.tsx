"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import PrizeWheel from "@/components/prize-wheel"
import AvatarUpload from "@/components/avatar-upload"
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

interface LeaderboardEntry {
	name: string
	score: number
	rank: number
	is_current_user: boolean
}

interface OfficeStats {
	office_name: string
	total_employees: number
	working_employees: number
	total_hours_today: number
	avg_hours_today: number
}

interface ProfileData {
	full_name: string
	position: string
	email: string
	office_name: string
	avatar_url?: string
}

export default function ProfilePage() {
	const { user, profile } = useAuth()
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
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
	const [officeStats, setOfficeStats] = useState<OfficeStats>({
		office_name: "Загрузка...",
		total_employees: 0,
		working_employees: 0,
		total_hours_today: 0,
		avg_hours_today: 0
	})
	const [profileData, setProfileData] = useState<ProfileData>({
		full_name: "",
		position: "",
		email: "",
		office_name: "",
		avatar_url: ""
	})
	const [editingProfile, setEditingProfile] = useState(false)
	const [loading, setLoading] = useState(true)
	const [showWheel, setShowWheel] = useState(false)

	useEffect(() => {
		if (user) {
			fetchAllProfileData()
		}
	}, [user])

	const fetchAllProfileData = async () => {
		if (!user) return

		try {
			await Promise.all([
				fetchUserStats(),
				fetchTaskHistory(),
				fetchLeaderboard(),
				fetchOfficeStats(),
				fetchProfileInfo()
			])
		} catch (error) {
			console.error("Ошибка загрузки данных профиля:", error)
		} finally {
			setLoading(false)
		}
	}

	const fetchUserStats = async () => {
		const { employeeId, error: empError } = await authService.getEmployeeId(user!.id)
		if (empError || !employeeId) return

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

		const { data, error } = await supabase
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

	const fetchLeaderboard = async () => {
		try {
			const { data, error } = await supabase
				.rpc('get_leaderboard_with_current_user', {
					current_user_id: user!.id
				})

			if (error) throw error

			const leaderboardData = (data || []).map((leader: any) => ({
				name: leader.name,
				score: parseFloat(leader.score) || 0,
				rank: leader.rank,
				is_current_user: leader.is_current_user,
			}))

			setLeaderboard(leaderboardData)
		} catch (error) {
			console.error("Ошибка загрузки лидерборда:", error)
			setLeaderboard([])
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

	const fetchProfileInfo = async () => {
		if (!profile) return

		setProfileData({
			full_name: profile.full_name || "",
			position: profile.position || "Сотрудник",
			email: user!.email || "",
			office_name: profile.office_name || "Не указан",
			avatar_url: profile.avatar_url || ""
		})
	}

	const handleSaveProfile = async () => {
		try {
			const { error } = await authService.updateProfile(user!.id, {
				full_name: profileData.full_name,
				position: profileData.position,
			})

			if (error) throw error

			toast({
				title: "✅ Профиль обновлен",
				description: "Изменения сохранены успешно",
			})
			setEditingProfile(false)
		} catch (error) {
			console.error("Ошибка обновления профиля:", error)
			toast({
				title: "❌ Ошибка",
				description: "Не удалось обновить профиль",
				variant: "destructive",
			})
		}
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

					{/* Заголовок профиля */}
					<PixelCard className="bg-gradient-to-r from-indigo-200 to-purple-200">
						<div className="p-6">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-4">
									<Avatar className="h-16 w-16 border-4 border-black">
										<AvatarImage src={profileData.avatar_url} />
										<AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white text-xl font-bold">
											{profileData.full_name.split(' ').map(n => n[0]).join('').toUpperCase() || 'П'}
										</AvatarFallback>
									</Avatar>
									<div>
										<h1 className="text-3xl font-bold">{profileData.full_name || "Загрузка..."}</h1>
										<p className="text-lg text-muted-foreground">{profileData.position}</p>
										<p className="text-sm text-muted-foreground">📧 {profileData.email}</p>
										<p className="text-sm text-muted-foreground">🏢 {profileData.office_name}</p>
									</div>
								</div>
								<div className="text-right">
									<LevelDisplay coins={stats.total_coins} />
									<div className="mt-2">
										<CoinDisplay coins={stats.total_coins} animated />
									</div>
								</div>
							</div>
						</div>
					</PixelCard>

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
								<TabsList className="grid w-full grid-cols-5 border-2 border-black">
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
									<TabsTrigger value="profile" className="border-2 border-black text-xs md:text-sm">
										👤 Профиль
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
												Лидерборд офиса
											</h3>

											{leaderboard.length > 0 ? (
												<div className="space-y-2">
													{leaderboard.map((entry, index) => (
														<div
															key={index}
															className={`flex items-center justify-between p-3 rounded border-2 ${entry.is_current_user
																? "bg-gradient-to-r from-yellow-200 to-yellow-300 border-yellow-500"
																: "bg-white border-black"
																}`}
														>
															<div className="flex items-center gap-3">
																<div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${entry.rank === 1 ? "bg-yellow-500" :
																	entry.rank === 2 ? "bg-gray-400" :
																		entry.rank === 3 ? "bg-orange-500" : "bg-gray-600"
																	}`}>
																	{entry.rank}
																</div>
																<div>
																	<div className="font-semibold">
																		{entry.is_current_user ? "🌟 " + entry.name + " (Вы)" : entry.name}
																	</div>
																</div>
															</div>
															<div className="text-right">
																<div className="font-bold">{entry.score.toFixed(1)} ч</div>
															</div>
														</div>
													))}
												</div>
											) : (
												<div className="text-center py-8">
													<div className="text-4xl mb-2">📊</div>
													<div className="text-lg font-semibold">Лидерборд пуст</div>
													<div className="text-muted-foreground">Пока нет данных по офису</div>
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

								{/* Вкладка "Профиль" */}
								<TabsContent value="profile" className="mt-6">
									<div className="space-y-6">
										<div className="flex items-center justify-between">
											<h3 className="text-2xl font-bold flex items-center gap-2">
												👤 Редактирование профиля
											</h3>
											<PixelButton
												onClick={() => setEditingProfile(!editingProfile)}
												variant={editingProfile ? "secondary" : "primary"}
											>
												{editingProfile ? "Отменить" : <><Edit className="h-4 w-4 mr-2" />Редактировать</>}
											</PixelButton>
										</div>

										<PixelCard>
											<div className="p-6 space-y-6">
												{/* Аватар */}
												<div>
													<Label>Аватар</Label>
													<div className="mt-2">
														<AvatarUpload
															currentUrl={profileData.avatar_url || ''}
															fullName={profileData.full_name}
															onAvatarChange={(newUrl) => setProfileData(prev => ({ ...prev, avatar_url: newUrl }))}
														/>
													</div>
												</div>

												{/* ФИО */}
												<div className="space-y-2">
													<Label htmlFor="fullname">Полное имя</Label>
													{editingProfile ? (
														<Input
															id="fullname"
															value={profileData.full_name}
															onChange={(e) => setProfileData(prev => ({
																...prev,
																full_name: e.target.value
															}))}
															placeholder="Иванов Иван Иванович"
														/>
													) : (
														<div className="p-3 bg-gray-50 border border-gray-200 rounded">
															{profileData.full_name || "Не указано"}
														</div>
													)}
												</div>

												{/* Должность */}
												<div className="space-y-2">
													<Label htmlFor="position">Должность</Label>
													{editingProfile ? (
														<Input
															id="position"
															value={profileData.position}
															onChange={(e) => setProfileData(prev => ({
																...prev,
																position: e.target.value
															}))}
															placeholder="Специалист"
														/>
													) : (
														<div className="p-3 bg-gray-50 border border-gray-200 rounded">
															{profileData.position}
														</div>
													)}
												</div>

												{/* Email (только чтение) */}
												<div className="space-y-2">
													<Label htmlFor="email">Email (только чтение)</Label>
													<div className="p-3 bg-gray-100 border border-gray-300 rounded text-gray-600">
														{profileData.email}
													</div>
													<p className="text-xs text-muted-foreground">
														Email может изменить только администратор
													</p>
												</div>

												{/* Офис (только чтение) */}
												<div className="space-y-2">
													<Label htmlFor="office">Офис (только чтение)</Label>
													<div className="p-3 bg-gray-100 border border-gray-300 rounded text-gray-600">
														{profileData.office_name}
													</div>
													<p className="text-xs text-muted-foreground">
														Офис может изменить только администратор
													</p>
												</div>

												{editingProfile && (
													<div className="flex gap-4">
														<PixelButton onClick={handleSaveProfile}>
															Сохранить изменения
														</PixelButton>
														<PixelButton
															variant="secondary"
															onClick={() => {
																setEditingProfile(false)
																fetchProfileInfo() // Сбрасываем изменения
															}}
														>
															Отменить
														</PixelButton>
													</div>
												)}
											</div>
										</PixelCard>
									</div>
								</TabsContent>
							</Tabs>
						</div>
					</PixelCard>
				</div>
			</main>
		</AuthGuard>
	)
}
