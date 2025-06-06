-- Добавление системы округов для Task Logger

-- 1. Создаем таблицу округов
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- 2. Добавляем популярные округа Москвы
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

-- 3. Добавляем поле district_id в таблицу employees
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS district_id INTEGER REFERENCES districts(id);

-- 4. Добавляем поле district_id в таблицу user_profiles для совместимости
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS district_id INTEGER REFERENCES districts(id);

-- Добавляем колонку role в user_profiles если её нет
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- 5. Даем админские права пользователю egordolgih@mail.ru
-- Сначала находим ID пользователя по email в auth.users
UPDATE user_profiles 
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru');

-- Также обновляем в auth.users если нужно
UPDATE auth.users 
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'egordolgih@mail.ru';

-- 6. Создаем представление для удобной работы с данными
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

-- 7. Проверяем результат
SELECT 'Созданные округи:' as info;
SELECT id, name, description FROM districts WHERE is_active = true ORDER BY name;

SELECT 'Статистика по округам:' as info;
SELECT * FROM employee_district_stats;

SELECT 'Админские права:' as info;
SELECT email, role FROM user_profiles WHERE role = 'admin'; 