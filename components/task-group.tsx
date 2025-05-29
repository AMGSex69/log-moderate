"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"
import TaskCard from "./task-card"
import type { TaskType } from "@/lib/supabase"

interface TaskGroupProps {
  groupName: string
  groupIcon: string
  groupColor: string
  tasks: TaskType[]
  activeTasks: number[]
  onStartTask: (taskId: number, taskName: string) => void
  onStopTask: (taskId: number) => void
  getTaskTime: (taskId: number) => string | undefined
}

export default function TaskGroup({
  groupName,
  groupIcon,
  groupColor,
  tasks,
  activeTasks,
  onStartTask,
  onStopTask,
  getTaskTime,
}: TaskGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const activeTasksInGroup = tasks.filter((task) => activeTasks.includes(task.id)).length

  return (
    <Card className={`border-2 bg-gradient-to-r ${groupColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <span className="text-2xl">{groupIcon}</span>
            <span>{groupName}</span>
            {activeTasksInGroup > 0 && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {activeTasksInGroup} активных
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-8 w-8 p-0">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                taskType={task}
                isActive={activeTasks.includes(task.id)}
                onStart={() => onStartTask(task.id, task.name)}
                onStop={() => onStopTask(task.id)}
                currentTime={getTaskTime(task.id)}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
