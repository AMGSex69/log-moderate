"use client"

import type React from "react"
import { useAuth } from "@/hooks/use-auth"
import { useState } from "react"
import LoginForm from "./login-form"
import RegisterForm from "./register-form"
import { Toaster } from "@/components/ui/toaster"

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, error } = useAuth()
  const [showRegister, setShowRegister] = useState(false)

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="text-6xl animate-bounce mb-4">🎮</div>
          <div className="text-2xl font-bold">Загрузка игры...</div>
          <div className="text-lg mt-2 opacity-80">Подготавливаем пиксельный мир</div>
          <div className="mt-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-red-400 via-pink-500 to-purple-500 flex items-center justify-center p-4">
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <div className="text-2xl font-bold mb-2">Ошибка подключения</div>
          <div className="text-lg mb-4 opacity-80 break-words">{error}</div>
          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-white text-purple-600 rounded-lg font-bold hover:bg-gray-100 transition-colors"
            >
              Перезагрузить
            </button>
            <button
              onClick={() => {
                localStorage.clear()
                sessionStorage.clear()
                window.location.reload()
              }}
              className="w-full px-6 py-3 bg-transparent border-2 border-white text-white rounded-lg font-bold hover:bg-white hover:text-purple-600 transition-colors"
            >
              Очистить кэш и перезагрузить
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center p-4">
        {showRegister ? (
          <RegisterForm onSwitchToLogin={() => setShowRegister(false)} />
        ) : (
          <LoginForm onSwitchToRegister={() => setShowRegister(true)} />
        )}
        <Toaster />
      </main>
    )
  }

  return <>{children}</>
}
