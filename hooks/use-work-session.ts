"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
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

export function useWorkSession() {
  const { user } = useAuth()
  const [currentSession, setCurrentSession] = useState<WorkSession | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [loading, setLoading] = useState(false)
  const fetchingRef = useRef(false)
  const lastFetchRef = useRef(0)

  const fetchCurrentSession = useCallback(async () => {
    if (!user || fetchingRef.current) return

    // Предотвращаем частые запросы (не чаще раза в 10 секунд)
    const now = Date.now()
    if (now - lastFetchRef.current < 10000) return

    fetchingRef.current = true
    lastFetchRef.current = now

    try {
      // Проверяем кэш
      const cacheKey = `work_session_${user.id}`
      const cached = appCache.get(cacheKey)
      if (cached) {
        setCurrentSession(cached)
        setIsWorking(!!cached?.clock_in_time && !cached?.clock_out_time)
        return
      }

      setLoading(true)
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
      const working = !!data?.clock_in_time && !data?.clock_out_time
      setIsWorking(working)

      // Кэшируем на 2 минуты
      appCache.set(cacheKey, data, 2)
    } catch (error) {
      console.error("Ошибка загрузки рабочей смены:", error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [user])

  // Убираем автоматические обновления - только по требованию
  const updateSessionCache = useCallback(
    (session: WorkSession | null) => {
      if (user) {
        const cacheKey = `work_session_${user.id}`
        appCache.set(cacheKey, session, 2)
      }
      setCurrentSession(session)
      setIsWorking(!!session?.clock_in_time && !session?.clock_out_time)
    },
    [user],
  )

  // Загружаем только при монтировании
  useEffect(() => {
    if (user) {
      fetchCurrentSession()
    }
  }, [user])

  const refreshSession = useCallback(async () => {
    if (user) {
      const cacheKey = `work_session_${user.id}`
      appCache.delete(cacheKey)
      await fetchCurrentSession()
    }
  }, [user, fetchCurrentSession])

  return {
    currentSession,
    isWorking,
    loading,
    fetchCurrentSession,
    updateSessionCache,
    refreshSession,
  }
}
