"use client"

import React, { useState, useRef, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import PixelButton from "@/components/pixel-button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { Upload, Trash2, Move, RotateCcw, ZoomIn, ZoomOut, Check, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AvatarUploadWithCropProps {
	currentUrl?: string
	fullName: string
	onAvatarChange: (newUrl: string) => void
}

interface CropSettings {
	x: number
	y: number
	scale: number
	rotation: number
}

export default function AvatarUploadWithCrop({ currentUrl, fullName, onAvatarChange }: AvatarUploadWithCropProps) {
	const { user } = useAuth()
	const { toast } = useToast()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const imageRef = useRef<HTMLImageElement>(null)
	const cropperRef = useRef<HTMLDivElement>(null)

	const [uploading, setUploading] = useState(false)
	const [showCropper, setShowCropper] = useState(false)
	const [previewImage, setPreviewImage] = useState("")
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [cropSettings, setCropSettings] = useState<CropSettings>({
		x: 0,
		y: 0,
		scale: 1,
		rotation: 0
	})
	const [isDragging, setIsDragging] = useState(false)
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

	const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase() || 'У'

	const uploadAvatar = async (file: File, cropData?: CropSettings) => {
		if (!user) return

		try {
			setUploading(true)

			// Проверяем размер файла (макс 2MB)
			if (file.size > 2 * 1024 * 1024) {
				toast({
					title: "❌ Файл слишком большой",
					description: "Максимальный размер файла: 2MB",
					variant: "destructive",
				})
				return
			}

			// Проверяем тип файла
			if (!file.type.startsWith('image/')) {
				toast({
					title: "❌ Неверный тип файла",
					description: "Пожалуйста, выберите изображение",
					variant: "destructive",
				})
				return
			}

			let finalFile = file

			// Если есть настройки кадрирования, обрабатываем изображение
			if (cropData && canvasRef.current && imageRef.current) {
				const canvas = canvasRef.current
				const ctx = canvas.getContext('2d')
				if (ctx) {
					// Устанавливаем размер canvas (квадратный аватар)
					canvas.width = 200
					canvas.height = 200

					// Очищаем canvas
					ctx.clearRect(0, 0, 200, 200)

					// Применяем трансформации
					ctx.save()
					ctx.translate(100, 100) // Центр canvas
					ctx.rotate(cropData.rotation * Math.PI / 180)
					ctx.scale(cropData.scale, cropData.scale)

					const img = imageRef.current

					// Размеры: контейнер 200px, желтый круг 120px, итоговый canvas 200px
					const containerSize = 200
					const cropAreaSize = 120

					// Рассчитываем как изображение отображается в контейнере (object-contain)
					const imgAspect = img.naturalWidth / img.naturalHeight
					let displayWidth, displayHeight

					if (imgAspect > 1) {
						// Широкое изображение
						displayWidth = containerSize
						displayHeight = containerSize / imgAspect
					} else {
						// Высокое изображение
						displayWidth = containerSize * imgAspect
						displayHeight = containerSize
					}

					// Масштабирование от области кропа к финальному canvas
					const scaleToCanvas = 200 / cropAreaSize

					// Применяем трансформации с учетом масштабирования
					ctx.translate(cropData.x * scaleToCanvas, cropData.y * scaleToCanvas)

					// Рисуем изображение с масштабированием
					ctx.drawImage(
						img,
						-displayWidth * scaleToCanvas / 2,
						-displayHeight * scaleToCanvas / 2,
						displayWidth * scaleToCanvas,
						displayHeight * scaleToCanvas
					)
					ctx.restore()

					// Конвертируем canvas в blob
					const blob = await new Promise<Blob>((resolve) => {
						canvas.toBlob((blob) => {
							if (blob) resolve(blob)
						}, 'image/png', 0.9)
					})

					if (blob) {
						finalFile = new File([blob], file.name, { type: 'image/png' })
					}
				}
			}

			// Создаем уникальное имя файла
			const fileExt = finalFile.name.split('.').pop()
			const fileName = `${user.id}-${Date.now()}.${fileExt}`
			const filePath = `avatars/${fileName}`

			// Удаляем старый аватар если он есть
			if (currentUrl && currentUrl.includes(process.env.NEXT_PUBLIC_SUPABASE_URL || '')) {
				const oldPath = currentUrl.split('/').pop()
				if (oldPath && oldPath.includes(user.id)) {
					await supabase.storage.from('avatars').remove([`avatars/${oldPath}`])
				}
			}

			// Загружаем новый файл
			const { error: uploadError } = await supabase.storage
				.from('avatars')
				.upload(filePath, finalFile)

			if (uploadError) throw uploadError

			// Получаем публичную ссылку
			const { data } = supabase.storage
				.from('avatars')
				.getPublicUrl(filePath)

			const newAvatarUrl = data.publicUrl

			// Обновляем аватар
			onAvatarChange(newAvatarUrl)

			toast({
				title: "✅ Аватар обновлен!",
				description: "Ваш аватар успешно загружен",
			})

			// Закрываем кроппер
			setShowCropper(false)
			setPreviewImage("")
			setSelectedFile(null)

		} catch (error) {
			console.error('Ошибка загрузки аватара:', error)
			toast({
				title: "❌ Ошибка загрузки",
				description: "Не удалось загрузить аватар",
				variant: "destructive",
			})
		} finally {
			setUploading(false)
		}
	}

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (file) {
			setSelectedFile(file)
			const reader = new FileReader()
			reader.onload = (e) => {
				const imageUrl = e.target?.result as string
				setPreviewImage(imageUrl)
				setShowCropper(true)
				// Сброс настроек кропа
				setCropSettings({ x: 0, y: 0, scale: 1, rotation: 0 })
			}
			reader.readAsDataURL(file)
		}
	}

	const handleCropConfirm = () => {
		if (selectedFile) {
			uploadAvatar(selectedFile, cropSettings)
		}
	}

	const handleCropCancel = () => {
		setShowCropper(false)
		setPreviewImage("")
		setSelectedFile(null)
	}

	const handleMouseDown = (e: React.MouseEvent) => {
		if (!cropperRef.current) return

		setIsDragging(true)
		const rect = cropperRef.current.getBoundingClientRect()
		setDragStart({
			x: e.clientX - rect.left - cropSettings.x,
			y: e.clientY - rect.top - cropSettings.y
		})
	}

	const handleMouseMove = useCallback((e: MouseEvent) => {
		if (!isDragging || !cropperRef.current) return

		const rect = cropperRef.current.getBoundingClientRect()
		const containerSize = 200
		const cropAreaSize = 120

		// Ограничиваем перемещение в пределах контейнера
		const maxOffset = (containerSize - cropAreaSize) / 2

		let newX = e.clientX - rect.left - dragStart.x
		let newY = e.clientY - rect.top - dragStart.y

		newX = Math.max(-maxOffset, Math.min(maxOffset, newX))
		newY = Math.max(-maxOffset, Math.min(maxOffset, newY))

		setCropSettings(prev => ({
			...prev,
			x: newX,
			y: newY
		}))
	}, [isDragging, dragStart])

	const handleMouseUp = useCallback(() => {
		setIsDragging(false)
	}, [])

	React.useEffect(() => {
		if (isDragging) {
			document.addEventListener('mousemove', handleMouseMove)
			document.addEventListener('mouseup', handleMouseUp)
			return () => {
				document.removeEventListener('mousemove', handleMouseMove)
				document.removeEventListener('mouseup', handleMouseUp)
			}
		}
	}, [isDragging, handleMouseMove, handleMouseUp])

	const removeAvatar = async () => {
		if (!currentUrl) return

		try {
			setUploading(true)

			// Удаляем файл из storage если он наш
			if (currentUrl.includes(process.env.NEXT_PUBLIC_SUPABASE_URL || '')) {
				const oldPath = currentUrl.split('/').pop()
				if (oldPath && oldPath.includes(user!.id)) {
					await supabase.storage.from('avatars').remove([`avatars/${oldPath}`])
				}
			}

			onAvatarChange("")

			toast({
				title: "✅ Аватар удален",
				description: "Аватар успешно удален",
			})

		} catch (error) {
			console.error('Ошибка удаления аватара:', error)
			toast({
				title: "❌ Ошибка удаления",
				description: "Не удалось удалить аватар",
				variant: "destructive",
			})
		} finally {
			setUploading(false)
		}
	}

	return (
		<div className="bg-white border-2 border-black p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-4">
			{/* Основной интерфейс */}
			<div className="flex items-center gap-4">
				{/* Текущий аватар */}
				<Avatar className="h-20 w-20 border-2 border-black">
					<AvatarImage src={currentUrl} />
					<AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white text-2xl font-bold">
						{initials}
					</AvatarFallback>
				</Avatar>

				{/* Кнопки управления */}
				<div className="flex flex-col gap-2">
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleFileChange}
						accept="image/*"
						className="hidden"
					/>

					<PixelButton
						onClick={() => fileInputRef.current?.click()}
						disabled={uploading}
						className="text-sm px-3 py-2"
					>
						{uploading ? "⏳" : "📁"} {uploading ? "Загрузка..." : "Выбрать и кропить"}
					</PixelButton>

					{currentUrl && (
						<PixelButton
							onClick={removeAvatar}
							variant="danger"
							disabled={uploading}
							className="text-sm px-3 py-2"
						>
							🗑️ Удалить
						</PixelButton>
					)}
				</div>
			</div>

			{/* Компактный кроппер */}
			{showCropper && (
				<div className="border-2 border-yellow-400 bg-yellow-50 p-4 rounded-none space-y-4">
					<div className="flex items-center gap-2 mb-2">
						<span className="text-lg">✂️</span>
						<span className="font-mono font-bold text-sm">НАСТРОЙКА АВАТАРА</span>
					</div>

					{/* Область кропа */}
					<div className="flex justify-center">
						<div
							ref={cropperRef}
							className="relative w-[200px] h-[200px] border-2 border-black bg-gray-100 overflow-hidden cursor-move"
							onMouseDown={handleMouseDown}
						>
							{/* Изображение */}
							<img
								ref={imageRef}
								src={previewImage}
								alt="Preview"
								className="absolute inset-0 w-full h-full object-contain select-none"
								style={{
									transform: `translate(${cropSettings.x}px, ${cropSettings.y}px) scale(${cropSettings.scale}) rotate(${cropSettings.rotation}deg)`,
									transformOrigin: 'center'
								}}
								draggable={false}
							/>

							{/* Область выреза (желтый круг) */}
							<div
								className="absolute top-1/2 left-1/2 w-[120px] h-[120px] border-4 border-yellow-400 rounded-full pointer-events-none"
								style={{
									transform: 'translate(-50%, -50%)',
									boxShadow: '0 0 0 200px rgba(0,0,0,0.5)'
								}}
							/>
						</div>
					</div>

					{/* Элементы управления */}
					<div className="flex flex-wrap gap-2 justify-center">
						<PixelButton
							onClick={() => setCropSettings(prev => ({ ...prev, scale: Math.min(prev.scale + 0.1, 3) }))}
							className="text-xs px-2 py-1"
						>
							<ZoomIn className="w-3 h-3" />
						</PixelButton>

						<PixelButton
							onClick={() => setCropSettings(prev => ({ ...prev, scale: Math.max(prev.scale - 0.1, 0.1) }))}
							className="text-xs px-2 py-1"
						>
							<ZoomOut className="w-3 h-3" />
						</PixelButton>

						<PixelButton
							onClick={() => setCropSettings(prev => ({ ...prev, rotation: prev.rotation + 15 }))}
							className="text-xs px-2 py-1"
						>
							<RotateCcw className="w-3 h-3" />
						</PixelButton>

						<PixelButton
							onClick={() => setCropSettings({ x: 0, y: 0, scale: 1, rotation: 0 })}
							variant="secondary"
							className="text-xs px-2 py-1"
						>
							🔄 Сброс
						</PixelButton>
					</div>

					{/* Кнопки подтверждения */}
					<div className="flex gap-2 justify-center">
						<PixelButton
							onClick={handleCropConfirm}
							disabled={uploading}
							className="px-4 py-2"
						>
							<Check className="w-4 h-4 mr-1" />
							Сохранить
						</PixelButton>

						<PixelButton
							onClick={handleCropCancel}
							variant="secondary"
							className="px-4 py-2"
						>
							<X className="w-4 h-4 mr-1" />
							Отмена
						</PixelButton>
					</div>
				</div>
			)}

			{/* Скрытый canvas для обработки */}
			<canvas ref={canvasRef} style={{ display: 'none' }} />

			<p className="text-xs text-gray-600 font-mono">
				💡 Максимальный размер: 2MB. Поддерживаемые форматы: JPG, PNG, GIF, WebP
			</p>
		</div>
	)
} 