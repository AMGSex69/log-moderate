-- Скрипт для обновления типов задач Task Logger
-- Удаляет старые английские названия и оставляет только русские

-- 1. Удаляем старые английские типы задач
DELETE FROM task_types WHERE name IN (
    'Разработка',
    'Тестирование', 
    'Документация',
    'Анализ',
    'Дизайн',
    'Планирование',
    'Код ревью',
    'Настройка',
    'Исправление багов',
    'Оптимизация',
    'Интеграция',
    'Деплой',
    'Обучение',
    'Консультации',
    'Митинги'
);

-- 2. Удаляем английские названия если они есть
DELETE FROM task_types WHERE name IN (
    'Development',
    'Testing',
    'Documentation',
    'Analysis',
    'Design',
    'Planning',
    'Code Review',
    'Configuration',
    'Bug Fixing',
    'Optimization',
    'Integration',
    'Deployment',
    'Learning',
    'Consulting',
    'Meetings'
);

-- 3. Добавляем актуальные русские типы задач
INSERT INTO task_types (name, description) VALUES
    ('Актуализация ОСС', 'Актуализация данных общих собрания собственников'),
    ('Обзвоны по рисовке', 'Телефонные звонки по вопросам рисовки'),
    ('Отчеты физикам (+почта)', 'Подготовка и отправка отчетов физическим лицам'),
    ('Проверка голосов (электроны, "Учтен ЭД" и др)', 'Проверка электронных голосов и их учет'),
    ('Проверка городских помещений', 'Проверка состояния городских помещений'),
    ('Проверка документов ОСС', 'Проверка документации общих собраний собственников'),
    ('Протоколы ОСС', 'Ведение протоколов общих собраний собственников'),
    ('Сбор фактуры по голосам', 'Сбор фактических данных по голосованию'),
    ('Таблицы по рисовке', 'Работа с таблицами и данными по рисовке'),
    ('Актуализация реестра домов', 'Обновление реестра жилых домов'),
    ('Модерация общедомовых чатов', 'Модерация сообщений в общедомовых чатах'),
    ('Актуализация юрзначимых опросов + публикация протоколов', 'Актуализация юридически значимых опросов и публикация протоколов'),
    ('Модерация опросов', 'Модерация пользовательских опросов'),
    ('Модерация ОСС от УО', 'Модерация ОСС от управляющих организаций'),
    ('Модерация ОСС от физлиц', 'Модерация ОСС от физических лиц'),
    ('Модерация юрзначимых опросов', 'Модерация юридически значимых опросов'),
    ('Отправка писем в Дирекции/Префектуры', 'Отправка официальных писем в дирекции и префектуры'),
    ('Спецопросы', 'Работа со специальными опросами'),
    ('АСГУФ', 'Работа с автоматизированной системой АСГУФ'),
    ('Валидация', 'Проверка и валидация данных'),
    ('Задачи руководства', 'Выполнение поручений руководства'),
    ('Работа с выгрузками', 'Обработка и анализ выгрузок данных'),
    ('Созвон/обучение', 'Проведение созвонов и обучающих мероприятий'),
    ('Статистика ОСС', 'Подготовка статистики по общим собраниям собственников'),
    ('Внесение решений МЖИ (кол-во бланков)', 'Внесение решений МЖИ с подсчетом количества бланков'),
    ('Проверка протоколов МЖИ', 'Проверка протоколов Мосжилинспекции'),
    ('Разбивка решений МЖИ', 'Разбивка и систематизация решений МЖИ'),
    ('Входящие звонки', 'Обработка входящих телефонных звонков'),
    ('Курьер ЭД (кол-во физ.Лиц)', 'Курьерская доставка электронных документов'),
    ('Обзвоны', 'Исходящие телефонные звонки'),
    ('Плакаты', 'Изготовление и размещение плакатов'),
    ('Скрипты', 'Разработка и использование скриптов'),
    ('Работа с посетителями', 'Работа с посетителями офиса'),
    ('Заполнение карточек домов после обходов', 'Заполнение карточек домов по результатам обходов'),
    ('Обходы', 'Проведение обходов жилых домов'),
    ('Подготовка обходного реестра/работа с ним после обхода', 'Подготовка реестра для обходов и работа с результатами'),
    ('Работа с нетиповыми обращениями СТП', 'Обработка нетиповых обращений через СТП'),
    ('СТП отмена ОСС', 'Отмена общих собраний через СТП'),
    ('СТП подселенцы', 'Работа с подселенцами через СТП')
ON CONFLICT (name) DO NOTHING;

-- 4. Проверяем результат
SELECT 
    'Проверка обновленных типов задач:' as info;

-- Считаем всего типов задач
SELECT 
    COUNT(*) as total_task_types,
    COUNT(*) FILTER (WHERE is_active = true) as active_task_types
FROM task_types;

-- Показываем все типы задач
SELECT 
    'Все типы задач после обновления:' as header;

SELECT 
    id, name, description, is_active
FROM task_types 
ORDER BY name;

-- Финальное сообщение
SELECT 
    '✅ Типы задач успешно обновлены!' as success_message,
    '📋 Удалены старые английские названия' as step1,
    '📝 Добавлены актуальные русские названия' as step2,
    NOW() as completed_at; 