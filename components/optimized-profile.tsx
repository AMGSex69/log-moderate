"use client"

import { memo, useMemo } from "react"
import { useOptimizedAuth } from "@/hooks/use-optimized-auth"
import { useOptimizedStats } from "@/hooks/use-optimized-stats"
import { perfMonitor } from "@/lib/performance"

// Мемоизируем тяжелые компоненты
const MemoizedStatsCard = memo(({ title, value, icon }: any) => (
  <div className="p-4 text-center">
    <div className="text-2xl mb-2">{icon}</div>
    <div className="text-3xl font-bold">{value}</div>
    <div className="text-sm">{title}</div>
  </div>
))

const MemoizedAchievementCard = memo(({ achievement }: any) => (
  <div className="p-4">
    <div className="flex items-center gap-3">
      <div className="text-3xl">{achievement.icon}</div>
      <div>
        <div className="font-bold">{achievement.name}</div>
        <div className="text-sm text-muted-foreground">{achievement.description}</div>
      </div>
    </div>
  </div>
))

export default function OptimizedProfile() {
  const { user, profile, loading: authLoading } = useOptimizedAuth()
  const { stats, loading: statsLoading } = useOptimizedStats(user?.id)

  // Мемоизируем вычисления
  const computedData = useMemo(() => {
    if (!stats) return null

    const endTimer = perfMonitor.startTimer("profileComputations")

    const result = {
      formattedTime: `${Math.floor(stats.total_time / 60)}ч ${stats.total_time % 60}м`,
      efficiency: stats.total_tasks > 0 ? Math.round((stats.total_units / stats.total_tasks) * 100) : 0,
      productivity: stats.total_time > 0 ? Math.round(stats.total_units / (stats.total_time / 60)) : 0,
    }

    endTimer()
    return result
  }, [stats])

  if (authLoading || statsLoading) {
    return <div>Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      {/* Основная статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MemoizedStatsCard title="Задач выполнено" value={stats?.total_tasks || 0} icon="🎯" />
        <MemoizedStatsCard title="Время работы" value={computedData?.formattedTime || "0ч 0м"} icon="⏱️" />
        <MemoizedStatsCard title="Эффективность" value={`${computedData?.efficiency || 0}%`} icon="📈" />
        <MemoizedStatsCard title="Продуктивность" value={`${computedData?.productivity || 0}/ч`} icon="⚡" />
      </div>
    </div>
  )
}
