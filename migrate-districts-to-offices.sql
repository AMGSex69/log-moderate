-- ===========================================
-- МИГРАЦИЯ С ОКРУГОВ НА ОФИСЫ
-- ===========================================

-- 1. СОЗДАЕМ ТАБЛИЦУ ОФИСОВ (если не существует)
CREATE TABLE IF NOT EXISTS public.offices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создаем уникальный индекс (если не существует)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'offices_name_key') THEN
        CREATE UNIQUE INDEX offices_name_key ON public.offices (name);
    END IF;
END $$;

-- 2. ЗАПОЛНЯЕМ ОФИСЫ (безопасно, с проверкой дубликатов)
INSERT INTO public.offices (name, description) VALUES
    ('Рассвет', 'Офис Рассвет (СЗАО/САО)'),
    ('Будапешт', 'Офис Будапешт (СВАО/САО)'),
    ('Янтарь', 'Офис Янтарь (ВАО)'),
    ('Саяны', 'Офис Саяны (ЮВАО)'),
    ('Бирюсинка', 'Офис Бирюсинка (ЮАО)'),
    ('Витязь', 'Офис Витязь (ЮЗАО)'),
    ('Планета', 'Офис Планета (ЗАО)'),
    ('Зеленоград', 'Офис Зеленоград (ЗелАО)'),
    ('Тульская', 'Офис Тульская (ЦАО/ЮАО)'),
    ('Чистые пруды', 'Офис Чистые пруды (Администрация)')
ON CONFLICT (name) DO NOTHING;

-- 3. ДОБАВЛЯЕМ КОЛОНКУ office_id в user_profiles (если не существует)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'office_id') THEN
        ALTER TABLE public.user_profiles ADD COLUMN office_id INTEGER REFERENCES public.offices(id);
    END IF;
END $$;

-- 4. ДОБАВЛЯЕМ КОЛОНКУ office_id в employees (если не существует)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'office_id') THEN
        ALTER TABLE public.employees ADD COLUMN office_id INTEGER REFERENCES public.offices(id);
    END IF;
END $$;

-- 5. ДОБАВЛЯЕМ КОЛОНКУ role в user_profiles для системы ролей (если не существует)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
        ALTER TABLE public.user_profiles ADD COLUMN role VARCHAR(50) DEFAULT 'user';
    END IF;
END $$;

-- 6. НАЗНАЧАЕМ ВСЕХ СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ В ОФИС "РАССВЕТ" (только если не назначены)
UPDATE public.user_profiles 
SET office_id = (SELECT id FROM public.offices WHERE name = 'Рассвет' LIMIT 1)
WHERE office_id IS NULL;

UPDATE public.employees 
SET office_id = (SELECT id FROM public.offices WHERE name = 'Рассвет' LIMIT 1)
WHERE office_id IS NULL;

-- 7. НАЗНАЧАЕМ СУПЕР-АДМИНИСТРАТОРОВ
UPDATE public.user_profiles 
SET role = 'super_admin'
WHERE id IN (
    SELECT u.id FROM auth.users u 
    WHERE u.email IN ('egordolgih@mail.ru', 'flack_nion@mail.ru')
);

-- 8. СОЗДАЕМ ФУНКЦИИ ДЛЯ РАБОТЫ С ОФИСАМИ

-- Функция получения офиса пользователя
CREATE OR REPLACE FUNCTION get_user_office_id(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    office_id INTEGER;
BEGIN
    SELECT up.office_id INTO office_id
    FROM user_profiles up
    WHERE up.id = user_uuid;
    
    RETURN office_id;
END;
$$;

-- Функция получения роли пользователя
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT COALESCE(up.role, 'user') INTO user_role
    FROM user_profiles up
    WHERE up.id = user_uuid;
    
    RETURN user_role;
END;
$$;

-- Функция статистики офиса
CREATE OR REPLACE FUNCTION get_office_statistics(requesting_user_uuid UUID)
RETURNS TABLE (
    office_id INTEGER,
    office_name TEXT,
    total_employees BIGINT,
    working_employees BIGINT,
    total_hours_today NUMERIC,
    avg_hours_today NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_office_id INTEGER;
    user_role TEXT;
BEGIN
    -- Получаем офис и роль пользователя
    SELECT 
        COALESCE(up.office_id, 1), -- По умолчанию офис "Рассвет"
        COALESCE(up.role, 'user')
    INTO user_office_id, user_role
    FROM user_profiles up
    WHERE up.id = requesting_user_uuid;

    -- Возвращаем статистику офиса
    RETURN QUERY
    SELECT 
        o.id as office_id,
        o.name as office_name,
        COUNT(DISTINCT e.id) as total_employees,
        COUNT(DISTINCT CASE WHEN ws.clock_in_time IS NOT NULL AND ws.clock_out_time IS NULL THEN e.id END) as working_employees,
        COALESCE(SUM(ws.total_work_minutes) / 60.0, 0) as total_hours_today,
        COALESCE(AVG(ws.total_work_minutes) / 60.0, 0) as avg_hours_today
    FROM offices o
    LEFT JOIN employees e ON e.office_id = o.id
    LEFT JOIN work_sessions ws ON ws.employee_id = e.id AND ws.date = CURRENT_DATE
    WHERE o.id = user_office_id
    GROUP BY o.id, o.name;
END;
$$;

-- Функция назначения администратора офиса
CREATE OR REPLACE FUNCTION assign_office_admin(admin_user_uuid UUID, target_user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_role TEXT;
    admin_office_id INTEGER;
    target_office_id INTEGER;
BEGIN
    -- Проверяем права администратора
    SELECT 
        COALESCE(up.role, 'user'),
        up.office_id
    INTO admin_role, admin_office_id
    FROM user_profiles up
    WHERE up.id = admin_user_uuid;

    -- Получаем офис целевого пользователя
    SELECT up.office_id INTO target_office_id
    FROM user_profiles up
    WHERE up.id = target_user_uuid;

    -- Проверяем права
    IF admin_role NOT IN ('super_admin', 'office_admin') THEN
        RETURN FALSE;
    END IF;

    -- Офис-админы могут назначать только в своем офисе
    IF admin_role = 'office_admin' AND admin_office_id != target_office_id THEN
        RETURN FALSE;
    END IF;

    -- Назначаем роль
    UPDATE user_profiles 
    SET role = 'office_admin'
    WHERE id = target_user_uuid;

    RETURN TRUE;
END;
$$;

-- 9. ПОКАЗЫВАЕМ РЕЗУЛЬТАТЫ МИГРАЦИИ
SELECT 'РЕЗУЛЬТАТЫ МИГРАЦИИ:' as info;

SELECT 'Созданные офисы:' as info;
SELECT id, name, description FROM public.offices ORDER BY name;

SELECT 'Пользователи по офисам:' as info;
SELECT 
    o.name as office_name,
    COUNT(up.id) as users_count,
    COUNT(CASE WHEN up.role = 'office_admin' THEN 1 END) as office_admins,
    COUNT(CASE WHEN up.role = 'super_admin' THEN 1 END) as super_admins
FROM offices o
LEFT JOIN user_profiles up ON up.office_id = o.id
GROUP BY o.id, o.name
ORDER BY o.name;

SELECT 'Супер-администраторы:' as info;
SELECT up.id, u.email, up.role, o.name as office_name
FROM user_profiles up
JOIN auth.users u ON u.id = up.id
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.role = 'super_admin';

SELECT 'МИГРАЦИЯ ЗАВЕРШЕНА ✅' as status; 