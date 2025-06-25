"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { supabase, type TaskType } from "@/lib/supabase"
import { CalendarIcon, ClockIcon, HashIcon } from "lucide-react"

export default function TaskLoggerForm() {
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
  const [selectedTaskType, setSelectedTaskType] = useState("")
  const [unitsCompleted, setUnitsCompleted] = useState("")
  const [timeSpent, setTimeSpent] = useState("")
  const [workDate, setWorkDate] = useState(new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState("")
  const [employeeName, setEmployeeName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const [selectedTaskUnit, setSelectedTaskUnit] = useState("")

  useEffect(() => {
    fetchTaskTypes()
  }, [])

  const fetchTaskTypes = async () => {
    try {
      const { data, error } = await supabase.from("task_types").select("*").order("name")

      if (error) throw error
      setTaskTypes(data || [])
    } catch (error) {
      console.error("Ошибка загрузки типов задач:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить типы задач",
        variant: "destructive",
      })
    }
  }

  const handleTaskTypeChange = (value: string) => {
    setSelectedTaskType(value)
    const taskType = taskTypes.find((t) => t.id.toString() === value)
    setSelectedTaskUnit(taskType?.measurement_unit || "")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTaskType || !unitsCompleted || !timeSpent || !employeeName) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, заполните все обязательные поля",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Сначала создаем или находим сотрудника
      let { data: employee, error: employeeError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("full_name", employeeName)
        .single()

      if (employeeError && employeeError.code === "PGRST116") {
        // Сотрудник не найден, создаем нового
        const { data: newEmployee, error: createError } = await supabase
          .from("user_profiles")
          .insert({
            full_name: employeeName,
            email: `${employeeName.toLowerCase().replace(/\s+/g, ".")}@company.com`,
            position: "Сотрудник",
          })
          .select("id")
          .single()

        if (createError) throw createError
        employee = newEmployee
      } else if (employeeError) {
        throw employeeError
      }

      // Добавляем запись о задаче
      const { error: logError } = await supabase.from("task_logs").insert({
        employee_id: employee.id,
        task_type_id: Number.parseInt(selectedTaskType),
        units_completed: Number.parseInt(unitsCompleted),
        time_spent_minutes: Number.parseInt(timeSpent),
        work_date: workDate,
        notes: notes || null,
      })

      if (logError) throw logError

      toast({
        title: "Успешно!",
        description: "Задача записана в лог",
      })

      // Очищаем форму
      setSelectedTaskType("")
      setUnitsCompleted("")
      setTimeSpent("")
      setNotes("")
      setWorkDate(new Date().toISOString().split("T")[0])
    } catch (error) {
      console.error("Ошибка сохранения:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить запись",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClockIcon className="h-5 w-5" />
          Лог выполненных задач
        </CardTitle>
        <CardDescription>Записывайте выполненные задачи с указанием количества и времени</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Ваше имя *</Label>
              <Input
                id="employee"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Введите ваше полное имя"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Дата работы *</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-type">Тип задачи *</Label>
            <Select value={selectedTaskType} onValueChange={handleTaskTypeChange} required>
              <SelectTrigger>
                <SelectValue placeholder="Выберите тип задачи" />
              </SelectTrigger>
              <SelectContent>
                {taskTypes.map((taskType) => (
                  <SelectItem key={taskType.id} value={taskType.id.toString()}>
                    {taskType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="units">
                Количество {selectedTaskUnit ? `(${selectedTaskUnit.toLowerCase()})` : "единиц"} *
              </Label>
              <div className="relative">
                <HashIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="units"
                  type="number"
                  min="0"
                  value={unitsCompleted}
                  onChange={(e) => setUnitsCompleted(e.target.value)}
                  placeholder="0"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Время (минуты) *</Label>
              <div className="relative">
                <ClockIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="time"
                  type="number"
                  min="1"
                  value={timeSpent}
                  onChange={(e) => setTimeSpent(e.target.value)}
                  placeholder="0"
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Заметки (необязательно)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Дополнительная информация о выполненной задаче..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Сохранение..." : "Записать в лог"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
