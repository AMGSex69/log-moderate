"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabase } from "@/lib/supabase"
import { GAME_CONFIG } from "@/lib/game-config"
import { User, Download, CalendarIcon, TrendingUp, Clock, Target, Award, Users } from "lucide-react"
import { format, subWeeks, subMonths } from "date-fns"
import { ru } from "date-fns/locale"
import * as XLSX from "xlsx"

interface EmployeeTaskStats {
  task_name: string
  task_group: string
  total_count: number
  total_units: number
  total_time: number
  avg_time_per_unit: number
  total_coins: number
  percentage_of_work: number
  last_completed: string
  efficiency_score: number
}

interface EmployeeDailyStats {
  date: string
  total_tasks: number
  total_units: number
  total_time: number
  total_coins: number
  unique_task_types: number
  most_productive_task: string
  work_efficiency: number
}

interface EmployeeOverallStats {
  employee_id: string
  full_name: string
  total_tasks: number
  total_units: number
  total_time: number
  total_coins: number
  avg_tasks_per_day: number
  avg_time_per_task: number
  most_productive_task: string
  favorite_task_group: string
  work_days: number
  task_breakdown: EmployeeTaskStats[]
  daily_breakdown: EmployeeDailyStats[]
}

interface AllEmployeesData {
  employee_id: string
  full_name: string
  total_tasks: number
  total_units: number
  total_time: number
  total_coins: number
  avg_tasks_per_day: number
  avg_time_per_task: number
  most_productive_task: string
  favorite_task_group: string
  work_days: number
  efficiency_score: number
}

export default function EmployeeAnalytics() {
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>("")
  const [period, setPeriod] = useState<string>("day")
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date())
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date())
  const [employeeStats, setEmployeeStats] = useState<EmployeeOverallStats | null>(null)
  const [allEmployeesData, setAllEmployeesData] = useState<AllEmployeesData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (selectedEmployee) {
      if (selectedEmployee === "all") {
        fetchAllEmployeesAnalytics()
      } else {
        fetchEmployeeStats()
      }
    }
  }, [selectedEmployee, period, customStartDate, customEndDate])

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name")

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error("Ошибка загрузки сотрудников:", error)
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

  const fetchAllEmployeesAnalytics = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()

      // Получаем все логи за период
      const { data: logs, error } = await supabase
        .from("task_logs")
        .select("employee_id, units_completed, time_spent_minutes, work_date, task_types(name), employees(full_name)")
        .gte("work_date", start)
        .lte("work_date", end)
        .order("work_date", { ascending: false })

      if (error) throw error

      if (!logs || logs.length === 0) {
        setAllEmployeesData([])
        setEmployeeStats(null)
        setLoading(false)
        return
      }

      // Группируем по сотрудникам
      const employeeMap = new Map<string, any>()

      logs.forEach((log: any) => {
        const employeeId = log.employee_id
        const existing = employeeMap.get(employeeId) || {
          employee_id: employeeId,
          full_name: log.employees.full_name,
          total_tasks: 0,
          total_units: 0,
          total_time: 0,
          total_coins: 0,
          work_dates: new Set(),
          task_stats: new Map(),
          group_stats: new Map(),
        }

        existing.total_tasks += 1
        existing.total_units += log.units_completed
        existing.total_time += log.time_spent_minutes
        existing.work_dates.add(log.work_date)

        // Статистика по задачам
        const taskName = log.task_types.name
        const taskStats = existing.task_stats.get(taskName) || { count: 0, units: 0, time: 0 }
        taskStats.count += 1
        taskStats.units += log.units_completed
        taskStats.time += log.time_spent_minutes
        existing.task_stats.set(taskName, taskStats)

        // Статистика по группам
        const taskGroup = getTaskGroup(taskName)
        const groupStats = existing.group_stats.get(taskGroup) || { time: 0 }
        groupStats.time += log.time_spent_minutes
        existing.group_stats.set(taskGroup, groupStats)

        // Рассчитываем монеты
        const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
        existing.total_coins += log.units_completed * coinsPerUnit

        employeeMap.set(employeeId, existing)
      })

      // Обрабатываем данные для отображения
      const allEmployeesResult = Array.from(employeeMap.values()).map((emp) => {
        const workDays = emp.work_dates.size
        const avgTasksPerDay = workDays > 0 ? Math.round((emp.total_tasks / workDays) * 10) / 10 : 0
        const avgTimePerTask = emp.total_tasks > 0 ? Math.round(emp.total_time / emp.total_tasks) : 0

        // Находим самую продуктивную задачу
        let mostProductiveTask = "Нет данных"
        let maxUnits = 0
        for (const [taskName, stats] of emp.task_stats.entries()) {
          if (stats.units > maxUnits) {
            maxUnits = stats.units
            mostProductiveTask = taskName
          }
        }

        // Находим любимую группу задач
        let favoriteTaskGroup = "Нет данных"
        let maxTime = 0
        for (const [groupName, stats] of emp.group_stats.entries()) {
          if (stats.time > maxTime) {
            maxTime = stats.time
            favoriteTaskGroup = groupName
          }
        }

        const efficiencyScore = emp.total_time > 0 ? Math.round((emp.total_units / emp.total_time) * 100) : 0

        return {
          employee_id: emp.employee_id,
          full_name: emp.full_name,
          total_tasks: emp.total_tasks,
          total_units: emp.total_units,
          total_time: emp.total_time,
          total_coins: emp.total_coins,
          avg_tasks_per_day: avgTasksPerDay,
          avg_time_per_task: avgTimePerTask,
          most_productive_task: mostProductiveTask,
          favorite_task_group: favoriteTaskGroup,
          work_days: workDays,
          efficiency_score: efficiencyScore,
        }
      })

      allEmployeesResult.sort((a, b) => b.total_units - a.total_units)
      setAllEmployeesData(allEmployeesResult)
      setEmployeeStats(null) // Очищаем данные одного сотрудника
    } catch (error) {
      console.error("Ошибка загрузки аналитики всех сотрудников:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployeeStats = async () => {
    if (!selectedEmployee || selectedEmployee === "all") return

    setLoading(true)
    try {
      const { start, end } = getDateRange()

      // Получаем все задачи сотрудника за период
      const { data: logs, error } = await supabase
        .from("task_logs")
        .select("units_completed, time_spent_minutes, work_date, created_at, task_types(name)")
        .eq("employee_id", selectedEmployee)
        .gte("work_date", start)
        .lte("work_date", end)
        .order("work_date", { ascending: false })

      if (error) throw error

      // Получаем имя сотрудника
      const { data: employee } = await supabase
        .from("employees")
        .select("full_name")
        .eq("id", selectedEmployee)
        .single()

      if (!logs || logs.length === 0) {
        setEmployeeStats({
          employee_id: selectedEmployee,
          full_name: employee?.full_name || "Неизвестно",
          total_tasks: 0,
          total_units: 0,
          total_time: 0,
          total_coins: 0,
          avg_tasks_per_day: 0,
          avg_time_per_task: 0,
          most_productive_task: "Нет данных",
          favorite_task_group: "Нет данных",
          work_days: 0,
          task_breakdown: [],
          daily_breakdown: [],
        })
        setAllEmployeesData([]) // Очищаем данные всех сотрудников
        setLoading(false)
        return
      }

      // Группируем по типам задач
      const taskMap = new Map<string, EmployeeTaskStats>()
      const dailyMap = new Map<string, EmployeeDailyStats>()
      let totalTasks = 0
      let totalUnits = 0
      let totalTime = 0
      let totalCoins = 0

      logs.forEach((log: any) => {
        const taskName = log.task_types.name
        const workDate = log.work_date
        const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
        const taskCoins = log.units_completed * coinsPerUnit

        // Статистика по задачам
        const existing = taskMap.get(taskName) || {
          task_name: taskName,
          task_group: getTaskGroup(taskName),
          total_count: 0,
          total_units: 0,
          total_time: 0,
          avg_time_per_unit: 0,
          total_coins: 0,
          percentage_of_work: 0,
          last_completed: workDate,
          efficiency_score: 0,
        }

        existing.total_count += 1
        existing.total_time += log.time_spent_minutes
        existing.total_units += log.units_completed
        existing.total_coins += taskCoins
        if (workDate > existing.last_completed) {
          existing.last_completed = workDate
        }

        taskMap.set(taskName, existing)

        // Статистика по дням
        const dailyExisting = dailyMap.get(workDate) || {
          date: workDate,
          total_tasks: 0,
          total_units: 0,
          total_time: 0,
          total_coins: 0,
          unique_task_types: 0,
          most_productive_task: "",
          work_efficiency: 0,
        }

        dailyExisting.total_tasks += 1
        dailyExisting.total_units += log.units_completed
        dailyExisting.total_time += log.time_spent_minutes
        dailyExisting.total_coins += taskCoins

        dailyMap.set(workDate, dailyExisting)

        totalTasks += 1
        totalUnits += log.units_completed
        totalTime += log.time_spent_minutes
        totalCoins += taskCoins
      })

      // Рассчитываем проценты и эффективность для задач
      const taskBreakdown = Array.from(taskMap.values()).map((task) => ({
        ...task,
        avg_time_per_unit: task.total_units > 0 ? Math.round(task.total_time / task.total_units) : 0,
        percentage_of_work: totalTime > 0 ? Math.round((task.total_time / totalTime) * 100) : 0,
        efficiency_score: task.total_time > 0 ? Math.round((task.total_units / task.total_time) * 100) : 0,
      }))

      taskBreakdown.sort((a, b) => b.total_units - a.total_units)

      // Дорабатываем дневную статистику
      const dailyBreakdown = Array.from(dailyMap.values()).map((day) => {
        const dayTasks = logs.filter((log: any) => log.work_date === day.date)
        const uniqueTaskTypes = new Set(dayTasks.map((log: any) => log.task_types.name)).size

        // Находим самую продуктивную задачу дня
        const taskCounts = new Map<string, number>()
        dayTasks.forEach((log: any) => {
          const taskName = log.task_types.name
          taskCounts.set(taskName, (taskCounts.get(taskName) || 0) + log.units_completed)
        })

        const mostProductiveTask = Array.from(taskCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Нет данных"

        return {
          ...day,
          unique_task_types: uniqueTaskTypes,
          most_productive_task: mostProductiveTask,
          work_efficiency: day.total_time > 0 ? Math.round((day.total_units / day.total_time) * 100) : 0,
        }
      })

      dailyBreakdown.sort((a, b) => b.date.localeCompare(a.date))

      // Рассчитываем общие метрики
      const uniqueDays = new Set(logs.map((log: any) => log.work_date)).size
      const avgTasksPerDay = uniqueDays > 0 ? Math.round((totalTasks / uniqueDays) * 10) / 10 : 0
      const avgTimePerTask = totalTasks > 0 ? Math.round(totalTime / totalTasks) : 0

      // Находим любимую группу задач
      const groupStats = new Map<string, number>()
      taskBreakdown.forEach((task) => {
        groupStats.set(task.task_group, (groupStats.get(task.task_group) || 0) + task.total_time)
      })
      const favoriteTaskGroup = Array.from(groupStats.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Нет данных"

      setEmployeeStats({
        employee_id: selectedEmployee,
        full_name: employee?.full_name || "Неизвестно",
        total_tasks: totalTasks,
        total_units: totalUnits,
        total_time: totalTime,
        total_coins: totalCoins,
        avg_tasks_per_day: avgTasksPerDay,
        avg_time_per_task: avgTimePerTask,
        most_productive_task: taskBreakdown[0]?.task_name || "Нет данных",
        favorite_task_group: favoriteTaskGroup,
        work_days: uniqueDays,
        task_breakdown: taskBreakdown,
        daily_breakdown: dailyBreakdown,
      })
      setAllEmployeesData([]) // Очищаем данные всех сотрудников
    } catch (error) {
      console.error("Ошибка загрузки статистики сотрудника:", error)
    } finally {
      setLoading(false)
    }
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
    const { start, end } = getDateRange()

    try {
      if (selectedEmployee === "all" && allEmployeesData.length > 0) {
        // Экспорт всех сотрудников
        const allEmployeesHeaders = [
          "Сотрудник",
          "Всего задач",
          "Единиц выполнено",
          "Общее время",
          "Монет заработано",
          "Рабочих дней",
          "Среднее задач в день",
          "Среднее время на задачу",
          "Самая продуктивная задача",
          "Любимая группа задач",
          "Эффективность",
        ]

        const allEmployeesExportData = allEmployeesData.map((emp) => [
          emp.full_name,
          emp.total_tasks,
          emp.total_units,
          formatTime(emp.total_time),
          emp.total_coins,
          emp.work_days,
          emp.avg_tasks_per_day,
          formatTime(emp.avg_time_per_task),
          emp.most_productive_task,
          emp.favorite_task_group,
          emp.efficiency_score,
        ])

        // Создаем книгу Excel
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet([allEmployeesHeaders, ...allEmployeesExportData])
        XLSX.utils.book_append_sheet(wb, ws, "Все сотрудники")

        // Экспортируем
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
        const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `Все_сотрудники_${start}_${end}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else if (employeeStats) {
        // Экспорт одного сотрудника (существующий код)
        const summaryData = [
          ["Сотрудник", employeeStats.full_name],
          ["Период", `${start} - ${end}`],
          ["Всего задач", employeeStats.total_tasks],
          ["Единиц выполнено", employeeStats.total_units],
          ["Общее время", formatTime(employeeStats.total_time)],
          ["Монет заработано", employeeStats.total_coins],
          ["Рабочих дней", employeeStats.work_days],
          ["Среднее задач в день", employeeStats.avg_tasks_per_day],
          ["Среднее время на задачу", formatTime(employeeStats.avg_time_per_task)],
          ["Самая продуктивная задача", employeeStats.most_productive_task],
          ["Любимая группа задач", employeeStats.favorite_task_group],
        ]

        const taskHeaders = [
          "Задача",
          "Группа",
          "Количество",
          "Единиц",
          "Время",
          "Среднее время/единица",
          "Монеты",
          "% от работы",
          "Эффективность",
          "Последнее выполнение",
        ]

        const taskData = employeeStats.task_breakdown.map((task) => [
          task.task_name,
          task.task_group,
          task.total_count,
          task.total_units,
          formatTime(task.total_time),
          `${task.avg_time_per_unit} мин`,
          task.total_coins,
          `${task.percentage_of_work}%`,
          task.efficiency_score,
          task.last_completed,
        ])

        const dailyHeaders = [
          "Дата",
          "Задач",
          "Единиц",
          "Время",
          "Монеты",
          "Типов задач",
          "Самая продуктивная",
          "Эффективность",
        ]

        const dailyData = employeeStats.daily_breakdown.map((day) => [
          day.date,
          day.total_tasks,
          day.total_units,
          formatTime(day.total_time),
          day.total_coins,
          day.unique_task_types,
          day.most_productive_task,
          day.work_efficiency,
        ])

        const wb = XLSX.utils.book_new()

        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
        XLSX.utils.book_append_sheet(wb, summaryWs, "Общая статистика")

        const taskWs = XLSX.utils.aoa_to_sheet([taskHeaders, ...taskData])
        XLSX.utils.book_append_sheet(wb, taskWs, "По задачам")

        const dailyWs = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyData])
        XLSX.utils.book_append_sheet(wb, dailyWs, "По дням")

        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
        const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `Статистика_${employeeStats.full_name.replace(/[^\w\s]/gi, "")}_${start}_${end}.xlsx`
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
        return "Сегодня"
      case "week":
        return "Неделя"
      case "month":
        return "Месяц"
      case "custom":
        return "Произвольный период"
      default:
        return "Сегодня"
    }
  }

  return (
    <div className="space-y-6">
      {/* Фильтры */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Аналитика сотрудника
          </CardTitle>
          <CardDescription>
            Детальная статистика работы сотрудников
            <br />
            <small className="text-muted-foreground">
              💡 Выберите "Все сотрудники" для сводной аналитики или конкретного сотрудника для детального анализа
            </small>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Выберите сотрудника" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">👥 Все сотрудники</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
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

            {(employeeStats || allEmployeesData.length > 0) && (
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
      ) : !selectedEmployee ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Выберите сотрудника для просмотра аналитики</p>
          </CardContent>
        </Card>
      ) : selectedEmployee === "all" && allEmployeesData.length > 0 ? (
        // Отображение всех сотрудников
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-6 w-6" />
              Сводная аналитика всех сотрудников
              <Badge variant="outline">{allEmployeesData.length} сотрудников</Badge>
            </CardTitle>
            <CardDescription>Общая статистика по всем активным сотрудникам за выбранный период</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allEmployeesData.map((emp, index) => (
                <Card key={emp.employee_id} className="border">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <h3 className="font-semibold text-lg">{emp.full_name}</h3>
                          <Badge variant="secondary">{emp.favorite_task_group}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Топ задача: <strong>{emp.most_productive_task}</strong> • {emp.work_days} рабочих дней
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">{emp.total_units} ед.</div>
                        <div className="text-sm text-yellow-600">🪙 {emp.total_coins.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Задач</div>
                        <div className="font-bold">{emp.total_tasks}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Время</div>
                        <div className="font-bold">{formatTime(emp.total_time)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Задач/день</div>
                        <div className="font-bold">{emp.avg_tasks_per_day}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Мин/задача</div>
                        <div className="font-bold">{emp.avg_time_per_task}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Эффективность</div>
                        <div className="font-bold">{emp.efficiency_score}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : employeeStats ? (
        // Отображение одного сотрудника (существующий код)
        <>
          {/* Общая статистика */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <Target className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold">{employeeStats.total_tasks}</div>
                <div className="text-sm text-muted-foreground">Всего задач</div>
                <div className="text-xs text-muted-foreground mt-1">{employeeStats.avg_tasks_per_day} в день</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold">{employeeStats.total_units}</div>
                <div className="text-sm text-muted-foreground">Единиц выполнено</div>
                <div className="text-xs text-muted-foreground mt-1">За {employeeStats.work_days} рабочих дней</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <div className="text-2xl font-bold">{formatTime(employeeStats.total_time)}</div>
                <div className="text-sm text-muted-foreground">Общее время</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatTime(employeeStats.avg_time_per_task)} на задачу
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Award className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                <div className="text-2xl font-bold">{employeeStats.total_coins.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Монет заработано</div>
                <div className="text-xs text-muted-foreground mt-1">{getPeriodLabel()}</div>
              </CardContent>
            </Card>
          </div>

          {/* Ключевые показатели */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-2">🎯 Самая продуктивная задача</h3>
                <p className="text-2xl font-bold text-green-600">{employeeStats.most_productive_task}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-2">📂 Любимая группа задач</h3>
                <p className="text-2xl font-bold text-blue-600">{employeeStats.favorite_task_group}</p>
              </CardContent>
            </Card>
          </div>

          {/* Детальная аналитика */}
          <Tabs defaultValue="tasks" className="space-y-4">
            <TabsList>
              <TabsTrigger value="tasks">📋 По задачам</TabsTrigger>
              <TabsTrigger value="daily">📅 По дням</TabsTrigger>
              <TabsTrigger value="groups">📊 По группам</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks">
              <Card>
                <CardHeader>
                  <CardTitle>Детализация по задачам</CardTitle>
                  <CardDescription>Статистика выполнения каждого типа задач за выбранный период</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {employeeStats.task_breakdown.map((task, index) => (
                      <Card key={task.task_name} className="border">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">#{index + 1}</Badge>
                                <h3 className="font-semibold">{task.task_name}</h3>
                                <Badge variant="secondary">{task.task_group}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                Последнее выполнение: {new Date(task.last_completed).toLocaleDateString("ru-RU")}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">{task.total_units} ед.</div>
                              <div className="text-sm text-yellow-600 font-medium">
                                🪙 {task.total_coins.toLocaleString()}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                              <div className="text-muted-foreground">% от работы</div>
                              <div className="font-bold">{task.percentage_of_work}%</div>
                            </div>
                          </div>

                          <div className="mt-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span>Эффективность</span>
                              <span>{task.efficiency_score}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${Math.min(task.efficiency_score, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="daily">
              <Card>
                <CardHeader>
                  <CardTitle>Активность по дням</CardTitle>
                  <CardDescription>Ежедневная статистика работы за выбранный период</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {employeeStats.daily_breakdown.map((day) => (
                      <Card key={day.date} className="border">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-bold text-lg">
                                {new Date(day.date).toLocaleDateString("ru-RU", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {day.unique_task_types} типов задач • Топ: {day.most_productive_task}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold">{day.total_tasks} задач</div>
                              <div className="text-sm text-muted-foreground">
                                {day.total_units} ед. • {formatTime(day.total_time)}
                              </div>
                              <div className="text-sm text-yellow-600">🪙 {day.total_coins}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="groups">
              <Card>
                <CardHeader>
                  <CardTitle>Статистика по группам задач</CardTitle>
                  <CardDescription>Распределение работы по категориям задач</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(
                      employeeStats.task_breakdown.reduce((acc, task) => {
                        if (!acc[task.task_group]) {
                          acc[task.task_group] = {
                            total_count: 0,
                            total_units: 0,
                            total_time: 0,
                            total_coins: 0,
                            tasks: [],
                          }
                        }
                        acc[task.task_group].total_count += task.total_count
                        acc[task.task_group].total_units += task.total_units
                        acc[task.task_group].total_time += task.total_time
                        acc[task.task_group].total_coins += task.total_coins
                        acc[task.task_group].tasks.push(task.task_name)
                        return acc
                      }, {} as any),
                    )
                      .sort((a, b) => b[1].total_units - a[1].total_units)
                      .map(([groupName, groupStats]: [string, any]) => (
                        <Card key={groupName} className="border">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-bold text-lg">{groupName}</h3>
                                <div className="text-sm text-muted-foreground">
                                  {groupStats.tasks.length} типов задач
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold">{groupStats.total_units} ед.</div>
                                <div className="text-sm text-yellow-600">🪙 {groupStats.total_coins}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-muted-foreground">Выполнений</div>
                                <div className="font-bold">{groupStats.total_count}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Время</div>
                                <div className="font-bold">{formatTime(groupStats.total_time)}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">% от работы</div>
                                <div className="font-bold">
                                  {Math.round((groupStats.total_time / employeeStats.total_time) * 100)}%
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
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
