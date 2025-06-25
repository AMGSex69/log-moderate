"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabase, type TaskLog, type EmployeeStats } from "@/lib/supabase"
import { BarChart3, CalendarIcon, Download, TrendingUp, Users, Clock, Target, Award, Activity } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface DashboardStats {
  totalEmployees: number
  totalTasksToday: number
  totalTimeToday: number
  totalUnitsToday: number
  avgTimePerTask: number
}

interface TaskTypeStats {
  task_name: string
  total_units: number
  total_time: number
  total_tasks: number
  avg_time_per_unit: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    totalTasksToday: 0,
    totalTimeToday: 0,
    totalUnitsToday: 0,
    avgTimePerTask: 0,
  })
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([])
  const [taskTypeStats, setTaskTypeStats] = useState<TaskTypeStats[]>([])
  const [recentLogs, setRecentLogs] = useState<TaskLog[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dateRange, setDateRange] = useState("today")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllData()
  }, [selectedDate, dateRange])

  const getDateRange = () => {
    const today = new Date()
    const selected = selectedDate

    switch (dateRange) {
      case "today":
        return {
          start: format(today, "yyyy-MM-dd"),
          end: format(today, "yyyy-MM-dd"),
        }
      case "week":
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - 7)
        return {
          start: format(weekStart, "yyyy-MM-dd"),
          end: format(today, "yyyy-MM-dd"),
        }
      case "month":
        const monthStart = new Date(today)
        monthStart.setDate(1)
        return {
          start: format(monthStart, "yyyy-MM-dd"),
          end: format(today, "yyyy-MM-dd"),
        }
      case "custom":
        return {
          start: format(selected, "yyyy-MM-dd"),
          end: format(selected, "yyyy-MM-dd"),
        }
      default:
        return {
          start: format(today, "yyyy-MM-dd"),
          end: format(today, "yyyy-MM-dd"),
        }
    }
  }

  const fetchAllData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchDashboardStats(), fetchEmployeeStats(), fetchTaskTypeStats(), fetchRecentLogs()])
    } catch (error) {
      console.error("Ошибка загрузки данных:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDashboardStats = async () => {
    const { start, end } = getDateRange()

    try {
      // Общая статистика за период
      const { data: logs, error } = await supabase
        .from("task_logs")
        .select("*")
        .gte("work_date", start)
        .lte("work_date", end)

      if (error) throw error

      // Уникальные сотрудники
      const { data: employees, error: empError } = await supabase.from("user_profiles").select("id").eq("is_active", true)

      if (empError) throw empError

      const totalTasks = logs?.length || 0
      const totalTime = logs?.reduce((sum, log) => sum + log.time_spent_minutes, 0) || 0
      const totalUnits = logs?.reduce((sum, log) => sum + log.units_completed, 0) || 0

      setStats({
        totalEmployees: employees?.length || 0,
        totalTasksToday: totalTasks,
        totalTimeToday: totalTime,
        totalUnitsToday: totalUnits,
        avgTimePerTask: totalTasks > 0 ? Math.round(totalTime / totalTasks) : 0,
      })
    } catch (error) {
      console.error("Ошибка загрузки общей статистики:", error)
    }
  }

  const fetchEmployeeStats = async () => {
    const { start, end } = getDateRange()

    try {
      const { data, error } = await supabase
        .from("task_logs")
        .select("employee_id, units_completed, time_spent_minutes, user_profiles(full_name, position)")
        .gte("work_date", start)
        .lte("work_date", end)

      if (error) throw error

      const statsMap = new Map<string, EmployeeStats>()

      data?.forEach((log: any) => {
        const employeeId = log.employee_id
        const existing = statsMap.get(employeeId) || {
          employee_id: employeeId,
          full_name: log.employees.full_name,
          total_tasks: 0,
          total_time: 0,
          total_units: 0,
        }

        existing.total_tasks += 1
        existing.total_time += log.time_spent_minutes
        existing.total_units += log.units_completed

        statsMap.set(employeeId, existing)
      })

      const sortedStats = Array.from(statsMap.values()).sort((a, b) => b.total_units - a.total_units)

      setEmployeeStats(sortedStats)
    } catch (error) {
      console.error("Ошибка загрузки статистики сотрудников:", error)
    }
  }

  const fetchTaskTypeStats = async () => {
    const { start, end } = getDateRange()

    try {
      const { data, error } = await supabase
        .from("task_logs")
        .select("task_type_id, units_completed, time_spent_minutes, task_types(name)")
        .gte("work_date", start)
        .lte("work_date", end)

      if (error) throw error

      const statsMap = new Map<number, TaskTypeStats>()

      data?.forEach((log: any) => {
        const taskTypeId = log.task_type_id
        const existing = statsMap.get(taskTypeId) || {
          task_name: log.task_types.name,
          total_units: 0,
          total_time: 0,
          total_tasks: 0,
          avg_time_per_unit: 0,
        }

        existing.total_tasks += 1
        existing.total_time += log.time_spent_minutes
        existing.total_units += log.units_completed

        statsMap.set(taskTypeId, existing)
      })

      const sortedStats = Array.from(statsMap.values())
        .map((stat) => ({
          ...stat,
          avg_time_per_unit: stat.total_units > 0 ? Math.round(stat.total_time / stat.total_units) : 0,
        }))
        .sort((a, b) => b.total_units - a.total_units)

      setTaskTypeStats(sortedStats)
    } catch (error) {
      console.error("Ошибка загрузки статистики задач:", error)
    }
  }

  const fetchRecentLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("task_logs")
        .select("*, user_profiles(full_name), task_types(name)")
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) throw error
      setRecentLogs(data || [])
    } catch (error) {
      console.error("Ошибка загрузки последних записей:", error)
    }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
  }

  const exportData = async () => {
    const { start, end } = getDateRange()

    try {
      const { data, error } = await supabase
        .from("task_logs")
        .select(
          "work_date, time_spent_minutes, units_completed, notes, , task_types!inner(name)",
        )
        .gte("work_date", start)
        .lte("work_date", end)
        .order("work_date", { ascending: false })

      if (error) throw error

      // Создаем CSV
      const headers = ["Дата", "Сотрудник", "Задача", "Единиц", "Время (мин)", "Заметки"]
      const csvContent = [
        headers.join(","),
        ...(data?.map((log: any) =>
          [
            log.work_date,
            log.employees.full_name,
            log.task_types.name,
            log.units_completed,
            log.time_spent_minutes,
            log.notes || "",
          ].join(","),
        ) || []),
      ].join("\n")

      // Скачиваем файл
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `task_report_${start}_${end}.csv`
      link.click()
    } catch (error) {
      console.error("Ошибка экспорта:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Загрузка данных...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и фильтры */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Административная панель</h1>
          <p className="text-muted-foreground">Управление и мониторинг задач сотрудников</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Сегодня</SelectItem>
              <SelectItem value="week">Неделя</SelectItem>
              <SelectItem value="month">Месяц</SelectItem>
              <SelectItem value="custom">Выбрать дату</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-40">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "dd.MM.yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={ru}
                />
              </PopoverContent>
            </Popover>
          )}

          <Button onClick={exportData} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Экспорт
          </Button>
        </div>
      </div>

      {/* Общая статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Сотрудников</p>
                <p className="text-2xl font-bold">{stats.totalEmployees}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Задач выполнено</p>
                <p className="text-2xl font-bold">{stats.totalTasksToday}</p>
              </div>
              <Target className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Общее время</p>
                <p className="text-2xl font-bold">{formatTime(stats.totalTimeToday)}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Единиц выполнено</p>
                <p className="text-2xl font-bold">{stats.totalUnitsToday}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Среднее время</p>
                <p className="text-2xl font-bold">{stats.avgTimePerTask}м</p>
              </div>
              <BarChart3 className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Детальная аналитика */}
      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees">Сотрудники</TabsTrigger>
          <TabsTrigger value="tasks">Задачи</TabsTrigger>
          <TabsTrigger value="recent">Последние записи</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Статистика сотрудников
              </CardTitle>
              <CardDescription>Производительность сотрудников за выбранный период</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {employeeStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Нет данных за выбранный период</div>
                ) : (
                  employeeStats.map((employee, index) => (
                    <div key={employee.employee_id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={index < 3 ? "default" : "secondary"}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                        >
                          {index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium">{employee.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {employee.total_tasks} задач • {formatTime(employee.total_time)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{employee.total_units}</p>
                        <p className="text-sm text-muted-foreground">единиц</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Статистика по типам задач</CardTitle>
              <CardDescription>Анализ эффективности выполнения различных типов задач</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {taskTypeStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Нет данных за выбранный период</div>
                ) : (
                  taskTypeStats.map((taskType) => (
                    <div key={taskType.task_name} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium">{taskType.task_name}</h3>
                        <Badge variant="outline">{taskType.total_tasks} задач</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Единиц</p>
                          <p className="font-bold">{taskType.total_units}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Время</p>
                          <p className="font-bold">{formatTime(taskType.total_time)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Мин/единица</p>
                          <p className="font-bold">{taskType.avg_time_per_unit}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Последние записи</CardTitle>
              <CardDescription>10 последних выполненных задач</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Нет записей</div>
                ) : (
                  recentLogs.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{log.employees.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {log.task_types.name} • {log.work_date}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{log.units_completed} ед.</p>
                        <p className="text-sm text-muted-foreground">{formatTime(log.time_spent_minutes)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
