"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Play, Square, Users } from "lucide-react"
import type { TaskType } from "@/lib/supabase"
import { useActiveSessions } from "@/hooks/use-active-sessions"

interface TaskCardProps {
  taskType: TaskType
  isActive: boolean
  onStart: () => void
  onStop: () => void
  currentTime?: string
}

const taskIcons: Record<string, string> = {
  "Решения МЖИ": "📋",
  "Протоколы МЖИ": "📄",
  Обзвоны: "📞",
  Обходы: "🚶‍♂️",
  "Развешивание плакатов": "📋",
  Актуализация: "🔄",
  Протоколы: "📝",
  Отчёты: "📊",
  Опросы: "❓",
  "Юридически значимые опросы": "⚖️",
  "Модерация ОСС": "🏢",
  "Модерация чатов": "💬",
  АСГУФ: "🖥️",
  "Задачи руководства": "👔",
  "Особые задачи": "⭐",
}

export default function TaskCard({ taskType, isActive, onStart, onStop, currentTime }: TaskCardProps) {
  const { activeColleagues } = useActiveSessions(isActive ? taskType.id : undefined)
  const [showColleagues, setShowColleagues] = useState(false)

  // Показываем коллег только когда задача активна
  useEffect(() => {
    if (isActive && activeColleagues.length > 0) {
      setShowColleagues(true)
    } else {
      setShowColleagues(false)
    }
  }, [isActive, activeColleagues.length])

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`
  }

  // Фильтруем коллег (исключаем текущего пользователя, если он есть в списке)
  const colleagues = activeColleagues.filter(
    (colleague, index, self) => index === self.findIndex((c) => c.employee_id === colleague.employee_id),
  )

  return (
    <Card
      className={`transition-all duration-200 hover:shadow-md ${isActive ? "ring-2 ring-blue-500 bg-blue-50" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{taskIcons[taskType.name] || "📋"}</span>
            <div>
              <h3 className="font-semibold text-sm">{taskType.name}</h3>
              <p className="text-xs text-muted-foreground">{taskType.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {colleagues.length > 0 && (
              <Badge variant="outline" className="bg-green-100 text-green-800">
                <Users className="h-3 w-3 mr-1" />
                {colleagues.length}
              </Badge>
            )}
            {isActive && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Активно
              </Badge>
            )}
          </div>
        </div>

        {isActive && currentTime && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-white rounded border">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="font-mono text-lg font-bold text-blue-600">{currentTime}</span>
          </div>
        )}

        {/* Показываем активных коллег */}
        {showColleagues && colleagues.length > 0 && (
          <div className="mb-3 p-2 bg-green-50 rounded border border-green-200">
            <div className="text-xs font-medium text-green-800 mb-1">Сейчас работают ({colleagues.length}):</div>
            <div className="space-y-1">
              {colleagues.slice(0, 3).map((colleague, index) => (
                <div key={colleague.employee_id} className="flex justify-between items-center text-xs">
                  <span className="text-green-700 font-medium">{colleague.full_name}</span>
                  <span className="text-green-600">{formatDuration(colleague.duration_minutes)}</span>
                </div>
              ))}
              {colleagues.length > 3 && (
                <div className="text-xs text-green-600 text-center">{`+${colleagues.length - 3} еще...`}</div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isActive ? (
            <Button onClick={onStart} size="sm" className="w-full">
              <Play className="h-4 w-4 mr-2" />
              Начать
            </Button>
          ) : (
            <Button onClick={onStop} variant="destructive" size="sm" className="w-full">
              <Square className="h-4 w-4 mr-2" />
              Завершить
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
