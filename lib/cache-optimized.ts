// Улучшенная система кэширования с TTL и приоритетами
interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
  priority: "low" | "medium" | "high"
  accessCount: number
  lastAccess: number
}

class OptimizedCache {
  private cache = new Map<string, CacheItem<any>>()
  private maxSize = 100 // Максимум элементов в кэше
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Очистка кэша каждые 5 минут
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  set<T>(key: string, data: T, ttlMinutes = 5, priority: "low" | "medium" | "high" = "medium") {
    // Если кэш переполнен, удаляем старые элементы
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000,
      priority,
      accessCount: 0,
      lastAccess: Date.now(),
    })
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    // Проверяем TTL
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    // Обновляем статистику доступа
    item.accessCount++
    item.lastAccess = Date.now()

    return item.data
  }

  // Предзагрузка данных
  async preload<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMinutes = 5,
    priority: "low" | "medium" | "high" = "medium",
  ) {
    if (this.has(key)) return this.get<T>(key)

    try {
      const data = await fetcher()
      this.set(key, data, ttlMinutes, priority)
      return data
    } catch (error) {
      console.error(`Preload failed for ${key}:`, error)
      return null
    }
  }

  has(key: string): boolean {
    const item = this.cache.get(key)
    if (!item) return false

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  private evictOldest() {
    let oldestKey = ""
    let oldestTime = Date.now()
    let lowestPriority = "high"

    // Сначала удаляем элементы с низким приоритетом
    for (const [key, item] of this.cache.entries()) {
      if (item.priority === "low" && item.lastAccess < oldestTime) {
        oldestKey = key
        oldestTime = item.lastAccess
        lowestPriority = "low"
      }
    }

    // Если нет элементов с низким приоритетом, удаляем самый старый
    if (!oldestKey) {
      for (const [key, item] of this.cache.entries()) {
        if (item.lastAccess < oldestTime) {
          oldestKey = key
          oldestTime = item.lastAccess
        }
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  private cleanup() {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key))

    if (keysToDelete.length > 0) {
      console.log(`Cache cleanup: removed ${keysToDelete.length} expired items`)
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      items: Array.from(this.cache.entries()).map(([key, item]) => ({
        key,
        priority: item.priority,
        accessCount: item.accessCount,
        age: Math.round((Date.now() - item.timestamp) / 1000),
        ttl: Math.round(item.ttl / 1000),
      })),
    }
  }

  clear() {
    this.cache.clear()
  }

  destroy() {
    clearInterval(this.cleanupInterval)
    this.clear()
  }
}

export const optimizedCache = new OptimizedCache()
