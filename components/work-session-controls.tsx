"use client"

import { useState, useEffect, useRef } from "react"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import PixelButton from "./pixel-button"
import PixelCard from "./pixel-card"
import { Clock, LogIn, LogOut, AlertTriangle } from "lucide-react"
import { appCache } from "@/lib/cache"

interface WorkSession {
  id: number
  employee_id: string
  date: string
  clock_in_time: string | null
  clock_out_time: string | null
  expected_end_time: string | null
  is_auto_clocked_out: boolean
  total_work_minutes: number
  total_task_minutes: number
  total_idle_minutes: number
}

interface WorkSessionControlsProps {
  onSessionChange?: (isWorking: boolean) => void
}

export default function WorkSessionControls({ onSessionChange }: WorkSessionControlsProps) {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const [currentSession, setCurrentSession] = useState<WorkSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [initialLoading, setInitialLoading] = useState(true)
  const timeUpdateRef = useRef<NodeJS.Timeout>()

  // Оптимизированное обновление времени
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date())
    }

    // Обновляем время только если компонент видим
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timeUpdateRef.current) {
          clearInterval(timeUpdateRef.current)
        }
      } else {
        updateTime()
        timeUpdateRef.current = setInterval(updateTime, 60000) // Каждую минуту
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    handleVisibilityChange() // Инициализация

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchCurrentSession()
    }
  }, [user])

  useEffect(() => {
    if (currentSession !== null) {
      onSessionChange?.(!!currentSession?.clock_in_time && !currentSession?.clock_out_time)
    }
  }, [currentSession, onSessionChange])

  const fetchCurrentSession = async () => {
    if (!user) return

    try {
      // Проверяем кэш
      const cacheKey = `work_session_${user.id}`
      const cached = appCache.get(cacheKey)
      if (cached) {
        setCurrentSession(cached)
        setInitialLoading(false)
        return
      }

      const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
      if (empError || !employeeId) return

      const today = new Date().toISOString().split("T")[0]

      const { data, error } = await supabase
        .from("work_sessions")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("date", today)
        .maybeSingle()

      if (error) throw error

      setCurrentSession(data)
      appCache.set(cacheKey, data, 2) // Кэш на 2 минуты
    } catch (error) {
      console.error("Ошибка загрузки рабочей смены:", error)
    } finally {
      setInitialLoading(false)
    }
  }

  const clockIn = async () => {
    if (!user || !profile || loading) return

    setLoading(true)
    try {
      const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
      if (empError || !employeeId) throw new Error("Employee not found")

      const now = new Date()
      const today = now.toISOString().split("T")[0]
      const workHours = profile.work_hours || 9
      const expectedEndTime = new Date(now.getTime() + workHours * 60 * 60 * 1000)

      let data: WorkSession

      if (currentSession) {
        const { data: updatedData, error } = await supabase
          .from("work_sessions")
          .update({
            clock_in_time: now.toISOString(),
            clock_out_time: null,
            expected_end_time: expectedEndTime.toISOString(),
            is_auto_clocked_out: false,
            total_work_minutes: 0,
            total_task_minutes: 0,
            total_idle_minutes: 0,
          })
          .eq("id", currentSession.id)
          .select()
          .single()

        if (error) throw error
        data = updatedData
      } else {
        const { data: newData, error } = await supabase
          .from("work_sessions")
          .insert({
            employee_id: employeeId,
            date: today,
            clock_in_time: now.toISOString(),
            expected_end_time: expectedEndTime.toISOString(),
            total_work_minutes: 0,
            total_task_minutes: 0,
            total_idle_minutes: 0,
          })
          .select()
          .single()

        if (error) throw error
        data = newData
      }

      setCurrentSession(data)

      // Обновляем кэш
      const cacheKey = `work_session_${user.id}`
      appCache.set(cacheKey, data, 2)

      // Асинхронно обновляем статус
      authService.updateOnlineStatus(user.id, true).catch(console.error)

      onSessionChange?.(true)

      toast({
        title: "🎯 Рабочий день начат!",
        description: `Ожидаемое окончание: ${expectedEndTime.toLocaleTimeString()}`,
      })
    } catch (error) {
      console.error("Ошибка отметки прихода:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось отметить приход",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const clockOut = async () => {
    if (!user || !currentSession || loading) return

    setLoading(true)
    try {
      const now = new Date()
      const clockInTime = new Date(currentSession.clock_in_time!)
      const totalWorkMinutes = Math.floor((now.getTime() - clockInTime.getTime()) / 60000)

      // Получаем статистику задач
      const { employeeId } = await authService.getEmployeeId(user.id)
      const today = now.toISOString().split("T")[0]

      const { data: taskLogs } = await supabase
        .from("task_logs")
        .select("time_spent_minutes")
        .eq("employee_id", employeeId)
        .eq("work_date", today)

      const totalTaskMinutes = taskLogs?.reduce((sum, log) => sum + log.time_spent_minutes, 0) || 0
      const totalIdleMinutes = Math.max(0, totalWorkMinutes - totalTaskMinutes)

      const { error } = await supabase
        .from("work_sessions")
        .update({
          clock_out_time: now.toISOString(),
          total_work_minutes: totalWorkMinutes,
          total_task_minutes: totalTaskMinutes,
          total_idle_minutes: totalIdleMinutes,
        })
        .eq("id", currentSession.id)

      if (error) throw error

      const updatedSession = {
        ...currentSession,
        clock_out_time: now.toISOString(),
        total_work_minutes: totalWorkMinutes,
        total_task_minutes: totalTaskMinutes,
        total_idle_minutes: totalIdleMinutes,
      }

      setCurrentSession(updatedSession)

      // Обновляем кэш
      const cacheKey = `work_session_${user.id}`
      appCache.set(cacheKey, updatedSession, 2)

      // Асинхронно обновляем статус
      authService.updateOnlineStatus(user.id, false).catch(console.error)

      onSessionChange?.(false)

      toast({
        title: "👋 Рабочий день завершен!",
        description: `Отработано: ${formatDuration(totalWorkMinutes)}`,
      })
    } catch (error) {
      console.error("Ошибка отметки ухода:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось отметить уход",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString()
  }

  const getWorkingTime = () => {
    if (!currentSession?.clock_in_time) return 0
    const clockInTime = new Date(currentSession.clock_in_time)
    return Math.floor((currentTime.getTime() - clockInTime.getTime()) / 60000)
  }

  const isOvertime = () => {
    if (!currentSession?.expected_end_time) return false
    return currentTime > new Date(currentSession.expected_end_time)
  }

  const isWorking = currentSession?.clock_in_time && !currentSession?.clock_out_time

  if (initialLoading) {
    return (
      <PixelCard>
        <CardContent className="p-6 text-center">
          <div className="text-4xl animate-spin mb-2">⏰</div>
          <div className="text-sm text-muted-foreground">Загрузка...</div>
        </CardContent>
      </PixelCard>
    )
  }

  return (
    <PixelCard className={isWorking ? "bg-gradient-to-r from-green-200 to-blue-200" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Рабочая смена
        </CardTitle>
        <CardDescription>{isWorking ? "Вы на рабочем месте" : "Отметьтесь для начала работы"}</CardDescription>
      </CardHeader>
      <CardContent>
        {!isWorking ? (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="text-4xl mb-2">🏢</div>
              <div className="text-muted-foreground">
                {currentSession?.clock_out_time ? "Готовы продолжить рабочий день?" : "Готовы начать рабочий день?"}
              </div>
              {currentSession?.clock_out_time && (
                <div className="text-sm text-muted-foreground mt-2">
                  Последний уход: {formatTime(currentSession.clock_out_time)}
                </div>
              )}
            </div>
            <PixelButton onClick={clockIn} disabled={loading} className="w-full" variant="success">
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? "Отмечаемся..." : currentSession?.clock_out_time ? "Вернулся на работу" : "Пришел на работу"}
            </PixelButton>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Начало смены</div>
                <div className="font-bold">{formatTime(currentSession.clock_in_time!)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Ожидаемый конец</div>
                <div className="font-bold">{formatTime(currentSession.expected_end_time!)}</div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-mono font-bold">{formatDuration(getWorkingTime())}</div>
              <div className="text-sm text-muted-foreground">отработано</div>
              {isOvertime() && (
                <Badge variant="destructive" className="mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Переработка
                </Badge>
              )}
            </div>

            <PixelButton onClick={clockOut} disabled={loading} className="w-full" variant="danger">
              <LogOut className="h-4 w-4 mr-2" />
              {loading ? "Отмечаемся..." : "Ушел с работы"}
            </PixelButton>
          </div>
        )}
      </CardContent>
    </PixelCard>
  )
}
