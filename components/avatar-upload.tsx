"use client"

import React, { useState, useRef, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import PixelButton from "@/components/pixel-button"
import PixelCard from "@/components/pixel-card"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { Upload, Camera, Link as LinkIcon, Trash2, RotateCcw, Check, X, Move } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AvatarUploadProps {
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

export default function AvatarUpload({ currentUrl, fullName, onAvatarChange }: AvatarUploadProps) {
	const { user } = useAuth()
	const { toast } = useToast()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const imageRef = useRef<HTMLImageElement>(null)
	const cropperRef = useRef<HTMLDivElement>(null)

	const [uploading, setUploading] = useState(false)
	const [uploadSuccess, setUploadSuccess] = useState(false)
	const [urlInput, setUrlInput] = useState("")
	const [showUrlInput, setShowUrlInput] = useState(false)
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
		console.log("🚀 [UPLOAD] Начинаем загрузку аватара...")
		console.log("📁 [UPLOAD] Файл:", file)
		console.log("⚙️ [UPLOAD] Настройки кропа:", cropData)
		console.log("👤 [UPLOAD] Пользователь:", user)

		if (!user) {
			console.error("❌ [UPLOAD] Пользователь не авторизован!")
			return
		}

		try {
			console.log("⏳ [UPLOAD] Устанавливаем состояние загрузки...")
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

					// Повторяем логику желтого круга (области кропа)
					const img = imageRef.current

					// Размеры: контейнер 300px, желтый круг 160px, итоговый canvas 200px
					const containerSize = 300
					const cropAreaSize = 160 // w-40 h-40

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

					// Масштабирование от области кропа (160px) к финальному canvas (200px)
					const scaleToCanvas = 200 / cropAreaSize

					// Применяем трансформации с учетом масштабирования от кропа к canvas
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

			await proceedWithUpload(finalFile)

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

	const proceedWithUpload = async (file: File) => {
		try {
			// Создаем уникальное имя файла
			const fileExt = file.name.split('.').pop()
			const fileName = `${user!.id}-${Date.now()}.${fileExt}`
			const filePath = `avatars/${fileName}`

			// Удаляем старый аватар если он есть и был загружен на наш storage
			if (currentUrl && currentUrl.includes(process.env.NEXT_PUBLIC_SUPABASE_URL || '')) {
				const oldPath = currentUrl.split('/').pop()
				if (oldPath && oldPath.includes(user!.id)) {
					await supabase.storage.from('avatars').remove([`avatars/${oldPath}`])
				}
			}

			// Загружаем новый файл
			const { error: uploadError } = await supabase.storage
				.from('avatars')
				.upload(filePath, file)

			if (uploadError) throw uploadError

			// Получаем публичную ссылку
			const { data } = supabase.storage
				.from('avatars')
				.getPublicUrl(filePath)

			const newAvatarUrl = data.publicUrl

			// Обновляем профиль пользователя
			const { error: updateError } = await supabase
				.from('user_profiles')
				.update({ avatar_url: newAvatarUrl })
				.eq('id', user!.id)

			if (updateError) throw updateError

			onAvatarChange(newAvatarUrl)
			setUploadSuccess(true)

			// Небольшая задержка для показа анимации успеха
			setTimeout(() => {
				setShowCropper(false)
				setPreviewImage("")
				setUploadSuccess(false)
			}, 1500)

			toast({
				title: "✅ Аватар обновлен",
				description: "Ваш аватар успешно загружен",
			})

		} catch (error) {
			console.error('Ошибка загрузки аватара:', error)
			toast({
				title: "❌ Ошибка загрузки",
				description: "Не удалось загрузить аватар",
				variant: "destructive",
			})
		}
	}

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (file) {
			console.log("📁 [FILE] Файл выбран:", file)
			// Сохраняем файл в состоянии
			setSelectedFile(file)

			// Создаем предварительный просмотр для кадрирования
			const reader = new FileReader()
			reader.onload = (e) => {
				if (e.target?.result) {
					console.log("🖼️ [FILE] Preview создан")
					setPreviewImage(e.target.result as string)
					setShowCropper(true)
					setCropSettings({ x: 0, y: 0, scale: 1, rotation: 0 })
				}
			}
			reader.readAsDataURL(file)
		}
	}

	const handleCropConfirm = () => {
		console.log("🔧 [CROP] Начинаем обработку сохранения аватара")

		console.log("📁 [CROP] selectedFile:", selectedFile)
		console.log("🖼️ [CROP] previewImage:", previewImage ? "есть" : "нет")
		console.log("⚙️ [CROP] cropSettings:", cropSettings)

		if (!selectedFile) {
			console.error("❌ [CROP] Файл не выбран!")
			return
		}

		if (!previewImage) {
			console.error("❌ [CROP] Нет изображения для предпросмотра!")
			return
		}

		console.log("📤 [CROP] Вызываем uploadAvatar с файлом...")
		uploadAvatar(selectedFile, cropSettings)
		console.log("🎯 [CROP] Закрываем кроппер...")
		setShowCropper(false)
		setPreviewImage("")
		setSelectedFile(null)
		console.log("✅ [CROP] handleCropConfirm завершен")
	}

	const handleMouseDown = (e: React.MouseEvent) => {
		if (cropperRef.current) {
			const rect = cropperRef.current.getBoundingClientRect()
			const relativeX = e.clientX - rect.left
			const relativeY = e.clientY - rect.top

			setIsDragging(true)
			setDragStart({
				x: relativeX - cropSettings.x,
				y: relativeY - cropSettings.y
			})
		}
	}

	const handleMouseMove = useCallback((e: MouseEvent) => {
		if (isDragging && cropperRef.current) {
			const rect = cropperRef.current.getBoundingClientRect()
			const relativeX = e.clientX - rect.left
			const relativeY = e.clientY - rect.top

			// Ограничиваем движение в пределах контейнера
			const maxX = rect.width / 2
			const maxY = rect.height / 2
			const newX = Math.max(-maxX, Math.min(maxX, relativeX - dragStart.x))
			const newY = Math.max(-maxY, Math.min(maxY, relativeY - dragStart.y))

			setCropSettings(prev => ({
				...prev,
				x: newX,
				y: newY
			}))
		}
	}, [isDragging, dragStart])

	const handleMouseUp = useCallback(() => {
		setIsDragging(false)
	}, [])

	// Добавляем обработчики мыши к документу
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

	const handleUrlSubmit = async () => {
		if (!user || !urlInput.trim()) return

		try {
			setUploading(true)

			// Простая валидация URL
			if (!urlInput.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
				toast({
					title: "❌ Неверная ссылка",
					description: "Пожалуйста, укажите прямую ссылку на изображение",
					variant: "destructive",
				})
				return
			}

			// Обновляем профиль пользователя
			const { error } = await supabase
				.from('user_profiles')
				.update({ avatar_url: urlInput.trim() })
				.eq('id', user.id)

			if (error) throw error

			onAvatarChange(urlInput.trim())
			setUrlInput("")
			setShowUrlInput(false)

			toast({
				title: "✅ Аватар обновлен",
				description: "Ваш аватар успешно изменен",
			})

		} catch (error) {
			console.error('Ошибка обновления аватара:', error)
			toast({
				title: "❌ Ошибка",
				description: "Не удалось обновить аватар",
				variant: "destructive",
			})
		} finally {
			setUploading(false)
		}
	}

	const removeAvatar = async () => {
		if (!user) return

		try {
			setUploading(true)

			// Удаляем файл из storage если он наш
			if (currentUrl && currentUrl.includes(process.env.NEXT_PUBLIC_SUPABASE_URL || '')) {
				const fileName = currentUrl.split('/').pop()
				if (fileName && fileName.includes(user.id)) {
					await supabase.storage.from('avatars').remove([`avatars/${fileName}`])
				}
			}

			// Обновляем профиль пользователя
			const { error } = await supabase
				.from('user_profiles')
				.update({ avatar_url: null })
				.eq('id', user.id)

			if (error) throw error

			onAvatarChange("")

			toast({
				title: "✅ Аватар удален",
				description: "Аватар успешно удален",
			})

		} catch (error) {
			console.error('Ошибка удаления аватара:', error)
			toast({
				title: "❌ Ошибка",
				description: "Не удалось удалить аватар",
				variant: "destructive",
			})
		} finally {
			setUploading(false)
		}
	}

	return (
		<div className="space-y-4">
			{/* Кроппер изображения - пиксельный стиль */}
			{showCropper && previewImage && (
				<div className="relative">
					<div className="bg-gradient-to-br from-blue-200 to-purple-200 border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
						{/* Декоративные пиксели */}
						<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
						<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

						<div className="flex items-center gap-3 mb-4">
							<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								<span className="text-xl">✂️</span>
							</div>
							<div>
								<h4 className="font-mono font-black text-lg text-black uppercase tracking-wide">
									НАСТРОЙКА АВАТАРА
								</h4>
								<p className="font-mono text-sm text-black font-semibold">
									Перетащите изображение мышкой
								</p>
							</div>
						</div>

						<div className="grid grid-cols-1 gap-4">
							{/* Предварительный просмотр с drag & drop */}
							<div className="space-y-3">
								<div ref={cropperRef} className="relative bg-black border-4 border-white rounded-none overflow-hidden" style={{ height: '300px' }}>
									<img
										ref={imageRef}
										src={previewImage}
										alt="Preview"
										className="w-full h-full object-contain cursor-move"
										style={{
											transform: `translate(${cropSettings.x}px, ${cropSettings.y}px) scale(${cropSettings.scale}) rotate(${cropSettings.rotation}deg)`,
											transformOrigin: 'center'
										}}
										onMouseDown={handleMouseDown}
										draggable={false}
									/>
									{/* Центральная круглая область для кропа */}
									<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
										<div className="w-40 h-40 border-4 border-yellow-400 shadow-lg rounded-full bg-transparent opacity-70"></div>
									</div>
									{/* Затемнение вокруг */}
									<div className="absolute inset-0 bg-black/30 pointer-events-none"></div>
								</div>

								{/* Пиксельные кнопки управления */}
								<div className="flex gap-2 justify-center">
									<button
										onClick={() => setCropSettings(prev => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.1) }))}
										className="bg-red-500 hover:bg-red-600 border-2 border-black text-white font-mono font-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-100"
									>
										🔍-
									</button>
									<button
										onClick={() => setCropSettings(prev => ({ ...prev, scale: Math.min(3, prev.scale + 0.1) }))}
										className="bg-green-500 hover:bg-green-600 border-2 border-black text-white font-mono font-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-100"
									>
										🔍+
									</button>
									<button
										onClick={() => setCropSettings(prev => ({ ...prev, rotation: prev.rotation + 90 }))}
										className="bg-blue-500 hover:bg-blue-600 border-2 border-black text-white font-mono font-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-100"
									>
										🔄
									</button>
									<button
										onClick={() => setCropSettings({ x: 0, y: 0, scale: 1, rotation: 0 })}
										className="bg-purple-500 hover:bg-purple-600 border-2 border-black text-white font-mono font-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-100"
									>
										↺
									</button>
								</div>
							</div>

							{/* Пиксельные кнопки действий */}
							<div className="space-y-3">
								<div className="space-y-2">
									<PixelButton
										onClick={() => {
											console.log("🚀 [АВАТАР] Нажата кнопка сохранения аватара")
											console.log("📋 [АВАТАР] Текущие настройки кропа:", cropSettings)
											console.log("🖼️ [АВАТАР] Изображение для предпросмотра:", previewImage)
											handleCropConfirm()
										}}
										loading={uploading}
										success={uploadSuccess}
										loadingText="💾 Сохранение..."
										successText="✅ Готово!"
										className="w-full shadow-lg hover:shadow-xl transition-shadow"
									>
										💾 Сохранить
									</PixelButton>
									<PixelButton
										variant="secondary"
										onClick={() => {
											setShowCropper(false)
											setPreviewImage("")
										}}
										className="w-full shadow-lg hover:shadow-xl transition-shadow"
									>
										❌ Отмена
									</PixelButton>
									<PixelButton
										variant="secondary"
										onClick={() => setCropSettings({ x: 0, y: 0, scale: 1, rotation: 0 })}
										className="w-full shadow-lg hover:shadow-xl transition-shadow"
									>
										🔄 Сброс
									</PixelButton>
								</div>
							</div>
						</div>

						{/* Инструкция */}
						<div className="mt-4 bg-yellow-200 border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
							<div className="font-mono text-black text-center text-sm">
								💡 <strong>ИНСТРУКЦИЯ:</strong> Перетащите изображение мышкой для позиционирования
							</div>
						</div>

						{/* Нижние декоративные пиксели */}
						<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
						<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
					</div>
					<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
				</div>
			)}

			{/* Основной интерфейс аватара - пиксельный стиль */}
			{!showCropper && (
				<div className="relative">
					<div className="bg-gradient-to-br from-green-200 to-blue-200 border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
						{/* Декоративные пиксели */}
						<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
						<div className="absolute top-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>

						<div className="flex items-center gap-3 mb-4">
							<div className="bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								<span className="text-xl">🖼️</span>
							</div>
							<div>
								<h4 className="font-mono font-black text-lg text-black uppercase tracking-wide">
									АВАТАР ПРОФИЛЯ
								</h4>
								<p className="font-mono text-sm text-black font-semibold">
									Персонализация персонажа
								</p>
							</div>
						</div>

						{/* Аватар и кнопки в пиксельном стиле */}
						<div className="bg-black border-2 border-white p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
							<div className="flex items-center gap-4 mb-4">
								<Avatar className="h-20 w-20 border-4 border-yellow-400 shadow-lg">
									<AvatarImage src={currentUrl} />
									<AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white text-2xl font-bold">
										{initials}
									</AvatarFallback>
								</Avatar>

								<div className="flex-1 space-y-2">
									<div className="grid grid-cols-2 gap-2">
										<PixelButton
											onClick={() => fileInputRef.current?.click()}
											disabled={uploading}
											size="sm"
											className="shadow-lg hover:shadow-xl transition-shadow"
										>
											📁 Файл
										</PixelButton>

										<PixelButton
											onClick={() => setShowUrlInput(!showUrlInput)}
											disabled={uploading}
											variant="secondary"
											size="sm"
											className="shadow-lg hover:shadow-xl transition-shadow"
										>
											🔗 URL
										</PixelButton>
									</div>

									{currentUrl && (
										<PixelButton
											onClick={removeAvatar}
											disabled={uploading}
											variant="danger"
											size="sm"
											className="w-full shadow-lg hover:shadow-xl transition-shadow"
										>
											🗑️ Удалить
										</PixelButton>
									)}
								</div>
							</div>

							<div className="bg-gray-800 border border-gray-600 p-2 rounded text-center">
								<div className="text-white font-mono text-xs">
									📋 Макс. 2MB • JPG, PNG, GIF, WebP
								</div>
							</div>
						</div>

						{/* Ввод URL в пиксельном стиле */}
						{showUrlInput && (
							<div className="mt-4 bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								<Label htmlFor="avatar-url" className="font-mono font-black text-black uppercase">🔗 Ссылка на изображение</Label>
								<div className="flex gap-2 mt-2">
									<Input
										id="avatar-url"
										value={urlInput}
										onChange={(e) => setUrlInput(e.target.value)}
										placeholder="https://example.com/avatar.jpg"
										disabled={uploading}
										className="flex-1 border-2 border-black font-mono"
									/>
									<PixelButton
										onClick={handleUrlSubmit}
										disabled={uploading || !urlInput.trim()}
										size="sm"
									>
										💾
									</PixelButton>
								</div>
							</div>
						)}

						{/* Скрытый input для файлов */}
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							onChange={handleFileChange}
							className="hidden"
						/>

						{/* Нижние декоративные пиксели */}
						<div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400 border border-black"></div>
						<div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-400 border border-black"></div>
					</div>
					<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
				</div>
			)}

			{/* Скрытый canvas для обработки изображений */}
			<canvas ref={canvasRef} className="hidden" />
		</div>
	)
} 