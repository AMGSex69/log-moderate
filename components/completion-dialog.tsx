"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { CheckCircle, Clock, Hash } from "lucide-react"

interface CompletionDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (units: number, notes: string) => void
  taskName: string
  timeSpent: string
  taskId?: number
}

export default function CompletionDialog({
  isOpen,
  onClose,
  onSave,
  taskName,
  timeSpent,
  taskId,
}: CompletionDialogProps) {
  const [units, setUnits] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [measurementUnit, setMeasurementUnit] = useState("единиц")

  useEffect(() => {
    if (isOpen && taskId) {
      fetchTaskUnit()
    }
  }, [isOpen, taskId])

  const fetchTaskUnit = async () => {
    if (!taskId) return

    try {
      const { data, error } = await supabase.from("task_types").select("measurement_unit").eq("id", taskId).single()

      if (error) throw error

      setMeasurementUnit(data?.measurement_unit || "единиц")
    } catch (error) {
      console.error("Ошибка загрузки единицы измерения:", error)
      setMeasurementUnit("единиц")
    }
  }

  const handleSave = async () => {
    if (!units || Number.parseInt(units) <= 0) return

    setLoading(true)
    try {
      await onSave(Number.parseInt(units), notes)
      setUnits("")
      setNotes("")
    } catch (error) {
      console.error("Ошибка сохранения:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setUnits("")
    setNotes("")
    onClose()
  }

  const getUnitLabel = () => {
    switch (measurementUnit?.toLowerCase()) {
      case "штука":
        return "штук"
      case "минуты":
        return "минут"
      default:
        return "единиц"
    }
  }

  const getUnitIcon = () => {
    switch (measurementUnit?.toLowerCase()) {
      case "минуты":
        return <Clock className="h-4 w-4" />
      default:
        return <Hash className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Завершение задачи
          </DialogTitle>
          <DialogDescription>
            Укажите количество выполненных единиц и добавьте заметки при необходимости
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">{taskName}</h4>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeSpent}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">Время выполнения: {timeSpent}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="units" className="flex items-center gap-2">
              {getUnitIcon()}
              Количество {getUnitLabel()} *
            </Label>
            <Input
              id="units"
              type="number"
              min="1"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder={`Введите количество ${getUnitLabel()}`}
              className="text-center text-lg font-bold"
              autoFocus
            />
            <div className="text-xs text-muted-foreground text-center">Единица измерения: {measurementUnit}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Заметки (необязательно)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Дополнительная информация о выполненной работе..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={!units || Number.parseInt(units) <= 0 || loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? "Сохранение..." : "Сохранить результат"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
