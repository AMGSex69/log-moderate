"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { optimizedCache } from "@/lib/cache-optimized"
import { perfMonitor } from "@/lib/performance"

export function useOptimizedStats(userId: string) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    if (!userId) return

    const endTimer = perfMonitor.startTimer("fetchUserStats")

    try {
      // Используем предзагрузку для критических данных
      const [employeeId, logsData] = await Promise.all([
        optimizedCache.preload(
          `employee_id_${userId}`,
          () => authService.getEmployeeId(userId).then((result) => result.employeeId),
          60, // 1 час
          "high",
        ),
        optimizedCache.preload(
          `user_logs_${userId}`,
          async () => {
            const { employeeId } = await authService.getEmployeeId(userId)
            if (!employeeId) return []

            const { data, error } = await supabase
              .from("task_logs")
              .select("time_spent_minutes, units_completed, work_date, task_types(name)")
              .eq("employee_id", employeeId)
              .order("work_date", { ascending: false })
              .limit(1000) // Ограничиваем количество записей

            if (error) throw error
            return data || []
          },
          5, // 5 минут
          "high",
        ),
      ])

      if (!employeeId || !logsData) return

      // Вычисляем статистику
      const totalTasks = logsData.length
      const totalTime = logsData.reduce((sum: number, log: any) => sum + log.time_spent_minutes, 0)
      const totalUnits = logsData.reduce((sum: number, log: any) => sum + log.units_completed, 0)

      // Кэшируем вычисленную статистику
      const calculatedStats = {
        total_tasks: totalTasks,
        total_time: totalTime,
        total_units: totalUnits,
        avg_time_per_task: totalTasks > 0 ? Math.round(totalTime / totalTasks) : 0,
      }

      optimizedCache.set(`user_stats_${userId}`, calculatedStats, 10, "medium")
      setStats(calculatedStats)
    } catch (error) {
      console.error("Ошибка загрузки статистики:", error)
    } finally {
      setLoading(false)
      endTimer()
    }
  }, [userId])

  useEffect(() => {
    // Проверяем кэш перед загрузкой
    const cachedStats = optimizedCache.get(`user_stats_${userId}`)
    if (cachedStats) {
      setStats(cachedStats)
      setLoading(false)
      return
    }

    fetchStats()
  }, [userId, fetchStats])

  return useMemo(
    () => ({
      stats,
      loading,
      refetch: fetchStats,
    }),
    [stats, loading, fetchStats],
  )
}
