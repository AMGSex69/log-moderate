-- Добавление нового офиса "Экран" для округа ЮВАО (исправленная версия)
-- Со всеми необходимыми настройками и логикой

BEGIN;

-- 1. Добавляем новый офис (используем districts как массив)
INSERT INTO offices (name, description, districts, created_at, updated_at)
VALUES ('Экран', 'Офис Экран в округе ЮВАО', ARRAY['ЮВАО'], NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Получаем ID нового офиса
DO $$
DECLARE
    new_office_id INTEGER;
BEGIN
    SELECT id INTO new_office_id FROM offices WHERE name = 'Экран';
    
    -- 2. Проверяем есть ли таблица work_schedules
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_schedules') THEN
        -- Добавляем рабочие графики для нового офиса
        INSERT INTO work_schedules (name, description, work_hours, office_id, is_active, created_at, updated_at)
        VALUES 
            ('5/2 (9ч)', 'Пятидневка с 9-часовым рабочим днем', 9, new_office_id, true, NOW(), NOW()),
            ('2/2 (12ч)', 'Двухдневка с 12-часовым рабочим днем', 12, new_office_id, true, NOW(), NOW())
        ON CONFLICT (name, office_id) DO NOTHING;
        RAISE NOTICE 'Рабочие графики добавлены для офиса Экран';
    ELSE
        RAISE NOTICE 'Таблица work_schedules не найдена, пропускаем добавление графиков';
    END IF;
    
    -- 3. Добавляем типы задач для нового офиса (используем существующую структуру task_types)
    INSERT INTO task_types (name, description, is_active, created_at, measurement_unit, group_name, icon, color)
    VALUES 
        ('Прием/Выдача (Экран)', 'Прием и выдача документов в офисе Экран', true, NOW(), 'документов', 'Экран', '📄', '#3B82F6'),
        ('Консультация (Экран)', 'Консультирование граждан в офисе Экран', true, NOW(), 'консультаций', 'Экран', '💬', '#10B981'),
        ('Оформление документов (Экран)', 'Подготовка и оформление документов в офисе Экран', true, NOW(), 'документов', 'Экран', '📝', '#F59E0B'),
        ('Проверка документов (Экран)', 'Проверка правильности документов в офисе Экран', true, NOW(), 'документов', 'Экран', '🔍', '#8B5CF6'),
        ('Работа с базами данных (Экран)', 'Внесение и обработка данных в офисе Экран', true, NOW(), 'записей', 'Экран', '💾', '#EF4444'),
        ('Телефонные звонки (Экран)', 'Обработка входящих звонков в офисе Экран', true, NOW(), 'звонков', 'Экран', '📞', '#06B6D4'),
        ('Подготовка отчетов (Экран)', 'Составление отчетности в офисе Экран', true, NOW(), 'отчетов', 'Экран', '📊', '#84CC16'),
        ('Межведомственное взаимодействие (Экран)', 'Работа с другими ведомствами в офисе Экран', true, NOW(), 'обращений', 'Экран', '🤝', '#F97316'),
        ('Обучение/Инструктаж (Экран)', 'Участие в обучающих мероприятиях в офисе Экран', true, NOW(), 'часов', 'Экран', '🎓', '#EC4899'),
        ('Техническая поддержка (Экран)', 'Решение технических вопросов в офисе Экран', true, NOW(), 'инцидентов', 'Экран', '🔧', '#6B7280')
    ON CONFLICT (name) DO NOTHING;
    
    RAISE NOTICE 'Офис "Экран" успешно добавлен с ID: %', new_office_id;
END $$;

-- 4. Проверяем созданный офис
SELECT 
    o.id,
    o.name,
    o.description,
    o.districts,
    COUNT(DISTINCT tt.id) as task_types_count
FROM offices o
LEFT JOIN task_types tt ON tt.group_name = 'Экран'
WHERE o.name = 'Экран'
GROUP BY o.id, o.name, o.description, o.districts;

-- 5. Показываем все типы задач для нового офиса
SELECT 
    tt.id,
    tt.name,
    tt.description,
    tt.measurement_unit,
    tt.group_name,
    tt.icon,
    tt.color
FROM task_types tt
WHERE tt.group_name = 'Экран'
ORDER BY tt.name;

-- 6. Показываем все офисы
SELECT 
    id,
    name,
    description,
    districts
FROM offices
ORDER BY name;

COMMIT;

-- Итоговая информация
SELECT 'Офис "Экран" (ЮВАО) успешно создан со всеми настройками!' as result; 