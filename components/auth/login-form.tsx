"use client"

import type React from "react"

import { useState } from "react"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import PixelCard from "@/components/pixel-card"
import PixelButton from "@/components/pixel-button"
import { Eye, EyeOff, LogIn } from "lucide-react"

interface LoginFormProps {
  onSwitchToRegister: () => void
}

export default function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      toast({
        title: "Ошибка входа",
        description: error.message === "Invalid login credentials" ? "Неверный email или пароль" : error.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Успешно!",
        description: "Добро пожаловать в игру!",
      })
    }

    setLoading(false)
  }

  return (
    <PixelCard className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="text-6xl mb-4">🎮</div>
        <CardTitle className="text-2xl">Вход в игру</CardTitle>
        <CardDescription>Войдите в свой аккаунт для продолжения</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="border-2 border-black"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-2 border-black pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <PixelButton type="submit" className="w-full" disabled={loading}>
            <LogIn className="h-4 w-4 mr-2" />
            {loading ? "Вход..." : "Войти"}
          </PixelButton>

          <div className="text-center">
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
              disabled={loading}
            >
              Нет аккаунта? Зарегистрироваться
            </button>
          </div>
        </form>
      </CardContent>
    </PixelCard>
  )
}
