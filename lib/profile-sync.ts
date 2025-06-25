// Система синхронизации профилей
// Используется для обновления профиля пользователя при изменении данных через админку

export interface ProfileUpdateEvent {
	userId: string
	changes: {
		office_id?: number
		admin_role?: string
		work_schedule?: string
		work_hours?: number
		managed_office_id?: number
	}
	timestamp: string
}

class ProfileSyncManager {
	private listeners: Map<string, Set<() => void>> = new Map()

	// Подписка на обновления профиля конкретного пользователя
	subscribe(userId: string, callback: () => void) {
		if (!this.listeners.has(userId)) {
			this.listeners.set(userId, new Set())
		}
		this.listeners.get(userId)!.add(callback)

		// Возвращаем функцию отписки
		return () => {
			const userListeners = this.listeners.get(userId)
			if (userListeners) {
				userListeners.delete(callback)
				if (userListeners.size === 0) {
					this.listeners.delete(userId)
				}
			}
		}
	}

	// Уведомление об обновлении профиля
	notifyProfileUpdate(userId: string, changes: ProfileUpdateEvent['changes']) {
		console.log('📡 [PROFILE-SYNC] Уведомление об обновлении профиля:', { userId, changes })

		const userListeners = this.listeners.get(userId)
		if (userListeners && userListeners.size > 0) {
			console.log(`🔔 [PROFILE-SYNC] Уведомляем ${userListeners.size} слушателей для пользователя ${userId}`)
			userListeners.forEach(callback => {
				try {
					callback()
				} catch (error) {
					console.error('❌ [PROFILE-SYNC] Ошибка в callback:', error)
				}
			})
		} else {
			console.log(`ℹ️ [PROFILE-SYNC] Нет активных слушателей для пользователя ${userId}`)
		}

		// Создаем глобальное событие для других компонентов
		const event = new CustomEvent('profileUpdated', {
			detail: { userId, changes, timestamp: new Date().toISOString() }
		})
		window.dispatchEvent(event)
	}

	// Глобальная подписка на все обновления профилей
	subscribeToAll(callback: (event: ProfileUpdateEvent) => void) {
		const handler = (event: CustomEvent<ProfileUpdateEvent>) => {
			callback(event.detail)
		}

		window.addEventListener('profileUpdated', handler as EventListener)

		return () => {
			window.removeEventListener('profileUpdated', handler as EventListener)
		}
	}

	// Очистка всех подписок
	clear() {
		this.listeners.clear()
	}
}

// Глобальный экземпляр менеджера
export const profileSyncManager = new ProfileSyncManager()

// Хук для использования в React компонентах
import { useEffect } from 'react'

export function useProfileSync(userId: string | null, onUpdate: () => void) {
	useEffect(() => {
		if (!userId) return

		console.log('🔗 [PROFILE-SYNC] Подписка на обновления профиля:', userId)
		const unsubscribe = profileSyncManager.subscribe(userId, onUpdate)

		return () => {
			console.log('🔌 [PROFILE-SYNC] Отписка от обновлений профиля:', userId)
			unsubscribe()
		}
	}, [userId, onUpdate])
}

// Функция для уведомления об изменении профиля из админки
export function notifyProfileChanged(userId: string, changes: ProfileUpdateEvent['changes']) {
	profileSyncManager.notifyProfileUpdate(userId, changes)
}

// Функция для принудительного обновления кеша профиля
export function invalidateProfileCache(userId: string) {
	// Удаляем из кеша
	if (typeof window !== 'undefined') {
		try {
			// Очищаем appCache
			const { appCache } = require('@/lib/cache')
			const cacheKeys = ['user_profile', 'current_user', `profile_${userId}`]
			cacheKeys.forEach(key => {
				appCache.delete(key)
			})

			// Также очищаем localStorage и sessionStorage на всякий случай
			cacheKeys.forEach(key => {
				localStorage.removeItem(key)
				sessionStorage.removeItem(key)
			})

			console.log('🗑️ [PROFILE-SYNC] Кеш профиля очищен для пользователя:', userId)
		} catch (error) {
			console.warn('⚠️ [PROFILE-SYNC] Ошибка очистки кеша:', error)
		}
	}
} 