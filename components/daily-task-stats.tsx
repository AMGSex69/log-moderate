"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { GAME_CONFIG } from "@/lib/game-config"
import { formatDuration } from "@/lib/utils"
import PixelButton from "@/components/pixel-button"
import { Calendar as CalendarIcon, Clock, Target, TrendingUp, Activity, Star, Zap, Award } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"

interface DailyTaskData {
	date: string
	tasks: TaskEntry[]
	total_tasks: number
	total_units: number
	total_time: number
	total_coins: number
	unique_task_types: number
}

interface TaskEntry {
	id: string
	task_name: string
	units_completed: number
	time_spent_minutes: number
	notes: string
	created_at: string
	coins_earned: number
}

interface DailyTaskStatsProps {
	userId: string
}

export default function DailyTaskStats({ userId }: DailyTaskStatsProps) {
	const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
	const [dailyData, setDailyData] = useState<DailyTaskData | null>(null)
	const [loading, setLoading] = useState(false)
	const [availableDates, setAvailableDates] = useState<string[]>([])

	// Получаем доступные даты для выбора
	useEffect(() => {
		if (userId) {
			fetchAvailableDates()
		}
	}, [userId])

	// Загружаем данные для выбранной даты
	useEffect(() => {
		if (userId && selectedDate) {
			fetchDailyData()
		}
	}, [userId, selectedDate])

	const fetchAvailableDates = async () => {
		try {
			const { employeeId, error: empError } = await authService.getEmployeeId(userId)
			if (empError || !employeeId) return

			const { data, error } = await supabase
				.from("task_logs")
				.select("work_date")
				.eq("employee_id", employeeId)
				.order("work_date", { ascending: false })

			if (error) throw error

			const uniqueDates = [...new Set(data?.map(log => log.work_date) || [])]
			setAvailableDates(uniqueDates)

			// Если выбранной даты нет в доступных, выбираем последнюю
			if (uniqueDates.length > 0 && !uniqueDates.includes(selectedDate)) {
				setSelectedDate(uniqueDates[0])
			}

		} catch (error) {
			console.error("Ошибка загрузки доступных дат:", error)
		}
	}

	const fetchDailyData = async () => {
		try {
			setLoading(true)

			const { employeeId, error: empError } = await authService.getEmployeeId(userId)
			if (empError || !employeeId) {
				throw new Error("Employee not found")
			}

			const { data: logs, error } = await supabase
				.from("task_logs")
				.select(`
          id,
          units_completed,
          time_spent_minutes,
          notes,
          created_at,
          task_types!inner(name)
        `)
				.eq("employee_id", employeeId)
				.eq("work_date", selectedDate)
				.order("created_at", { ascending: false })

			if (error) throw error

			if (!logs || logs.length === 0) {
				setDailyData({
					date: selectedDate,
					tasks: [],
					total_tasks: 0,
					total_units: 0,
					total_time: 0,
					total_coins: 0,
					unique_task_types: 0
				})
				return
			}

			// Обрабатываем данные
			const tasks: TaskEntry[] = logs.map((log: any) => {
				const taskName = log.task_types.name
				const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
				const coinsEarned = log.units_completed * coinsPerUnit

				return {
					id: log.id,
					task_name: taskName,
					units_completed: log.units_completed,
					time_spent_minutes: log.time_spent_minutes,
					notes: log.notes,
					created_at: log.created_at,
					coins_earned: coinsEarned
				}
			})

			const totalTasks = tasks.length
			const totalUnits = tasks.reduce((sum, task) => sum + task.units_completed, 0)
			const totalTime = tasks.reduce((sum, task) => sum + task.time_spent_minutes, 0)
			const totalCoins = tasks.reduce((sum, task) => sum + task.coins_earned, 0)
			const uniqueTaskTypes = new Set(tasks.map(task => task.task_name)).size

			setDailyData({
				date: selectedDate,
				tasks,
				total_tasks: totalTasks,
				total_units: totalUnits,
				total_time: totalTime,
				total_coins: totalCoins,
				unique_task_types: uniqueTaskTypes
			})

		} catch (error) {
			console.error("Ошибка загрузки дневных данных:", error)
		} finally {
			setLoading(false)
		}
	}

	const getDateDisplay = (date: string) => {
		const dateObj = new Date(date)
		const today = new Date()
		const yesterday = new Date(today)
		yesterday.setDate(yesterday.getDate() - 1)

		if (date === today.toISOString().split('T')[0]) {
			return "Сегодня"
		} else if (date === yesterday.toISOString().split('T')[0]) {
			return "Вчера"
		} else {
			return dateObj.toLocaleDateString('ru-RU', {
				weekday: 'long',
				day: 'numeric',
				month: 'long'
			})
		}
	}

	const getQuickDateButtons = () => {
		const today = new Date().toISOString().split('T')[0]
		const yesterday = new Date()
		yesterday.setDate(yesterday.getDate() - 1)
		const yesterdayStr = yesterday.toISOString().split('T')[0]

		return [
			{ date: today, label: "Сегодня" },
			{ date: yesterdayStr, label: "Вчера" }
		].filter(btn => availableDates.includes(btn.date))
	}

	if (loading) {
		return (
			<div className="relative">
				<div className="bg-gradient-to-br from-blue-300 to-purple-300 border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8">
					{/* Декоративные пиксели */}
					<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
					<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

					<div className="text-center">
						<div className="text-6xl mb-4 animate-bounce">📊</div>
						<div className="font-mono font-black text-2xl text-black uppercase tracking-wide">
							ЗАГРУЗКА ДАННЫХ...
						</div>
					</div>

					{/* Нижние декоративные пиксели */}
					<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
					<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
				</div>
				<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			{/* Заголовок статистики */}
			<div className="relative">
				<div className="bg-gradient-to-br from-cyan-300 to-blue-300 border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
					{/* Декоративные пиксели */}
					<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
					<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

					<div className="flex items-center gap-3">
						<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
							<CalendarIcon className="h-6 w-6 text-cyan-600" />
						</div>
						<div>
							<h3 className="font-mono font-black text-2xl text-black uppercase tracking-wide">
								СТАТИСТИКА ПО ДНЯМ
							</h3>
							<p className="font-mono text-sm text-black font-semibold">
								Анализ выполненных задач
							</p>
						</div>
					</div>

					{/* Нижние декоративные пиксели */}
					<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
					<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
				</div>
				<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
			</div>

			{/* Основной контент: календарь слева, информация справа */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Календарь слева - красивая панелька */}
				<div className="lg:col-span-1">
					<div className="relative">
						<div className="bg-gradient-to-br from-indigo-300 to-purple-300 border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
							{/* Декоративные пиксели */}
							<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
							<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

							{/* Заголовок календаря */}
							<div className="flex items-center gap-3 mb-4">
								<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
									<span className="text-xl">📅</span>
								</div>
								<div>
									<h4 className="font-mono font-black text-lg text-black uppercase tracking-wide">
										КАЛЕНДАРЬ
									</h4>
									<p className="font-mono text-sm text-black font-semibold">
										Выбор даты
									</p>
								</div>
							</div>

							{/* Быстрые кнопки */}
							<div className="mb-4 space-y-2">
								{getQuickDateButtons().map((btn) => (
									<PixelButton
										key={btn.date}
										variant={selectedDate === btn.date ? "default" : "secondary"}
										size="sm"
										onClick={() => setSelectedDate(btn.date)}
										className="w-full shadow-lg hover:shadow-xl transition-all"
									>
										<span className="text-lg mr-2">
											{btn.label === "Сегодня" ? "🌟" : "⭐"}
										</span>
										{btn.label}
									</PixelButton>
								))}
							</div>

							{/* Календарь в рамке */}
							<div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								{(() => {
									const today = new Date()
									const currentDate = new Date(selectedDate)
									const year = currentDate.getFullYear()
									const month = currentDate.getMonth()

									// Названия месяцев
									const monthNames = [
										'ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
										'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'
									]

									// Первый день месяца
									const firstDay = new Date(year, month, 1)
									// Последний день месяца
									const lastDay = new Date(year, month + 1, 0)
									// День недели первого дня (0 = воскресенье, конвертируем в понедельник = 0)
									const firstDayOfWeekJS = firstDay.getDay()
									const firstDayOfWeek = firstDayOfWeekJS === 0 ? 6 : firstDayOfWeekJS - 1
									// Количество дней в месяце
									const daysInMonth = lastDay.getDate()

									// Создаем массив недель
									const weeks = []
									let currentWeek = []

									// Добавляем пустые ячейки в начале
									for (let i = 0; i < firstDayOfWeek; i++) {
										currentWeek.push(null)
									}

									// Добавляем дни месяца
									for (let day = 1; day <= daysInMonth; day++) {
										currentWeek.push(day)

										// Если неделя заполнена (7 дней) или это последний день
										if (currentWeek.length === 7 || day === daysInMonth) {
											// Дополняем неделю пустыми ячейками если нужно
											while (currentWeek.length < 7) {
												currentWeek.push(null)
											}
											weeks.push([...currentWeek])
											currentWeek = []
										}
									}

									const isToday = (day: number) => {
										const checkDate = new Date(year, month, day)
										return checkDate.toDateString() === today.toDateString()
									}

									const isSelected = (day: number) => {
										const checkDate = new Date(year, month, day)
										return checkDate.toISOString().split('T')[0] === selectedDate
									}

									const isAvailable = (day: number) => {
										const checkDate = new Date(year, month, day)
										return availableDates.includes(checkDate.toISOString().split('T')[0])
									}

									const handleDateClick = (day: number) => {
										const clickedDate = new Date(year, month, day)
										const dateStr = clickedDate.toISOString().split('T')[0]
										if (availableDates.includes(dateStr)) {
											setSelectedDate(dateStr)
										}
									}

									const navigateMonth = (direction: number) => {
										const newDate = new Date(year, month + direction, 1)
										setSelectedDate(newDate.toISOString().split('T')[0])
									}

									return (
										<div className="w-full">
											{/* Заголовок с навигацией */}
											<div className="flex justify-between items-center mb-3 relative">
												<button
													onClick={() => navigateMonth(-1)}
													className="h-7 w-7 bg-blue-500 hover:bg-blue-600 text-white border-2 border-black font-mono font-bold transition-colors shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
												>
													‹
												</button>
												<div className="text-sm font-mono font-black text-black uppercase bg-gray-200 border border-black px-2 py-1">
													{monthNames[month]} {year}
												</div>
												<button
													onClick={() => navigateMonth(1)}
													className="h-7 w-7 bg-blue-500 hover:bg-blue-600 text-white border-2 border-black font-mono font-bold transition-colors shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
												>
													›
												</button>
											</div>

											{/* Таблица календаря */}
											<table className="w-full border-collapse border-2 border-black">
												{/* Заголовки дней недели */}
												<thead>
													<tr>
														{['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map((day, index) => (
															<th key={index} className="text-xs font-mono font-black text-center p-2 border border-black bg-gray-200 text-black uppercase">
																{day}
															</th>
														))}
													</tr>
												</thead>

												{/* Недели */}
												<tbody>
													{weeks.map((week, weekIndex) => (
														<tr key={weekIndex}>
															{week.map((day, dayIndex) => (
																<td key={dayIndex} className="border border-black p-0 h-9 hover:bg-blue-100 transition-colors">
																	{day && (
																		<button
																			onClick={() => handleDateClick(day)}
																			disabled={!isAvailable(day)}
																			className={`
																				w-full h-full font-mono font-bold transition-all duration-200 flex items-center justify-center
																				${isSelected(day)
																					? 'bg-blue-600 text-white font-black border-2 border-yellow-400 shadow-[2px_2px_0px_0px_rgba(255,255,0,0.5)]'
																					: isToday(day)
																						? 'bg-yellow-400 text-black font-black border-2 border-orange-500 shadow-[1px_1px_0px_0px_rgba(255,165,0,0.7)]'
																						: isAvailable(day)
																							? 'hover:bg-blue-200 focus:bg-blue-300'
																							: 'text-gray-300 bg-gray-100 cursor-not-allowed opacity-30'
																				}
																			`}
																		>
																			{day}
																		</button>
																	)}
																</td>
															))}
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)
								})()}
							</div>

							{/* Нижние декоративные пиксели */}
							<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
							<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
						</div>
						<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
					</div>
				</div>

				{/* Информация справа */}
				<div className="lg:col-span-2 space-y-6">

					{/* Данные за выбранный день */}
					{dailyData && (
						<>
							{/* Общая статистика дня - пиксельный стиль */}
							<div className="relative">
								<div className="bg-gradient-to-br from-green-300 to-emerald-300 border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
									{/* Декоративные пиксели */}
									<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
									<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

									<div className="flex items-center gap-3 mb-6">
										<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
											<span className="text-3xl">
												{getDateDisplay(dailyData.date) === "Сегодня" ? "🌟" :
													getDateDisplay(dailyData.date) === "Вчера" ? "⭐" : "📅"}
											</span>
										</div>
										<div>
											<h4 className="font-mono font-black text-2xl text-black uppercase tracking-wide">
												{getDateDisplay(dailyData.date)}
											</h4>
											<p className="font-mono text-sm text-black font-semibold">
												Результаты за день
											</p>
										</div>
									</div>

									{dailyData.total_tasks === 0 ? (
										<div className="bg-black border-2 border-white p-8 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-center">
											<div className="text-6xl mb-4">😴</div>
											<div className="font-mono font-black text-2xl text-white mb-2 uppercase">НЕТ ДАННЫХ</div>
											<div className="font-mono text-lg text-gray-300">В этот день задачи не выполнялись</div>
										</div>
									) : (
										<>
											{/* Основные метрики - пиксельный стиль */}
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
												{/* Задач выполнено */}
												<div className="bg-blue-400 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-4 text-center">
													<div className="flex items-center justify-center mb-2">
														<Target className="h-6 w-6 text-white mr-2" />
													</div>
													<div className="font-mono font-black text-3xl text-white">{dailyData.total_tasks}</div>
													<div className="font-mono text-sm text-white font-semibold uppercase">ЗАДАЧ</div>
												</div>

												{/* Единиц завершено */}
												<div className="bg-green-400 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-4 text-center">
													<div className="flex items-center justify-center mb-2">
														<TrendingUp className="h-6 w-6 text-white mr-2" />
													</div>
													<div className="font-mono font-black text-3xl text-white">{dailyData.total_units}</div>
													<div className="font-mono text-sm text-white font-semibold uppercase">ЕДИНИЦ</div>
												</div>

												{/* Время работы */}
												<div className="bg-orange-400 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-4 text-center">
													<div className="flex items-center justify-center mb-2">
														<Clock className="h-6 w-6 text-white mr-2" />
													</div>
													<div className="font-mono font-black text-xl text-white">{formatDuration(dailyData.total_time)}</div>
													<div className="font-mono text-sm text-white font-semibold uppercase">ВРЕМЕНИ</div>
												</div>

												{/* Очки */}
												<div className="bg-purple-400 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-4 text-center">
													<div className="flex items-center justify-center mb-2">
														<Award className="h-6 w-6 text-white mr-2" />
													</div>
													<div className="font-mono font-black text-3xl text-white">{dailyData.total_coins}</div>
													<div className="font-mono text-sm text-white font-semibold uppercase">ОЧКОВ</div>
												</div>
											</div>

											{/* Дополнительная статистика */}
											<div className="bg-white border-2 border-black p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-wrap justify-center gap-4">
												<div className="bg-yellow-300 border-2 border-black px-3 py-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
													<span className="font-mono font-black text-black text-sm uppercase">
														<Star className="h-4 w-4 inline mr-1" />
														{dailyData.unique_task_types} ТИПОВ ЗАДАЧ
													</span>
												</div>
												<div className="bg-cyan-300 border-2 border-black px-3 py-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
													<span className="font-mono font-black text-black text-sm uppercase">
														<Zap className="h-4 w-4 inline mr-1" />
														{Math.round(dailyData.total_time / dailyData.total_tasks)} МИН/ЗАДАЧА
													</span>
												</div>
											</div>
										</>
									)}

									{/* Нижние декоративные пиксели */}
									<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
									<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
								</div>
								<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
							</div>

							{/* Список задач за день - пиксельный стиль */}
							{dailyData.tasks.length > 0 && (
								<div className="relative">
									<div className="bg-gradient-to-br from-purple-300 to-pink-300 border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
										{/* Декоративные пиксели */}
										<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
										<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

										<div className="flex items-center gap-3 mb-6">
											<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
												<Activity className="h-6 w-6 text-purple-600" />
											</div>
											<div>
												<h4 className="font-mono font-black text-2xl text-black uppercase tracking-wide">
													ВЫПОЛНЕННЫЕ ЗАДАЧИ
												</h4>
												<p className="font-mono text-sm text-black font-semibold">
													Всего: {dailyData.tasks.length} задач
												</p>
											</div>
										</div>

										<div className="space-y-4 max-h-96 overflow-y-auto">
											{dailyData.tasks.map((task, index) => (
												<div key={task.id} className="bg-white border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-4 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all duration-100">
													<div className="flex items-center justify-between">
														<div className="flex-1">
															<div className="flex items-center gap-3 mb-2">
																<div className="bg-black text-white font-mono font-black text-sm px-2 py-1 border-2 border-black">
																	#{index + 1}
																</div>
																<div className="font-mono font-black text-lg text-black uppercase">{task.task_name}</div>
															</div>
															<div className="flex items-center gap-6 mb-2">
																<span className="bg-blue-200 border border-black px-2 py-1 font-mono text-sm font-semibold">
																	<Target className="h-4 w-4 inline mr-1" />
																	{task.units_completed} ед.
																</span>
																<span className="bg-orange-200 border border-black px-2 py-1 font-mono text-sm font-semibold">
																	<Clock className="h-4 w-4 inline mr-1" />
																	{formatDuration(task.time_spent_minutes)}
																</span>
																<span className="bg-gray-200 border border-black px-2 py-1 font-mono text-sm font-semibold">
																	⏰ {new Date(task.created_at).toLocaleTimeString('ru-RU', {
																		hour: '2-digit',
																		minute: '2-digit'
																	})}
																</span>
															</div>
															{task.notes && (
																<div className="bg-yellow-200 border border-black p-2 mt-2 font-mono text-sm">
																	💬 {task.notes}
																</div>
															)}
														</div>
														<div className="text-right ml-4">
															<div className="bg-green-400 border-2 border-black p-2 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-center">
																<div className="font-mono font-black text-xl text-white">
																	+{task.coins_earned}
																</div>
																<div className="font-mono text-sm text-white">🪙</div>
															</div>
															<div className="font-mono text-xs text-gray-600 mt-1 text-center">
																{Math.round(task.time_spent_minutes / task.units_completed)} мин/ед.
															</div>
														</div>
													</div>
												</div>
											))}
										</div>

										{/* Нижние декоративные пиксели */}
										<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
										<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
									</div>
									<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	)
} 