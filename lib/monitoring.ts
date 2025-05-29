// Система мониторинга приложения
export class AppMonitoring {
  private static instance: AppMonitoring
  private metrics = {
    userCount: 0,
    activeUsers: new Set<string>(),
    requestCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
  }

  static getInstance() {
    if (!AppMonitoring.instance) {
      AppMonitoring.instance = new AppMonitoring()
    }
    return AppMonitoring.instance
  }

  trackUser(userId: string) {
    this.metrics.activeUsers.add(userId)
    this.metrics.userCount = this.metrics.activeUsers.size
  }

  trackRequest(responseTime: number) {
    this.metrics.requestCount++
    this.metrics.averageResponseTime = (this.metrics.averageResponseTime + responseTime) / 2
  }

  trackError() {
    this.metrics.errorCount++
  }

  updateMemoryUsage() {
    if (typeof window !== "undefined" && "memory" in performance) {
      // @ts-ignore
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024 // MB
    }
  }

  getHealthStatus() {
    this.updateMemoryUsage()

    return {
      status: this.getOverallStatus(),
      metrics: {
        ...this.metrics,
        activeUsers: this.metrics.activeUsers.size,
        errorRate:
          this.metrics.requestCount > 0
            ? ((this.metrics.errorCount / this.metrics.requestCount) * 100).toFixed(2) + "%"
            : "0%",
      },
      recommendations: this.getRecommendations(),
    }
  }

  private getOverallStatus(): "healthy" | "warning" | "critical" {
    const errorRate = this.metrics.requestCount > 0 ? this.metrics.errorCount / this.metrics.requestCount : 0

    if (errorRate > 0.1 || this.metrics.memoryUsage > 100) return "critical"
    if (errorRate > 0.05 || this.metrics.memoryUsage > 50) return "warning"
    return "healthy"
  }

  private getRecommendations(): string[] {
    const recommendations = []

    if (this.metrics.memoryUsage > 50) {
      recommendations.push("Высокое потребление памяти. Рекомендуется очистка кэша.")
    }

    if (this.metrics.averageResponseTime > 1000) {
      recommendations.push("Медленные запросы. Проверьте оптимизацию базы данных.")
    }

    if (this.metrics.activeUsers.size > 50) {
      recommendations.push("Высокая нагрузка. Рассмотрите масштабирование.")
    }

    return recommendations
  }

  // Оценка масштабируемости
  getScalabilityReport() {
    const currentLoad = this.metrics.activeUsers.size

    return {
      currentUsers: currentLoad,
      estimatedCapacity: {
        comfortable: 100, // Комфортная работа
        maximum: 250, // Максимум без деградации
        critical: 500, // Критический предел
      },
      recommendations: {
        database: currentLoad > 50 ? "Добавить индексы и оптимизировать запросы" : "Текущая конфигурация достаточна",
        caching: currentLoad > 100 ? "Внедрить Redis для кэширования" : "Локальный кэш достаточен",
        infrastructure:
          currentLoad > 200 ? "Рассмотреть горизонтальное масштабирование" : "Текущая инфраструктура достаточна",
      },
    }
  }
}

export const appMonitoring = AppMonitoring.getInstance()
