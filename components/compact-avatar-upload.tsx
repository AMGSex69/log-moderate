"use client"

import React, { useState, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import PixelButton from "@/components/pixel-button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { Upload, Link as LinkIcon, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CompactAvatarUploadProps {
	currentUrl?: string
	fullName: string
	onAvatarChange: (newUrl: string) => void
}

export default function CompactAvatarUpload({ currentUrl, fullName, onAvatarChange }: CompactAvatarUploadProps) {
	const { user } = useAuth()
	const { toast } = useToast()
	const fileInputRef = useRef<HTMLInputElement>(null)

	const [uploading, setUploading] = useState(false)

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
				.upload(filePath, file)

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
		<div className="bg-white border-2 border-black p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
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
						{uploading ? "⏳" : "📁"} {uploading ? "Загрузка..." : "Выбрать файл"}
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

			<p className="text-xs text-gray-600 mt-2 font-mono">
				💡 Максимальный размер: 2MB. Поддерживаемые форматы: JPG, PNG, GIF, WebP
			</p>
		</div>
	)
} 