"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface Timer {
  seconds: number
  isRunning: boolean
  start: () => void
  stop: () => void
  reset: () => void
  formatTime: () => string
  getMinutes: () => number
}

interface ActiveTask {
  id: number
  name: string
  startTime: Date
}

export function useMultiTimer() {
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([])
  const [timers, setTimers] = useState<Map<number, Timer>>(new Map())
  const intervalRefs = useRef<Map<number, NodeJS.Timeout>>(new Map())

  const createTimer = useCallback((taskId: number): Timer => {
    let seconds = 0
    let isRunning = false

    const formatTime = () => {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60

      if (hours > 0) {
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      }
      return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }

    const getMinutes = () => Math.ceil(seconds / 60)

    const start = () => {
      if (isRunning) return
      isRunning = true

      const interval = setInterval(() => {
        seconds += 1
        // Обновляем состояние таймеров для ре-рендера
        setTimers((prev) => new Map(prev))
      }, 1000)

      intervalRefs.current.set(taskId, interval)
    }

    const stop = () => {
      isRunning = false
      const interval = intervalRefs.current.get(taskId)
      if (interval) {
        clearInterval(interval)
        intervalRefs.current.delete(taskId)
      }
    }

    const reset = () => {
      stop()
      seconds = 0
      setTimers((prev) => new Map(prev))
    }

    return {
      get seconds() {
        return seconds
      },
      get isRunning() {
        return isRunning
      },
      start,
      stop,
      reset,
      formatTime,
      getMinutes,
    }
  }, [])

  const startTask = useCallback(
    (taskId: number, taskName: string) => {
      // Проверяем, что задача еще не активна
      if (activeTasks.find((task) => task.id === taskId)) {
        return false
      }

      const newTask: ActiveTask = {
        id: taskId,
        name: taskName,
        startTime: new Date(),
      }

      const timer = createTimer(taskId)

      setActiveTasks((prev) => [...prev, newTask])
      setTimers((prev) => new Map(prev.set(taskId, timer)))

      timer.start()
      return true
    },
    [activeTasks, createTimer],
  )

  const stopTask = useCallback(
    (taskId: number) => {
      const timer = timers.get(taskId)
      if (timer) {
        timer.stop()
      }

      const task = activeTasks.find((t) => t.id === taskId)
      return task || null
    },
    [timers, activeTasks],
  )

  const removeTask = useCallback(
    (taskId: number) => {
      const timer = timers.get(taskId)
      if (timer) {
        timer.stop()
      }

      setActiveTasks((prev) => prev.filter((task) => task.id !== taskId))
      setTimers((prev) => {
        const newMap = new Map(prev)
        newMap.delete(taskId)
        return newMap
      })

      // Очищаем интервал
      const interval = intervalRefs.current.get(taskId)
      if (interval) {
        clearInterval(interval)
        intervalRefs.current.delete(taskId)
      }
    },
    [timers],
  )

  const stopAllTasks = useCallback(() => {
    timers.forEach((timer) => {
      timer.stop()
    })
  }, [timers])

  const startAllTasks = useCallback(() => {
    timers.forEach((timer) => {
      timer.start()
    })
  }, [timers])

  const getTaskTimer = useCallback(
    (taskId: number) => {
      return timers.get(taskId)
    },
    [timers],
  )

  const getActiveTasksWithTimers = useCallback(() => {
    return activeTasks
      .map((task) => ({
        ...task,
        timer: timers.get(task.id),
      }))
      .filter((task) => task.timer)
  }, [activeTasks, timers])

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      intervalRefs.current.forEach((interval) => {
        clearInterval(interval)
      })
      intervalRefs.current.clear()
    }
  }, [])

  return {
    activeTasks,
    startTask,
    stopTask,
    removeTask,
    stopAllTasks,
    startAllTasks,
    getTaskTimer,
    getActiveTasksWithTimers,
  }
}
