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
import { Eye, EyeOff, UserPlus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface RegisterFormProps {
  onSwitchToLogin: () => void
}

export default function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [workSchedule, setWorkSchedule] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password || !fullName || !confirmPassword) {
      toast({
        title: "Ошибка",
        description: "Заполните все поля",
        variant: "destructive",
      })
      return
    }

    if (!workSchedule) {
      toast({
        title: "Ошибка",
        description: "Выберите график работы",
        variant: "destructive",
      })
      return
    }

    if (password !== confirmPassword) {
      toast({
        title: "Ошибка",
        description: "Пароли не совпадают",
        variant: "destructive",
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: "Ошибка",
        description: "Пароль должен содержать минимум 6 символов",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    const { error } = await signUp(email, password, fullName, workSchedule)

    if (error) {
      toast({
        title: "Ошибка регистрации",
        description: error.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Регистрация успешна!",
        description: "Проверьте email для подтверждения аккаунта",
      })
      onSwitchToLogin()
    }

    setLoading(false)
  }

  return (
    <PixelCard className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="text-6xl mb-4">🎮</div>
        <CardTitle className="text-2xl">Регистрация</CardTitle>
        <CardDescription>Создайте аккаунт для начала игры</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Полное имя</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иван Иванов"
              className="border-2 border-black"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workSchedule">График работы</Label>
            <Select value={workSchedule} onValueChange={setWorkSchedule} disabled={loading}>
              <SelectTrigger className="border-2 border-black">
                <SelectValue placeholder="Выберите график работы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8+1">8 часов + 1 час обед</SelectItem>
                <SelectItem value="12">12 часов</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="border-2 border-black"
              disabled={loading}
            />
          </div>

          <PixelButton type="submit" className="w-full" disabled={loading}>
            <UserPlus className="h-4 w-4 mr-2" />
            {loading ? "Регистрация..." : "Зарегистрироваться"}
          </PixelButton>

          <div className="text-center">
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
              disabled={loading}
            >
              Уже есть аккаунт? Войти
            </button>
          </div>
        </form>
      </CardContent>
    </PixelCard>
  )
}
