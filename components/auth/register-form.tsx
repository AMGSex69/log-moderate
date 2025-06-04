"use client"

import type React from "react"

import { useState } from "react"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import PixelCard from "@/components/pixel-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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
			console.error("Registration error:", error)

			let errorMessage = error.message

			// Обрабатываем специфичные ошибки
			if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
				errorMessage = "Проблема на сервере. Попробуйте еще раз через несколько минут или обратитесь к администратору."
			} else if (error.message?.includes('Email rate limit exceeded')) {
				errorMessage = "Слишком много попыток регистрации. Подождите несколько минут."
			} else if (error.message?.includes('User already registered')) {
				errorMessage = "Пользователь с таким email уже зарегистрирован"
			} else if (error.message?.includes('Invalid email')) {
				errorMessage = "Неверный формат email адреса"
			} else if (error.message?.includes('Password should be at least')) {
				errorMessage = "Пароль должен быть не менее 6 символов"
			}

			toast({
				title: "Ошибка регистрации",
				description: errorMessage,
				variant: "destructive",
			})
		} else {
			toast({
				title: "Регистрация успешна!",
				description: "Добро пожаловать! Настройте свой профиль",
			})
			// Не переключаемся на логин, поскольку пользователь должен быть автоматически залогинен
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

					<Button
						type="submit"
						className={cn(
							"w-full border-4 border-b-8 text-white font-bold",
							"shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
							"hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
							"hover:translate-x-[-2px] hover:translate-y-[-2px]",
							"active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
							"active:translate-x-[2px] active:translate-y-[2px]",
							"disabled:opacity-50 disabled:cursor-not-allowed",
							"transition-all duration-100",
							"bg-blue-500 hover:bg-blue-600 border-blue-700",
							"px-4 py-2"
						)}
						disabled={loading}
					>
						<UserPlus className="h-4 w-4 mr-2" />
						{loading ? "Регистрация..." : "Зарегистрироваться"}
					</Button>

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
