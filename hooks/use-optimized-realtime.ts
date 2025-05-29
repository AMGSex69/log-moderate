"use client"

import { useEffect, useRef, useState } from "react"
import { optimizedSupabase } from "@/lib/optimized-supabase"

// Хук для оптимизированных real-time подписок
export function useOptimizedRealtime<T>(table: string, filter?: any, initialData?: T[]) {
  const [data, setData] = useState<T[]>(initialData || [])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    let mounted = true

    // Используем общий канал для всех подписок на таблицу
    const channelName = `optimized_${table}`

    if (!channelRef.current) {
      channelRef.current = optimizedSupabase.subscribeToChannel(channelName, {
        event: "*",
        schema: "public",
        table: table,
        filter: filter ? `${filter.column}=eq.${filter.value}` : undefined,
      })

      // Обработчик изменений
      channelRef.current.on("postgres_changes", (payload: any) => {
        if (!mounted) return

        setData((prevData) => {
          switch (payload.eventType) {
            case "INSERT":
              return [...prevData, payload.new as T]
            case "UPDATE":
              return prevData.map((item) => ((item as any).id === payload.new.id ? (payload.new as T) : item))
            case "DELETE":
              return prevData.filter((item) => (item as any).id !== payload.old.id)
            default:
              return prevData
          }
        })
      })
    }

    // Загружаем начальные данные
    const loadInitialData = async () => {
      try {
        let query = optimizedSupabase.from(table).select("*")

        if (filter) {
          query = query.eq(filter.column, filter.value)
        }

        const { data: initialData, error } = await query

        if (error) throw error
        if (mounted) {
          setData(initialData || [])
          setLoading(false)
        }
      } catch (error) {
        console.error("Error loading initial data:", error)
        if (mounted) setLoading(false)
      }
    }

    loadInitialData()

    return () => {
      mounted = false
      // НЕ отписываемся, так как канал переиспользуется
    }
  }, [table, filter?.column, filter?.value])

  return { data, loading }
}
