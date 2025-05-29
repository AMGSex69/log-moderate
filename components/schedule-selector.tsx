"use client"

import { useState } from "react"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import PixelButton from "./pixel-button"
import PixelCard from "./pixel-card"

interface ScheduleSelectorProps {
  onScheduleSelect: (schedule: string, hours: number) => void
  loading?: boolean
}

export default function ScheduleSelector({ onScheduleSelect, loading = false }: ScheduleSelectorProps) {
  const [selectedSchedule, setSelectedSchedule] = useState("5/2")

  const schedules = [
    {
      value: "5/2",
      label: "5/2 (Пятидневка)",
      description: "9 часов в день (8 + 1 час обед)",
      hours: 9,
      icon: "📅",
    },
    {
      value: "2/2",
      label: "2/2 (Сменный)",
      description: "12 часов в день",
      hours: 12,
      icon: "🔄",
    },
  ]

  const handleSubmit = () => {
    const schedule = schedules.find((s) => s.value === selectedSchedule)
    if (schedule) {
      onScheduleSelect(schedule.value, schedule.hours)
    }
  }

  return (
    <PixelCard className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="text-6xl mb-4">⏰</div>
        <CardTitle className="text-2xl">Выберите график работы</CardTitle>
        <CardDescription>Это поможет системе отслеживать ваше рабочее время</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={selectedSchedule} onValueChange={setSelectedSchedule} className="space-y-4">
          {schedules.map((schedule) => (
            <PixelCard
              key={schedule.value}
              className={`cursor-pointer transition-all ${
                selectedSchedule === schedule.value
                  ? "bg-gradient-to-r from-blue-200 to-purple-200 border-blue-500"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="p-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value={schedule.value} id={schedule.value} />
                  <Label htmlFor={schedule.value} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{schedule.icon}</span>
                      <div>
                        <div className="font-bold">{schedule.label}</div>
                        <div className="text-sm text-muted-foreground">{schedule.description}</div>
                      </div>
                    </div>
                  </Label>
                </div>
              </div>
            </PixelCard>
          ))}
        </RadioGroup>

        <PixelButton onClick={handleSubmit} className="w-full mt-6" disabled={loading}>
          {loading ? "Сохранение..." : "Продолжить"}
        </PixelButton>
      </CardContent>
    </PixelCard>
  )
}
