"use client"

import React from "react"

// Система мониторинга производительности
class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, number[]> = new Map()

  static getInstance() {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  startTimer(label: string): () => void {
    const start = performance.now()
    return () => {
      const end = performance.now()
      const duration = end - start

      if (!this.metrics.has(label)) {
        this.metrics.set(label, [])
      }
      this.metrics.get(label)!.push(duration)

      // Логируем медленные операции
      if (duration > 100) {
        console.warn(`Slow operation: ${label} took ${duration.toFixed(2)}ms`)
      }
    }
  }

  getMetrics() {
    const result: Record<string, { avg: number; max: number; count: number }> = {}

    this.metrics.forEach((times, label) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length
      const max = Math.max(...times)
      result[label] = { avg: Math.round(avg), max: Math.round(max), count: times.length }
    })

    return result
  }

  clear() {
    this.metrics.clear()
  }
}

export const perfMonitor = PerformanceMonitor.getInstance()

// Хук для мониторинга компонентов
export function usePerformanceMonitor(componentName: string) {
  const endTimer = perfMonitor.startTimer(`Component: ${componentName}`)

  React.useEffect(() => {
    return endTimer
  }, [endTimer])
}
