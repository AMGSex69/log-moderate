"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { CalendarIcon, Clock, AlertTriangle, CheckCircle, User, Users } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface TimelineSegment {
  start: Date
  end: Date
  type: "task" | "break" | "idle" | "offline"
  taskName?: string
  breakType?: string
  duration: number
  units?: number
}

interface EmployeeTimelineData {
  employeeId: string
  fullName: string
  workSchedule: string
  workHours: number
  clockInTime: Date | null
  clockOutTime: Date | null
  expectedEndTime: Date | null
  isAutoClockOut: boolean
  segments: TimelineSegment[]
  totalWorkTime: number
  totalTaskTime: number
  totalIdleTime: number
  totalBreakTime: number
  totalUnits: number
  isCurrentlyWorking: boolean
}

export default function EmployeeTimeline() {
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [timelineData, setTimelineData] = useState<EmployeeTimelineData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    fetchTimelineData()
  }, [selectedEmployee, selectedDate])

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, user_id")
        .eq("is_active", true)
        .order("full_name")

      if (error) throw error

      const employeesWithProfiles = []
      for (const employee of data || []) {
        if (employee.user_id) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("work_schedule, work_hours")
            .eq("id", employee.user_id)
            .single()

          employeesWithProfiles.push({
            ...employee,
            user_profiles: profile || { work_schedule: "5/2", work_hours: 9 },
          })
        } else {
          employeesWithProfiles.push({
            ...employee,
            user_profiles: { work_schedule: "5/2", work_hours: 9 },
          })
        }
      }

      setEmployees(employeesWithProfiles)
    } catch (error) {
      console.error("Ошибка загрузки сотрудников:", error)
    }
  }

  const fetchTimelineData = async () => {
    setLoading(true)
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd")

      // Если не выбран сотрудник - не загружаем данные
      if (!selectedEmployee) {
        setTimelineData([])
        setLoading(false)
        return
      }

      let employeeFilter = employees
      if (selectedEmployee !== "all") {
        employeeFilter = employees.filter((emp) => emp.id === selectedEmployee)
      } else {
        // Для "всех" показываем только тех, кто работал в этот день
        const { data: workingSessions } = await supabase
          .from("work_sessions")
          .select("employee_id")
          .eq("date", dateStr)
          .not("clock_in_time", "is", null)

        const workingEmployeeIds = workingSessions?.map((s) => s.employee_id) || []

        // Также добавляем тех, у кого есть задачи в этот день
        const { data: taskLogs } = await supabase.from("task_logs").select("employee_id").eq("work_date", dateStr)

        const taskEmployeeIds = taskLogs?.map((t) => t.employee_id) || []

        const allActiveEmployeeIds = [...new Set([...workingEmployeeIds, ...taskEmployeeIds])]
        employeeFilter = employees.filter((emp) => allActiveEmployeeIds.includes(emp.id))
      }

      const timelinesData: EmployeeTimelineData[] = []

      for (const employee of employeeFilter) {
        const timeline = await buildEmployeeTimeline(employee.id, dateStr, employee)
        timelinesData.push(timeline)
      }

      // Сортируем: сначала работающие сейчас, потом по времени прихода
      timelinesData.sort((a, b) => {
        if (a.isCurrentlyWorking && !b.isCurrentlyWorking) return -1
        if (!a.isCurrentlyWorking && b.isCurrentlyWorking) return 1

        if (a.clockInTime && b.clockInTime) {
          return a.clockInTime.getTime() - b.clockInTime.getTime()
        }

        return a.fullName.localeCompare(b.fullName)
      })

      setTimelineData(timelinesData)
    } catch (error) {
      console.error("Ошибка загрузки таймлайнов:", error)
    } finally {
      setLoading(false)
    }
  }

  const buildEmployeeTimeline = async (
    employeeId: string,
    date: string,
    employee: any,
  ): Promise<EmployeeTimelineData> => {
    // Получаем рабочую смену
    const { data: workSession } = await supabase
      .from("work_sessions")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("date", date)
      .single()

    // Получаем задачи с временными метками
    const { data: tasks } = await supabase
      .from("task_logs")
      .select("started_at, created_at, time_spent_minutes, units_completed, task_types(name)")
      .eq("employee_id", employeeId)
      .eq("work_date", date)
      .order("started_at")

    // Получаем перерывы
    const { data: breaks } = await supabase
      .from("break_logs")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("date", date)
      .order("start_time")

    const segments: TimelineSegment[] = []
    let totalTaskTime = 0
    let totalBreakTime = 0
    let totalUnits = 0

    const clockInTime = workSession?.clock_in_time ? new Date(workSession.clock_in_time) : null
    const clockOutTime = workSession?.clock_out_time ? new Date(workSession.clock_out_time) : null
    const expectedEndTime = workSession?.expected_end_time ? new Date(workSession.expected_end_time) : null
    const isCurrentlyWorking = !!clockInTime && !clockOutTime

    if (!clockInTime) {
      // Если сотрудник не отметился, но есть задачи - показываем только задачи
      if (tasks && tasks.length > 0) {
        tasks.forEach((task: any) => {
          const startTime = new Date(task.started_at || task.created_at)
          const endTime = new Date(startTime.getTime() + task.time_spent_minutes * 60000)

          segments.push({
            start: startTime,
            end: endTime,
            type: "task",
            taskName: task.task_types.name,
            duration: task.time_spent_minutes,
            units: task.units_completed,
          })

          totalTaskTime += task.time_spent_minutes
          totalUnits += task.units_completed
        })
      } else {
        // Полностью offline
        const dayStart = new Date(date + "T00:00:00")
        const dayEnd = new Date(date + "T23:59:59")

        segments.push({
          start: dayStart,
          end: dayEnd,
          type: "offline",
          duration: 24 * 60,
        })
      }

      return {
        employeeId,
        fullName: employee.full_name,
        workSchedule: employee.user_profiles.work_schedule,
        workHours: employee.user_profiles.work_hours,
        clockInTime: null,
        clockOutTime: null,
        expectedEndTime: null,
        isAutoClockOut: false,
        segments,
        totalWorkTime: 0,
        totalTaskTime,
        totalIdleTime: 0,
        totalBreakTime: 0,
        totalUnits,
        isCurrentlyWorking: false,
      }
    }

    // Добавляем задачи как сегменты
    tasks?.forEach((task: any) => {
      const startTime = new Date(task.started_at || task.created_at)
      const endTime = new Date(startTime.getTime() + task.time_spent_minutes * 60000)

      segments.push({
        start: startTime,
        end: endTime,
        type: "task",
        taskName: task.task_types.name,
        duration: task.time_spent_minutes,
        units: task.units_completed,
      })

      totalTaskTime += task.time_spent_minutes
      totalUnits += task.units_completed
    })

    // Добавляем перерывы
    breaks?.forEach((breakLog: any) => {
      const startTime = new Date(breakLog.start_time)
      const endTime = breakLog.end_time ? new Date(breakLog.end_time) : new Date()
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 60000)

      segments.push({
        start: startTime,
        end: endTime,
        type: "break",
        breakType: breakLog.break_type,
        duration,
      })

      totalBreakTime += duration
    })

    // Сортируем сегменты по времени
    segments.sort((a, b) => a.start.getTime() - b.start.getTime())

    // Находим простои между активностями
    const workEndTime = clockOutTime || new Date()
    const idleSegments = findIdleTime(segments, clockInTime, workEndTime)
    segments.push(...idleSegments)

    // Пересортировываем с простоями
    segments.sort((a, b) => a.start.getTime() - b.start.getTime())

    const totalIdleTime = idleSegments.reduce((sum, segment) => sum + segment.duration, 0)
    const totalWorkTime = clockOutTime
      ? Math.floor((clockOutTime.getTime() - clockInTime.getTime()) / 60000)
      : Math.floor((Date.now() - clockInTime.getTime()) / 60000)

    return {
      employeeId,
      fullName: employee.full_name,
      workSchedule: employee.user_profiles.work_schedule,
      workHours: employee.user_profiles.work_hours,
      clockInTime,
      clockOutTime,
      expectedEndTime,
      isAutoClockOut: workSession?.is_auto_clocked_out || false,
      segments,
      totalWorkTime,
      totalTaskTime,
      totalIdleTime,
      totalBreakTime,
      totalUnits,
      isCurrentlyWorking,
    }
  }

  const findIdleTime = (segments: TimelineSegment[], clockIn: Date, clockOut: Date): TimelineSegment[] => {
    const idleSegments: TimelineSegment[] = []
    let currentTime = clockIn

    // Фильтруем только задачи и перерывы для поиска пробелов
    const workSegments = segments
      .filter((s) => s.type === "task" || s.type === "break")
      .sort((a, b) => a.start.getTime() - b.start.getTime())

    workSegments.forEach((segment) => {
      if (segment.start.getTime() > currentTime.getTime()) {
        const idleDuration = Math.floor((segment.start.getTime() - currentTime.getTime()) / 60000)
        if (idleDuration > 5) {
          // Простои больше 5 минут
          idleSegments.push({
            start: new Date(currentTime),
            end: new Date(segment.start),
            type: "idle",
            duration: idleDuration,
          })
        }
      }
      currentTime = new Date(Math.max(currentTime.getTime(), segment.end.getTime()))
    })

    // Проверяем простой до конца рабочего дня
    if (currentTime.getTime() < clockOut.getTime()) {
      const idleDuration = Math.floor((clockOut.getTime() - currentTime.getTime()) / 60000)
      if (idleDuration > 5) {
        idleSegments.push({
          start: new Date(currentTime),
          end: new Date(clockOut),
          type: "idle",
          duration: idleDuration,
        })
      }
    }

    return idleSegments
  }

  const formatTime = (date: Date) => {
    return format(date, "HH:mm")
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
  }

  const getSegmentColor = (segment: TimelineSegment) => {
    switch (segment.type) {
      case "task":
        return "bg-green-500"
      case "break":
        return "bg-blue-500"
      case "idle":
        return "bg-red-500"
      case "offline":
        return "bg-gray-400"
      default:
        return "bg-gray-500"
    }
  }

  const getSegmentTooltip = (segment: TimelineSegment) => {
    const timeRange = `${formatTime(segment.start)} - ${formatTime(segment.end)}`
    const duration = formatDuration(segment.duration)

    switch (segment.type) {
      case "task":
        return `${segment.taskName}\n${timeRange}\n${duration}${segment.units ? `\n${segment.units} единиц` : ""}`
      case "break":
        return `${segment.breakType === "lunch" ? "Обед" : "Перерыв"}\n${timeRange}\n${duration}`
      case "idle":
        return `Простой\n${timeRange}\n${duration}`
      case "offline":
        return `Не на работе\n${timeRange}`
      default:
        return `${timeRange}\n${duration}`
    }
  }

  const getSegmentWidth = (segment: TimelineSegment, totalMinutes: number = 24 * 60) => {
    return Math.max((segment.duration / totalMinutes) * 100, 0.5) // Минимум 0.5% для видимости
  }

  const getSegmentPosition = (segment: TimelineSegment) => {
    const dayStart = new Date(segment.start)
    dayStart.setHours(0, 0, 0, 0)
    const minutesFromStart = (segment.start.getTime() - dayStart.getTime()) / 60000
    const totalMinutes = 24 * 60
    return (minutesFromStart / totalMinutes) * 100
  }

  const getWorkingEmployeesCount = () => {
    return timelineData.filter((emp) => emp.clockInTime || emp.totalTaskTime > 0).length
  }

  const getCurrentlyWorkingCount = () => {
    return timelineData.filter((emp) => emp.isCurrentlyWorking).length
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Временная шкала активности
          {selectedEmployee === "all" && (
            <Badge variant="outline" className="ml-2">
              <Users className="h-3 w-3 mr-1" />
              {getWorkingEmployeesCount()} сотрудников
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {selectedEmployee === "all"
            ? `Показаны все сотрудники, которые работали ${format(selectedDate, "dd.MM.yyyy")}. Сейчас работают: ${getCurrentlyWorkingCount()}`
            : "Детальная активность выбранного сотрудника"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Фильтры */}
        <div className="flex gap-4 mb-6">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-60">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "dd MMMM yyyy", { locale: ru })}
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

          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-60">
              <SelectValue placeholder="Выберите сотрудника" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Все работавшие сотрудники
                </div>
              </SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {emp.full_name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Временная шкала (часы) */}
        <div className="mb-4">
          <div className="flex text-xs text-muted-foreground border-b pb-1">
            {Array.from({ length: 25 }, (_, i) => (
              <div key={i} className="flex-1 text-center" style={{ width: `${100 / 24}%` }}>
                {i < 24 ? `${i.toString().padStart(2, "0")}:00` : ""}
              </div>
            ))}
          </div>
        </div>

        {/* Таймлайны сотрудников */}
        {loading ? (
          <div className="text-center py-8">
            <div className="text-4xl animate-spin">⏰</div>
            <div className="mt-2">Загрузка данных...</div>
          </div>
        ) : !selectedEmployee ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-4xl mb-2">👤</div>
            <div>Выберите сотрудника для просмотра временной шкалы</div>
          </div>
        ) : timelineData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-4xl mb-2">📅</div>
            <div>
              {selectedEmployee === "all" ? "Никто не работал в выбранную дату" : "Нет данных за выбранную дату"}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {timelineData.map((employeeData) => (
              <Card key={employeeData.employeeId} className="border-2">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{employeeData.fullName}</h3>
                        {employeeData.isCurrentlyWorking && (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Сейчас работает
                          </Badge>
                        )}
                        {employeeData.isAutoClockOut && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Авто-завершение
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        График: {employeeData.workSchedule} • {employeeData.workHours}ч в день
                        {employeeData.clockInTime && <> • Приход: {formatTime(employeeData.clockInTime)}</>}
                        {employeeData.clockOutTime && <> • Уход: {formatTime(employeeData.clockOutTime)}</>}
                      </p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-bold text-green-600">{formatDuration(employeeData.totalTaskTime)}</div>
                        <div className="text-muted-foreground">Задачи</div>
                      </div>
                      {employeeData.totalUnits > 0 && (
                        <div className="text-center">
                          <div className="font-bold text-purple-600">{employeeData.totalUnits}</div>
                          <div className="text-muted-foreground">Единиц</div>
                        </div>
                      )}
                      <div className="text-center">
                        <div className="font-bold text-blue-600">{formatDuration(employeeData.totalBreakTime)}</div>
                        <div className="text-muted-foreground">Перерывы</div>
                      </div>
                      {employeeData.totalIdleTime > 0 && (
                        <div className="text-center">
                          <div className="font-bold text-red-600 flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />
                            {formatDuration(employeeData.totalIdleTime)}
                          </div>
                          <div className="text-muted-foreground">Простои</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Временная шкала */}
                  <div className="relative h-8 bg-gray-100 rounded border">
                    {employeeData.segments.map((segment, index) => (
                      <div
                        key={index}
                        className={`absolute h-full ${getSegmentColor(segment)} opacity-80 hover:opacity-100 transition-opacity cursor-pointer rounded`}
                        style={{
                          left: `${getSegmentPosition(segment)}%`,
                          width: `${getSegmentWidth(segment)}%`,
                          minWidth: "2px",
                        }}
                        title={getSegmentTooltip(segment)}
                      />
                    ))}
                  </div>

                  {/* Легенда */}
                  <div className="flex gap-4 mt-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <span>Задачи</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <span>Перерывы</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span>Простои</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-400 rounded"></div>
                      <span>Не на работе</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
