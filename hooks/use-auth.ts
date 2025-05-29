"use client"

import React from "react"
import { useState, useEffect, createContext, useContext, useRef } from "react"
import type { User } from "@supabase/supabase-js"
import { authService, type UserProfile } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { appCache } from "@/lib/cache"

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, fullName: string, workSchedule?: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)
  const authStateListenerRef = useRef<any>(null)
  const initTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // Предотвращаем повторную инициализацию
    if (initialized.current) return
    initialized.current = true

    const initializeAuth = async () => {
      try {
        console.log("🔄 Initializing auth...")

        // Устанавливаем таймаут для принудительного завершения загрузки
        initTimeoutRef.current = setTimeout(() => {
          console.log("⏰ Auth initialization timeout")
          setLoading(false)
          setError("Timeout loading user session")
        }, 10000) // 10 секунд максимум

        // Проверяем кэш сначала
        const cachedUser = appCache.get("current_user")
        const cachedProfile = appCache.get("user_profile")

        if (cachedUser && cachedProfile) {
          console.log("💾 Using cached auth data")
          setUser(cachedUser)
          setProfile(cachedProfile)
          setLoading(false)
          if (initTimeoutRef.current) {
            clearTimeout(initTimeoutRef.current)
          }
          return
        }

        // Получаем текущую сессию с таймаутом
        console.log("🔍 Getting current session...")
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Session timeout")), 5000))

        const {
          data: { session },
          error: sessionError,
        } = (await Promise.race([sessionPromise, timeoutPromise])) as any

        if (sessionError) {
          console.error("❌ Session error:", sessionError)
          setError(sessionError.message)
          setLoading(false)
          if (initTimeoutRef.current) {
            clearTimeout(initTimeoutRef.current)
          }
          return
        }

        if (session?.user) {
          console.log("✅ User found:", session.user.id)
          setUser(session.user)

          try {
            console.log("👤 Loading user profile...")
            const { profile } = await authService.getUserProfile(session.user.id)
            setProfile(profile)

            // Кэшируем данные
            appCache.set("current_user", session.user, 30)
            appCache.set("user_profile", profile, 30)
            console.log("💾 Auth data cached")
          } catch (profileError) {
            console.error("❌ Profile error:", profileError)
            setError("Failed to load user profile")
          }
        } else {
          console.log("👤 No user session found")
        }
      } catch (error: any) {
        console.error("❌ Auth initialization error:", error)
        setError(error.message || "Failed to initialize authentication")
      } finally {
        setLoading(false)
        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current)
        }
        console.log("✅ Auth initialization complete")
      }
    }

    initializeAuth()

    // Слушаем изменения аутентификации только один раз
    if (!authStateListenerRef.current) {
      console.log("👂 Setting up auth state listener")
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("🔄 Auth state changed:", event, session?.user?.id)

        // Игнорируем начальное событие, если уже инициализированы
        if (event === "INITIAL_SESSION" && user) {
          return
        }

        setUser(session?.user ?? null)

        if (session?.user) {
          try {
            const { profile } = await authService.getUserProfile(session.user.id)
            setProfile(profile)

            // Обновляем кэш
            appCache.set("current_user", session.user, 30)
            appCache.set("user_profile", profile, 30)
          } catch (error) {
            console.error("❌ Profile fetch error:", error)
          }
        } else {
          setProfile(null)
          appCache.clear()
        }

        setLoading(false)
      })

      authStateListenerRef.current = subscription
    }

    return () => {
      if (authStateListenerRef.current) {
        authStateListenerRef.current.unsubscribe()
        authStateListenerRef.current = null
      }
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current)
      }
    }
  }, [])

  const handleSignIn = async (email: string, password: string) => {
    setError(null)
    const { error } = await authService.signIn(email, password)
    if (error) {
      setError(error.message)
    }
    return { error }
  }

  const handleSignUp = async (email: string, password: string, fullName: string, workSchedule?: string) => {
    setError(null)
    const { error } = await authService.signUp(email, password, fullName, workSchedule)
    if (error) {
      setError(error.message)
    }
    return { error }
  }

  const handleSignOut = async () => {
    await authService.signOut()
    setUser(null)
    setProfile(null)
    setError(null)
    appCache.clear()
  }

  const refreshProfile = async () => {
    if (user) {
      try {
        const { profile } = await authService.getUserProfile(user.id)
        setProfile(profile)
        appCache.set("user_profile", profile, 30)
      } catch (error: any) {
        console.error("❌ Profile refresh error:", error)
        setError(error.message)
      }
    }
  }

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error("No user logged in") }

    try {
      setError(null)
      const { error } = await authService.updateProfile(user.id, updates)
      if (!error) {
        await refreshProfile()
      }
      return { error }
    } catch (error: any) {
      setError(error.message)
      return { error }
    }
  }

  const contextValue = {
    user,
    profile,
    loading,
    error,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    refreshProfile,
    updateProfile: handleUpdateProfile,
  }

  return React.createElement(AuthContext.Provider, { value: contextValue }, children)
}
