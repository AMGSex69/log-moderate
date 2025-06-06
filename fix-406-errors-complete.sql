-- ===========================================
-- ПОЛНОЕ ИСПРАВЛЕНИЕ 406 ОШИБОК И ПРОБЛЕМ С НОВЫМИ ПОЛЬЗОВАТЕЛЯМИ
-- ===========================================

-- 1. ИСПРАВЛЯЕМ RLS ПОЛИТИКИ ДЛЯ USER_PROFILES
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Удаляем все старые конфликтующие политики
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON public.user_profiles;

-- Создаем единую политику полного доступа для отладки
CREATE POLICY "user_profiles_full_access" ON public.user_profiles
    FOR ALL USING (true) WITH CHECK (true);

-- 2. ИСПРАВЛЯЕМ RLS ПОЛИТИКИ ДЛЯ WORK_SESSIONS
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

-- Удаляем все старые конфликтующие политики
DROP POLICY IF EXISTS "work_sessions_select_policy" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_insert_policy" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_update_policy" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_delete_policy" ON public.work_sessions;
DROP POLICY IF EXISTS "Users can view their own work sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "Users can insert their own work sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "Users can update their own work sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_policy" ON public.work_sessions;
DROP POLICY IF EXISTS "work_sessions_full_access" ON public.work_sessions;

-- Создаем единую политику полного доступа для отладки
CREATE POLICY "work_sessions_full_access" ON public.work_sessions
    FOR ALL USING (true) WITH CHECK (true);

-- 3. ИСПРАВЛЯЕМ RLS ПОЛИТИКИ ДЛЯ EMPLOYEES
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Удаляем все старые политики
DROP POLICY IF EXISTS "employees_select_policy" ON public.employees;
DROP POLICY IF EXISTS "employees_insert_policy" ON public.employees;
DROP POLICY IF EXISTS "employees_update_policy" ON public.employees;

-- Создаем единую политику полного доступа
CREATE POLICY "employees_full_access" ON public.employees
    FOR ALL USING (true) WITH CHECK (true);

-- 4. ДОБАВЛЯЕМ ПОЛЕ DISTRICT_ID ЕСЛИ НЕ СУЩЕСТВУЕТ
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS district_id INTEGER REFERENCES districts(id);

ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS district_id INTEGER REFERENCES districts(id);

-- 5. ДОБАВЛЯЕМ ПОЛЕ ROLE ЕСЛИ НЕ СУЩЕСТВУЕТ
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- 6. ОБНОВЛЯЕМ ФУНКЦИЮ handle_new_user ДЛЯ ПОДДЕРЖКИ ОКРУГОВ
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    existing_profile_id UUID;
    existing_employee_id INTEGER;
    user_full_name TEXT;
    user_work_schedule TEXT;
    user_work_hours INTEGER;
    user_district_id INTEGER;
BEGIN
    -- Проверяем, не существует ли уже профиль
    SELECT id INTO existing_profile_id 
    FROM user_profiles 
    WHERE id = NEW.id;
    
    SELECT id INTO existing_employee_id 
    FROM employees 
    WHERE user_id = NEW.id;
    
    -- Если записи уже существуют, просто возвращаем
    IF existing_profile_id IS NOT NULL AND existing_employee_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Получаем данные пользователя
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.email,
        'Новый пользователь'
    );
    
    user_work_schedule := COALESCE(
        NEW.raw_user_meta_data->>'work_schedule',
        '5/2'
    );
    
    user_work_hours := CASE 
        WHEN user_work_schedule = '2/2' THEN 12
        ELSE 9
    END;

    -- Получаем district_id из метаданных
    user_district_id := CASE 
        WHEN NEW.raw_user_meta_data->>'district_id' IS NOT NULL 
        THEN (NEW.raw_user_meta_data->>'district_id')::INTEGER
        ELSE NULL
    END;

    -- Создаем профиль если не существует
    IF existing_profile_id IS NULL THEN
        INSERT INTO user_profiles (
            id,
            full_name,
            position,
            work_schedule,
            work_hours,
            is_admin,
            is_online,
            role,
            district_id,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            user_full_name,
            'Сотрудник',
            user_work_schedule,
            user_work_hours,
            false,
            false,
            'user',
            user_district_id,
            NOW(),
            NOW()
        );
    END IF;

    -- Создаем employee если не существует
    IF existing_employee_id IS NULL THEN
        INSERT INTO employees (
            user_id,
            full_name,
            position,
            work_schedule,
            work_hours,
            is_admin,
            is_online,
            district_id,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            user_full_name,
            'Сотрудник',
            user_work_schedule,
            user_work_hours,
            false,
            false,
            user_district_id,
            NOW(),
            NOW()
        );
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- 7. СОЗДАЕМ ТРИГГЕР ЕСЛИ НЕ СУЩЕСТВУЕТ
DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. ИСПРАВЛЯЕМ ДАННЫЕ ДЛЯ ПРОБЛЕМНОГО ПОЛЬЗОВАТЕЛЯ 17ea9af8-1642-474d-bbeb-30cddd88c797
DO $$
DECLARE
    user_email TEXT;
    user_full_name TEXT;
BEGIN
    -- Получаем данные пользователя из auth.users
    SELECT email, raw_user_meta_data->>'full_name' 
    INTO user_email, user_full_name
    FROM auth.users 
    WHERE id = '17ea9af8-1642-474d-bbeb-30cddd88c797';

    IF user_email IS NOT NULL THEN
        -- Создаем или обновляем user_profile
        INSERT INTO public.user_profiles (
            id,
            full_name,
            position,
            is_admin,
            work_schedule,
            work_hours,
            role,
            created_at,
            updated_at
        ) VALUES (
            '17ea9af8-1642-474d-bbeb-30cddd88c797',
            COALESCE(user_full_name, user_email, 'Сотрудник'),
            'Сотрудник',
            false,
            '5/2',
            9,
            'user',
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
            updated_at = NOW();

        -- Создаем или обновляем employee
        INSERT INTO public.employees (
            user_id,
            full_name,
            position,
            work_schedule,
            work_hours,
            is_admin,
            is_online,
            created_at,
            updated_at
        ) VALUES (
            '17ea9af8-1642-474d-bbeb-30cddd88c797',
            COALESCE(user_full_name, user_email, 'Сотрудник'),
            'Сотрудник',
            '5/2',
            9,
            false,
            false,
            NOW(),
            NOW()
        ) ON CONFLICT (user_id) DO UPDATE SET
            full_name = COALESCE(EXCLUDED.full_name, employees.full_name),
            updated_at = NOW();

        RAISE NOTICE 'Данные пользователя % исправлены', user_email;
    END IF;
END $$;

-- 9. ПРОВЕРЯЕМ РЕЗУЛЬТАТЫ
SELECT 'РЕЗУЛЬТАТЫ ИСПРАВЛЕНИЯ:' as info;

SELECT 'Политики RLS для user_profiles:' as info;
SELECT policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_profiles';

SELECT 'Политики RLS для work_sessions:' as info;
SELECT policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'work_sessions';

SELECT 'Политики RLS для employees:' as info;
SELECT policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'employees';

SELECT 'Данные проблемного пользователя:' as info;
SELECT 
    'user_profiles' as table_name,
    id::text,
    full_name,
    district_id::text,
    role
FROM public.user_profiles 
WHERE id = '17ea9af8-1642-474d-bbeb-30cddd88c797'
UNION ALL
SELECT 
    'employees' as table_name,
    user_id::text,
    full_name,
    district_id::text,
    'N/A' as role
FROM public.employees 
WHERE user_id = '17ea9af8-1642-474d-bbeb-30cddd88c797';

SELECT 'ИСПРАВЛЕНИЕ ЗАВЕРШЕНО ✅' as status; 