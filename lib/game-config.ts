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
		'Курьер ЭД (кол-во физ.Лиц)': 2,  // за каждое физ
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
			color: '#10B981', // green
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
			color: '#6366F1', // indigo
			tasks: [
				'АСГУФ',
				'Валидация',
				'Задачи руководства',
				'Работа с выгрузками',
				'Созвон/обучение',
				'Статистика ОСС'
			]
		},
		mzhi: {
			name: 'МЖИ',
			icon: '🏛️',
			color: '#8B5CF6', // violet
			tasks: [
				'Внесение решений МЖИ (кол-во бланков)',
				'Проверка протоколов МЖИ',
				'Разбивка решений МЖИ'
			]
		},
		office: {
			name: 'Офисные задачи',
			icon: '📞',
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
		field_work: {
			name: 'Обходы',
			icon: '🚶',
			color: '#059669', // emerald
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

	// Новая система уровней (100 уровней с прогрессивным увеличением)
	LEVELS: (() => {
		const levels = []
		let requiredCoins = 0

		for (let level = 1; level <= 100; level++) {
			// Прогрессивная формула: каждый уровень требует больше очков
			// 1-10: 50, 100, 200, 350, 550, 800, 1100, 1450, 1850, 2300
			// 11-20: +600, +650, +700... (увеличивается на 50 каждый уровень)
			// 21-50: еще быстрее
			// 51-100: очень быстро растет

			let increment
			if (level <= 10) {
				increment = 50 + (level - 1) * 50 + Math.pow(level - 1, 2) * 25
			} else if (level <= 20) {
				increment = 600 + (level - 11) * 50
			} else if (level <= 50) {
				increment = 1100 + (level - 21) * 100 + Math.pow(level - 21, 2) * 10
			} else if (level <= 80) {
				increment = 5000 + (level - 51) * 200 + Math.pow(level - 51, 2) * 20
			} else {
				increment = 15000 + (level - 81) * 500 + Math.pow(level - 81, 2) * 50
			}

			requiredCoins += increment

			// Названия уровней
			let title, icon
			if (level <= 5) {
				title = `Новичок ${level}`
				icon = '🌱'
			} else if (level <= 10) {
				title = `Стажер ${level - 5}`
				icon = '📚'
			} else if (level <= 20) {
				title = `Работник ${level - 10}`
				icon = '💼'
			} else if (level <= 30) {
				title = `Специалист ${level - 20}`
				icon = '🔧'
			} else if (level <= 40) {
				title = `Эксперт ${level - 30}`
				icon = '🎯'
			} else if (level <= 50) {
				title = `Мастер ${level - 40}`
				icon = '⚡'
			} else if (level <= 60) {
				title = `Виртуоз ${level - 50}`
				icon = '🎨'
			} else if (level <= 70) {
				title = `Гений ${level - 60}`
				icon = '🧠'
			} else if (level <= 80) {
				title = `Легенда ${level - 70}`
				icon = '🏆'
			} else if (level <= 90) {
				title = `Титан ${level - 80}`
				icon = '💎'
			} else {
				title = `Бог ${level - 90}`
				icon = '👑'
			}

			levels.push({
				level,
				min_coins: requiredCoins,
				title,
				icon
			})
		}

		return levels
	})(),

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

export default GAME_CONFIG
