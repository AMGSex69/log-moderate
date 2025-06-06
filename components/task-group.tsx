"use client"

import { useState } from "react"
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

	// Определяем цвет фона на основе groupColor
	const getBgColor = (color: string) => {
		switch (color) {
			case '#10B981': return 'from-green-200 to-green-300'
			case '#3B82F6': return 'from-blue-200 to-blue-300'
			case '#F59E0B': return 'from-yellow-200 to-yellow-300'
			case '#EF4444': return 'from-red-200 to-red-300'
			case '#8B5CF6': return 'from-purple-200 to-purple-300'
			case '#06B6D4': return 'from-cyan-200 to-cyan-300'
			default: return 'from-gray-200 to-gray-300'
		}
	}

	return (
		<div className="relative">
			<div className={`
				bg-gradient-to-br ${getBgColor(groupColor)}
				border-4 border-black rounded-none
				shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
			`}>
				{/* Декоративные пиксели */}
				<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
				<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

				{/* Заголовок группы */}
				<div className="p-4 border-b-4 border-black">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								<span className="text-2xl">{groupIcon}</span>
							</div>
							<div>
								<h3 className="font-mono font-black text-xl text-black uppercase tracking-wide">
									{groupName}
								</h3>
								{activeTasksInGroup > 0 && (
									<div className="flex items-center gap-2 mt-1">
										<div className="bg-green-500 border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
											<span className="font-mono text-xs font-black text-white uppercase">
												{activeTasksInGroup} АКТИВНЫХ
											</span>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Кнопка раскрытия/скрытия */}
						<button
							onClick={() => setIsExpanded(!isExpanded)}
							className="
								bg-white hover:bg-gray-100 
								border-2 border-black rounded-none
								shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
								hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
								hover:translate-x-[1px] hover:translate-y-[1px]
								transition-all duration-100
								p-2
							"
						>
							{isExpanded ?
								<ChevronUp className="h-5 w-5 text-black" /> :
								<ChevronDown className="h-5 w-5 text-black" />
							}
						</button>
					</div>
				</div>

				{/* Содержимое группы */}
				{isExpanded && (
					<div className="p-4">
						<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
					</div>
				)}

				{/* Нижние декоративные пиксели */}
				<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
				<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
			</div>

			{/* Дополнительная тень для глубины */}
			<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
		</div>
	)
}
