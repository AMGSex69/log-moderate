"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Clock, Target, Users } from "lucide-react"
import { supabase, type EmployeeStats } from "@/lib/supabase"

export default function StatsPanel() {
  const [stats, setStats] = useState<EmployeeStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from("task_logs")
        .select("employee_id, units_completed, time_spent_minutes, employees(full_name)")
        .gte("work_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])

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

      const sortedStats = Array.from(statsMap.values())
        .sort((a, b) => b.total_units - a.total_units)
        .slice(0, 5)

      setStats(sortedStats)
    } catch (error) {
      console.error("Ошибка загрузки статистики:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Статистика команды
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Загрузка...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Лидеры недели
        </CardTitle>
        <CardDescription>Топ-5 сотрудников по количеству выполненных задач</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stats.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Пока нет данных
            </div>
          ) : (
            stats.map((employee, index) => (
              <div key={employee.employee_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={index === 0 ? "default" : "secondary"}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                  >
                    {index + 1}
                  </Badge>
                  <div>
                    <p className="font-medium">{employee.full_name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {employee.total_units} ед.
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(employee.total_time)}
                      </span>
                    </div>
                  </div>
                </div>
                {index === 0 && <Trophy className="h-5 w-5 text-yellow-500" />}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
