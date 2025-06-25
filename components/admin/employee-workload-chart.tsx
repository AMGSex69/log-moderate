"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { CalendarIcon, BarChart3 } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface WorkloadData {
  hour: number
  tasks: number
  time_minutes: number
  units: number
}

interface EmployeeWorkloadChartProps {
  employeeId?: string
}

export default function EmployeeWorkloadChart({ employeeId }: EmployeeWorkloadChartProps) {
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>(employeeId || "")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [workloadData, setWorkloadData] = useState<WorkloadData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (selectedEmployee) {
      fetchWorkloadData()
    }
  }, [selectedEmployee, selectedDate])

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .not("employee_id", "is", null)
        .order("full_name")

      if (error) throw error
      setEmployees(data || [])

      if (!employeeId && data && data.length > 0) {
        setSelectedEmployee(data[0].id)
      }
    } catch (error) {
      console.error("Ошибка загрузки сотрудников:", error)
    }
  }

  const fetchWorkloadData = async () => {
    if (!selectedEmployee) return

    setLoading(true)
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd")

      // Получаем задачи за день
      const { data: tasks, error: tasksError } = await supabase
        .from("task_logs")
        .select("started_at, created_at, time_spent_minutes, units_completed")
        .eq("employee_id", selectedEmployee)
        .eq("work_date", dateStr)

      if (tasksError) throw tasksError

      // Получаем активные сессии за день
      const { data: sessions, error: sessionsError } = await supabase
        .from("active_sessions")
        .select("started_at, last_heartbeat")
        .eq("employee_id", selectedEmployee)
        .gte("started_at", `${dateStr}T00:00:00`)
        .lt("started_at", `${dateStr}T23:59:59`)

      if (sessionsError) throw sessionsError

      // Создаем массив для 24 часов
      const hourlyData: WorkloadData[] = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        tasks: 0,
        time_minutes: 0,
        units: 0,
      }))

      // Обрабатываем завершенные задачи
      tasks?.forEach((task: any) => {
        const startTime = new Date(task.started_at || task.created_at)
        const hour = startTime.getHours()

        if (hour >= 0 && hour < 24) {
          hourlyData[hour].tasks += 1
          hourlyData[hour].time_minutes += task.time_spent_minutes
          hourlyData[hour].units += task.units_completed
        }
      })

      // Обрабатываем активные сессии
      sessions?.forEach((session: any) => {
        const startTime = new Date(session.started_at)
        const endTime = new Date(session.last_heartbeat)
        const startHour = startTime.getHours()
        const endHour = endTime.getHours()

        // Добавляем время активности по часам
        for (let hour = startHour; hour <= endHour && hour < 24; hour++) {
          const hourStart = new Date(startTime)
          hourStart.setHours(hour, 0, 0, 0)

          const hourEnd = new Date(startTime)
          hourEnd.setHours(hour, 59, 59, 999)

          const sessionStart = hour === startHour ? startTime : hourStart
          const sessionEnd = hour === endHour ? endTime : hourEnd

          const durationMinutes = Math.max(0, (sessionEnd.getTime() - sessionStart.getTime()) / 60000)

          if (durationMinutes > 0) {
            hourlyData[hour].time_minutes += Math.round(durationMinutes)
          }
        }
      })

      setWorkloadData(hourlyData)
    } catch (error) {
      console.error("Ошибка загрузки данных загруженности:", error)
    } finally {
      setLoading(false)
    }
  }

  const maxTime = Math.max(...workloadData.map((d) => d.time_minutes), 1)
  const maxTasks = Math.max(...workloadData.map((d) => d.tasks), 1)

  const selectedEmployeeName = employees.find((emp) => emp.id === selectedEmployee)?.full_name || "Неизвестно"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          График загруженности
        </CardTitle>
        <CardDescription>Почасовая активность сотрудника: {selectedEmployeeName}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          {!employeeId && (
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
          )}

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
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-4xl animate-spin">📊</div>
            <div className="mt-2">Загрузка данных...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* График времени */}
            <div>
              <h4 className="font-medium mb-2">Время работы (минуты)</h4>
              <div className="flex items-end gap-1 h-32 border-b border-l pl-2 pb-2">
                {workloadData.map((data) => {
                  const height = maxTime > 0 ? (data.time_minutes / maxTime) * 100 : 0
                  return (
                    <div key={`time-${data.hour}`} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                        style={{ height: `${height}%`, minHeight: data.time_minutes > 0 ? "2px" : "0px" }}
                        title={`${data.hour}:00 - ${data.time_minutes} мин`}
                      />
                      <span className="text-xs mt-1 text-muted-foreground">{data.hour}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* График задач */}
            <div>
              <h4 className="font-medium mb-2">Количество задач</h4>
              <div className="flex items-end gap-1 h-20 border-b border-l pl-2 pb-2">
                {workloadData.map((data) => {
                  const height = maxTasks > 0 ? (data.tasks / maxTasks) * 100 : 0
                  return (
                    <div key={`tasks-${data.hour}`} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-green-500 rounded-t transition-all duration-300 hover:bg-green-600"
                        style={{ height: `${height}%`, minHeight: data.tasks > 0 ? "2px" : "0px" }}
                        title={`${data.hour}:00 - ${data.tasks} задач`}
                      />
                      <span className="text-xs mt-1 text-muted-foreground">{data.hour}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Сводка */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round((workloadData.reduce((sum, d) => sum + d.time_minutes, 0) / 60) * 10) / 10}ч
                </div>
                <div className="text-sm text-muted-foreground">Общее время</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {workloadData.reduce((sum, d) => sum + d.tasks, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Всего задач</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {workloadData.reduce((sum, d) => sum + d.units, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Единиц выполнено</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
