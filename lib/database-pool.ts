// Пул соединений и оптимизация запросов
class DatabasePool {
  private static instance: DatabasePool
  private queryCache = new Map<string, { data: any; timestamp: number }>()
  private pendingQueries = new Map<string, Promise<any>>()

  static getInstance() {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool()
    }
    return DatabasePool.instance
  }

  // Дедупликация одинаковых запросов
  async executeQuery<T>(queryKey: string, queryFn: () => Promise<T>, cacheTTL = 30000): Promise<T> {
    // Проверяем кэш
    const cached = this.queryCache.get(queryKey)
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.data
    }

    // Проверяем, не выполняется ли уже такой запрос
    if (this.pendingQueries.has(queryKey)) {
      return this.pendingQueries.get(queryKey)!
    }

    // Выполняем запрос
    const queryPromise = queryFn()
      .then((data) => {
        this.queryCache.set(queryKey, { data, timestamp: Date.now() })
        this.pendingQueries.delete(queryKey)
        return data
      })
      .catch((error) => {
        this.pendingQueries.delete(queryKey)
        throw error
      })

    this.pendingQueries.set(queryKey, queryPromise)
    return queryPromise
  }

  // Пакетные запросы
  async batchQueries<T>(queries: Array<{ key: string; fn: () => Promise<T> }>): Promise<T[]> {
    const promises = queries.map(({ key, fn }) => this.executeQuery(key, fn))
    return Promise.all(promises)
  }

  clearCache() {
    this.queryCache.clear()
  }

  getStats() {
    return {
      cacheSize: this.queryCache.size,
      pendingQueries: this.pendingQueries.size,
    }
  }
}

export const dbPool = DatabasePool.getInstance()
