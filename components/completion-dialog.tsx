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
import { CheckCircle, Clock, Hash, Plus, Minus } from "lucide-react"
import PixelButton from "@/components/pixel-button"

interface CompletionDialogProps {
	isOpen: boolean
	onClose: () => void
	onSave: (units: number, notes: string) => void
	taskName: string
	timeSpent: string
	taskId?: number
	initialUnits?: number
}

export default function CompletionDialog({
	isOpen,
	onClose,
	onSave,
	taskName,
	timeSpent,
	taskId,
	initialUnits = 1,
}: CompletionDialogProps) {
	const [units, setUnits] = useState("")
	const [notes, setNotes] = useState("")
	const [loading, setLoading] = useState(false)
	const [success, setSuccess] = useState(false)
	const [measurementUnit, setMeasurementUnit] = useState("единиц")

	useEffect(() => {
		if (isOpen) {
			const startingUnits = (initialUnits && initialUnits > 0) ? initialUnits : 1
			setUnits(startingUnits.toString())
		}
	}, [isOpen, initialUnits])

	useEffect(() => {
		if (isOpen && taskId) {
			fetchTaskUnit()
		}
	}, [isOpen, taskId])

	const fetchTaskUnit = async () => {
		if (!taskId) {
			console.log("fetchTaskUnit: taskId не указан")
			return
		}

		try {
			console.log("fetchTaskUnit: загружаем единицу измерения для задачи", taskId)

			const { data, error } = await supabase
				.from("task_types")
				.select("measurement_unit")
				.eq("id", taskId)
				.single()

			if (error) {
				console.error("fetchTaskUnit: ошибка запроса к БД:", error)
				throw error
			}

			if (!data) {
				console.warn("fetchTaskUnit: данные не найдены для задачи", taskId)
				setMeasurementUnit("единиц")
				return
			}

			const unit = data.measurement_unit || "единиц"
			console.log("fetchTaskUnit: загружена единица измерения:", unit)
			setMeasurementUnit(unit)

		} catch (error) {
			console.error("fetchTaskUnit: ошибка загрузки единицы измерения для задачи", taskId, ":", error)
			setMeasurementUnit("единиц")
		}
	}

	const handleSave = async () => {
		if (!units || Number.parseInt(units) <= 0) return

		setLoading(true)
		setSuccess(false)
		try {
			await onSave(Number.parseInt(units), notes)
			setSuccess(true)
			// Небольшая задержка для показа анимации успеха
			setTimeout(() => {
				setUnits("")
				setNotes("")
				setSuccess(false)
			}, 1500)
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

	const incrementUnits = () => {
		const currentUnits = parseInt(units) || 0
		setUnits((currentUnits + 1).toString())
	}

	const decrementUnits = () => {
		const currentUnits = parseInt(units) || 0
		if (currentUnits > 1) {
			setUnits((currentUnits - 1).toString())
		}
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
						Подтвердите количество выполненных единиц и добавьте заметки при необходимости
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
						{initialUnits && initialUnits > 0 && (
							<div className="text-sm text-green-600 mt-1">
								📝 Указано в процессе: {initialUnits} {getUnitLabel()}
							</div>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="units" className="flex items-center gap-2">
							{getUnitIcon()}
							Количество {getUnitLabel()} *
						</Label>

						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={decrementUnits}
								disabled={parseInt(units) <= 1}
								className="h-10 w-10 p-0"
							>
								<Minus className="h-4 w-4" />
							</Button>

							<div className="flex-1">
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
							</div>

							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={incrementUnits}
								className="h-10 w-10 p-0"
							>
								<Plus className="h-4 w-4" />
							</Button>
						</div>

						<div className="text-xs text-muted-foreground text-center">
							Единица измерения: {measurementUnit}
							{initialUnits && initialUnits > 0 && (
								<span className="text-green-600"> • Предзаполнено из активной задачи</span>
							)}
						</div>
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
					<Button variant="outline" onClick={handleClose} disabled={loading || success}>
						Отмена
					</Button>
					<PixelButton
						onClick={handleSave}
						disabled={!units || Number.parseInt(units) <= 0}
						loading={loading}
						success={success}
						loadingText="💾 Сохранение..."
						successText="✅ Готово!"
						variant="default"
					>
						Сохранить результат
					</PixelButton>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
