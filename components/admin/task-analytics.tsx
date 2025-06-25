"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase, type TaskType } from "@/lib/supabase"
import { GAME_CONFIG } from "@/lib/game-config"
import { Trophy, TrendingUp, Clock, Target, Users, Award } from "lucide-react"
import { format, subWeeks, subMonths } from "date-fns"
import { ru } from "date-fns/locale"

interface TaskLeaderboardEntry {
  employee_id: string
  full_name: string
  total_units: number
  total_time: number
  total_tasks: number
  avg_time_per_unit: number
  total_coins: number
  efficiency_score: number
}

interface TaskAnalytics {
  task_id: number
  task_name: string
  total_employees: number
  total_units: number
  total_time: number
  total_tasks: number
  avg_time_per_unit: number
  total_coins_earned: number
  leaderboard: TaskLeaderboardEntry[]
  best_performer: string
  most_efficient: string
}

interface TaskTrend {
  period: string
  units: number
  time: number
  tasks: number
  employees: number
}

export default function TaskAnalytics() {
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
  const [selectedTask, setSelectedTask] = useState<string>("")
  const [timeframe, setTimeframe] = useState<string>("all")
  const [taskAnalytics, setTaskAnalytics] = useState<TaskAnalytics | null>(null)
  const [taskTrends, setTaskTrends] = useState<TaskTrend[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchTaskTypes()
  }, [])

  useEffect(() => {
    if (selectedTask) {
      fetchTaskAnalytics()
      fetchTaskTrends()
    }
  }, [selectedTask, timeframe])

  const fetchTaskTypes = async () => {
    try {
      const { data, error } = await supabase.from("task_types").select("*").order("name")

      if (error) throw error
      setTaskTypes(data || [])
      if (data && data.length > 0) {
        setSelectedTask(data[0].id.toString())
      }
    } catch (error) {
      console.error("Ошибка загрузки типов задач:", error)
    }
  }

  const getDateRange = () => {
    const now = new Date()
    switch (timeframe) {
      case "week":
        return {
          start: format(subWeeks(now, 1), "yyyy-MM-dd"),
          end: format(now, "yyyy-MM-dd"),
        }
      case "month":
        return {
          start: format(subMonths(now, 1), "yyyy-MM-dd"),
          end: format(now, "yyyy-MM-dd"),
        }
      case "3months":
        return {
          start: format(subMonths(now, 3), "yyyy-MM-dd"),
          end: format(now, "yyyy-MM-dd"),
        }
      default:
        return { start: null, end: null }
    }
  }

  const fetchTaskAnalytics = async () => {
    if (!selectedTask) return

    setLoading(true)
    try {
      const { start, end } = getDateRange()

      let query = supabase
        .from("task_logs")
        .select("employee_id, units_completed, time_spent_minutes, user_profiles(full_name)")

      if (start && end) {
        query = query.eq("task_type_id", Number.parseInt(selectedTask)).gte("work_date", start).lte("work_date", end)
      } else {
        query = query.eq("task_type_id", Number.parseInt(selectedTask))
      }

      const { data: logs, error } = await query

      if (error) throw error

      const taskType = taskTypes.find((t) => t.id.toString() === selectedTask)
      const taskName = taskType?.name || "Неизвестная задача"

      if (!logs || logs.length === 0) {
        setTaskAnalytics({
          task_id: Number.parseInt(selectedTask),
          task_name: taskName,
          total_employees: 0,
          total_units: 0,
          total_time: 0,
          total_tasks: 0,
          avg_time_per_unit: 0,
          total_coins_earned: 0,
          leaderboard: [],
          best_performer: "Нет данных",
          most_efficient: "Нет данных",
        })
        setLoading(false)
        return
      }

      // Группируем по сотрудникам
      const employeeMap = new Map<string, TaskLeaderboardEntry>()
      let totalUnits = 0
      let totalTime = 0
      let totalTasks = 0

      logs.forEach((log: any) => {
        const employeeId = log.employee_id
        const existing = employeeMap.get(employeeId) || {
          employee_id: employeeId,
          full_name: log.user_profiles.full_name,
          total_units: 0,
          total_time: 0,
          total_tasks: 0,
          avg_time_per_unit: 0,
          total_coins: 0,
          efficiency_score: 0,
        }

        existing.total_tasks += 1
        existing.total_time += log.time_spent_minutes
        existing.total_units += log.units_completed

        employeeMap.set(employeeId, existing)

        totalTasks += 1
        totalTime += log.time_spent_minutes
        totalUnits += log.units_completed
      })

      // Рассчитываем метрики для каждого сотрудника
      const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
      const leaderboard = Array.from(employeeMap.values()).map((employee) => {
        const avgTimePerUnit = employee.total_units > 0 ? employee.total_time / employee.total_units : 0
        const totalCoins = employee.total_units * coinsPerUnit
        // Эффективность = единицы / время (больше = лучше)
        const efficiencyScore = employee.total_time > 0 ? (employee.total_units / employee.total_time) * 100 : 0

        return {
          ...employee,
          avg_time_per_unit: Math.round(avgTimePerUnit),
          total_coins: totalCoins,
          efficiency_score: Math.round(efficiencyScore * 100) / 100,
        }
      })

      // Сортируем лидерборд по количеству единиц
      leaderboard.sort((a, b) => b.total_units - a.total_units)

      // Находим лучших исполнителей
      const bestPerformer = leaderboard[0]?.full_name || "Нет данных"
      const mostEfficient =
        leaderboard.length > 0
          ? leaderboard.reduce((prev, current) => (prev.efficiency_score > current.efficiency_score ? prev : current))
              .full_name
          : "Нет данных"

      setTaskAnalytics({
        task_id: Number.parseInt(selectedTask),
        task_name: taskName,
        total_employees: employeeMap.size,
        total_units: totalUnits,
        total_time: totalTime,
        total_tasks: totalTasks,
        avg_time_per_unit: totalUnits > 0 ? Math.round(totalTime / totalUnits) : 0,
        total_coins_earned: totalUnits * coinsPerUnit,
        leaderboard,
        best_performer: bestPerformer,
        most_efficient: mostEfficient,
      })
    } catch (error) {
      console.error("Ошибка загрузки аналитики задачи:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTaskTrends = async () => {
    if (!selectedTask) return

    try {
      const trends: TaskTrend[] = []
      const now = new Date()
      const periodsCount = 8
      const isWeekly = timeframe === "week" || timeframe === "all"

      for (let i = 0; i < periodsCount; i++) {
        const periodStart = isWeekly ? subWeeks(now, i + 1) : subMonths(now, i + 1)
        const periodEnd = isWeekly ? subWeeks(now, i) : subMonths(now, i)

        const { data: logs } = await supabase
          .from("task_logs")
          .select("employee_id, units_completed, time_spent_minutes")
          .eq("task_type_id", Number.parseInt(selectedTask))
          .gte("work_date", format(periodStart, "yyyy-MM-dd"))
          .lt("work_date", format(periodEnd, "yyyy-MM-dd"))

        const uniqueEmployees = new Set(logs?.map((log) => log.employee_id)).size
        const periodUnits = logs?.reduce((sum, log) => sum + log.units_completed, 0) || 0
        const periodTime = logs?.reduce((sum, log) => sum + log.time_spent_minutes, 0) || 0
        const periodTasks = logs?.length || 0

        trends.unshift({
          period: isWeekly
            ? `${format(periodStart, "dd.MM", { locale: ru })} - ${format(periodEnd, "dd.MM", { locale: ru })}`
            : format(periodStart, "LLLL", { locale: ru }),
          units: periodUnits,
          time: periodTime,
          tasks: periodTasks,
          employees: uniqueEmployees,
        })
      }

      setTaskTrends(trends)
    } catch (error) {
      console.error("Ошибка загрузки трендов задачи:", error)
    }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return "🥇"
      case 1:
        return "🥈"
      case 2:
        return "🥉"
      default:
        return `#${index + 1}`
    }
  }

  if (!selectedTask) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Выберите задачу для просмотра аналитики</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Фильтры */}
      <div className="flex gap-4">
        <Select value={selectedTask} onValueChange={setSelectedTask}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Выберите задачу" />
          </SelectTrigger>
          <SelectContent>
            {taskTypes.map((task) => (
              <SelectItem key={task.id} value={task.id.toString()}>
                {task.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все время</SelectItem>
            <SelectItem value="week">Неделя</SelectItem>
            <SelectItem value="month">Месяц</SelectItem>
            <SelectItem value="3months">3 месяца</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-4xl animate-spin mb-4">📊</div>
            <p>Загрузка аналитики...</p>
          </CardContent>
        </Card>
      ) : (
        taskAnalytics && (
          <>
            {/* Общая статистика задачи */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-6 w-6" />
                  {taskAnalytics.task_name}
                </CardTitle>
                <CardDescription>
                  Лучший исполнитель: <strong>{taskAnalytics.best_performer}</strong> • Самый эффективный:{" "}
                  <strong>{taskAnalytics.most_efficient}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                    <div className="text-2xl font-bold">{taskAnalytics.total_employees}</div>
                    <div className="text-sm text-muted-foreground">Сотрудников</div>
                  </div>

                  <div className="text-center">
                    <Target className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <div className="text-2xl font-bold">{taskAnalytics.total_units}</div>
                    <div className="text-sm text-muted-foreground">Единиц выполнено</div>
                  </div>

                  <div className="text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                    <div className="text-2xl font-bold">{formatTime(taskAnalytics.total_time)}</div>
                    <div className="text-sm text-muted-foreground">Общее время</div>
                  </div>

                  <div className="text-center">
                    <Award className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                    <div className="text-2xl font-bold">{taskAnalytics.total_coins_earned.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Монет заработано</div>
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    Среднее время: {taskAnalytics.avg_time_per_unit} мин/единица
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="leaderboard" className="space-y-4">
              <TabsList>
                <TabsTrigger value="leaderboard">Лидерборд</TabsTrigger>
                <TabsTrigger value="trends">Динамика</TabsTrigger>
              </TabsList>

              <TabsContent value="leaderboard">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      Рейтинг по задаче "{taskAnalytics.task_name}"
                    </CardTitle>
                    <CardDescription>Топ исполнителей по количеству выполненных единиц</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {taskAnalytics.leaderboard.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="text-4xl mb-2">🏆</div>
                        <div>Нет данных за выбранный период</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {taskAnalytics.leaderboard.map((entry, index) => (
                          <Card
                            key={entry.employee_id}
                            className={`border-2 ${
                              index === 0
                                ? "border-yellow-300 bg-gradient-to-r from-yellow-50 to-yellow-100"
                                : index === 1
                                  ? "border-gray-300 bg-gradient-to-r from-gray-50 to-gray-100"
                                  : index === 2
                                    ? "border-orange-300 bg-gradient-to-r from-orange-50 to-orange-100"
                                    : "border-gray-200"
                            }`}
                          >
                            <CardContent className="p-4">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                  <div className="text-2xl font-bold">{getRankIcon(index)}</div>
                                  <div>
                                    <div className="font-bold text-lg">{entry.full_name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {entry.total_tasks} задач • {formatTime(entry.total_time)} • Эффективность:{" "}
                                      {entry.efficiency_score}
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="text-2xl font-bold text-green-600">{entry.total_units} ед.</div>
                                  <div className="text-sm text-yellow-600">🪙 {entry.total_coins.toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground">{entry.avg_time_per_unit} мин/ед</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trends">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Динамика выполнения
                    </CardTitle>
                    <CardDescription>Изменение производительности команды по задаче во времени</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {taskTrends.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="text-4xl mb-2">📈</div>
                        <div>Нет данных для отображения динамики</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {taskTrends.map((trend, index) => (
                          <Card key={index} className="border">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium">{trend.period}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {trend.employees} сотрудников • {trend.tasks} задач • {formatTime(trend.time)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xl font-bold text-green-600">{trend.units} ед.</div>
                                  <div className="text-sm text-muted-foreground">
                                    {trend.time > 0 ? Math.round(trend.time / trend.units) : 0} мин/ед
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )
      )}
    </div>
  )
}
