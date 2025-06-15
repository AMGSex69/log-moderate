// Утилиты для расчета уровня пользователя
// Выделено в отдельный файл для решения проблем с импортом

import { GAME_CONFIG } from './game-config'

// Функции для расчета уровня пользователя (новая система)
export function calculateLevel(coins: number): { level: number; name: string; icon: string; minCoins: number } {
	const levels = GAME_CONFIG.LEVELS

	// Ищем подходящий уровень (идем с конца)
	for (let i = levels.length - 1; i >= 0; i--) {
		if (coins >= levels[i].min_coins) {
			return {
				level: levels[i].level,
				name: levels[i].title,
				icon: levels[i].icon,
				minCoins: levels[i].min_coins
			}
		}
	}

	// Если очков меньше, чем для 1 уровня
	return { level: 0, name: 'Новичок', icon: '🌱', minCoins: 0 }
}

export function getNextLevel(coins: number): { level: number; threshold: number; name: string; minCoins: number; icon: string } | null {
	const levels = GAME_CONFIG.LEVELS

	// Ищем следующий уровень
	for (const levelData of levels) {
		if (coins < levelData.min_coins) {
			return {
				level: levelData.level,
				threshold: levelData.min_coins,
				name: levelData.title,
				minCoins: levelData.min_coins,
				icon: levelData.icon
			}
		}
	}

	// Максимальный уровень достигнут
	return null
} 