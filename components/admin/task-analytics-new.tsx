"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabase, type TaskType } from "@/lib/supabase"
import { GAME_CONFIG } from "@/lib/game-config"
import { Target, Download, CalendarIcon, Trophy, Clock, Users, TrendingUp, BarChart3 } from "lucide-react"
import { format, subWeeks, subMonths } from "date-fns"
import { ru } from "date-fns/locale"
import * as XLSX from "xlsx"

interface TaskPerformer {
  employee_id: string
  full_name: string
  total_count: number
  total_units: number
  total_time: number
  avg_time_per_unit: number
  total_coins: number
  efficiency_score: number
  last_completed: string
  rank: number
}

interface TaskPeriodStats {
  period: string
  total_count: number
  total_units: number
  total_time: number
  unique_performers: number
  avg_time_per_unit: number
  best_performer: string
}

interface TaskAnalyticsData {
  task_id: number | string
  task_name: string
  task_group: string
  total_performers: number
  total_count: number
  total_units: number
  total_time: number
  avg_time_per_unit: number
  total_coins_earned: number
  best_performer: string
  most_efficient: string
  performers: TaskPerformer[]
  period_stats: TaskPeriodStats[]
}

interface AllTasksData {
  task_name: string
  task_group: string
  total_performers: number
  total_count: number
  total_units: number
  total_time: number
  avg_time_per_unit: number
  total_coins_earned: number
  best_performer: string
  most_efficient: string
}

export default function TaskAnalyticsNew() {
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
  const [selectedTask, setSelectedTask] = useState<string>("")
  const [period, setPeriod] = useState<string>("day")
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date())
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date())
  const [taskAnalytics, setTaskAnalytics] = useState<TaskAnalyticsData | null>(null)
  const [allTasksData, setAllTasksData] = useState<AllTasksData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchTaskTypes()
  }, [])

  useEffect(() => {
    if (selectedTask) {
      if (selectedTask === "all") {
        fetchAllTasksAnalytics()
      } else {
        fetchTaskAnalytics()
      }
    }
  }, [selectedTask, period, customStartDate, customEndDate])

  const fetchTaskTypes = async () => {
    try {
      // Получаем уникальные задачи из логов (только те, которые реально выполнялись)
      const { data: uniqueTasks, error } = await supabase
        .from("task_logs")
        .select("task_types(id, name, description)")
        .not("task_types", "is", null)

      if (error) throw error

      const taskTypesMap = new Map()
      uniqueTasks?.forEach((log: any) => {
        if (log.task_types) {
          taskTypesMap.set(log.task_types.id, log.task_types)
        }
      })

      const tasks = Array.from(taskTypesMap.values()).sort((a, b) => a.name.localeCompare(b.name))
      setTaskTypes(tasks)
    } catch (error) {
      console.error("Ошибка загрузки типов задач:", error)
    }
  }

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

  const fetchAllTasksAnalytics = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()

      // Получаем все логи за период
      const { data: logs, error } = await supabase
        .from("task_logs")
        .select(`
          employee_id,
          units_completed,
          time_spent_minutes,
          work_date,
          employees!inner(full_name),
          task_types!inner(name)
        `)
        .gte("work_date", start)
        .lte("work_date", end)
        .order("work_date", { ascending: false })

      if (error) throw error

      if (!logs || logs.length === 0) {
        setAllTasksData([])
        setTaskAnalytics(null)
        setLoading(false)
        return
      }

      // Группируем по задачам
      const taskMap = new Map<string, any>()

      logs.forEach((log: any) => {
        const taskName = log.task_types.name
        const existing = taskMap.get(taskName) || {
          task_name: taskName,
          task_group: getTaskGroup(taskName),
          total_count: 0,
          total_units: 0,
          total_time: 0,
          performers: new Map(),
          total_coins_earned: 0,
        }

        existing.total_count += 1
        existing.total_units += log.units_completed
        existing.total_time += log.time_spent_minutes

        // Отслеживаем исполнителей
        const employeeId = log.employee_id
        const performerData = existing.performers.get(employeeId) || {
          employee_id: employeeId,
          full_name: log.employees.full_name,
          total_units: 0,
          total_time: 0,
        }
        performerData.total_units += log.units_completed
        performerData.total_time += log.time_spent_minutes
        existing.performers.set(employeeId, performerData)

        // Рассчитываем монеты
        const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
        existing.total_coins_earned += log.units_completed * coinsPerUnit

        taskMap.set(taskName, existing)
      })

      // Обрабатываем данные для отображения
      const allTasksResult = Array.from(taskMap.values()).map((task) => {
        const performers = Array.from(task.performers.values())
        const bestPerformer =
          performers.length > 0
            ? performers.reduce((prev, current) => (prev.total_units > current.total_units ? prev : current)).full_name
            : "Нет данных"

        const mostEfficient =
          performers.length > 0
            ? performers.reduce((prev, current) => {
                const prevEff = prev.total_time > 0 ? prev.total_units / prev.total_time : 0
                const currentEff = current.total_time > 0 ? current.total_units / current.total_time : 0
                return prevEff > currentEff ? prev : current
              }).full_name
            : "Нет данных"

        return {
          task_name: task.task_name,
          task_group: task.task_group,
          total_performers: task.performers.size,
          total_count: task.total_count,
          total_units: task.total_units,
          total_time: task.total_time,
          avg_time_per_unit: task.total_units > 0 ? Math.round(task.total_time / task.total_units) : 0,
          total_coins_earned: task.total_coins_earned,
          best_performer: bestPerformer,
          most_efficient: mostEfficient,
        }
      })

      allTasksResult.sort((a, b) => b.total_units - a.total_units)
      setAllTasksData(allTasksResult)
      setTaskAnalytics(null) // Очищаем данные одной задачи
    } catch (error) {
      console.error("Ошибка загрузки аналитики всех задач:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTaskAnalytics = async () => {
    if (!selectedTask || selectedTask === "all") return

    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const taskId = Number.parseInt(selectedTask)

      // Получаем все логи для выбранной задачи
      const { data: logs, error } = await supabase
        .from("task_logs")
        .select(`
          employee_id,
          units_completed,
          time_spent_minutes,
          work_date,
          created_at,
          employees!inner(full_name),
          task_types!inner(name)
        `)
        .eq("task_type_id", taskId)
        .gte("work_date", start)
        .lte("work_date", end)
        .order("work_date", { ascending: false })

      if (error) throw error

      const taskType = taskTypes.find((t) => t.id === taskId)
      const taskName = taskType?.name || "Неизвестная задача"

      if (!logs || logs.length === 0) {
        setTaskAnalytics({
          task_id: taskId,
          task_name: taskName,
          task_group: getTaskGroup(taskName),
          total_performers: 0,
          total_count: 0,
          total_units: 0,
          total_time: 0,
          avg_time_per_unit: 0,
          total_coins_earned: 0,
          best_performer: "Нет данных",
          most_efficient: "Нет данных",
          performers: [],
          period_stats: [],
        })
        setAllTasksData([]) // Очищаем данные всех задач
        setLoading(false)
        return
      }

      // Группируем по исполнителям
      const performerMap = new Map<string, TaskPerformer>()
      let totalCount = 0
      let totalUnits = 0
      let totalTime = 0

      logs.forEach((log: any) => {
        const employeeId = log.employee_id
        const existing = performerMap.get(employeeId) || {
          employee_id: employeeId,
          full_name: log.employees.full_name,
          total_count: 0,
          total_units: 0,
          total_time: 0,
          avg_time_per_unit: 0,
          total_coins: 0,
          efficiency_score: 0,
          last_completed: log.work_date,
          rank: 0,
        }

        existing.total_count += 1
        existing.total_units += log.units_completed
        existing.total_time += log.time_spent_minutes
        if (log.work_date > existing.last_completed) {
          existing.last_completed = log.work_date
        }

        performerMap.set(employeeId, existing)

        totalCount += 1
        totalUnits += log.units_completed
        totalTime += log.time_spent_minutes
      })

      // Рассчитываем метрики для исполнителей
      const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
      const performers = Array.from(performerMap.values()).map((performer) => {
        const avgTimePerUnit = performer.total_units > 0 ? Math.round(performer.total_time / performer.total_units) : 0
        const totalCoins = performer.total_units * coinsPerUnit
        const efficiencyScore =
          performer.total_time > 0 ? Math.round((performer.total_units / performer.total_time) * 100) : 0

        return {
          ...performer,
          avg_time_per_unit: avgTimePerUnit,
          total_coins: totalCoins,
          efficiency_score: efficiencyScore,
        }
      })

      // Сортируем и присваиваем ранги
      performers.sort((a, b) => b.total_units - a.total_units)
      performers.forEach((performer, index) => {
        performer.rank = index + 1
      })

      // Находим лучших исполнителей
      const bestPerformer = performers[0]?.full_name || "Нет данных"
      const mostEfficient =
        performers.length > 0
          ? performers.reduce((prev, current) => (prev.efficiency_score > current.efficiency_score ? prev : current))
              .full_name
          : "Нет данных"

      // Статистика по периодам
      const periodStats = await calculatePeriodStats(logs, period)

      setTaskAnalytics({
        task_id: taskId,
        task_name: taskName,
        task_group: getTaskGroup(taskName),
        total_performers: performerMap.size,
        total_count: totalCount,
        total_units: totalUnits,
        total_time: totalTime,
        avg_time_per_unit: totalUnits > 0 ? Math.round(totalTime / totalUnits) : 0,
        total_coins_earned: totalUnits * coinsPerUnit,
        best_performer: bestPerformer,
        most_efficient: mostEfficient,
        performers,
        period_stats: periodStats,
      })
      setAllTasksData([]) // Очищаем данные всех задач
    } catch (error) {
      console.error("Ошибка загрузки аналитики задачи:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculatePeriodStats = async (logs: any[], periodType: string): Promise<TaskPeriodStats[]> => {
    const periodMap = new Map<string, any>()

    logs.forEach((log: any) => {
      let periodKey = ""
      const date = new Date(log.work_date)

      switch (periodType) {
        case "day":
          periodKey = log.work_date
          break
        case "week":
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay() + 1)
          periodKey = format(weekStart, "yyyy-MM-dd")
          break
        case "month":
          periodKey = format(date, "yyyy-MM")
          break
        default:
          periodKey = log.work_date
      }

      const existing = periodMap.get(periodKey) || {
        period: periodKey,
        total_count: 0,
        total_units: 0,
        total_time: 0,
        performers: new Set(),
        best_performer_units: 0,
        best_performer_name: "",
      }

      existing.total_count += 1
      existing.total_units += log.units_completed
      existing.total_time += log.time_spent_minutes
      existing.performers.add(log.employee_id)

      // Отслеживаем лучшего исполнителя периода
      if (log.units_completed > existing.best_performer_units) {
        existing.best_performer_units = log.units_completed
        existing.best_performer_name = log.employees.full_name
      }

      periodMap.set(periodKey, existing)
    })

    return Array.from(periodMap.values())
      .map((period) => ({
        period: period.period,
        total_count: period.total_count,
        total_units: period.total_units,
        total_time: period.total_time,
        unique_performers: period.performers.size,
        avg_time_per_unit: period.total_units > 0 ? Math.round(period.total_time / period.total_units) : 0,
        best_performer: period.best_performer_name || "Нет данных",
      }))
      .sort((a, b) => b.period.localeCompare(a.period))
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

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇"
      case 2:
        return "🥈"
      case 3:
        return "🥉"
      default:
        return `#${rank}`
    }
  }

  const exportToExcel = () => {
    const { start, end } = getDateRange()

    try {
      if (selectedTask === "all" && allTasksData.length > 0) {
        // Экспорт всех задач
        const allTasksHeaders = [
          "Задача",
          "Группа",
          "Исполнителей",
          "Выполнений",
          "Единиц",
          "Время",
          "Среднее время/единица",
          "Монет заработано",
          "Лучший исполнитель",
          "Самый эффективный",
        ]

        const allTasksExportData = allTasksData.map((task) => [
          task.task_name,
          task.task_group,
          task.total_performers,
          task.total_count,
          task.total_units,
          formatTime(task.total_time),
          `${task.avg_time_per_unit} мин`,
          task.total_coins_earned,
          task.best_performer,
          task.most_efficient,
        ])

        // Создаем книгу Excel
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet([allTasksHeaders, ...allTasksExportData])
        XLSX.utils.book_append_sheet(wb, ws, "Все задачи")

        // Экспортируем
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
        const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `Все_задачи_${start}_${end}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else if (taskAnalytics) {
        // Экспорт одной задачи (существующий код)
        const summaryData = [
          ["Задача", taskAnalytics.task_name],
          ["Группа", taskAnalytics.task_group],
          ["Период", `${start} - ${end}`],
          ["Всего исполнителей", taskAnalytics.total_performers],
          ["Всего выполнений", taskAnalytics.total_count],
          ["Единиц выполнено", taskAnalytics.total_units],
          ["Общее время", formatTime(taskAnalytics.total_time)],
          ["Среднее время/единица", `${taskAnalytics.avg_time_per_unit} мин`],
          ["Монет заработано", taskAnalytics.total_coins_earned],
          ["Лучший исполнитель", taskAnalytics.best_performer],
          ["Самый эффективный", taskAnalytics.most_efficient],
        ]

        const performersHeaders = [
          "Ранг",
          "Исполнитель",
          "Выполнений",
          "Единиц",
          "Время",
          "Среднее время/единица",
          "Монеты",
          "Эффективность",
          "Последнее выполнение",
        ]

        const performersData = taskAnalytics.performers.map((performer) => [
          performer.rank,
          performer.full_name,
          performer.total_count,
          performer.total_units,
          formatTime(performer.total_time),
          `${performer.avg_time_per_unit} мин`,
          performer.total_coins,
          performer.efficiency_score,
          performer.last_completed,
        ])

        const periodHeaders = [
          "Период",
          "Выполнений",
          "Единиц",
          "Время",
          "Исполнителей",
          "Среднее время/единица",
          "Лучший исполнитель",
        ]

        const periodData = taskAnalytics.period_stats.map((period) => [
          period.period,
          period.total_count,
          period.total_units,
          formatTime(period.total_time),
          period.unique_performers,
          `${period.avg_time_per_unit} мин`,
          period.best_performer,
        ])

        const wb = XLSX.utils.book_new()

        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
        XLSX.utils.book_append_sheet(wb, summaryWs, "Общая статистика")

        const performersWs = XLSX.utils.aoa_to_sheet([performersHeaders, ...performersData])
        XLSX.utils.book_append_sheet(wb, performersWs, "Рейтинг исполнителей")

        const periodWs = XLSX.utils.aoa_to_sheet([periodHeaders, ...periodData])
        XLSX.utils.book_append_sheet(wb, periodWs, "По периодам")

        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
        const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `Аналитика_${taskAnalytics.task_name.replace(/[^\w\s]/gi, "")}_${start}_${end}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error("Ошибка экспорта:", error)
      alert("Произошла ошибка при экспорте файла. Попробуйте еще раз.")
    }
  }

  const getPeriodLabel = () => {
    switch (period) {
      case "day":
        return "сегодня"
      case "week":
        return "по неделям"
      case "month":
        return "по месяцам"
      case "custom":
        return "произвольный период"
      default:
        return "сегодня"
    }
  }

  return (
    <div className="space-y-6">
      {/* Фильтры */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Аналитика задач
          </CardTitle>
          <CardDescription>
            Детальная статистика выполнения задач
            <br />
            <small className="text-muted-foreground">
              💡 Выберите "Все задачи" для сводной аналитики или конкретную задачу для детального анализа
            </small>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={selectedTask} onValueChange={setSelectedTask}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Выберите задачу" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📊 Все задачи</SelectItem>
                {taskTypes.map((task) => (
                  <SelectItem key={task.id} value={task.id.toString()}>
                    {task.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

            {(taskAnalytics || allTasksData.length > 0) && (
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
            <p>Загрузка аналитики...</p>
          </CardContent>
        </Card>
      ) : !selectedTask ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Выберите задачу для просмотра аналитики</p>
          </CardContent>
        </Card>
      ) : selectedTask === "all" && allTasksData.length > 0 ? (
        // Отображение всех задач
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Сводная аналитика всех задач
              <Badge variant="outline">{allTasksData.length} задач</Badge>
            </CardTitle>
            <CardDescription>Общая статистика по всем выполняемым задачам за выбранный период</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allTasksData.map((task, index) => (
                <Card key={task.task_name} className="border">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <h3 className="font-semibold text-lg">{task.task_name}</h3>
                          <Badge variant="secondary">{task.task_group}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Лучший: <strong>{task.best_performer}</strong> • Эффективный:{" "}
                          <strong>{task.most_efficient}</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">{task.total_units} ед.</div>
                        <div className="text-sm text-yellow-600">🪙 {task.total_coins_earned.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Исполнителей</div>
                        <div className="font-bold">{task.total_performers}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Выполнений</div>
                        <div className="font-bold">{task.total_count}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Время</div>
                        <div className="font-bold">{formatTime(task.total_time)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Мин/единица</div>
                        <div className="font-bold">{task.avg_time_per_unit}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Эффективность</div>
                        <div className="font-bold">
                          {task.total_time > 0 ? Math.round((task.total_units / task.total_time) * 100) : 0}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : taskAnalytics ? (
        // Отображение одной задачи (существующий код)
        <>
          {/* Общая статистика задачи */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-6 w-6" />
                {taskAnalytics.task_name}
                <Badge variant="outline">{taskAnalytics.task_group}</Badge>
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
                  <div className="text-2xl font-bold">{taskAnalytics.total_performers}</div>
                  <div className="text-sm text-muted-foreground">Исполнителей</div>
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
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <div className="text-2xl font-bold">{taskAnalytics.avg_time_per_unit} мин</div>
                  <div className="text-sm text-muted-foreground">Среднее время/единица</div>
                </div>
              </div>

              <div className="mt-4 text-center">
                <Badge variant="outline" className="text-lg px-4 py-2">
                  💰 {taskAnalytics.total_coins_earned.toLocaleString()} монет заработано
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Детальная аналитика */}
          <Tabs defaultValue="performers" className="space-y-4">
            <TabsList>
              <TabsTrigger value="performers">🏆 Рейтинг исполнителей</TabsTrigger>
              <TabsTrigger value="periods">📊 Динамика {getPeriodLabel()}</TabsTrigger>
            </TabsList>

            <TabsContent value="performers">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Рейтинг исполнителей по задаче "{taskAnalytics.task_name}"
                  </CardTitle>
                  <CardDescription>Топ исполнителей по количеству выполненных единиц</CardDescription>
                </CardHeader>
                <CardContent>
                  {taskAnalytics.performers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="text-4xl mb-2">🏆</div>
                      <div>Нет данных за выбранный период</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {taskAnalytics.performers.map((performer) => (
                        <Card
                          key={performer.employee_id}
                          className={`border-2 ${
                            performer.rank === 1
                              ? "border-yellow-300 bg-gradient-to-r from-yellow-50 to-yellow-100"
                              : performer.rank === 2
                                ? "border-gray-300 bg-gradient-to-r from-gray-50 to-gray-100"
                                : performer.rank === 3
                                  ? "border-orange-300 bg-gradient-to-r from-orange-50 to-orange-100"
                                  : "border-gray-200"
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-4">
                                <div className="text-2xl font-bold">{getRankIcon(performer.rank)}</div>
                                <div>
                                  <div className="font-bold text-lg">{performer.full_name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {performer.total_count} выполнений • {formatTime(performer.total_time)} •
                                    Эффективность: {performer.efficiency_score}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Последнее: {new Date(performer.last_completed).toLocaleDateString("ru-RU")}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-2xl font-bold text-green-600">{performer.total_units} ед.</div>
                                <div className="text-sm text-yellow-600">
                                  🪙 {performer.total_coins.toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {performer.avg_time_per_unit} мин/ед
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

            <TabsContent value="periods">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Динамика выполнения {getPeriodLabel()}
                  </CardTitle>
                  <CardDescription>Изменение производительности команды по задаче во времени</CardDescription>
                </CardHeader>
                <CardContent>
                  {taskAnalytics.period_stats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="text-4xl mb-2">📈</div>
                      <div>Нет данных для отображения динамики</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {taskAnalytics.period_stats.map((period, index) => (
                        <Card key={index} className="border">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium text-lg">
                                  {period.period === format(new Date(), "yyyy-MM-dd")
                                    ? "Сегодня"
                                    : new Date(period.period).toLocaleDateString("ru-RU")}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {period.unique_performers} исполнителей • {period.total_count} выполнений •
                                  {formatTime(period.total_time)}
                                </div>
                                <div className="text-xs text-muted-foreground">Лучший: {period.best_performer}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-green-600">{period.total_units} ед.</div>
                                <div className="text-sm text-muted-foreground">{period.avg_time_per_unit} мин/ед</div>
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
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-muted-foreground">Нет данных за выбранный период</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
