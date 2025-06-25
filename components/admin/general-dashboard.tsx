"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabase } from "@/lib/supabase"
import { GAME_CONFIG } from "@/lib/game-config"
import {
  BarChart3,
  CalendarIcon,
  Download,
  TrendingUp,
  Users,
  Clock,
  Target,
  Award,
  Activity,
  Zap,
  Trophy,
} from "lucide-react"
import { format, subWeeks, subMonths } from "date-fns"
import { ru } from "date-fns/locale"
import * as XLSX from "xlsx"

interface DashboardStats {
  total_employees: number
  active_employees_today: number
  total_tasks_today: number
  total_tasks_period: number
  total_units_today: number
  total_units_period: number
  total_time_today: number
  total_time_period: number
  total_coins_period: number
  avg_tasks_per_employee: number
  avg_time_per_task: number
  most_productive_employee: string
  most_popular_task: string
  most_productive_group: string
}

interface TopPerformer {
  employee_id: string
  full_name: string
  total_tasks: number
  total_units: number
  total_time: number
  total_coins: number
  efficiency_score: number
}

interface TaskGroupStats {
  group_name: string
  total_tasks: number
  total_units: number
  total_time: number
  total_coins: number
  unique_performers: number
  avg_time_per_unit: number
}

interface DailyTrend {
  date: string
  total_tasks: number
  total_units: number
  total_time: number
  active_employees: number
}

export default function GeneralDashboard() {
  const [period, setPeriod] = useState<string>("day")
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date())
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date())
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([])
  const [groupStats, setGroupStats] = useState<TaskGroupStats[]>([])
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [period, customStartDate, customEndDate])

  const getDateRange = () => {
    const now = new Date()
    switch (period) {
      case "day":
        return {
          start: format(now, "yyyy-MM-dd"),
          end: format(now, "yyyy-MM-dd"),
        }
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
      case "custom":
        return {
          start: format(customStartDate, "yyyy-MM-dd"),
          end: format(customEndDate, "yyyy-MM-dd"),
        }
      default:
        return {
          start: format(now, "yyyy-MM-dd"),
          end: format(now, "yyyy-MM-dd"),
        }
    }
  }

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const today = format(new Date(), "yyyy-MM-dd")

      // Параллельно загружаем все данные
      const [generalStatsResult, topPerformersResult, groupStatsResult, dailyTrendsResult] = await Promise.all([
        fetchGeneralStats(start, end, today),
        fetchTopPerformers(start, end),
        fetchGroupStats(start, end),
        fetchDailyTrends(start, end),
      ])

      setStats(generalStatsResult)
      setTopPerformers(topPerformersResult)
      setGroupStats(groupStatsResult)
      setDailyTrends(dailyTrendsResult)
    } catch (error) {
      console.error("Ошибка загрузки данных дашборда:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchGeneralStats = async (start: string, end: string, today: string): Promise<DashboardStats> => {
    // Общее количество активных сотрудников
    const { data: employees } = await supabase.from("user_profiles").select("id").not("employee_id", "is", null)

    // Активные сотрудники сегодня (с задачами или рабочими сессиями)
    const { data: todayActive } = await supabase.from("task_logs").select("employee_id").eq("work_date", today)

    const { data: todayWorkSessions } = await supabase
      .from("work_sessions")
      .select("employee_id")
      .eq("date", today)
      .not("clock_in_time", "is", null)

    const activeToday = new Set([
      ...(todayActive?.map((t) => t.employee_id) || []),
      ...(todayWorkSessions?.map((w) => w.employee_id) || []),
    ]).size

    // Задачи за сегодня
    const { data: todayTasks } = await supabase
      .from("task_logs")
      .select("units_completed, time_spent_minutes, task_types(name)")
      .eq("work_date", today)

    // Задачи за период
    const { data: periodTasks } = await supabase
      .from("task_logs")
      .select("employee_id, units_completed, time_spent_minutes, task_types(name)")
      .gte("work_date", start)
      .lte("work_date", end)

    const totalTasksToday = todayTasks?.length || 0
    const totalTasksPeriod = periodTasks?.length || 0
    const totalUnitsToday = todayTasks?.reduce((sum, t) => sum + t.units_completed, 0) || 0
    const totalUnitsPeriod = periodTasks?.reduce((sum, t) => sum + t.units_completed, 0) || 0
    const totalTimeToday = todayTasks?.reduce((sum, t) => sum + t.time_spent_minutes, 0) || 0
    const totalTimePeriod = periodTasks?.reduce((sum, t) => sum + t.time_spent_minutes, 0) || 0

    // Рассчитываем монеты за период
    let totalCoinsPeriod = 0
    periodTasks?.forEach((task: any) => {
      const taskName = task.task_types?.name
      const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
      totalCoinsPeriod += task.units_completed * coinsPerUnit
    })

    // Находим самого продуктивного сотрудника
    const employeeStats = new Map<string, { units: number; name: string }>()
    for (const task of periodTasks || []) {
      const existing = employeeStats.get(task.employee_id) || { units: 0, name: "" }
      existing.units += task.units_completed
      employeeStats.set(task.employee_id, existing)
    }

    // Получаем имена сотрудников
    if (employeeStats.size > 0) {
      const { data: employeeNames } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", Array.from(employeeStats.keys()))

      employeeNames?.forEach((emp) => {
        const stats = employeeStats.get(emp.id)
        if (stats) {
          stats.name = emp.full_name
        }
      })
    }

    const mostProductiveEmployee =
      Array.from(employeeStats.values()).sort((a, b) => b.units - a.units)[0]?.name || "Нет данных"

    // Самая популярная задача
    const taskCounts = new Map<string, number>()
    periodTasks?.forEach((task: any) => {
      const taskName = task.task_types?.name
      if (taskName) {
        taskCounts.set(taskName, (taskCounts.get(taskName) || 0) + 1)
      }
    })

    const mostPopularTask = Array.from(taskCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Нет данных"

    // Самая продуктивная группа
    const groupStats = new Map<string, number>()
    periodTasks?.forEach((task: any) => {
      const taskName = task.task_types?.name
      if (taskName) {
        const group = getTaskGroup(taskName)
        groupStats.set(group, (groupStats.get(group) || 0) + task.units_completed)
      }
    })

    const mostProductiveGroup = Array.from(groupStats.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Нет данных"

    const uniqueEmployees = new Set(periodTasks?.map((t) => t.employee_id)).size
    const avgTasksPerEmployee = uniqueEmployees > 0 ? Math.round(totalTasksPeriod / uniqueEmployees) : 0
    const avgTimePerTask = totalTasksPeriod > 0 ? Math.round(totalTimePeriod / totalTasksPeriod) : 0

    return {
      total_employees: employees?.length || 0,
      active_employees_today: activeToday,
      total_tasks_today: totalTasksToday,
      total_tasks_period: totalTasksPeriod,
      total_units_today: totalUnitsToday,
      total_units_period: totalUnitsPeriod,
      total_time_today: totalTimeToday,
      total_time_period: totalTimePeriod,
      total_coins_period: totalCoinsPeriod,
      avg_tasks_per_employee: avgTasksPerEmployee,
      avg_time_per_task: avgTimePerTask,
      most_productive_employee: mostProductiveEmployee,
      most_popular_task: mostPopularTask,
      most_productive_group: mostProductiveGroup,
    }
  }

  const fetchTopPerformers = async (start: string, end: string): Promise<TopPerformer[]> => {
    const { data: logs } = await supabase
      .from("task_logs")
      .select("employee_id, units_completed, time_spent_minutes, task_types(name), user_profiles(full_name)")
      .gte("work_date", start)
      .lte("work_date", end)

    const performerMap = new Map<string, TopPerformer>()

    logs?.forEach((log: any) => {
      const employeeId = log.employee_id
      const existing = performerMap.get(employeeId) || {
        employee_id: employeeId,
        full_name: log.user_profiles.full_name,
        total_tasks: 0,
        total_units: 0,
        total_time: 0,
        total_coins: 0,
        efficiency_score: 0,
      }

      existing.total_tasks += 1
      existing.total_units += log.units_completed
      existing.total_time += log.time_spent_minutes

      const taskName = log.task_types?.name
      const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
      existing.total_coins += log.units_completed * coinsPerUnit

      performerMap.set(employeeId, existing)
    })

    return Array.from(performerMap.values())
      .map((performer) => ({
        ...performer,
        efficiency_score:
          performer.total_time > 0 ? Math.round((performer.total_units / performer.total_time) * 100) : 0,
      }))
      .sort((a, b) => b.total_units - a.total_units)
      .slice(0, 10)
  }

  const fetchGroupStats = async (start: string, end: string): Promise<TaskGroupStats[]> => {
    const { data: logs } = await supabase
      .from("task_logs")
      .select("employee_id, units_completed, time_spent_minutes, task_types(name)")
      .gte("work_date", start)
      .lte("work_date", end)

    const groupMap = new Map<string, TaskGroupStats>()

    logs?.forEach((log: any) => {
      const taskName = log.task_types?.name
      if (!taskName) return

      const groupName = getTaskGroup(taskName)
      const existing = groupMap.get(groupName) || {
        group_name: groupName,
        total_tasks: 0,
        total_units: 0,
        total_time: 0,
        total_coins: 0,
        unique_performers: new Set(),
        avg_time_per_unit: 0,
      }

      existing.total_tasks += 1
      existing.total_units += log.units_completed
      existing.total_time += log.time_spent_minutes
      ;(existing.unique_performers as Set<string>).add(log.employee_id)

      const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
      existing.total_coins += log.units_completed * coinsPerUnit

      groupMap.set(groupName, existing)
    })

    return Array.from(groupMap.values())
      .map((group) => ({
        ...group,
        unique_performers: (group.unique_performers as Set<string>).size,
        avg_time_per_unit: group.total_units > 0 ? Math.round(group.total_time / group.total_units) : 0,
      }))
      .sort((a, b) => b.total_units - a.total_units)
  }

  const fetchDailyTrends = async (start: string, end: string): Promise<DailyTrend[]> => {
    const { data: logs } = await supabase
      .from("task_logs")
      .select("employee_id, units_completed, time_spent_minutes, work_date")
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date")

    const dailyMap = new Map<string, DailyTrend>()

    logs?.forEach((log: any) => {
      const date = log.work_date
      const existing = dailyMap.get(date) || {
        date,
        total_tasks: 0,
        total_units: 0,
        total_time: 0,
        active_employees: new Set(),
      }

      existing.total_tasks += 1
      existing.total_units += log.units_completed
      existing.total_time += log.time_spent_minutes
      ;(existing.active_employees as Set<string>).add(log.employee_id)

      dailyMap.set(date, existing)
    })

    return Array.from(dailyMap.values())
      .map((day) => ({
        ...day,
        active_employees: (day.active_employees as Set<string>).size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  const getTaskGroup = (taskName: string): string => {
    for (const [groupName, groupData] of Object.entries(GAME_CONFIG.TASK_GROUPS)) {
      if (groupData.tasks.includes(taskName)) {
        return groupName
      }
    }
    return "Прочее"
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
  }

  const exportToExcel = () => {
    if (!stats) return

    const { start, end } = getDateRange()

    try {
      // Общая статистика
      const summaryData = [
        ["Период", `${start} - ${end}`],
        ["Всего сотрудников", stats.total_employees],
        ["Активных сегодня", stats.active_employees_today],
        ["Задач сегодня", stats.total_tasks_today],
        ["Задач за период", stats.total_tasks_period],
        ["Единиц сегодня", stats.total_units_today],
        ["Единиц за период", stats.total_units_period],
        ["Время сегодня", formatTime(stats.total_time_today)],
        ["Время за период", formatTime(stats.total_time_period)],
        ["Монет за период", stats.total_coins_period],
        ["Среднее задач на сотрудника", stats.avg_tasks_per_employee],
        ["Среднее время на задачу", formatTime(stats.avg_time_per_task)],
        ["Самый продуктивный", stats.most_productive_employee],
        ["Популярная задача", stats.most_popular_task],
        ["Продуктивная группа", stats.most_productive_group],
      ]

      // Топ исполнители
      const performersHeaders = ["Сотрудник", "Задач", "Единиц", "Время", "Монеты", "Эффективность"]

      const performersData = topPerformers.map((performer) => [
        performer.full_name,
        performer.total_tasks,
        performer.total_units,
        formatTime(performer.total_time),
        performer.total_coins,
        performer.efficiency_score,
      ])

      // Статистика групп
      const groupHeaders = ["Группа", "Задач", "Единиц", "Время", "Монеты", "Исполнителей", "Мин/единица"]

      const groupData = groupStats.map((group) => [
        group.group_name,
        group.total_tasks,
        group.total_units,
        formatTime(group.total_time),
        group.total_coins,
        group.unique_performers,
        group.avg_time_per_unit,
      ])

      // Дневные тренды
      const trendsHeaders = ["Дата", "Задач", "Единиц", "Время", "Активных сотрудников"]

      const trendsData = dailyTrends.map((trend) => [
        trend.date,
        trend.total_tasks,
        trend.total_units,
        formatTime(trend.total_time),
        trend.active_employees,
      ])

      // Создаем книгу Excel
      const wb = XLSX.utils.book_new()

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, summaryWs, "Общая статистика")

      const performersWs = XLSX.utils.aoa_to_sheet([performersHeaders, ...performersData])
      XLSX.utils.book_append_sheet(wb, performersWs, "Топ исполнители")

      const groupWs = XLSX.utils.aoa_to_sheet([groupHeaders, ...groupData])
      XLSX.utils.book_append_sheet(wb, groupWs, "Группы задач")

      const trendsWs = XLSX.utils.aoa_to_sheet([trendsHeaders, ...trendsData])
      XLSX.utils.book_append_sheet(wb, trendsWs, "Дневные тренды")

      // Используем только браузерный метод экспорта
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Общая_статистика_${start}_${end}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Ошибка экспорта:", error)
      alert("Произошла ошибка при экспорте файла. Попробуйте еще раз.")
    }
  }

  const getPeriodLabel = () => {
    switch (period) {
      case "day":
        return "Сегодня"
      case "week":
        return "Неделя"
      case "month":
        return "Месяц"
      case "custom":
        return "Произвольный период"
      default:
        return "Неделя"
    }
  }

  return (
    <div className="space-y-6">
      {/* Фильтры */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Общая статистика системы
          </CardTitle>
          <CardDescription>Сводная аналитика работы всей команды</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Сегодня</SelectItem>
                <SelectItem value="week">Неделя</SelectItem>
                <SelectItem value="month">Месяц</SelectItem>
                <SelectItem value="custom">Произвольный</SelectItem>
              </SelectContent>
            </Select>

            {period === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-40">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(customStartDate, "dd.MM.yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={(date) => date && setCustomStartDate(date)}
                      locale={ru}
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-40">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(customEndDate, "dd.MM.yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={(date) => date && setCustomEndDate(date)}
                      locale={ru}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}

            {stats && (
              <Button onClick={exportToExcel} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Экспорт Excel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-4xl animate-spin mb-4">📊</div>
            <p>Загрузка статистики...</p>
          </CardContent>
        </Card>
      ) : stats ? (
        <>
          {/* Ключевые метрики */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold">{stats.active_employees_today}</div>
                <div className="text-sm text-muted-foreground">Активных сегодня</div>
                <div className="text-xs text-muted-foreground">из {stats.total_employees} всего</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Target className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold">{stats.total_tasks_period}</div>
                <div className="text-sm text-muted-foreground">Задач за {getPeriodLabel().toLowerCase()}</div>
                <div className="text-xs text-muted-foreground">сегодня: {stats.total_tasks_today}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold">{stats.total_units_period}</div>
                <div className="text-sm text-muted-foreground">Единиц выполнено</div>
                <div className="text-xs text-muted-foreground">сегодня: {stats.total_units_today}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Award className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                <div className="text-2xl font-bold">{stats.total_coins_period.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Монет заработано</div>
                <div className="text-xs text-muted-foreground">{getPeriodLabel()}</div>
              </CardContent>
            </Card>
          </div>

          {/* Дополнительные метрики */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <div className="text-2xl font-bold">{formatTime(stats.total_time_period)}</div>
                <div className="text-sm text-muted-foreground">Общее время работы</div>
                <div className="text-xs text-muted-foreground">
                  Среднее на задачу: {formatTime(stats.avg_time_per_task)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                <div className="text-2xl font-bold">{stats.avg_tasks_per_employee}</div>
                <div className="text-sm text-muted-foreground">Задач на сотрудника</div>
                <div className="text-xs text-muted-foreground">В среднем за период</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Zap className="h-8 w-8 mx-auto mb-2 text-red-600" />
                <div className="text-2xl font-bold">
                  {stats.total_time_period > 0
                    ? Math.round((stats.total_units_period / stats.total_time_period) * 100)
                    : 0}
                </div>
                <div className="text-sm text-muted-foreground">Общая эффективность</div>
                <div className="text-xs text-muted-foreground">Единиц/час</div>
              </CardContent>
            </Card>
          </div>

          {/* Лидеры */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Самый продуктивный
                </h3>
                <p className="text-2xl font-bold text-green-600">{stats.most_productive_employee}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  Популярная задача
                </h3>
                <p className="text-2xl font-bold text-blue-600">{stats.most_popular_task}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  Продуктивная группа
                </h3>
                <p className="text-2xl font-bold text-purple-600">{stats.most_productive_group}</p>
              </CardContent>
            </Card>
          </div>

          {/* Детальная аналитика */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Топ исполнители */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Топ-10 исполнителей
                </CardTitle>
                <CardDescription>Лучшие сотрудники по количеству выполненных единиц</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {topPerformers.map((performer, index) => (
                    <div
                      key={performer.employee_id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={index < 3 ? "default" : "secondary"}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                        >
                          {index + 1}
                        </Badge>
                        <div>
                          <div className="font-medium">{performer.full_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {performer.total_tasks} задач • {formatTime(performer.total_time)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{performer.total_units} ед.</div>
                        <div className="text-sm text-yellow-600">🪙 {performer.total_coins}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Статистика по группам */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Статистика по группам задач
                </CardTitle>
                <CardDescription>Производительность по категориям работ</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {groupStats.map((group, index) => (
                    <div key={group.group_name} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium">{group.group_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {group.unique_performers} исполнителей • {group.avg_time_per_unit} мин/ед
                          </div>
                        </div>
                        <Badge variant="outline">#{index + 1}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">Единиц</div>
                          <div className="font-bold">{group.total_units}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Время</div>
                          <div className="font-bold">{formatTime(group.total_time)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Монеты</div>
                          <div className="font-bold text-yellow-600">{group.total_coins}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Дневные тренды */}
          {dailyTrends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Динамика по дням
                </CardTitle>
                <CardDescription>Изменение активности команды во времени</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {dailyTrends.map((trend) => (
                    <div key={trend.date} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <div className="font-medium">
                          {new Date(trend.date).toLocaleDateString("ru-RU", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {trend.active_employees} активных сотрудников
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{trend.total_units} ед.</div>
                        <div className="text-sm text-muted-foreground">
                          {trend.total_tasks} задач • {formatTime(trend.total_time)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}
