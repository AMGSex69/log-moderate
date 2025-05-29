"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { GAME_CONFIG } from "@/lib/game-config"

export interface TaskStats {
  task_name: string
  task_group: string
  total_count: number
  total_time: number
  avg_time: number
  last_completed: string
  rank_position: number
  total_users: number
  total_units: number
  total_coins: number
}

export interface DailyStats {
  date: string
  tasks_completed: number
  total_time: number
  unique_tasks: number
  most_active_task: string
  total_units: number
}

export interface UserRanking {
  employee_id: string
  user_name: string
  total_count: number
  total_time: number
  rank: number
}

export function useDetailedStats(userId: string, period: "day" | "week" | "month" = "month") {
  const [taskStats, setTaskStats] = useState<TaskStats[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [userRankings, setUserRankings] = useState<Record<string, UserRanking[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      fetchDetailedStats()
    }
  }, [userId, period])

  const fetchDetailedStats = async () => {
    setLoading(true)

    try {
      // Получаем employee_id для пользователя
      const { employeeId, error: empError } = await authService.getEmployeeId(userId)
      if (empError || !employeeId) {
        console.error("Не удалось найти employee_id:", empError)
        setLoading(false)
        return
      }

      const endDate = new Date()
      const startDate = new Date()

      switch (period) {
        case "day":
          startDate.setDate(endDate.getDate() - 7)
          break
        case "week":
          startDate.setDate(endDate.getDate() - 30)
          break
        case "month":
          startDate.setMonth(endDate.getMonth() - 3)
          break
      }

      const startDateStr = startDate.toISOString().split("T")[0]
      const endDateStr = endDate.toISOString().split("T")[0]

      // Получаем детальную статистику по задачам для текущего пользователя
      const { data: taskData, error: taskError } = await supabase
        .from("task_logs")
        .select(`
          task_type_id,
          time_spent_minutes,
          units_completed,
          work_date,
          created_at,
          task_types!inner(name)
        `)
        .eq("employee_id", employeeId)
        .gte("work_date", startDateStr)
        .lte("work_date", endDateStr)
        .order("work_date", { ascending: false })

      if (taskError) {
        console.error("Ошибка загрузки задач пользователя:", taskError)
        setLoading(false)
        return
      }

      // Получаем статистику всех пользователей для рейтингов
      const { data: allUsersData, error: allUsersError } = await supabase
        .from("task_logs")
        .select(`
          employee_id,
          task_type_id,
          time_spent_minutes,
          units_completed,
          task_types!inner(name),
          employees!inner(full_name)
        `)
        .gte("work_date", startDateStr)
        .lte("work_date", endDateStr)

      if (allUsersError) {
        console.error("Ошибка загрузки данных всех пользователей:", allUsersError)
      }

      // Обрабатываем статистику по задачам
      const taskStatsMap = new Map<string, any>()

      taskData?.forEach((log: any) => {
        const taskName = log.task_types?.name || "Unknown"
        const existing = taskStatsMap.get(taskName) || {
          task_name: taskName,
          task_group: getTaskGroup(taskName),
          total_count: 0,
          total_time: 0,
          total_units: 0,
          total_coins: 0,
          last_completed: log.work_date,
        }

        existing.total_count++
        existing.total_time += log.time_spent_minutes || 0
        existing.total_units += log.units_completed || 0

        // Рассчитываем монеты
        const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
        existing.total_coins += (log.units_completed || 0) * coinsPerUnit

        // Обновляем последнюю дату выполнения
        if (log.work_date > existing.last_completed) {
          existing.last_completed = log.work_date
        }

        taskStatsMap.set(taskName, existing)
      })

      // Вычисляем рейтинги по задачам
      const rankingsMap = new Map<string, UserRanking[]>()

      allUsersData?.forEach((log: any) => {
        const taskName = log.task_types?.name || "Unknown"
        if (!rankingsMap.has(taskName)) {
          rankingsMap.set(taskName, [])
        }

        const userStats = rankingsMap.get(taskName)!
        const existing = userStats.find((u) => u.employee_id === log.employee_id)

        if (existing) {
          existing.total_count++
          existing.total_time += log.time_spent_minutes || 0
        } else {
          userStats.push({
            employee_id: log.employee_id,
            user_name: log.employees?.full_name || `User ${log.employee_id}`,
            total_count: 1,
            total_time: log.time_spent_minutes || 0,
            rank: 0,
          })
        }
      })

      // Сортируем и присваиваем ранги
      rankingsMap.forEach((rankings, taskName) => {
        rankings.sort((a, b) => b.total_count - a.total_count)
        rankings.forEach((user, index) => {
          user.rank = index + 1
        })
      })

      // Добавляем ранги к статистике задач
      const finalTaskStats = Array.from(taskStatsMap.values()).map((stat) => {
        const rankings = rankingsMap.get(stat.task_name) || []
        const userRank = rankings.find((r) => r.employee_id === employeeId)

        return {
          ...stat,
          avg_time: stat.total_count > 0 ? Math.round(stat.total_time / stat.total_count) : 0,
          rank_position: userRank?.rank || 0,
          total_users: rankings.length,
        }
      })

      // Группируем по дням для дневной статистики
      const dailyStatsMap = new Map<string, DailyStats>()
      const taskCountByDay = new Map<string, Map<string, number>>()

      taskData?.forEach((log: any) => {
        const date = log.work_date
        const taskName = log.task_types?.name || "Unknown"

        const existing = dailyStatsMap.get(date) || {
          date,
          tasks_completed: 0,
          total_time: 0,
          unique_tasks: 0,
          most_active_task: "",
          total_units: 0,
        }

        existing.tasks_completed++
        existing.total_time += log.time_spent_minutes || 0
        existing.total_units += log.units_completed || 0

        // Отслеживаем количество задач по типам для определения самой активной
        if (!taskCountByDay.has(date)) {
          taskCountByDay.set(date, new Map())
        }
        const dayTasks = taskCountByDay.get(date)!
        dayTasks.set(taskName, (dayTasks.get(taskName) || 0) + 1)

        dailyStatsMap.set(date, existing)
      })

      // Определяем самую активную задачу для каждого дня и уникальные задачи
      dailyStatsMap.forEach((dayStats, date) => {
        const dayTasks = taskCountByDay.get(date)
        if (dayTasks) {
          dayStats.unique_tasks = dayTasks.size

          // Находим самую частую задачу
          let maxCount = 0
          let mostActiveTask = ""
          dayTasks.forEach((count, taskName) => {
            if (count > maxCount) {
              maxCount = count
              mostActiveTask = taskName
            }
          })
          dayStats.most_active_task = mostActiveTask
        }
      })

      setTaskStats(finalTaskStats.sort((a, b) => b.total_count - a.total_count))
      setDailyStats(Array.from(dailyStatsMap.values()).sort((a, b) => b.date.localeCompare(a.date)))
      setUserRankings(Object.fromEntries(rankingsMap))
    } catch (error) {
      console.error("Ошибка загрузки детальной статистики:", error)
    } finally {
      setLoading(false)
    }
  }

  return { taskStats, dailyStats, userRankings, loading, refetch: fetchDetailedStats }
}

function getTaskGroup(taskName: string): string {
  // Определяем группу задачи на основе конфигурации
  for (const [groupName, groupData] of Object.entries(GAME_CONFIG.TASK_GROUPS)) {
    if (groupData.tasks.includes(taskName)) {
      return groupName
    }
  }
  return "Прочее"
}
