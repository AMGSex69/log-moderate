"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import PixelButton from "./pixel-button"
import PixelCard from "./pixel-card"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Pause, Play, Coffee } from "lucide-react"

interface BreakControlsProps {
  onBreakStart: () => void
  onBreakEnd: () => void
  isOnBreak: boolean
}

export default function BreakControls({ onBreakStart, onBreakEnd, isOnBreak }: BreakControlsProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null)

  useEffect(() => {}, [])

  const handleBreakStart = async () => {
    if (!user) return

    try {
      const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
      if (empError || !employeeId) throw new Error("Employee not found")

      // Записываем начало перерыва
      const { error } = await supabase.from("break_logs").insert({
        employee_id: employeeId,
        break_type: "lunch",
        start_time: new Date().toISOString(),
        date: new Date().toISOString().split("T")[0],
      })

      if (error) throw error

      setBreakStartTime(new Date())
      onBreakStart()

      toast({
        title: "🍽️ Обед начат",
        description: "Все активные задачи приостановлены",
      })
    } catch (error) {
      console.error("Ошибка начала перерыва:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось начать перерыв",
        variant: "destructive",
      })
    }
  }

  const handleBreakEnd = async () => {
    if (!user) return

    try {
      const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
      if (empError || !employeeId) throw new Error("Employee not found")

      // Обновляем запись перерыва
      const { error } = await supabase
        .from("break_logs")
        .update({ end_time: new Date().toISOString() })
        .eq("employee_id", employeeId)
        .eq("date", new Date().toISOString().split("T")[0])
        .is("end_time", null)

      if (error) throw error

      setBreakStartTime(null)
      onBreakEnd()

      toast({
        title: "🎯 Обед завершен",
        description: "Можно продолжать работу",
      })
    } catch (error) {
      console.error("Ошибка завершения перерыва:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось завершить перерыв",
        variant: "destructive",
      })
    }
  }

  const formatDuration = (startTime: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000 / 60)
    return `${diff} мин`
  }

  return (
    <div className="space-y-4">
      {/* Контроль перерыва */}
      <PixelCard className={isOnBreak ? "bg-gradient-to-r from-orange-200 to-red-200" : ""}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Coffee className="h-5 w-5" />
              <span className="font-bold">Обед</span>
            </div>
            {isOnBreak && breakStartTime && <Badge variant="secondary">{formatDuration(breakStartTime)}</Badge>}
          </div>

          {!isOnBreak ? (
            <PixelButton onClick={handleBreakStart} variant="secondary" className="w-full">
              <Pause className="h-4 w-4 mr-2" />
              Начать обед
            </PixelButton>
          ) : (
            <PixelButton onClick={handleBreakEnd} variant="success" className="w-full">
              <Play className="h-4 w-4 mr-2" />
              Завершить обед
            </PixelButton>
          )}
        </div>
      </PixelCard>
    </div>
  )
}
