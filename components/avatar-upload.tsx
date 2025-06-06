"use client"

import { useState, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import PixelButton from "@/components/pixel-button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { Upload, Camera, Link as LinkIcon, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AvatarUploadProps {
	currentUrl?: string
	fullName: string
	onAvatarChange: (newUrl: string) => void
}

export default function AvatarUpload({ currentUrl, fullName, onAvatarChange }: AvatarUploadProps) {
	const { user } = useAuth()
	const { toast } = useToast()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [uploading, setUploading] = useState(false)
	const [urlInput, setUrlInput] = useState("")
	const [showUrlInput, setShowUrlInput] = useState(false)

	const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase() || 'У'

	const uploadAvatar = async (file: File) => {
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

			// Создаем уникальное имя файла
			const fileExt = file.name.split('.').pop()
			const fileName = `${user.id}-${Date.now()}.${fileExt}`
			const filePath = `avatars/${fileName}`

			// Удаляем старый аватар если он есть и был загружен на наш storage
			if (currentUrl && currentUrl.includes(process.env.NEXT_PUBLIC_SUPABASE_URL || '')) {
				const oldPath = currentUrl.split('/').pop()
				if (oldPath) {
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
				.eq('id', user.id)

			if (updateError) throw updateError

			onAvatarChange(newAvatarUrl)

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
		} finally {
			setUploading(false)
		}
	}

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (file) {
			uploadAvatar(file)
		}
	}

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
				const filePath = currentUrl.split('/').pop()
				if (filePath) {
					await supabase.storage.from('avatars').remove([`avatars/${filePath}`])
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
			{/* Аватар */}
			<div className="flex items-center gap-4">
				<Avatar className="h-20 w-20 border-4 border-black">
					<AvatarImage src={currentUrl} />
					<AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white text-2xl font-bold">
						{initials}
					</AvatarFallback>
				</Avatar>

				<div className="space-y-2">
					<div className="flex gap-2">
						<PixelButton
							onClick={() => fileInputRef.current?.click()}
							disabled={uploading}
							size="sm"
						>
							<Camera className="h-4 w-4 mr-2" />
							{uploading ? "Загрузка..." : "Загрузить"}
						</PixelButton>

						<PixelButton
							onClick={() => setShowUrlInput(!showUrlInput)}
							disabled={uploading}
							variant="secondary"
							size="sm"
						>
							<LinkIcon className="h-4 w-4 mr-2" />
							По ссылке
						</PixelButton>

						{currentUrl && (
							<PixelButton
								onClick={removeAvatar}
								disabled={uploading}
								variant="danger"
								size="sm"
							>
								<Trash2 className="h-4 w-4 mr-2" />
								Удалить
							</PixelButton>
						)}
					</div>

					<p className="text-xs text-muted-foreground">
						Максимум 2MB. Форматы: JPG, PNG, GIF, WebP
					</p>
				</div>

				{/* Скрытый input для файлов */}
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					onChange={handleFileChange}
					className="hidden"
				/>
			</div>

			{/* Ввод URL */}
			{showUrlInput && (
				<div className="space-y-2">
					<Label htmlFor="avatar-url">Ссылка на изображение</Label>
					<div className="flex gap-2">
						<Input
							id="avatar-url"
							value={urlInput}
							onChange={(e) => setUrlInput(e.target.value)}
							placeholder="https://example.com/avatar.jpg"
							disabled={uploading}
						/>
						<Button
							onClick={handleUrlSubmit}
							disabled={uploading || !urlInput.trim()}
						>
							Сохранить
						</Button>
					</div>
				</div>
			)}
		</div>
	)
} 