"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import PixelCard from "./pixel-card"
import { Clock, Square, Play, Pause, Hash, Plus, Minus } from "lucide-react"

interface ActiveTaskWithTimer {
	id: number
	taskTypeId: number
	name: string
	startTime: Date
	elapsedTime: number
	units: number
	isActive: boolean
}

interface ActiveTasksPanelProps {
	activeTasks: ActiveTaskWithTimer[]
	onStopTask: (taskTypeId: number) => void
	onUpdateUnits: (taskTypeId: number, units: number) => void
	getFormattedTime: (taskTypeId: number) => string
	getMinutes: (taskTypeId: number) => number
}

export default function ActiveTasksPanel({
	activeTasks,
	onStopTask,
	onUpdateUnits,
	getFormattedTime,
	getMinutes
}: ActiveTasksPanelProps) {
	const [editingUnits, setEditingUnits] = useState<Map<number, string>>(new Map())

	const handleUnitsChange = (taskTypeId: number, value: string) => {
		const newEditingUnits = new Map(editingUnits)
		newEditingUnits.set(taskTypeId, value)
		setEditingUnits(newEditingUnits)

		// Обновляем значение в реальном времени, но только если это валидное число
		const numValue = parseInt(value) || 0
		if (numValue >= 0) {
			onUpdateUnits(taskTypeId, numValue)
		}
	}

	const handleUnitsBlur = (taskTypeId: number, currentUnits: number) => {
		const editValue = editingUnits.get(taskTypeId)
		if (editValue !== undefined) {
			const numValue = parseInt(editValue) || 0
			if (numValue !== currentUnits && numValue >= 0) {
				onUpdateUnits(taskTypeId, numValue)
			}
		}
		// Убираем из состояния редактирования
		const newEditingUnits = new Map(editingUnits)
		newEditingUnits.delete(taskTypeId)
		setEditingUnits(newEditingUnits)
	}

	const incrementUnits = (taskTypeId: number, currentUnits: number) => {
		const newUnits = currentUnits + 1
		onUpdateUnits(taskTypeId, newUnits)
		// Обновляем и текстовое поле
		const newEditingUnits = new Map(editingUnits)
		newEditingUnits.set(taskTypeId, newUnits.toString())
		setEditingUnits(newEditingUnits)
	}

	const decrementUnits = (taskTypeId: number, currentUnits: number) => {
		const newUnits = Math.max(0, currentUnits - 1)
		onUpdateUnits(taskTypeId, newUnits)
		// Обновляем и текстовое поле
		const newEditingUnits = new Map(editingUnits)
		newEditingUnits.set(taskTypeId, newUnits.toString())
		setEditingUnits(newEditingUnits)
	}

	if (activeTasks.length === 0) {
		return (
			<PixelCard>
				<div className="p-4 text-center">
					<div className="flex items-center justify-center gap-4">
						<div className="flex items-center gap-2">
							<Clock className="h-5 w-5" />
							<h2 className="text-2xl font-bold">Активные задачи</h2>
						</div>
						<span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
							Нет задач
						</span>
					</div>
				</div>
			</PixelCard>
		)
	}

	return (
		<PixelCard>
			<div className="p-4">
				<div className="flex items-center justify-center gap-4 mb-4">
					<div className="flex items-center gap-2">
						<Clock className="h-5 w-5" />
						<h2 className="text-2xl font-bold">Активные задачи</h2>
					</div>
					<span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
						{activeTasks.length} активных
					</span>
				</div>

				<div className="space-y-3">
					{activeTasks.map((task) => {
						const formattedTime = getFormattedTime(task.taskTypeId)
						const minutes = getMinutes(task.taskTypeId)
						const editValue = editingUnits.get(task.taskTypeId)
						const displayUnits = editValue !== undefined ? editValue : task.units.toString()

						return (
							<div
								key={task.taskTypeId}
								className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
							>
								<div className="flex items-center gap-3">
									<div className="flex items-center gap-2">
										<Play className="h-4 w-4 text-green-600 animate-pulse" />
										<Badge variant="outline" className="bg-green-100 text-green-800">
											{task.name}
										</Badge>
									</div>

									{/* Счетчик единиц с кнопками */}
									<div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1">
										<Button
											size="sm"
											variant="ghost"
											onClick={() => decrementUnits(task.taskTypeId, task.units)}
											className="h-6 w-6 p-0 hover:bg-red-100"
											disabled={task.units <= 0}
										>
											<Minus className="h-3 w-3" />
										</Button>

										<div className="flex items-center gap-1">
											<Hash className="h-3 w-3 text-gray-500" />
											<Input
												type="number"
												min="0"
												value={displayUnits}
												onChange={(e) => handleUnitsChange(task.taskTypeId, e.target.value)}
												onBlur={() => handleUnitsBlur(task.taskTypeId, task.units)}
												onFocus={() => {
													const newEditingUnits = new Map(editingUnits)
													newEditingUnits.set(task.taskTypeId, task.units.toString())
													setEditingUnits(newEditingUnits)
												}}
												className="w-16 h-6 text-center text-sm border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
											/>
											<span className="text-xs text-gray-500">ед.</span>
										</div>

										<Button
											size="sm"
											variant="ghost"
											onClick={() => incrementUnits(task.taskTypeId, task.units)}
											className="h-6 w-6 p-0 hover:bg-green-100"
										>
											<Plus className="h-3 w-3" />
										</Button>
									</div>
								</div>

								<div className="flex items-center gap-3">
									<div className="text-right">
										<div className="font-mono font-bold text-lg text-green-700">
											{formattedTime}
										</div>
										<div className="text-xs text-muted-foreground">
											{minutes} мин
										</div>
									</div>

									<Button
										size="sm"
										variant="outline"
										onClick={() => onStopTask(task.taskTypeId)}
										className="text-red-600 hover:text-red-700 hover:bg-red-50"
									>
										<Square className="h-4 w-4" />
									</Button>
								</div>
							</div>
						)
					})}

					{activeTasks.length > 0 && (
						<div className="mt-4 pt-3 border-t border-gray-200">
							<div className="text-sm text-muted-foreground text-center">
								💡 Максимум 5 задач одновременно • 📝 Указывайте количество единиц в реальном времени
							</div>
						</div>
					)}
				</div>
			</div>
		</PixelCard>
	)
}
