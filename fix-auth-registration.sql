-- Исправление проблем с регистрацией пользователей
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard

-- 1. Проверяем и создаем необходимые таблицы если их нет
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    work_schedule TEXT,
    work_hours INTEGER,
    is_active BOOLEAN DEFAULT true
);

-- 2. Создаем безопасные RLS политики для user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- Создаем новые более безопасные политики
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- 3. Создаем функцию для автоматического создания профиля пользователя
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Новый пользователь'));
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Логируем ошибку но не прерываем регистрацию
        RAISE WARNING 'Error creating user profile: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Создаем триггер для автоматического создания профиля
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Создаем таблицу employees если её нет
CREATE TABLE IF NOT EXISTS public.employees (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) UNIQUE,
    employee_number TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- 6. RLS для employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own employee record" ON public.employees;
DROP POLICY IF EXISTS "Users can insert own employee record" ON public.employees;

CREATE POLICY "Users can view own employee record" ON public.employees
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own employee record" ON public.employees
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. Функция для создания записи сотрудника
CREATE OR REPLACE FUNCTION public.handle_new_employee()
RETURNS TRIGGER AS $$
BEGIN
    -- Создаем запись сотрудника с автоматическим номером
    INSERT INTO public.employees (user_id, employee_number)
    VALUES (
        NEW.id, 
        'EMP-' || LPAD(nextval('employees_id_seq')::TEXT, 4, '0')
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error creating employee record: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Триггер для создания записи сотрудника
DROP TRIGGER IF EXISTS on_user_profile_created ON public.user_profiles;
CREATE TRIGGER on_user_profile_created
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_employee();

-- 9. Проверяем что таблицы task_types существуют и имеют базовые данные
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.task_types LIMIT 1) THEN
        INSERT INTO public.task_types (name, measurement_unit, created_at) VALUES
        ('Актуализация ОСС', 'штук', NOW()),
        ('Обзвоны по рисовке', 'штук', NOW()),
        ('Входящие звонки', 'штук', NOW()),
        ('Работа с посетителями', 'штук', NOW()),
        ('Проверка документов ОСС', 'штук', NOW());
    END IF;
END $$;

-- 10. Разрешаем анонимным пользователям регистрироваться
-- (это делается в настройках Authentication в Supabase Dashboard)

-- Комментарий: После выполнения этого скрипта нужно также проверить в Supabase Dashboard:
-- 1. Authentication > Settings > "Enable email confirmations" должно быть выключено для тестирования
-- 2. Authentication > Settings > "Disable new user signups" должно быть выключено
-- 3. Database > Tables > Проверить что все таблицы созданы корректно

COMMIT; 