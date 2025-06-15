"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { GAME_CONFIG, calculateLevel } from "@/lib/game-config"
import PixelCard from "@/components/pixel-card"
import PixelButton from "@/components/pixel-button"
import LevelDisplay from "@/components/level-display"
import CoinDisplay from "@/components/coin-display"
import { User, Mail, Building, Calendar, Clock, Trophy, Target, Star, Award } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { ru } from "date-fns/locale"

interface UserProfileData {
	id: string
	full_name: string
	position: string
	email?: string
	office_name?: string
	avatar_url?: string
	work_schedule?: string
	work_hours?: number
	is_online?: boolean
	last_seen?: string
	created_at: string
	total_tasks?: number
	total_units?: number
	total_coins?: number
	level?: number
	current_streak?: number
	best_tasks?: Array<{
		task_name: string
		units_count: number
		rank_position: number
	}>
}

interface UserProfileModalProps {
	userId: string | null
	isOpen: boolean
	onClose: () => void
	showFullStats?: boolean // Показывать ли полную статистику или только базовую информацию
}

export default function UserProfileModal({
	userId,
	isOpen,
	onClose,
	showFullStats = false
}: UserProfileModalProps) {
	const [userData, setUserData] = useState<UserProfileData | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (isOpen && userId) {
			fetchUserData()
		}
	}, [isOpen, userId])

	const fetchUserData = async () => {
		if (!userId) return

		setLoading(true)
		setError(null)

		try {
			// ВРЕМЕННОЕ РЕШЕНИЕ: Используем данные из таблицы employees + auth.users
			console.log("🔍 Загружаем данные пользователя из employees...")

			// Получаем данные сотрудника по user_id
			const { data: employeeData, error: employeeError } = await supabase
				.from("employees")
				.select(`
          id,
          full_name,
          position,
          user_id,
          office_id,
          work_schedule,
          work_hours,
          is_online,
          last_seen,
          created_at,
          offices(name)
        `)
				.eq("user_id", userId)
				.single()

			if (employeeError || !employeeData) {
				throw new Error(`Сотрудник не найден: ${employeeError?.message || 'Неизвестная ошибка'}`)
			}

			// Формируем данные профиля из данных сотрудника
			const profileData = {
				id: employeeData.user_id,
				full_name: employeeData.full_name,
				position: employeeData.position,
				avatar_url: undefined, // Пока нет в таблице employees
				work_schedule: employeeData.work_schedule,
				work_hours: employeeData.work_hours,
				is_online: employeeData.is_online,
				last_seen: employeeData.last_seen,
				created_at: employeeData.created_at,
				offices: employeeData.offices
			}

			console.log("✅ Данные пользователя загружены из employees:", profileData)

			// Получаем email из auth.users (только для супер-админа или для собственного профиля)
			const { data: { user: currentUser } } = await supabase.auth.getUser()
			let userEmail = null

			try {
				if (currentUser?.id === userId || currentUser?.email === 'egordolgih@mail.ru') {
					// Используем более безопасный способ получения email
					if (currentUser?.id === userId) {
						userEmail = currentUser.email
					} else {
						// Для админа попробуем получить через admin API
						const { data: authData } = await supabase.auth.admin.getUserById(userId)
						userEmail = authData.user?.email
					}
				}
			} catch (emailError) {
				console.log("Email access restricted:", emailError)
				// Не критично, просто не показываем email
			}

			// Если включена полная статистика, получаем дополнительные данные
			let stats = null
			if (showFullStats) {
				stats = await fetchUserStats(userId)
			}

			const userData: UserProfileData = {
				id: profileData.id,
				full_name: profileData.full_name,
				position: profileData.position,
				email: userEmail || undefined,
				office_name: (profileData.offices as any)?.name || 'Не указан',
				avatar_url: profileData.avatar_url,
				work_schedule: profileData.work_schedule,
				work_hours: profileData.work_hours,
				is_online: profileData.is_online,
				last_seen: profileData.last_seen,
				created_at: profileData.created_at,
				...stats
			}

			setUserData(userData)
		} catch (err: any) {
			console.error("❌ Database error loading profile:", err)
			setError(err.message || "Ошибка загрузки данных профиля")
			setUserData(null) // Сбрасываем данные при ошибке
		} finally {
			setLoading(false)
		}
	}

	const fetchUserStats = async (userId: string) => {
		try {
			// Получаем employee_id
			const { data: employeeData } = await supabase
				.from("employees")
				.select("id")
				.eq("user_id", userId)
				.single()

			if (!employeeData) return null

			// Получаем статистику задач
			const { data: taskLogs } = await supabase
				.from("task_logs")
				.select(`
          units_completed,
          time_spent_minutes,
          work_date,
          task_types(name)
        `)
				.eq("employee_id", employeeData.id)
				.order("work_date", { ascending: false })

			if (!taskLogs) return null

			const totalTasks = taskLogs.length
			const totalUnits = taskLogs.reduce((sum, log) => sum + log.units_completed, 0)

			// Рассчитываем общие монеты
			let totalCoins = 0
			taskLogs.forEach((log: any) => {
				const taskName = log.task_types?.name
				const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
				totalCoins += log.units_completed * coinsPerUnit
			})

			// Рассчитываем уровень
			const levelInfo = calculateLevel(totalCoins)

			// Рассчитываем текущий стрим
			const currentStreak = calculateCurrentStreak(taskLogs)

			// Находим лучшие задачи
			const taskStats = new Map<string, number>()
			taskLogs.forEach((log: any) => {
				const taskName = log.task_types?.name
				if (taskName) {
					taskStats.set(taskName, (taskStats.get(taskName) || 0) + log.units_completed)
				}
			})

			const bestTasks = Array.from(taskStats.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, 3)
				.map(([taskName, units], index) => ({
					task_name: taskName,
					units_count: units,
					rank_position: index + 1
				}))

			return {
				total_tasks: totalTasks,
				total_units: totalUnits,
				total_coins: totalCoins,
				level: levelInfo.level,
				current_streak: currentStreak,
				best_tasks: bestTasks
			}
		} catch (error) {
			console.error("Ошибка загрузки статистики:", error)
			return null
		}
	}

	const calculateCurrentStreak = (logs: any[]) => {
		if (!logs || logs.length === 0) return 0

		const uniqueDates = [...new Set(logs.map(log => log.work_date))].sort().reverse()
		let streak = 0
		let currentDate = new Date()
		currentDate.setHours(0, 0, 0, 0)

		for (const dateStr of uniqueDates) {
			const logDate = new Date(dateStr)
			logDate.setHours(0, 0, 0, 0)

			const diffDays = Math.floor((currentDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24))

			if (diffDays === streak) {
				streak++
			} else {
				break
			}
		}

		return streak
	}

	const getInitials = (name: string) => {
		return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
	}

	const getOnlineStatus = () => {
		if (!userData?.is_online) {
			if (userData?.last_seen) {
				const lastSeen = new Date(userData.last_seen)
				return `Был в сети ${formatDistanceToNow(lastSeen, { addSuffix: true, locale: ru })}`
			}
			return "Не в сети"
		}
		return "В сети"
	}

	if (!isOpen) return null

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-purple-100 to-pink-100 border-4 border-black">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 font-mono font-black text-xl">
						<User className="h-5 w-5" />
						ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
					</DialogTitle>
				</DialogHeader>

				{loading ? (
					<div className="flex items-center justify-center py-12">
						<div className="text-center">
							<div className="text-4xl animate-spin mb-4">⚡</div>
							<div className="font-mono">Загрузка профиля...</div>
						</div>
					</div>
				) : error ? (
					<div className="text-center py-12">
						<div className="text-4xl mb-4">❌</div>
						<div className="font-mono text-red-600 mb-2">{error}</div>
						<div className="text-sm text-gray-600 mb-4">
							Попробуйте обновить страницу или обратитесь к администратору
						</div>
						<PixelButton onClick={onClose} className="mt-4">
							Закрыть
						</PixelButton>
					</div>
				) : userData ? (
					<div className="space-y-6">
						{/* Шапка профиля */}
						<PixelCard className="bg-gradient-to-r from-blue-200 to-purple-200">
							<div className="p-6">
								<div className="flex items-start gap-6">
									{/* Аватар */}
									<div className="relative">
										<Avatar className="w-20 h-20 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
											<AvatarImage src={userData.avatar_url} alt={userData.full_name} />
											<AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400 text-white font-bold text-xl">
												{getInitials(userData.full_name)}
											</AvatarFallback>
										</Avatar>
										{/* Статус онлайн */}
										<div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${userData.is_online ? 'bg-green-500' : 'bg-gray-400'
											}`} />
									</div>

									{/* Основная информация */}
									<div className="flex-1">
										<h2 className="text-2xl font-bold mb-2">{userData.full_name}</h2>
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<Badge variant="outline" className="bg-white">
													{userData.position}
												</Badge>
												<Badge variant="outline" className="bg-yellow-100">
													<Building className="w-3 h-3 mr-1" />
													{userData.office_name}
												</Badge>
											</div>

											{userData.email && (
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													<Mail className="w-4 h-4" />
													{userData.email}
												</div>
											)}

											<div className="flex items-center gap-2 text-sm text-muted-foreground">
												<Clock className="w-4 h-4" />
												{getOnlineStatus()}
											</div>

											{userData.work_schedule && (
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													<Calendar className="w-4 h-4" />
													График: {userData.work_schedule} ({userData.work_hours}ч/день)
												</div>
											)}
										</div>
									</div>

									{/* Уровень и монеты (если есть статистика) */}
									{showFullStats && userData.level && (
										<div className="text-right">
											<div className="mb-2">
												<LevelDisplay
													coins={userData.total_coins || 0}
												/>
											</div>
											<CoinDisplay
												coins={userData.total_coins || 0}
											/>
										</div>
									)}
								</div>
							</div>
						</PixelCard>

						{/* Вкладки с детальной информацией */}
						{showFullStats && userData.total_tasks ? (
							<Tabs defaultValue="stats" className="w-full">
								<TabsList className="grid w-full grid-cols-2">
									<TabsTrigger value="stats">Статистика</TabsTrigger>
									<TabsTrigger value="achievements">Достижения</TabsTrigger>
								</TabsList>

								<TabsContent value="stats" className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<PixelCard className="bg-gradient-to-r from-green-200 to-blue-200">
											<div className="p-4 text-center">
												<Target className="w-8 h-8 mx-auto mb-2 text-green-600" />
												<div className="text-2xl font-bold">{userData.total_tasks}</div>
												<div className="text-sm text-muted-foreground">Всего задач</div>
											</div>
										</PixelCard>

										<PixelCard className="bg-gradient-to-r from-yellow-200 to-orange-200">
											<div className="p-4 text-center">
												<Star className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
												<div className="text-2xl font-bold">{userData.total_units}</div>
												<div className="text-sm text-muted-foreground">Единиц выполнено</div>
											</div>
										</PixelCard>

										<PixelCard className="bg-gradient-to-r from-purple-200 to-pink-200">
											<div className="p-4 text-center">
												<Trophy className="w-8 h-8 mx-auto mb-2 text-purple-600" />
												<div className="text-2xl font-bold">{userData.current_streak}</div>
												<div className="text-sm text-muted-foreground">Дней подряд</div>
											</div>
										</PixelCard>

										<PixelCard className="bg-gradient-to-r from-red-200 to-pink-200">
											<div className="p-4 text-center">
												<Award className="w-8 h-8 mx-auto mb-2 text-red-600" />
												<div className="text-2xl font-bold">#{userData.level}</div>
												<div className="text-sm text-muted-foreground">Уровень</div>
											</div>
										</PixelCard>
									</div>

									{/* Лучшие задачи */}
									{userData.best_tasks && userData.best_tasks.length > 0 && (
										<PixelCard>
											<div className="p-4">
												<h3 className="font-bold mb-3 flex items-center gap-2">
													<Trophy className="w-5 h-5" />
													Лучшие задачи
												</h3>
												<div className="space-y-2">
													{userData.best_tasks.map((task) => (
														<div
															key={task.task_name}
															className="flex items-center justify-between p-2 bg-white rounded border-2 border-black"
														>
															<div className="font-medium">{task.task_name}</div>
															<div className="flex items-center gap-2">
																<Badge variant="secondary">
																	{task.units_count} единиц
																</Badge>
																<div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${task.rank_position === 1 ? 'bg-yellow-500' :
																	task.rank_position === 2 ? 'bg-gray-400' : 'bg-orange-500'
																	}`}>
																	{task.rank_position}
																</div>
															</div>
														</div>
													))}
												</div>
											</div>
										</PixelCard>
									)}
								</TabsContent>

								<TabsContent value="achievements">
									<PixelCard>
										<div className="p-6 text-center">
											<Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
											<h3 className="text-xl font-bold mb-2">Достижения</h3>
											<p className="text-muted-foreground">
												Система достижений будет добавлена в следующих обновлениях
											</p>
										</div>
									</PixelCard>
								</TabsContent>
							</Tabs>
						) : (
							<PixelCard>
								<div className="p-4 text-center">
									<div className="text-sm text-muted-foreground">
										Зарегистрирован: {format(new Date(userData.created_at), 'dd MMMM yyyy', { locale: ru })}
									</div>
								</div>
							</PixelCard>
						)}

						{/* Кнопка закрытия */}
						<div className="flex justify-center">
							<PixelButton onClick={onClose} variant="secondary">
								Закрыть
							</PixelButton>
						</div>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	)
} 