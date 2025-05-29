"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabase"
import { GAME_CONFIG } from "@/lib/game-config"
import { User, TrendingUp, Clock, Target, Award, Calendar } from "lucide-react"
import { format, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import { ru } from "date-fns/locale"

interface EmployeeTaskStats {
  task_name: string
  total_units: number
  total_time: number
  total_tasks: number
  avg_time_per_unit: number
  total_coins: number
  percentage_of_work: number
}

interface EmployeeOverallStats {
  employee_id: string
  full_name: string
  total_tasks: number
  total_units: number
  total_time: number
  total_coins: number
  avg_tasks_per_day: number
  most_productive_task: string
  task_breakdown: EmployeeTaskStats[]
}

interface PeriodStats {
  period: string
  tasks: number
  units: number
  time: number
  coins: number
}

export default function EmployeeStats() {
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>("")
  const [timeframe, setTimeframe] = useState<string>("all")
  const [employeeStats, setEmployeeStats] = useState<EmployeeOverallStats | null>(null)
  const [periodStats, setPeriodStats] = useState<PeriodStats[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeStats()
      fetchPeriodStats()
    }
  }, [selectedEmployee, timeframe])

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name")

      if (error) throw error
      setEmployees(data || [])
      if (data && data.length > 0) {
        setSelectedEmployee(data[0].id)
      }
    } catch (error) {
      console.error("Ошибка загрузки сотрудников:", error)
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

  const fetchEmployeeStats = async () => {
    if (!selectedEmployee) return

    setLoading(true)
    try {
      const { start, end } = getDateRange()

      let query = supabase
        .from("task_logs")
        .select("units_completed, time_spent_minutes, work_date, task_types(name)")
        .eq("employee_id", selectedEmployee)

      if (start && end) {
        query = query.gte("work_date", start).lte("work_date", end)
      }

      const { data: logs, error } = await query

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
          most_productive_task: "Нет данных",
          task_breakdown: [],
        })
        setLoading(false)
        return
      }

      // Группируем по типам задач
      const taskMap = new Map<string, EmployeeTaskStats>()
      let totalTasks = 0
      let totalUnits = 0
      let totalTime = 0
      let totalCoins = 0

      logs.forEach((log: any) => {
        const taskName = log.task_types.name
        const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
        const taskCoins = log.units_completed * coinsPerUnit

        const existing = taskMap.get(taskName) || {
          task_name: taskName,
          total_units: 0,
          total_time: 0,
          total_tasks: 0,
          avg_time_per_unit: 0,
          total_coins: 0,
          percentage_of_work: 0,
        }

        existing.total_tasks += 1
        existing.total_time += log.time_spent_minutes
        existing.total_units += log.units_completed
        existing.total_coins += taskCoins

        taskMap.set(taskName, existing)

        totalTasks += 1
        totalUnits += log.units_completed
        totalTime += log.time_spent_minutes
        totalCoins += taskCoins
      })

      // Рассчитываем проценты и средние значения
      const taskBreakdown = Array.from(taskMap.values()).map((task) => ({
        ...task,
        avg_time_per_unit: task.total_units > 0 ? Math.round(task.total_time / task.total_units) : 0,
        percentage_of_work: totalTime > 0 ? Math.round((task.total_time / totalTime) * 100) : 0,
      }))

      taskBreakdown.sort((a, b) => b.total_units - a.total_units)

      // Рассчитываем уникальные дни
      const uniqueDays = new Set(logs.map((log: any) => log.work_date)).size
      const avgTasksPerDay = uniqueDays > 0 ? Math.round((totalTasks / uniqueDays) * 10) / 10 : 0

      setEmployeeStats({
        employee_id: selectedEmployee,
        full_name: employee?.full_name || "Неизвестно",
        total_tasks: totalTasks,
        total_units: totalUnits,
        total_time: totalTime,
        total_coins: totalCoins,
        avg_tasks_per_day: avgTasksPerDay,
        most_productive_task: taskBreakdown[0]?.task_name || "Нет данных",
        task_breakdown: taskBreakdown,
      })
    } catch (error) {
      console.error("Ошибка загрузки статистики сотрудника:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPeriodStats = async () => {
    if (!selectedEmployee) return

    try {
      const periods: PeriodStats[] = []
      const now = new Date()

      // Получаем данные за последние 12 недель или 6 месяцев
      const periodsCount = timeframe === "week" ? 12 : 6
      const isWeekly = timeframe === "week"

      for (let i = 0; i < periodsCount; i++) {
        const periodStart = isWeekly
          ? startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
          : startOfMonth(subMonths(now, i))

        const periodEnd = isWeekly ? endOfWeek(periodStart, { weekStartsOn: 1 }) : endOfMonth(periodStart)

        const { data: logs } = await supabase
          .from("task_logs")
          .select("units_completed, time_spent_minutes, task_types(name)")
          .eq("employee_id", selectedEmployee)
          .gte("work_date", format(periodStart, "yyyy-MM-dd"))
          .lte("work_date", format(periodEnd, "yyyy-MM-dd"))

        let periodTasks = 0
        let periodUnits = 0
        let periodTime = 0
        let periodCoins = 0

        logs?.forEach((log: any) => {
          const taskName = log.task_types.name
          const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5

          periodTasks += 1
          periodUnits += log.units_completed
          periodTime += log.time_spent_minutes
          periodCoins += log.units_completed * coinsPerUnit
        })

        periods.unshift({
          period: isWeekly
            ? `${format(periodStart, "dd.MM", { locale: ru })} - ${format(periodEnd, "dd.MM", { locale: ru })}`
            : format(periodStart, "LLLL yyyy", { locale: ru }),
          tasks: periodTasks,
          units: periodUnits,
          time: periodTime,
          coins: periodCoins,
        })
      }

      setPeriodStats(periods)
    } catch (error) {
      console.error("Ошибка загрузки периодной статистики:", error)
    }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
  }

  if (!selectedEmployee) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Выберите сотрудника для просмотра статистики</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Фильтры */}
      <div className="flex gap-4">
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Выберите сотрудника" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.full_name}
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
            <p>Загрузка статистики...</p>
          </CardContent>
        </Card>
      ) : (
        employeeStats && (
          <>
            {/* Общая статистика */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold">{employeeStats.total_tasks}</div>
                  <div className="text-sm text-muted-foreground">Всего задач</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <div className="text-2xl font-bold">{employeeStats.total_units}</div>
                  <div className="text-sm text-muted-foreground">Единиц выполнено</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                  <div className="text-2xl font-bold">{formatTime(employeeStats.total_time)}</div>
                  <div className="text-sm text-muted-foreground">Общее время</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <Award className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                  <div className="text-2xl font-bold">{employeeStats.total_coins.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Монет заработано</div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="breakdown" className="space-y-4">
              <TabsList>
                <TabsTrigger value="breakdown">Разбивка по задачам</TabsTrigger>
                <TabsTrigger value="trends">Динамика по периодам</TabsTrigger>
              </TabsList>

              <TabsContent value="breakdown">
                <Card>
                  <CardHeader>
                    <CardTitle>Детализация по типам задач</CardTitle>
                    <CardDescription>
                      Среднее количество задач в день: <strong>{employeeStats.avg_tasks_per_day}</strong> • Самая
                      продуктивная задача: <strong>{employeeStats.most_productive_task}</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {employeeStats.task_breakdown.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="text-4xl mb-2">📝</div>
                        <div>Нет данных за выбранный период</div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {employeeStats.task_breakdown.map((task, index) => (
                          <Card key={task.task_name} className="border">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h3 className="font-semibold">{task.task_name}</h3>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span>{task.total_tasks} задач</span>
                                    <span>{formatTime(task.total_time)}</span>
                                    <span>{task.avg_time_per_unit} мин/ед</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold">{task.total_units} ед.</div>
                                  <div className="text-sm text-yellow-600 font-medium">
                                    🪙 {task.total_coins.toLocaleString()}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Доля от общего времени</span>
                                  <span>{task.percentage_of_work}%</span>
                                </div>
                                <Progress value={task.percentage_of_work} className="h-2" />
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
                      <Calendar className="h-5 w-5" />
                      Динамика по {timeframe === "week" ? "неделям" : "месяцам"}
                    </CardTitle>
                    <CardDescription>Изменение производительности во времени</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {periodStats.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="text-4xl mb-2">📈</div>
                        <div>Нет данных для отображения динамики</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {periodStats.map((period, index) => (
                          <Card key={index} className="border">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium">{period.period}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {period.tasks} задач • {formatTime(period.time)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold">{period.units} ед.</div>
                                  <div className="text-sm text-yellow-600">🪙 {period.coins.toLocaleString()}</div>
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
