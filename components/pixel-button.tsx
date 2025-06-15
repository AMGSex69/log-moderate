"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const pixelButtonVariants = cva(
	"inline-flex items-center justify-center whitespace-nowrap text-sm font-mono font-black uppercase tracking-wide ring-offset-background transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]",
	{
		variants: {
			variant: {
				default: "bg-gradient-to-r from-blue-400 to-blue-500 text-white hover:from-blue-500 hover:to-blue-600",
				destructive: "bg-gradient-to-r from-red-400 to-red-500 text-white hover:from-red-500 hover:to-red-600",
				outline: "border-2 border-black bg-white text-black hover:bg-gray-100",
				secondary: "bg-gradient-to-r from-gray-300 to-gray-400 text-black hover:from-gray-400 hover:to-gray-500",
				ghost: "border-none shadow-none bg-transparent text-black hover:bg-gray-100",
				link: "border-none shadow-none bg-transparent text-blue-600 underline-offset-4 hover:underline",
				danger: "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700",
				// Новые варианты для улучшенной визуализации
				loading: "bg-gradient-to-r from-yellow-400 to-yellow-500 text-black animate-pulse cursor-wait",
				success: "bg-gradient-to-r from-green-400 to-green-500 text-white animate-bounce",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-9 px-3 text-xs",
				lg: "h-11 px-8 text-base",
				icon: "h-10 w-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
)

export interface PixelButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
	VariantProps<typeof pixelButtonVariants> {
	asChild?: boolean
	loading?: boolean
	success?: boolean
	successDuration?: number
	loadingText?: string
	successText?: string
}

const PixelButton = React.forwardRef<HTMLButtonElement, PixelButtonProps>(
	({
		className,
		variant,
		size,
		asChild = false,
		loading = false,
		success = false,
		successDuration = 2000,
		loadingText,
		successText,
		children,
		disabled,
		onClick,
		...props
	}, ref) => {
		const [isSuccess, setIsSuccess] = React.useState(false)
		const [isLoading, setIsLoading] = React.useState(false)

		// Автоматически управляем состоянием успеха
		React.useEffect(() => {
			console.log("🎨 [PIXELBUTTON] success prop changed:", success)
			if (success) {
				setIsSuccess(true)
				console.log("🎨 [PIXELBUTTON] setIsSuccess(true) - показываем анимацию успеха")
				const timer = setTimeout(() => {
					console.log("🎨 [PIXELBUTTON] success timeout - убираем анимацию")
					setIsSuccess(false)
				}, successDuration)
				return () => clearTimeout(timer)
			} else {
				setIsSuccess(false)
			}
		}, [success, successDuration])

		// Управляем состоянием загрузки
		React.useEffect(() => {
			console.log("🎨 [PIXELBUTTON] loading prop changed:", loading)
			setIsLoading(loading)
		}, [loading])

		const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
			if (loading || disabled || isSuccess) return

			if (onClick) {
				// Показываем кратковременную анимацию нажатия
				const button = event.currentTarget
				button.style.transform = 'translate(2px, 2px)'
				button.style.boxShadow = 'none'

				setTimeout(() => {
					button.style.transform = ''
					button.style.boxShadow = ''
				}, 100)

				onClick(event)
			}
		}

		// Определяем текущий вариант на основе состояния
		const currentVariant = isSuccess ? "success" : isLoading ? "loading" : variant

		// Определяем текущий текст
		const currentText = isSuccess
			? (successText || "✅ Готово!")
			: isLoading
				? (loadingText || "⏳ Загрузка...")
				: children

		// Логирование для отладки (только при изменении состояния)
		React.useEffect(() => {
			console.log("🎨 [PIXELBUTTON] State changed:", {
				loading,
				success,
				isLoading,
				isSuccess,
				currentVariant
			})
		}, [loading, success, isLoading, isSuccess, currentVariant])

		const Comp = asChild ? Slot : "button"

		return (
			<Comp
				className={cn(pixelButtonVariants({ variant: currentVariant, size, className }))}
				ref={ref}
				disabled={disabled || isLoading || isSuccess}
				onClick={handleClick}
				{...props}
			>
				{currentText}
			</Comp>
		)
	}
)
PixelButton.displayName = "PixelButton"

export default PixelButton
