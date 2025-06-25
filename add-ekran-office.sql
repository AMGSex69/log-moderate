-- Добавление нового офиса "Экран" для округа ЮВАО
-- Со всеми необходимыми настройками и логикой

BEGIN;

-- 1. Добавляем новый офис
INSERT INTO offices (name, district, is_active, created_at, updated_at)
VALUES ('Экран', 'ЮВАО', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Получаем ID нового офиса
DO $$
DECLARE
    new_office_id INTEGER;
BEGIN
    SELECT id INTO new_office_id FROM offices WHERE name = 'Экран';
    
    -- 2. Добавляем рабочие графики для нового офиса
    INSERT INTO work_schedules (name, description, work_hours, office_id, is_active, created_at, updated_at)
    VALUES 
        ('5/2 (9ч)', 'Пятидневка с 9-часовым рабочим днем', 9, new_office_id, true, NOW(), NOW()),
        ('2/2 (12ч)', 'Двухдневка с 12-часовым рабочим днем', 12, new_office_id, true, NOW(), NOW())
    ON CONFLICT (name, office_id) DO NOTHING;
    
    -- 3. Добавляем типы задач для нового офиса
    INSERT INTO task_types (name, description, coins_reward, office_id, is_active, created_at, updated_at)
    VALUES 
        ('Прием/Выдача', 'Прием и выдача документов', 10, new_office_id, true, NOW(), NOW()),
        ('Консультация', 'Консультирование граждан', 15, new_office_id, true, NOW(), NOW()),
        ('Оформление документов', 'Подготовка и оформление документов', 20, new_office_id, true, NOW(), NOW()),
        ('Проверка документов', 'Проверка правильности документов', 12, new_office_id, true, NOW(), NOW()),
        ('Работа с базами данных', 'Внесение и обработка данных', 18, new_office_id, true, NOW(), NOW()),
        ('Телефонные звонки', 'Обработка входящих звонков', 8, new_office_id, true, NOW(), NOW()),
        ('Подготовка отчетов', 'Составление отчетности', 25, new_office_id, true, NOW(), NOW()),
        ('Межведомственное взаимодействие', 'Работа с другими ведомствами', 22, new_office_id, true, NOW(), NOW()),
        ('Обучение/Инструктаж', 'Участие в обучающих мероприятиях', 15, new_office_id, true, NOW(), NOW()),
        ('Техническая поддержка', 'Решение технических вопросов', 20, new_office_id, true, NOW(), NOW())
    ON CONFLICT (name, office_id) DO NOTHING;
    
    RAISE NOTICE 'Офис "Экран" успешно добавлен с ID: %', new_office_id;
END $$;

-- 4. Проверяем созданный офис и его настройки
SELECT 
    o.id,
    o.name,
    o.district,
    o.is_active,
    COUNT(ws.id) as work_schedules_count,
    COUNT(tt.id) as task_types_count
FROM offices o
LEFT JOIN work_schedules ws ON o.id = ws.office_id
LEFT JOIN task_types tt ON o.id = tt.office_id
WHERE o.name = 'Экран'
GROUP BY o.id, o.name, o.district, o.is_active;

-- 5. Показываем все рабочие графики для нового офиса
SELECT 
    ws.id,
    ws.name,
    ws.description,
    ws.work_hours,
    o.name as office_name
FROM work_schedules ws
JOIN offices o ON ws.office_id = o.id
WHERE o.name = 'Экран'
ORDER BY ws.work_hours;

-- 6. Показываем все типы задач для нового офиса
SELECT 
    tt.id,
    tt.name,
    tt.description,
    tt.coins_reward,
    o.name as office_name
FROM task_types tt
JOIN offices o ON tt.office_id = o.id
WHERE o.name = 'Экран'
ORDER BY tt.coins_reward DESC;

COMMIT;

-- Итоговая информация
SELECT 'Офис "Экран" (ЮВАО) успешно создан со всеми настройками!' as result; 