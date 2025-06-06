// Конфигурация игрофикации для Task Logger
// Обновленная версия с новыми группами задач

export const GAME_CONFIG = {
	// Награды за выполнение задач (базовые баллы)
	TASK_REWARDS: {
		// Актуализация
		'Актуализация ОСС': 15,
		'Обзвоны по рисовке': 10,
		'Отчеты физикам (+почта)': 12,
		'Проверка голосов (электроны, "Учтен ЭД" и др)': 8,
		'Проверка городских помещений': 20,
		'Проверка документов ОСС': 10,
		'Протоколы ОСС': 25,
		'Сбор фактуры по голосам': 8,
		'Таблицы по рисовке': 6,

		// Работа с админкой
		'Актуализация реестра домов': 15,
		'Модерация общедомовых чатов': 5,

		// ОСС и Опросы
		'Актуализация юрзначимых опросов + публикация протоколов': 30,
		'Модерация опросов': 8,
		'Модерация ОСС от УО': 12,
		'Модерация ОСС от физлиц': 10,
		'Модерация юрзначимых опросов': 15,
		'Отправка писем в Дирекции/Префектуры': 20,
		'Спецопросы': 25,

		// Поддержка/Прочее
		'АСГУФ': 10,
		'Валидация': 8,
		'Задачи руководства': 15,
		'Работа с выгрузками': 12,
		'Созвон/обучение': 10,
		'Статистика ОСС': 12,

		// МЖИ
		'Внесение решений МЖИ (кол-во бланков)': 5,  // за каждый бланк
		'Проверка протоколов МЖИ': 15,
		'Разбивка решений МЖИ': 10,

		// Офисные задачи
		'Входящие звонки': 3,  // за каждый звонок
		'Курьер ЭД (кол-во физ.Лиц)': 2,  // за каждое физ.лицо
		'Обзвоны': 4,  // за каждый звонок
		'Плакаты': 8,
		'Скрипты': 12,
		'Работа с посетителями': 5,

		// Обходы
		'Заполнение карточек домов после обходов': 8,
		'Обходы': 25,  // за каждый дом
		'Подготовка обходного реестра/работа с ним после обхода': 15,

		// СТП
		'Работа с нетиповыми обращениями': 12,
		'СТП отмена ОСС': 10,
		'СТП подселенцы': 8,
	} as Record<string, number>,

	// Группы задач с цветовой кодировкой
	TASK_GROUPS: {
		actualization: {
			name: 'Актуализация',
			icon: '📝',
			color: '#3B82F6', // blue
			tasks: [
				'Актуализация ОСС',
				'Обзвоны по рисовке',
				'Отчеты физикам (+почта)',
				'Проверка голосов (электроны, "Учтен ЭД" и др)',
				'Проверка городских помещений',
				'Проверка документов ОСС',
				'Протоколы ОСС',
				'Сбор фактуры по голосам',
				'Таблицы по рисовке'
			]
		},
		admin_work: {
			name: 'Работа с админкой',
			icon: '⚙️',
			color: '#8B5CF6', // purple
			tasks: [
				'Актуализация реестра домов',
				'Модерация общедомовых чатов'
			]
		},
		oss_surveys: {
			name: 'ОСС и Опросы',
			icon: '📊',
			color: '#10B981', // emerald
			tasks: [
				'Актуализация юрзначимых опросов + публикация протоколов',
				'Модерация опросов',
				'Модерация ОСС от УО',
				'Модерация ОСС от физлиц',
				'Модерация юрзначимых опросов',
				'Отправка писем в Дирекции/Префектуры',
				'Спецопросы'
			]
		},
		support: {
			name: 'Поддержка/Прочее',
			icon: '🛠️',
			color: '#F59E0B', // amber
			tasks: [
				'АСГУФ',
				'Валидация',
				'Задачи руководства',
				'Работа с выгрузками',
				'Созвон/обучение',
				'Статистика ОСС'
			]
		},
		mgji: {
			name: 'МЖИ',
			icon: '🏛️',
			color: '#EF4444', // red
			tasks: [
				'Внесение решений МЖИ (кол-во бланков)',
				'Проверка протоколов МЖИ',
				'Разбивка решений МЖИ'
			]
		},
		office: {
			name: 'Офисные задачи',
			icon: '💼',
			color: '#06B6D4', // cyan
			tasks: [
				'Входящие звонки',
				'Курьер ЭД (кол-во физ.Лиц)',
				'Обзвоны',
				'Плакаты',
				'Скрипты',
				'Работа с посетителями'
			]
		},
		walkthroughs: {
			name: 'Обходы',
			icon: '🚶',
			color: '#84CC16', // lime
			tasks: [
				'Заполнение карточек домов после обходов',
				'Обходы',
				'Подготовка обходного реестра/работа с ним после обхода'
			]
		},
		stp: {
			name: 'СТП',
			icon: '📞',
			color: '#F97316', // orange
			tasks: [
				'Работа с нетиповыми обращениями',
				'СТП отмена ОСС',
				'СТП подселенцы'
			]
		}
	} as Record<string, {
		name: string
		icon: string
		color: string
		tasks: string[]
	}>,

	// Пороги для получения призов (общие очки)
	PRIZE_THRESHOLDS: {
		bronze: 100,      // Бронзовый уровень
		silver: 300,      // Серебряный уровень  
		gold: 600,        // Золотой уровень
		platinum: 1000,   // Платиновый уровень
		diamond: 1500,    // Алмазный уровень
		master: 2500,     // Мастер уровень
		grandmaster: 5000 // Гранд мастер
	} as Record<string, number>,

	// Бонусы за эффективность (коэффициенты)
	EFFICIENCY_BONUSES: {
		excellent: 2.0,   // Отличная эффективность (менее 80% от среднего времени)
		good: 1.5,        // Хорошая эффективность (80-90% от среднего)
		normal: 1.0,      // Нормальная эффективность (90-110% от среднего)
		poor: 0.8,        // Плохая эффективность (110-130% от среднего)
		bad: 0.5          // Очень плохая эффективность (более 130% от среднего)
	} as Record<string, number>,

	// Настройки для одновременной работы над задачами
	MULTITASK_CONFIG: {
		max_concurrent_tasks: 3,           // Максимальное количество одновременных задач
		task_switch_penalty: 0.1,          // Штраф за переключение между задачами (10%)
		multitask_bonus_threshold: 2,      // Бонус начисляется при работе над N+ задачами
		multitask_efficiency_bonus: 1.2,   // Бонус за многозадачность
		idle_task_timeout: 30,             // Время в минутах, после которого неактивная задача считается приостановленной
		heartbeat_interval: 60,            // Интервал обновления heartbeat в секундах
	},

	// Специальные бонусы за группы задач
	GROUP_BONUSES: {
		daily_group_completion: 1.5,       // Бонус за выполнение задач из всех групп за день
		group_specialist: 1.3,             // Бонус за специализацию на одной группе (>70% задач)
		versatile_worker: 1.4,             // Бонус за работу в 5+ группах за неделю
	},

	// Специальные события и достижения
	ACHIEVEMENTS: {
		speed_demon: {
			name: 'Скоростной демон',
			description: 'Выполните 10 задач менее чем за половину среднего времени',
			badge: '⚡',
			points: 200
		},
		multitasker: {
			name: 'Мультизадачник',
			description: 'Работайте одновременно над 3 задачами в течение часа',
			badge: '🎯',
			points: 150
		},
		thousand_club: {
			name: 'Клуб тысячи',
			description: 'Наберите 1000 очков',
			badge: '💰',
			points: 100
		},
		night_owl: {
			name: 'Полуночник',
			description: 'Выполните 20 задач после 18:00',
			badge: '🌙',
			points: 100
		},
		early_bird: {
			name: 'Жаворонок',
			description: 'Выполните 20 задач до 10:00',
			badge: '🌅',
			points: 100
		},
		group_master: {
			name: 'Мастер группы',
			description: 'Выполните по 10 задач в каждой группе',
			badge: '👑',
			points: 300
		},
		efficiency_king: {
			name: 'Король эффективности',
			description: 'Поддерживайте коэффициент эффективности выше 1.8 неделю',
			badge: '🏆',
			points: 400
		}
	}
}

// Утилитарные функции для работы с конфигурацией
export function getTaskGroup(taskName: string): string | null {
	for (const [groupKey, group] of Object.entries(GAME_CONFIG.TASK_GROUPS)) {
		if (group.tasks.includes(taskName)) {
			return groupKey
		}
	}
	return null
}

export function getTaskGroupName(taskName: string): string {
	const groupKey = getTaskGroup(taskName)
	return groupKey ? GAME_CONFIG.TASK_GROUPS[groupKey].name : 'Прочее'
}

export function getTaskGroupColor(taskName: string): string {
	const groupKey = getTaskGroup(taskName)
	return groupKey ? GAME_CONFIG.TASK_GROUPS[groupKey].color : '#6B7280'
}

export function calculateTaskReward(taskName: string, unitsCompleted: number, timeSpent: number, averageTime?: number): number {
	const baseReward = GAME_CONFIG.TASK_REWARDS[taskName] || 5
	let totalReward = baseReward * unitsCompleted

	// Применяем бонус за эффективность если есть средний показатель
	if (averageTime && averageTime > 0) {
		const efficiency = averageTime / (timeSpent / unitsCompleted)
		let efficiencyBonus = GAME_CONFIG.EFFICIENCY_BONUSES.normal

		if (efficiency >= 1.25) efficiencyBonus = GAME_CONFIG.EFFICIENCY_BONUSES.excellent
		else if (efficiency >= 1.11) efficiencyBonus = GAME_CONFIG.EFFICIENCY_BONUSES.good
		else if (efficiency >= 0.91) efficiencyBonus = GAME_CONFIG.EFFICIENCY_BONUSES.normal
		else if (efficiency >= 0.77) efficiencyBonus = GAME_CONFIG.EFFICIENCY_BONUSES.poor
		else efficiencyBonus = GAME_CONFIG.EFFICIENCY_BONUSES.bad

		totalReward *= efficiencyBonus
	}

	return Math.round(totalReward)
}

export function getPrizeLevel(totalPoints: number): string {
	const thresholds = GAME_CONFIG.PRIZE_THRESHOLDS

	if (totalPoints >= thresholds.grandmaster) return 'grandmaster'
	if (totalPoints >= thresholds.master) return 'master'
	if (totalPoints >= thresholds.diamond) return 'diamond'
	if (totalPoints >= thresholds.platinum) return 'platinum'
	if (totalPoints >= thresholds.gold) return 'gold'
	if (totalPoints >= thresholds.silver) return 'silver'
	if (totalPoints >= thresholds.bronze) return 'bronze'

	return 'novice'
}

// Функции для расчета уровня пользователя
export function calculateLevel(coins: number): { level: number; name: string; icon: string; minCoins: number } {
	const thresholds = GAME_CONFIG.PRIZE_THRESHOLDS

	if (coins >= thresholds.grandmaster) return { level: 7, name: 'Гранд-мастер', icon: '👑', minCoins: thresholds.grandmaster }
	if (coins >= thresholds.master) return { level: 6, name: 'Мастер', icon: '🏆', minCoins: thresholds.master }
	if (coins >= thresholds.diamond) return { level: 5, name: 'Алмаз', icon: '💎', minCoins: thresholds.diamond }
	if (coins >= thresholds.platinum) return { level: 4, name: 'Платина', icon: '🥇', minCoins: thresholds.platinum }
	if (coins >= thresholds.gold) return { level: 3, name: 'Золото', icon: '🥈', minCoins: thresholds.gold }
	if (coins >= thresholds.silver) return { level: 2, name: 'Серебро', icon: '🥉', minCoins: thresholds.silver }
	if (coins >= thresholds.bronze) return { level: 1, name: 'Бронза', icon: '🏅', minCoins: thresholds.bronze }

	return { level: 0, name: 'Новичок', icon: '🌱', minCoins: 0 }
}

export function getNextLevel(coins: number): { level: number; threshold: number; name: string; minCoins: number; icon: string } | null {
	const thresholds = GAME_CONFIG.PRIZE_THRESHOLDS

	if (coins < thresholds.bronze) {
		return { level: 1, threshold: thresholds.bronze, name: 'Бронза', minCoins: thresholds.bronze, icon: '🏅' }
	}
	if (coins < thresholds.silver) {
		return { level: 2, threshold: thresholds.silver, name: 'Серебро', minCoins: thresholds.silver, icon: '🥉' }
	}
	if (coins < thresholds.gold) {
		return { level: 3, threshold: thresholds.gold, name: 'Золото', minCoins: thresholds.gold, icon: '🥈' }
	}
	if (coins < thresholds.platinum) {
		return { level: 4, threshold: thresholds.platinum, name: 'Платина', minCoins: thresholds.platinum, icon: '🥇' }
	}
	if (coins < thresholds.diamond) {
		return { level: 5, threshold: thresholds.diamond, name: 'Алмаз', minCoins: thresholds.diamond, icon: '💎' }
	}
	if (coins < thresholds.master) {
		return { level: 6, threshold: thresholds.master, name: 'Мастер', minCoins: thresholds.master, icon: '🏆' }
	}
	if (coins < thresholds.grandmaster) {
		return { level: 7, threshold: thresholds.grandmaster, name: 'Гранд-мастер', minCoins: thresholds.grandmaster, icon: '👑' }
	}

	// Максимальный уровень достигнут
	return null
}

export default GAME_CONFIG
