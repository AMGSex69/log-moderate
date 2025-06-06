-- ===========================================
-- ОБНОВЛЕНИЕ ОФИСОВ НА РЕАЛЬНЫЕ ДАННЫЕ
-- ===========================================

-- 1. Очищаем старые тестовые офисы (кроме тех, к которым привязаны пользователи)
-- Сначала смотрим какие офисы используются
DO $$
DECLARE
    used_office_ids INTEGER[];
BEGIN
    -- Получаем список используемых офисов
    SELECT ARRAY_AGG(DISTINCT office_id) INTO used_office_ids
    FROM (
        SELECT office_id FROM user_profiles WHERE office_id IS NOT NULL
        UNION
        SELECT office_id FROM employees WHERE office_id IS NOT NULL
    ) used_offices;
    
    -- Удаляем неиспользуемые офисы
    DELETE FROM offices 
    WHERE id NOT IN (SELECT UNNEST(used_office_ids));
END $$;

-- 2. Вставляем/обновляем правильные офисы
INSERT INTO offices (name, description) VALUES
    ('Рассвет', 'Офис Рассвет - Округа (СЗАО/САО)'),
    ('Будапешт', 'Офис Будапешт - Округа (СВАО/САО)'),
    ('Янтарь', 'Офис Янтарь - Округ (ВАО)'),
    ('Саяны', 'Офис Саяны - Округ (ЮВАО)'),
    ('Бирюсинка', 'Офис Бирюсинка - Округ (ЮАО)'),
    ('Витязь', 'Офис Витязь - Округ (ЮЗАО)'),
    ('Планета', 'Офис Планета - Округ (ЗАО)'),
    ('Зеленоград', 'Офис Зеленоград - Округ (ЗелАО)'),
    ('Тульская', 'Офис Тульская - Округа (ЦАО/ЮАО)'),
    ('Чистые пруды', 'Офис Чистые пруды - Администрация и редакция')
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description;

-- 3. Убеждаемся что все пользователи привязаны к существующим офисам
-- Если у кого-то office_id указывает на несуществующий офис, переводим в "Рассвет"
UPDATE user_profiles 
SET office_id = (SELECT id FROM offices WHERE name = 'Рассвет' LIMIT 1)
WHERE office_id NOT IN (SELECT id FROM offices);

UPDATE employees 
SET office_id = (SELECT id FROM offices WHERE name = 'Рассвет' LIMIT 1)
WHERE office_id NOT IN (SELECT id FROM offices);

-- 4. Показываем итоговую структуру
SELECT 
    'ИТОГОВЫЕ ОФИСЫ:' as info,
    id,
    name,
    description
FROM offices 
ORDER BY id; 