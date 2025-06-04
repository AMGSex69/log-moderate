// Утилиты для расчета уровня пользователя
// Выделено в отдельный файл для решения проблем с импортом

// Пороги для получения призов (общие очки)
export const PRIZE_THRESHOLDS = {
	bronze: 100,      // Бронзовый уровень
	silver: 300,      // Серебряный уровень  
	gold: 600,        // Золотой уровень
	platinum: 1000,   // Платиновый уровень
	diamond: 1500,    // Алмазный уровень
	master: 2500,     // Мастер уровень
	grandmaster: 5000 // Гранд мастер
} as const

// Функции для расчета уровня пользователя
export function calculateLevel(coins: number): { level: number; name: string; icon: string; minCoins: number } {
	if (coins >= PRIZE_THRESHOLDS.grandmaster) return { level: 7, name: 'Гранд-мастер', icon: '👑', minCoins: PRIZE_THRESHOLDS.grandmaster }
	if (coins >= PRIZE_THRESHOLDS.master) return { level: 6, name: 'Мастер', icon: '🏆', minCoins: PRIZE_THRESHOLDS.master }
	if (coins >= PRIZE_THRESHOLDS.diamond) return { level: 5, name: 'Алмаз', icon: '💎', minCoins: PRIZE_THRESHOLDS.diamond }
	if (coins >= PRIZE_THRESHOLDS.platinum) return { level: 4, name: 'Платина', icon: '🥇', minCoins: PRIZE_THRESHOLDS.platinum }
	if (coins >= PRIZE_THRESHOLDS.gold) return { level: 3, name: 'Золото', icon: '🥈', minCoins: PRIZE_THRESHOLDS.gold }
	if (coins >= PRIZE_THRESHOLDS.silver) return { level: 2, name: 'Серебро', icon: '🥉', minCoins: PRIZE_THRESHOLDS.silver }
	if (coins >= PRIZE_THRESHOLDS.bronze) return { level: 1, name: 'Бронза', icon: '🏅', minCoins: PRIZE_THRESHOLDS.bronze }

	return { level: 0, name: 'Новичок', icon: '🌱', minCoins: 0 }
}

export function getNextLevel(coins: number): { level: number; threshold: number; name: string; minCoins: number; icon: string } | null {
	if (coins < PRIZE_THRESHOLDS.bronze) {
		return { level: 1, threshold: PRIZE_THRESHOLDS.bronze, name: 'Бронза', minCoins: PRIZE_THRESHOLDS.bronze, icon: '🏅' }
	}
	if (coins < PRIZE_THRESHOLDS.silver) {
		return { level: 2, threshold: PRIZE_THRESHOLDS.silver, name: 'Серебро', minCoins: PRIZE_THRESHOLDS.silver, icon: '🥉' }
	}
	if (coins < PRIZE_THRESHOLDS.gold) {
		return { level: 3, threshold: PRIZE_THRESHOLDS.gold, name: 'Золото', minCoins: PRIZE_THRESHOLDS.gold, icon: '🥈' }
	}
	if (coins < PRIZE_THRESHOLDS.platinum) {
		return { level: 4, threshold: PRIZE_THRESHOLDS.platinum, name: 'Платина', minCoins: PRIZE_THRESHOLDS.platinum, icon: '🥇' }
	}
	if (coins < PRIZE_THRESHOLDS.diamond) {
		return { level: 5, threshold: PRIZE_THRESHOLDS.diamond, name: 'Алмаз', minCoins: PRIZE_THRESHOLDS.diamond, icon: '💎' }
	}
	if (coins < PRIZE_THRESHOLDS.master) {
		return { level: 6, threshold: PRIZE_THRESHOLDS.master, name: 'Мастер', minCoins: PRIZE_THRESHOLDS.master, icon: '🏆' }
	}
	if (coins < PRIZE_THRESHOLDS.grandmaster) {
		return { level: 7, threshold: PRIZE_THRESHOLDS.grandmaster, name: 'Гранд-мастер', minCoins: PRIZE_THRESHOLDS.grandmaster, icon: '👑' }
	}

	// Максимальный уровень достигнут
	return null
} 