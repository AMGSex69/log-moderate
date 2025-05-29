// Игровая конфигурация
export const GAME_CONFIG = {
  // Награды за задачи (монетки)
  TASK_REWARDS: {
    // Актуализация
    "Актуализация ОСС": 6,
    "Обзвоны по рисовке": 3,
    "Отчеты физикам (+почта)": 7,
    'Проверка голосов (электроны, "Учтен ЭД" и др)': 5,
    "Проверка городских помещений": 4,
    "Проверка документов ОСС": 2,
    "Протоколы ОСС": 7,
    "Сбор фактуры по голосам": 2,
    "Таблицы по рисовке": 2,

    // Работа с админкой
    "Актуализация реестра домов": 2,
    "Модерация общедомовых чатов": 3,

    // ОСС и Опросы
    "Актуализация юрзначимых опросов + публикация протоколов": 6,
    "Модерация опросов": 4,
    "Модерация ОСС от УО": 6,
    "Модерация ОСС от физлиц": 9,
    "Модерация юрзначимых опросов": 6,
    "Отправка писем в Дирекции/Префектуры": 2,
    Спецопросы: 3,

    // Поддержка/Прочее
    АСГУФ: 2,
    Валидация: 2,
    "Задачи руководства": 3,
    "Работа с выгрузками": 4,
    "Созвон/обучение": 1,
    "Статистика ОСС": 3,

    // МЖИ
    "Внесение решений МЖИ (кол-во бланков)": 2,
    "Проверка протоколов МЖИ": 4,
    "Разбивка решений МЖИ": 2,

    // Офисные задачи
    "Входящие звонки": 4,
    "Курьер ЭД (кол-во физ.Лиц)": 3,
    Обзвоны: 2,
    Плакаты: 2,
    Скрипты: 2,
    "Работа с посетителями": 6,

    // Обходы
    "Заполнение карточек домов после обходов": 3,
    Обходы: 5,
    "Подготовка обходного реестра/работа с ним после обхода": 5,

    // СТП
    "Работа с нетиповыми обращениями": 6,
    "СТП отмена ОСС": 2,
    "СТП подселенцы": 5,
  } as Record<string, number>,

  // Группы задач
  TASK_GROUPS: {
    Актуализация: {
      icon: "🔄",
      color: "from-blue-200 to-blue-300",
      tasks: [
        "Актуализация ОСС",
        "Обзвоны по рисовке",
        "Отчеты физикам (+почта)",
        'Проверка голосов (электроны, "Учтен ЭД" и др)',
        "Проверка городских помещений",
        "Проверка документов ОСС",
        "Протоколы ОСС",
        "Сбор фактуры по голосам",
        "Таблицы по рисовке",
      ],
    },
    "Работа с админкой": {
      icon: "⚙️",
      color: "from-gray-200 to-gray-300",
      tasks: ["Актуализация реестра домов", "Модерация общедомовых чатов"],
    },
    "ОСС и Опросы": {
      icon: "📊",
      color: "from-green-200 to-green-300",
      tasks: [
        "Актуализация юрзначимых опросов + публикация протоколов",
        "Модерация опросов",
        "Модерация ОСС от УО",
        "Модерация ОСС от физлиц",
        "Модерация юрзначимых опросов",
        "Отправка писем в Дирекции/Префектуры",
        "Спецопросы",
      ],
    },
    "Поддержка/Прочее": {
      icon: "🛠️",
      color: "from-purple-200 to-purple-300",
      tasks: ["АСГУФ", "Валидация", "Задачи руководства", "Работа с выгрузками", "Созвон/обучение", "Статистика ОСС"],
    },
    МЖИ: {
      icon: "📋",
      color: "from-orange-200 to-orange-300",
      tasks: ["Внесение решений МЖИ (кол-во бланков)", "Проверка протоколов МЖИ", "Разбивка решений МЖИ"],
    },
    "Офисные задачи": {
      icon: "🏢",
      color: "from-yellow-200 to-yellow-300",
      tasks: [
        "Входящие звонки",
        "Курьер ЭД (кол-во физ.Лиц)",
        "Обзвоны",
        "Плакаты",
        "Скрипты",
        "Работа с посетителями",
      ],
    },
    Обходы: {
      icon: "🚶‍♂️",
      color: "from-teal-200 to-teal-300",
      tasks: [
        "Заполнение карточек домов после обходов",
        "Обходы",
        "Подготовка обходного реестра/работа с ним после обхода",
      ],
    },
    СТП: {
      icon: "🎯",
      color: "from-red-200 to-red-300",
      tasks: ["Работа с нетиповыми обращениями", "СТП отмена ОСС", "СТП подселенцы"],
    },
  },

  // Достижения
  ACHIEVEMENTS: [
    { id: "first_task", name: "Первые шаги", description: "Выполните первую задачу", icon: "🎯", reward: 10 },
    { id: "hard_worker", name: "Трудяга", description: "Выполните 5 сложных задач (6+ очков)", icon: "💪", reward: 25 },
    { id: "speed_demon", name: "Скоростной демон", description: "Выполните 15 задач за день", icon: "⚡", reward: 50 },
    {
      id: "variety_master",
      name: "Мастер разнообразия",
      description: "Выполните задачи из 5 разных групп за день",
      icon: "🌈",
      reward: 40,
    },
    {
      id: "multitasker",
      name: "Мультизадачник",
      description: "Работайте над 3 задачами одновременно",
      icon: "🎪",
      reward: 30,
    },
    {
      id: "efficiency_expert",
      name: "Эксперт эффективности",
      description: "Среднее время на задачу < 20 мин (за день)",
      icon: "⏱️",
      reward: 35,
    },
    {
      id: "high_value_specialist",
      name: "Специалист высокой ценности",
      description: "Выполните 3 задачи по 7+ очков за день",
      icon: "💎",
      reward: 60,
    },
    {
      id: "consistency_king",
      name: "Король постоянства",
      description: "Работайте 5 дней подряд",
      icon: "👑",
      reward: 75,
    },
    {
      id: "thousand_club",
      name: "Клуб тысячи",
      description: "Накопите 1000 очков",
      icon: "🎰",
      reward: 0,
      special: "wheel",
    },
    {
      id: "perfectionist",
      name: "Перфекционист",
      description: "Выполните 10 задач без перерывов",
      icon: "🎖️",
      reward: 45,
    },
  ],

  // 50 уровней с экспоненциальным ростом
  LEVELS: [
    // Начальные уровни (1-10) - первая неделя
    { level: 1, name: "Новичок", minCoins: 0, icon: "🌱" },
    { level: 2, name: "Стажёр", minCoins: 50, icon: "📚" },
    { level: 3, name: "Ученик", minCoins: 120, icon: "🎓" },
    { level: 4, name: "Помощник", minCoins: 220, icon: "🤝" },
    { level: 5, name: "Сотрудник", minCoins: 350, icon: "💼" },
    { level: 6, name: "Работник", minCoins: 520, icon: "⚒️" },
    { level: 7, name: "Исполнитель", minCoins: 730, icon: "✅" },
    { level: 8, name: "Деятель", minCoins: 980, icon: "🎯" },
    { level: 9, name: "Активист", minCoins: 1280, icon: "🔥" },
    { level: 10, name: "Энтузиаст", minCoins: 1630, icon: "⭐" },

    // Продвинутые уровни (11-20) - вторая неделя
    { level: 11, name: "Специалист", minCoins: 2030, icon: "🎖️" },
    { level: 12, name: "Профессионал", minCoins: 2480, icon: "💪" },
    { level: 13, name: "Эксперт", minCoins: 2980, icon: "🧠" },
    { level: 14, name: "Мастер", minCoins: 3530, icon: "🔧" },
    { level: 15, name: "Виртуоз", minCoins: 4130, icon: "🎨" },
    { level: 16, name: "Гуру", minCoins: 4780, icon: "🧙‍♂️" },
    { level: 17, name: "Сенсей", minCoins: 5480, icon: "🥋" },
    { level: 18, name: "Наставник", minCoins: 6230, icon: "👨‍🏫" },
    { level: 19, name: "Лидер", minCoins: 7030, icon: "👑" },
    { level: 20, name: "Командир", minCoins: 7880, icon: "⚔️" },

    // Высокие уровни (21-30) - третья неделя
    { level: 21, name: "Капитан", minCoins: 8780, icon: "🚢" },
    { level: 22, name: "Майор", minCoins: 9730, icon: "🎖️" },
    { level: 23, name: "Полковник", minCoins: 10730, icon: "🏅" },
    { level: 24, name: "Генерал", minCoins: 11780, icon: "⭐" },
    { level: 25, name: "Маршал", minCoins: 12880, icon: "🎗️" },
    { level: 26, name: "Чемпион", minCoins: 14030, icon: "🏆" },
    { level: 27, name: "Легенда", minCoins: 15230, icon: "🌟" },
    { level: 28, name: "Миф", minCoins: 16480, icon: "🦄" },
    { level: 29, name: "Феномен", minCoins: 17780, icon: "💫" },
    { level: 30, name: "Чудо", minCoins: 19130, icon: "✨" },

    // Элитные уровни (31-40) - четвертая неделя
    { level: 31, name: "Титан", minCoins: 20530, icon: "⛰️" },
    { level: 32, name: "Колосс", minCoins: 21980, icon: "🗿" },
    { level: 33, name: "Гигант", minCoins: 23480, icon: "🏔️" },
    { level: 34, name: "Левиафан", minCoins: 25030, icon: "🐋" },
    { level: 35, name: "Кракен", minCoins: 26630, icon: "🐙" },
    { level: 36, name: "Дракон", minCoins: 28280, icon: "🐉" },
    { level: 37, name: "Феникс", minCoins: 29980, icon: "🔥" },
    { level: 38, name: "Грифон", minCoins: 31730, icon: "🦅" },
    { level: 39, name: "Единорог", minCoins: 33530, icon: "🦄" },
    { level: 40, name: "Химера", minCoins: 35380, icon: "👹" },

    // Божественные уровни (41-49) - пятая неделя и далее
    { level: 41, name: "Полубог", minCoins: 37280, icon: "⚡" },
    { level: 42, name: "Божество", minCoins: 39230, icon: "🌩️" },
    { level: 43, name: "Олимпиец", minCoins: 41230, icon: "🏛️" },
    { level: 44, name: "Архангел", minCoins: 43280, icon: "👼" },
    { level: 45, name: "Серафим", minCoins: 45380, icon: "😇" },
    { level: 46, name: "Херувим", minCoins: 47530, icon: "👑" },
    { level: 47, name: "Демиург", minCoins: 49730, icon: "🌌" },
    { level: 48, name: "Создатель", minCoins: 51980, icon: "🌍" },
    { level: 49, name: "Всевышний", minCoins: 54280, icon: "☀️" },

    // Финальный уровень (50) - месяц упорной работы
    { level: 50, name: "БОГ ЭД", minCoins: 56630, icon: "👑" },
  ],
}

export function calculateLevel(coins: number) {
  const levels = GAME_CONFIG.LEVELS
  for (let i = levels.length - 1; i >= 0; i--) {
    if (coins >= levels[i].minCoins) {
      return levels[i]
    }
  }
  return levels[0]
}

export function getNextLevel(coins: number) {
  const currentLevel = calculateLevel(coins)
  const levels = GAME_CONFIG.LEVELS
  const currentIndex = levels.findIndex((l) => l.level === currentLevel.level)
  return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null
}

export function getProgressToNextLevel(coins: number) {
  const currentLevel = calculateLevel(coins)
  const nextLevel = getNextLevel(coins)

  if (!nextLevel) {
    return { progress: 100, coinsNeeded: 0, coinsToNext: 0 }
  }

  const coinsInCurrentLevel = coins - currentLevel.minCoins
  const coinsNeededForNext = nextLevel.minCoins - currentLevel.minCoins
  const progress = Math.round((coinsInCurrentLevel / coinsNeededForNext) * 100)
  const coinsToNext = nextLevel.minCoins - coins

  return { progress, coinsNeeded: coinsNeededForNext, coinsToNext }
}
