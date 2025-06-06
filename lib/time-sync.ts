// Утилиты для синхронизации времени между компонентами
export class TimeSync {
	private static instance: TimeSync
	private listeners: Map<string, (time: Date) => void> = new Map()
	private interval: NodeJS.Timeout | null = null
	private isRunning = false

	static getInstance(): TimeSync {
		if (!TimeSync.instance) {
			TimeSync.instance = new TimeSync()
		}
		return TimeSync.instance
	}

	// Запуск глобального таймера
	start() {
		if (this.isRunning) return

		this.isRunning = true
		this.interval = setInterval(() => {
			const now = new Date()
			this.listeners.forEach((callback) => {
				try {
					callback(now)
				} catch (error) {
					console.error("Time sync callback error:", error)
				}
			})
		}, 1000) // Обновляем каждую секунду
	}

	// Остановка глобального таймера
	stop() {
		if (this.interval) {
			clearInterval(this.interval)
			this.interval = null
		}
		this.isRunning = false
	}

	// Подписка на обновления времени
	subscribe(id: string, callback: (time: Date) => void) {
		this.listeners.set(id, callback)

		// Запускаем таймер если есть подписчики
		if (this.listeners.size > 0 && !this.isRunning) {
			this.start()
		}
	}

	// Отписка от обновлений времени
	unsubscribe(id: string) {
		this.listeners.delete(id)

		// Останавливаем таймер если нет подписчиков
		if (this.listeners.size === 0) {
			this.stop()
		}
	}

	// Получение текущего времени
	getCurrentTime(): Date {
		return new Date()
	}

	// Форматирование времени в читаемый вид
	formatTime(date: Date): string {
		return date.toLocaleTimeString("ru-RU", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		})
	}

	// Вычисление разности времени в секундах
	getElapsedSeconds(startTime: Date, endTime?: Date): number {
		const end = endTime || this.getCurrentTime()
		return Math.floor((end.getTime() - startTime.getTime()) / 1000)
	}

	// Вычисление разности времени в минутах
	getElapsedMinutes(startTime: Date, endTime?: Date): number {
		return Math.ceil(this.getElapsedSeconds(startTime, endTime) / 60)
	}

	// Форматирование времени выполнения
	formatElapsedTime(startTime: Date, endTime?: Date): string {
		const totalSeconds = this.getElapsedSeconds(startTime, endTime)
		const hours = Math.floor(totalSeconds / 3600)
		const minutes = Math.floor((totalSeconds % 3600) / 60)
		const seconds = totalSeconds % 60

		if (hours > 0) {
			return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
		}
		return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
	}

	// Проверка валидности временной зоны
	isValidTimestamp(timestamp: string): boolean {
		const date = new Date(timestamp)
		return !isNaN(date.getTime())
	}

	// Нормализация времени из базы данных
	normalizeDBTime(timestamp: string): Date | null {
		if (!this.isValidTimestamp(timestamp)) {
			console.warn("Invalid timestamp:", timestamp)
			return null
		}
		return new Date(timestamp)
	}

	// Конвертация в ISO строку для базы данных
	toISOString(date?: Date): string {
		return (date || this.getCurrentTime()).toISOString()
	}
}

// Singleton instance для использования в приложении
export const timeSync = TimeSync.getInstance()

// Хук для React компонентов
import { useEffect, useState } from "react"

export function useTimeSync(id: string) {
	const [currentTime, setCurrentTime] = useState(new Date())

	useEffect(() => {
		const callback = (time: Date) => setCurrentTime(time)
		timeSync.subscribe(id, callback)

		return () => {
			timeSync.unsubscribe(id)
		}
	}, [id])

	return {
		currentTime,
		formatTime: (date: Date) => timeSync.formatTime(date),
		getElapsedSeconds: (startTime: Date, endTime?: Date) => timeSync.getElapsedSeconds(startTime, endTime),
		getElapsedMinutes: (startTime: Date, endTime?: Date) => timeSync.getElapsedMinutes(startTime, endTime),
		formatElapsedTime: (startTime: Date, endTime?: Date) => timeSync.formatElapsedTime(startTime, endTime),
	}
} 