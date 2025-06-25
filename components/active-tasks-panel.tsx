"use client"

import { useState } from "react"
import { Square, Play, Pause } from "lucide-react"

interface ActiveTaskWithTimer {
	id: number
	taskTypeId: number
	taskName: string
	startTime: Date
	elapsedTime: number
	units: number
	isActive: boolean
}

interface Timer {
	startTime: Date
	elapsedTime: number
	isRunning: boolean
	isPaused?: boolean
	pauseStartTime?: Date
	totalPausedTime?: number
}

interface ActiveTasksPanelProps {
	activeTasks: ActiveTaskWithTimer[]
	timers: Map<number, Timer>
	onStopTask: (taskTypeId: number) => void
	onUpdateUnits: (taskTypeId: number, units: number) => void
	onPauseTask: (taskTypeId: number) => void
	onResumeTask: (taskTypeId: number) => void
	getFormattedTime: (taskTypeId: number) => string
	getMinutes: (taskTypeId: number) => number
	isGloballyPaused?: boolean
	isOnBreak?: boolean
}

export default function ActiveTasksPanel({
	activeTasks,
	timers,
	onStopTask,
	onUpdateUnits,
	onPauseTask,
	onResumeTask,
	getFormattedTime,
	getMinutes,
	isGloballyPaused = false,
	isOnBreak = false
}: ActiveTasksPanelProps) {
	return (
		<>
			{/* Панель активных задач - пиксельный стиль */}
			{activeTasks.length > 0 ? (
				<div className="relative">
					<div className="
						bg-gradient-to-br from-green-200 to-green-300
						border-4 border-black rounded-none
						shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
						p-4
					">
						{/* Декоративные пиксели */}
						<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
						<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

						<div className="flex items-center gap-3 mb-4">
							<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								<span className="text-xl">⚡</span>
							</div>
							<div>
								<h3 className="font-mono font-black text-xl text-black uppercase tracking-wide">
									АКТИВНЫЕ ЗАДАЧИ
								</h3>
								<p className="font-mono text-sm text-black font-semibold">
									{activeTasks.length} из 5 слотов заняты
								</p>
							</div>
						</div>

						{/* Список активных задач */}
						<div className="space-y-3">
							{activeTasks.map((task) => {
								const formattedTime = getFormattedTime(task.taskTypeId)
								const minutes = getMinutes(task.taskTypeId)
								const timer = timers.get(task.taskTypeId)
								const isPaused = timer?.isPaused || false
								const isIndividualPauseDisabled = isGloballyPaused || isOnBreak

								return (
									<div
										key={task.taskTypeId}
										className={`border-2 border-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 ${isPaused ? "bg-gradient-to-r from-yellow-800 to-yellow-900" : "bg-black"
											}`}
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<div className="flex items-center gap-2">
													{isPaused ? (
														<div className="w-2 h-2 bg-yellow-400 border border-white"></div>
													) : (
														<div className="w-2 h-2 bg-green-400 animate-pulse"></div>
													)}
													<span className={`font-mono font-black uppercase text-sm ${isPaused ? "text-yellow-300" : "text-green-400"
														}`}>
														{task.taskName}
													</span>
													{isPaused && (
														<span className="text-xs bg-yellow-400 text-black px-2 py-1 border border-black font-mono font-black">
															ПАУЗА
														</span>
													)}
												</div>

												{/* Счетчик единиц с кнопками в пиксельном стиле */}
												<div className="flex items-center gap-1 bg-gray-800 border border-gray-600 rounded p-1">
													<button
														onClick={() => {
															const newUnits = Math.max(0, task.units - 1)
															onUpdateUnits(task.taskTypeId, newUnits)
														}}
														disabled={task.units <= 0}
														className="w-6 h-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 border border-white text-white text-xs flex items-center justify-center font-mono font-black"
													>
														-
													</button>

													<div className="flex items-center gap-1 min-w-[60px] justify-center">
														<input
															type="number"
															min="0"
															value={task.units}
															onChange={(e) => {
																const value = parseInt(e.target.value) || 0
																onUpdateUnits(task.taskTypeId, value)
															}}
															className={`w-10 h-6 bg-transparent text-center text-sm font-mono font-black border-0 outline-none ${isPaused ? "text-yellow-400" : "text-green-400"
																}`}
														/>
														<span className="text-xs text-gray-400 font-mono">ед</span>
													</div>

													<button
														onClick={() => {
															const newUnits = task.units + 1
															onUpdateUnits(task.taskTypeId, newUnits)
														}}
														className="w-6 h-6 bg-green-600 hover:bg-green-700 border border-white text-white text-xs flex items-center justify-center font-mono font-black"
													>
														+
													</button>
												</div>
											</div>

											<div className="flex items-center gap-3">
												<div className="text-right">
													<div className={`font-mono font-black text-lg ${isPaused ? "text-yellow-400" : "text-green-400"
														}`}>
														{formattedTime}
													</div>
													<div className="font-mono text-xs text-gray-300">
														{minutes} мин
													</div>
												</div>

												{/* Кнопка паузы/возобновления в пиксельном стиле */}
												<button
													onClick={() => !isIndividualPauseDisabled && (isPaused ? onResumeTask(task.taskTypeId) : onPauseTask(task.taskTypeId))}
													disabled={isIndividualPauseDisabled}
													className={`
														${isIndividualPauseDisabled
															? 'bg-gray-500 cursor-not-allowed'
															: isPaused
																? 'bg-green-500 hover:bg-green-600'
																: 'bg-yellow-500 hover:bg-yellow-600'
														}
														border-2 border-white rounded-none
														shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
														${!isIndividualPauseDisabled && 'hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px]'}
														transition-all duration-100
														p-2
													`}
													title={
														isIndividualPauseDisabled
															? (isOnBreak ? "Недоступно во время обеда" : "Недоступно во время общей паузы")
															: (isPaused ? "Возобновить задачу" : "Приостановить задачу")
													}
												>
													{isPaused ? (
														<Play className={`h-4 w-4 ${isIndividualPauseDisabled ? 'text-gray-300' : 'text-white'}`} />
													) : (
														<Pause className={`h-4 w-4 ${isIndividualPauseDisabled ? 'text-gray-300' : 'text-white'}`} />
													)}
												</button>

												{/* Кнопка остановки в пиксельном стиле */}
												<button
													onClick={() => onStopTask(task.taskTypeId)}
													className="
														bg-red-500 hover:bg-red-600 
														border-2 border-white rounded-none
														shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
														hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
														hover:translate-x-[1px] hover:translate-y-[1px]
														transition-all duration-100
														p-2
													"
													title="Завершить задачу"
												>
													<Square className="h-4 w-4 text-white" />
												</button>
											</div>
										</div>
									</div>
								)
							})}
						</div>

						{/* Подсказка в пиксельном стиле */}
						<div className="mt-4 bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
							<div className="font-mono text-xs text-black text-center font-semibold">
								💡 Максимум 5 задач одновременно • ⏸️ Ставьте на паузу отдельные задачи
							</div>
						</div>

						{/* Нижние декоративные пиксели */}
						<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
						<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
					</div>
					<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
				</div>
			) : (
				<div className="relative">
					<div className="
						bg-gradient-to-br from-gray-200 to-gray-300
						border-4 border-black rounded-none
						shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
						p-4
					">
						{/* Декоративные пиксели */}
						<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
						<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

						<div className="flex items-center gap-3 mb-4">
							<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								<span className="text-xl">⏸️</span>
							</div>
							<div>
								<h3 className="font-mono font-black text-xl text-black uppercase tracking-wide">
									АКТИВНЫЕ ЗАДАЧИ
								</h3>
								<p className="font-mono text-sm text-black font-semibold">
									Нет активных задач
								</p>
							</div>
						</div>

						<div className="bg-black border-2 border-white p-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-center">
							<div className="text-4xl mb-2">🎮</div>
							<div className="font-mono text-white font-black">ВЫБЕРИТЕ ЗАДАЧУ</div>
							<div className="font-mono text-gray-300 text-sm mt-1">Начните выполнение снизу</div>
						</div>

						{/* Нижние декоративные пиксели */}
						<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
						<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
					</div>
					<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
				</div>
			)}
		</>
	)
}
