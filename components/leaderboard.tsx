"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase, type TaskType } from "@/lib/supabase"
import PixelCard from "./pixel-card"
import { GAME_CONFIG } from "@/lib/game-config"

interface LeaderboardEntry {
  employee_id: string
  full_name: string
  total_units: number
  total_time: number
  total_tasks: number
  total_coins: number
  avg_time_per_unit: number
}

export default function Leaderboard() {
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
  const [selectedTask, setSelectedTask] = useState<string>("all")
  const [timeframe, setTimeframe] = useState<string>("week")
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTaskTypes()
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [selectedTask, timeframe])

  const fetchTaskTypes = async () => {
    try {
      const { data, error } = await supabase.from("task_types").select("*").order("name")
      if (error) throw error
      setTaskTypes(data || [])
    } catch (error) {
      console.error("Ошибка загрузки типов задач:", error)
    }
  }

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const days = timeframe === "day" ? 1 : timeframe === "week" ? 7 : 30
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      let query = supabase
        .from("task_logs")
        .select(
          "employee_id, units_completed, time_spent_minutes, task_type_id, employees(full_name), task_types(name)",
        )
        .gte("work_date", startDate.toISOString().split("T")[0])

      if (selectedTask !== "all") {
        query = query.eq("task_type_id", Number.parseInt(selectedTask))
      }

      const { data, error } = await query

      if (error) throw error

      // Группируем по сотрудникам
      const statsMap = new Map<string, LeaderboardEntry>()

      data?.forEach((log: any) => {
        const employeeId = log.employee_id
        const existing = statsMap.get(employeeId) || {
          employee_id: employeeId,
          full_name: log.employees.full_name,
          total_units: 0,
          total_time: 0,
          total_tasks: 0,
          total_coins: 0,
          avg_time_per_unit: 0,
        }

        existing.total_tasks += 1
        existing.total_time += log.time_spent_minutes
        existing.total_units += log.units_completed

        // Рассчитываем монеты
        const taskName = log.task_types.name
        const coinsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 5
        existing.total_coins += log.units_completed * coinsPerUnit

        statsMap.set(employeeId, existing)
      })

      // Рассчитываем среднее время и сортируем
      const sortedStats = Array.from(statsMap.values())
        .map((stat) => ({
          ...stat,
          avg_time_per_unit: stat.total_units > 0 ? Math.round(stat.total_time / stat.total_units) : 0,
        }))
        .sort((a, b) => b.total_coins - a.total_coins)

      setLeaderboard(sortedStats)
    } catch (error) {
      console.error("Ошибка загрузки лидерборда:", error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return "🥇"
      case 1:
        return "🥈"
      case 2:
        return "🥉"
      default:
        return `#${index + 1}`
    }
  }

  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return "from-yellow-200 to-yellow-300 border-yellow-500"
      case 1:
        return "from-gray-200 to-gray-300 border-gray-500"
      case 2:
        return "from-orange-200 to-orange-300 border-orange-500"
      default:
        return "from-blue-100 to-purple-100 border-black"
    }
  }

  return (
    <PixelCard>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl">🏆</span>
          <h2 className="text-2xl font-bold">Лидерборд</h2>
        </div>

        <div className="flex gap-4 mb-6">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-40 border-2 border-black">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">За день</SelectItem>
              <SelectItem value="week">За неделю</SelectItem>
              <SelectItem value="month">За месяц</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedTask} onValueChange={setSelectedTask}>
            <SelectTrigger className="w-60 border-2 border-black">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все задачи</SelectItem>
              {taskTypes.map((task) => (
                <SelectItem key={task.id} value={task.id.toString()}>
                  {task.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-4xl animate-spin">⚡</div>
              <div className="mt-2">Загрузка рейтинга...</div>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">😴</div>
              <div>Нет данных за выбранный период</div>
            </div>
          ) : (
            leaderboard.map((entry, index) => (
              <PixelCard
                key={entry.employee_id}
                className={`bg-gradient-to-r ${getRankColor(index)}`}
                glowing={index === 0}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold">{getRankIcon(index)}</div>
                      <div>
                        <div className="font-bold text-lg">{entry.full_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {entry.total_tasks} задач • {Math.floor(entry.total_time / 60)}ч {entry.total_time % 60}м
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">🪙</span>
                        <span className="font-bold text-xl text-yellow-600">{entry.total_coins.toLocaleString()}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{entry.total_units} единиц</div>
                    </div>
                  </div>
                </div>
              </PixelCard>
            ))
          )}
        </div>
      </div>
    </PixelCard>
  )
}
