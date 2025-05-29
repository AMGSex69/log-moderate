import { getSupabaseClient } from "./supabase-client"

// Менеджер подключений для оптимизации
class ConnectionManager {
  private static instance: ConnectionManager
  private activeConnections = new Map<string, any>()
  private connectionPool: any[] = []
  private maxConnections = 5 // Лимит на пользователя

  static getInstance() {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager()
    }
    return ConnectionManager.instance
  }

  // Переиспользование подключений
  getConnection(key: string) {
    if (this.activeConnections.has(key)) {
      return this.activeConnections.get(key)
    }

    // Создаем новое подключение только если нужно
    if (this.activeConnections.size < this.maxConnections) {
      const connection = this.createConnection()
      this.activeConnections.set(key, connection)
      return connection
    }

    // Переиспользуем существующее
    return Array.from(this.activeConnections.values())[0]
  }

  private createConnection() {
    return getSupabaseClient()
  }

  // Очистка неактивных подключений
  cleanup() {
    this.activeConnections.forEach((connection, key) => {
      if (this.isIdle(connection)) {
        connection.removeAllChannels?.()
        this.activeConnections.delete(key)
      }
    })
  }

  private isIdle(connection: any): boolean {
    // Логика определения неактивного подключения
    return false // Упрощенная версия
  }

  getStats() {
    return {
      active: this.activeConnections.size,
      limit: this.maxConnections,
    }
  }
}

export const connectionManager = ConnectionManager.getInstance()
