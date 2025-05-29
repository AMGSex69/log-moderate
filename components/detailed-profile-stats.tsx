"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDetailedStats } from "@/hooks/use-detailed-stats"
import { formatDuration } from "@/lib/utils"
import PixelCard from "@/components/pixel-card"
import PixelButton from "@/components/pixel-button"
import { Trophy, TrendingUp, Calendar, Clock, Target, Medal } from "lucide-react"

interface DetailedProfileStatsProps {
  userId: string
}

export function DetailedProfileStats({ userId }: DetailedProfileStatsProps) {
  const [period, setPeriod] = useState<"day" | "week" | "month">("month")
  const { taskStats, dailyStats, userRankings, loading } = useDetailedStats(userId, period)

  if (loading) {
    return (
      <PixelCard>
        <div className="p-8 text-center">
          <div className="text-4xl animate-spin mb-4">📊</div>
          <div className="text-xl font-bold">Загрузка детальной статистики...</div>
        </div>
      </PixelCard>
    )
  }

  const topTasks = taskStats.sort((a, b) => b.total_count - a.total_count).slice(0, 5)

  const bestRanks = taskStats
    .filter((t) => t.rank_position > 0)
    .sort((a, b) => a.rank_position - b.rank_position)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Переключатель периода */}
      <div className="flex gap-2">
        <PixelButton variant={period === "day" ? "primary" : "secondary"} size="sm" onClick={() => setPeriod("day")}>
          7 дней
        </PixelButton>
        <PixelButton variant={period === "week" ? "primary" : "secondary"} size="sm" onClick={() => setPeriod("week")}>
          30 дней
        </PixelButton>
        <PixelButton
          variant={period === "month" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setPeriod("month")}
        >
          3 месяца
        </PixelButton>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-4 border-2 border-black">
          <TabsTrigger value="tasks" className="border-2 border-black">
            📋 Задачи
          </TabsTrigger>
          <TabsTrigger value="rankings" className="border-2 border-black">
            🏆 Рейтинги
          </TabsTrigger>
          <TabsTrigger value="daily" className="border-2 border-black">
            📅 По дням
          </TabsTrigger>
          <TabsTrigger value="summary" className="border-2 border-black">
            📊 Сводка
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4 mt-6">
          <PixelCard className="bg-gradient-to-r from-green-200 to-green-300">
            <div className="p-6">
              <h3 className="text-2xl font-bold flex items-center gap-2 mb-4">
                <Target className="h-6 w-6" />
                Топ-5 выполняемых задач
              </h3>
              <div className="space-y-3">
                {topTasks.map((task, index) => (
                  <PixelCard key={task.task_name} className="bg-white">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-2 border-black">
                              #{index + 1}
                            </Badge>
                            <span className="font-bold">{task.task_name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Группа: {task.task_group}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">{task.total_count} раз</div>
                          <div className="text-sm text-muted-foreground">{formatDuration(task.total_time)}</div>
                          <div className="text-xs text-muted-foreground">Среднее: {formatDuration(task.avg_time)}</div>
                        </div>
                      </div>
                    </div>
                  </PixelCard>
                ))}
              </div>
            </div>
          </PixelCard>

          <PixelCard>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Все задачи</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {taskStats.map((task) => (
                  <PixelCard key={task.task_name} className="bg-gradient-to-r from-gray-100 to-gray-200">
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-sm">{task.task_name}</div>
                          <div className="text-xs text-muted-foreground">{task.task_group}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-bold">{task.total_count} раз</div>
                          <div className="text-xs text-muted-foreground">{formatDuration(task.total_time)}</div>
                        </div>
                      </div>
                    </div>
                  </PixelCard>
                ))}
              </div>
            </div>
          </PixelCard>
        </TabsContent>

        <TabsContent value="rankings" className="space-y-4 mt-6">
          <PixelCard className="bg-gradient-to-r from-yellow-200 to-yellow-300">
            <div className="p-6">
              <h3 className="text-2xl font-bold flex items-center gap-2 mb-4">
                <Medal className="h-6 w-6" />
                Лучшие позиции в рейтингах
              </h3>
              <div className="space-y-3">
                {bestRanks.map((task) => (
                  <PixelCard key={task.task_name} className="bg-white">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-bold">{task.task_name}</div>
                          <div className="text-sm text-muted-foreground">{task.task_group}</div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <Trophy
                              className={`h-5 w-5 ${
                                task.rank_position === 1
                                  ? "text-yellow-500"
                                  : task.rank_position === 2
                                    ? "text-gray-400"
                                    : task.rank_position === 3
                                      ? "text-amber-600"
                                      : "text-muted-foreground"
                              }`}
                            />
                            <span className="text-xl font-bold">#{task.rank_position}</span>
                            <span className="text-sm text-muted-foreground">из {task.total_users}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">{task.total_count} выполнений</div>
                        </div>
                      </div>
                    </div>
                  </PixelCard>
                ))}
              </div>
            </div>
          </PixelCard>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4 mt-6">
          <PixelCard className="bg-gradient-to-r from-blue-200 to-blue-300">
            <div className="p-6">
              <h3 className="text-2xl font-bold flex items-center gap-2 mb-4">
                <Calendar className="h-6 w-6" />
                Активность по дням
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {dailyStats.map((day) => (
                  <PixelCard key={day.date} className="bg-white">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold">
                            {new Date(day.date).toLocaleDateString("ru-RU", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                          <div className="text-sm text-muted-foreground">{day.unique_tasks} уникальных задач</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">{day.tasks_completed} задач</div>
                          <div className="text-sm text-muted-foreground">{formatDuration(day.total_time)}</div>
                        </div>
                      </div>
                    </div>
                  </PixelCard>
                ))}
              </div>
            </div>
          </PixelCard>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PixelCard className="bg-gradient-to-r from-blue-200 to-blue-300">
              <div className="p-6 text-center">
                <Target className="h-8 w-8 mx-auto mb-2 text-blue-700" />
                <div className="text-3xl font-bold text-blue-800">
                  {taskStats.reduce((sum, t) => sum + t.total_count, 0)}
                </div>
                <div className="text-sm font-medium text-blue-700">Всего задач</div>
              </div>
            </PixelCard>

            <PixelCard className="bg-gradient-to-r from-green-200 to-green-300">
              <div className="p-6 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-green-700" />
                <div className="text-3xl font-bold text-green-800">
                  {formatDuration(taskStats.reduce((sum, t) => sum + t.total_time, 0))}
                </div>
                <div className="text-sm font-medium text-green-700">Общее время</div>
              </div>
            </PixelCard>

            <PixelCard className="bg-gradient-to-r from-purple-200 to-purple-300">
              <div className="p-6 text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-700" />
                <div className="text-3xl font-bold text-purple-800">{taskStats.length}</div>
                <div className="text-sm font-medium text-purple-700">Типов задач</div>
              </div>
            </PixelCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
