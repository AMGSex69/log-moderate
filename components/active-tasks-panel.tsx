"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Square } from "lucide-react"

interface ActiveTaskWithTimer {
  id: number
  name: string
  startTime: Date
  timer?: {
    formatTime: () => string
  }
}

interface ActiveTasksPanelProps {
  activeTasks: ActiveTaskWithTimer[]
  onStopTask: (taskId: number) => void
}

export default function ActiveTasksPanel({ activeTasks, onStopTask }: ActiveTasksPanelProps) {
  if (activeTasks.length === 0) {
    return null
  }

  const formatDuration = (startTime: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000 / 60)
    const hours = Math.floor(diff / 60)
    const minutes = diff % 60
    return hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`
  }

  return (
    <Card className="border-2 border-green-500 bg-gradient-to-r from-green-50 to-green-100">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-green-600" />
          Активные задачи
          <Badge variant="secondary" className="bg-green-200 text-green-800">
            {activeTasks.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {activeTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{task.name}</div>
                <div className="text-xs text-muted-foreground">
                  Время: {task.timer?.formatTime() || "00:00"} • Всего: {formatDuration(task.startTime)}
                </div>
              </div>
              <Button onClick={() => onStopTask(task.id)} variant="destructive" size="sm" className="ml-3">
                <Square className="h-3 w-3 mr-1" />
                Стоп
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
