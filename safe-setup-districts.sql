-- Безопасная настройка системы округов
-- Проверяет существование объектов и создает только недостающие

-- 1. Проверяем и добавляем недостающие округа (если нужно)
INSERT INTO districts (name, description) VALUES
    ('ЦАО', 'Центральный административный округ'),
    ('САО', 'Северный административный округ'),
    ('СВАО', 'Северо-Восточный административный округ'),
    ('ВАО', 'Восточный административный округ'),
    ('ЮВАО', 'Юго-Восточный административный округ'),
    ('ЮАО', 'Южный административный округ'),
    ('ЮЗАО', 'Юго-Западный административный округ'),
    ('ЗАО', 'Западный административный округ'),
    ('СЗАО', 'Северо-Западный административный округ'),
    ('НАО', 'Новомосковский административный округ'),
    ('ТАО', 'Троицкий административный округ'),
    ('Зеленоград', 'Зеленоградский административный округ')
ON CONFLICT (name) DO NOTHING;

-- 2. Добавляем поле district_id в таблицу employees (если еще нет)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS district_id INTEGER REFERENCES districts(id);

-- 3. Добавляем поле district_id в таблицу user_profiles (если еще нет)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS district_id INTEGER REFERENCES districts(id);

-- 4. Добавляем колонку role в user_profiles (если еще нет)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- 5. Даем админские права пользователю egordolgih@mail.ru
UPDATE user_profiles 
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru');

-- Также обновляем метаданные в auth.users
UPDATE auth.users 
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'egordolgih@mail.ru';

-- 6. Создаем представление для статистики по округам
CREATE OR REPLACE VIEW employee_district_stats AS
SELECT 
    d.id as district_id,
    d.name as district_name,
    COUNT(DISTINCT e.id) as total_employees,
    COUNT(DISTINCT CASE WHEN ws.clock_in_time IS NOT NULL AND ws.clock_out_time IS NULL THEN e.id END) as working_employees,
    COALESCE(SUM(ws.total_work_minutes), 0) as total_work_minutes_today,
    COALESCE(AVG(ws.total_work_minutes), 0) as avg_work_minutes_today
FROM districts d
LEFT JOIN employees e ON e.district_id = d.id
LEFT JOIN work_sessions ws ON ws.employee_id = e.id AND ws.date = CURRENT_DATE
WHERE d.is_active = true
GROUP BY d.id, d.name
ORDER BY d.name;

-- 7. Проверяем результаты
SELECT '=== ТЕКУЩЕЕ СОСТОЯНИЕ СИСТЕМЫ ===' as info;

SELECT 'Округи в системе:' as info;
SELECT id, name, description FROM districts WHERE is_active = true ORDER BY name;

SELECT 'Колонки в user_profiles:' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' AND column_name IN ('district_id', 'role')
ORDER BY column_name;

SELECT 'Колонки в employees:' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'employees' AND column_name = 'district_id';

SELECT 'Админские права:' as info;
SELECT 
    u.email, 
    COALESCE(up.role, 'user') as role,
    up.district_id
FROM auth.users u
LEFT JOIN user_profiles up ON up.id = u.id
WHERE up.role = 'admin' OR u.email = 'egordolgih@mail.ru'
ORDER BY u.email;

SELECT 'Статистика по округам:' as info;
SELECT * FROM employee_district_stats; 