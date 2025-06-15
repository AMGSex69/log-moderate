import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface TaskType {
	id: number
	name: string
}

interface PostFactumDialogProps {
	isOpen: boolean
	onClose: () => void
	onSave: (taskData: {
		taskTypeId: number
		taskName: string
		units: number
		timeSpent: number
		workDate: string
		startTime: string
		endTime: string
	}) => Promise<void>
	taskTypes: TaskType[]
}

export default function PostFactumDialog({
	isOpen,
	onClose,
	onSave,
	taskTypes
}: PostFactumDialogProps) {
	const [selectedTaskId, setSelectedTaskId] = useState<string>("")
	const [units, setUnits] = useState<string>("1")
	const [workDate, setWorkDate] = useState<Date>(new Date())
	const [startTime, setStartTime] = useState<string>("")
	const [endTime, setEndTime] = useState<string>("")
	const [isLoading, setIsLoading] = useState(false)

	const handleSave = async () => {
		if (!selectedTaskId || !units || !startTime || !endTime) {
			alert("Пожалуйста, заполните все поля")
			return
		}

		const selectedTask = taskTypes.find(t => t.id.toString() === selectedTaskId)
		if (!selectedTask) {
			alert("Выберите задачу")
			return
		}

		// Проверяем корректность времени
		const start = new Date(`2000-01-01T${startTime}:00`)
		const end = new Date(`2000-01-01T${endTime}:00`)

		if (end <= start) {
			alert("Время окончания должно быть позже времени начала")
			return
		}

		// Рассчитываем время в минутах
		const timeSpentMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))

		try {
			setIsLoading(true)
			await onSave({
				taskTypeId: selectedTask.id,
				taskName: selectedTask.name,
				units: parseInt(units),
				timeSpent: timeSpentMinutes,
				workDate: format(workDate, "yyyy-MM-dd"),
				startTime,
				endTime
			})

			// Сброс формы
			setSelectedTaskId("")
			setUnits("1")
			setStartTime("")
			setEndTime("")
			onClose()
		} catch (error) {
			console.error("Ошибка сохранения задачи:", error)
			alert("Не удалось сохранить задачу")
		} finally {
			setIsLoading(false)
		}
	}



	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						⏰ Отложенные задачи
					</DialogTitle>
					<DialogDescription>
						Укажите детали уже выполненной задачи
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Выбор даты */}
					<div className="space-y-2">
						<Label>Дата выполнения</Label>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className={cn(
										"w-full justify-start text-left font-normal",
										!workDate && "text-muted-foreground"
									)}
								>
									<CalendarIcon className="mr-2 h-4 w-4" />
									{workDate ? format(workDate, "dd MMMM yyyy", { locale: ru }) : "Выберите дату"}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="center">
								<Calendar
									mode="single"
									selected={workDate}
									onSelect={(date) => date && setWorkDate(date)}
									initialFocus
									locale={ru}
									className="rounded-md border"
									weekStartsOn={1}
									showOutsideDays={false}
									classNames={{
										head_row: "flex w-full",
										head_cell: "text-muted-foreground rounded-md w-10 font-normal text-[0.8rem] text-center",
										row: "flex w-full mt-2",
										cell: "h-10 w-10 text-center text-sm p-0 relative flex items-center justify-center",
										day: "h-10 w-10 p-0 font-normal aria-selected:opacity-100 rounded-md hover:bg-accent hover:text-accent-foreground",
										day_outside: "invisible",
									}}
									formatters={{
										formatWeekdayName: (date) => {
											const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
											const dayIndex = date.getDay()
											return weekdays[dayIndex === 0 ? 6 : dayIndex - 1]
										}
									}}
								/>
							</PopoverContent>
						</Popover>
					</div>

					{/* Выбор задачи */}
					<div className="space-y-2">
						<Label>Тип задачи</Label>
						<Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
							<SelectTrigger>
								<SelectValue placeholder="Выберите задачу" />
							</SelectTrigger>
							<SelectContent>
								{taskTypes.map((task) => (
									<SelectItem key={task.id} value={task.id.toString()}>
										{task.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Количество единиц */}
					<div className="space-y-2">
						<Label>Количество единиц</Label>
						<Input
							type="number"
							min="1"
							value={units}
							onChange={(e) => setUnits(e.target.value)}
							placeholder="Введите количество"
						/>
					</div>

					{/* Время начала */}
					<div className="space-y-2">
						<Label>Время начала</Label>
						<Input
							type="time"
							value={startTime}
							onChange={(e) => setStartTime(e.target.value)}
							placeholder="15:50"
							className="w-full"
						/>
					</div>

					{/* Время окончания */}
					<div className="space-y-2">
						<Label>Время окончания</Label>
						<Input
							type="time"
							value={endTime}
							onChange={(e) => setEndTime(e.target.value)}
							placeholder="16:50"
							className="w-full"
						/>
					</div>

					{/* Информация о времени */}
					{startTime && endTime && (
						<div className="p-3 bg-blue-50 rounded-lg">
							<p className="text-sm text-blue-700">
								<strong>Продолжительность:</strong>{" "}
								{(() => {
									const start = new Date(`2000-01-01T${startTime}:00`)
									const end = new Date(`2000-01-01T${endTime}:00`)
									const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
									const hours = Math.floor(minutes / 60)
									const mins = minutes % 60
									return hours > 0 ? `${hours}ч ${mins}мин` : `${mins}мин`
								})()}
							</p>
						</div>
					)}
				</div>

				<div className="flex justify-end gap-2 pt-4">
					<Button variant="outline" onClick={onClose} disabled={isLoading}>
						Отмена
					</Button>
					<Button onClick={handleSave} disabled={isLoading}>
						{isLoading ? "Сохранение..." : "Сохранить"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
} 