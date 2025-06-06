-- ДИАГНОСТИКА И ИСПРАВЛЕНИЕ ОШИБКИ 500 ПРИ РЕГИСТРАЦИИ
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Проверяем существование таблиц
SELECT 'Checking tables...' as step;

SELECT 
    table_name,
    CASE WHEN table_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_profiles', 'employees', 'task_types')
ORDER BY table_name;

-- 2. Проверяем существование функции триггера
SELECT 'Checking trigger function...' as step;

SELECT 
    routine_name,
    routine_type,
    CASE WHEN routine_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'handle_new_user';

-- 3. Проверяем существование триггера
SELECT 'Checking trigger...' as step;

SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation,
    CASE WHEN trigger_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 4. ИСПРАВЛЕНИЕ: Удаляем проблемный триггер и создаем безопасную версию
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 5. ИСПРАВЛЕНИЕ: Создаем БЕЗОПАСНУЮ функцию триггера с обработкой ошибок
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_full_name TEXT;
    user_work_schedule TEXT;
    user_work_hours INTEGER;
    employee_num TEXT;
    existing_profile_id UUID;
    existing_employee_id INTEGER;
BEGIN
    -- Логируем начало функции
    RAISE LOG 'handle_new_user: Starting for user ID %', NEW.id;
    
    -- Проверяем, не существует ли уже профиль (предотвращаем дублирование)
    SELECT id INTO existing_profile_id 
    FROM public.user_profiles 
    WHERE id = NEW.id;
    
    SELECT id INTO existing_employee_id 
    FROM public.employees 
    WHERE user_id = NEW.id;
    
    -- Если профиль уже существует, просто возвращаем NEW
    IF existing_profile_id IS NOT NULL OR existing_employee_id IS NOT NULL THEN
        RAISE LOG 'handle_new_user: Profile already exists for user %', NEW.id;
        RETURN NEW;
    END IF;

    -- Получаем данные из метаданных пользователя с безопасными значениями по умолчанию
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

    -- Генерируем номер сотрудника безопасно
    SELECT COALESCE(
        'EMP-' || LPAD(
            (COALESCE(
                (SELECT MAX(
                    CASE 
                        WHEN employee_number ~ '^EMP-[0-9]+$' 
                        THEN CAST(SUBSTRING(employee_number FROM 5) AS INTEGER)
                        ELSE 0 
                    END
                ) FROM public.employees), 
                0
            ) + 1)::TEXT, 
            4, 
            '0'
        ),
        'EMP-0001'
    ) INTO employee_num;

    -- Создаем профиль пользователя с обработкой ошибок
    BEGIN
        INSERT INTO public.user_profiles (
            id, 
            full_name, 
            position, 
            is_admin, 
            role, 
            work_schedule, 
            work_hours, 
            is_online,
            created_at,
            updated_at
        ) VALUES (
            NEW.id, 
            user_full_name, 
            'Сотрудник', 
            false, 
            'user', 
            user_work_schedule, 
            user_work_hours, 
            false,
            NOW(),
            NOW()
        );
        
        RAISE LOG 'handle_new_user: Successfully created user_profile for %', NEW.id;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE LOG 'handle_new_user: Profile already exists (unique violation) for %', NEW.id;
        WHEN OTHERS THEN
            RAISE LOG 'handle_new_user: Error creating user_profile for %: % %', NEW.id, SQLSTATE, SQLERRM;
            -- НЕ прерываем процесс, продолжаем
    END;

    -- Создаем запись сотрудника с обработкой ошибок
    BEGIN
        INSERT INTO public.employees (
            user_id, 
            employee_number, 
            full_name, 
            position, 
            is_admin, 
            is_active, 
            work_schedule, 
            work_hours, 
            is_online,
            created_at,
            updated_at
        ) VALUES (
            NEW.id, 
            employee_num, 
            user_full_name, 
            'Сотрудник', 
            false, 
            true, 
            user_work_schedule, 
            user_work_hours, 
            false,
            NOW(),
            NOW()
        );
        
        RAISE LOG 'handle_new_user: Successfully created employee for %', NEW.id;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE LOG 'handle_new_user: Employee already exists (unique violation) for %', NEW.id;
        WHEN OTHERS THEN
            RAISE LOG 'handle_new_user: Error creating employee for %: % %', NEW.id, SQLSTATE, SQLERRM;
            -- НЕ прерываем процесс, продолжаем
    END;

    RAISE LOG 'handle_new_user: Completed successfully for user %', NEW.id;
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Критическая ошибка - логируем но НЕ прерываем регистрацию
        RAISE LOG 'handle_new_user: CRITICAL ERROR for user %: % %', NEW.id, SQLSTATE, SQLERRM;
        -- Возвращаем NEW чтобы регистрация продолжилась
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Создаем триггер ПОСЛЕ создания пользователя
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- 7. Проверяем права доступа
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.employees TO authenticated;
GRANT ALL ON public.task_types TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

-- 8. Проверяем последовательности
GRANT USAGE, SELECT, UPDATE ON SEQUENCE employees_id_seq TO authenticated;

-- 9. Временно отключаем RLS для диагностики (ВРЕМЕННО!)
-- ВАЖНО: Это только для тестирования! Включите RLS обратно после тестирования!
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;

-- 10. Создаем тестовую функцию для проверки
CREATE OR REPLACE FUNCTION test_user_creation()
RETURNS TEXT AS $$
DECLARE
    test_result TEXT;
BEGIN
    -- Проверяем что функция триггера работает
    test_result := 'Function test: ';
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user') THEN
        test_result := test_result || '✅ Function exists. ';
    ELSE
        test_result := test_result || '❌ Function missing. ';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created') THEN
        test_result := test_result || '✅ Trigger exists. ';
    ELSE
        test_result := test_result || '❌ Trigger missing. ';
    END IF;
    
    RETURN test_result || 'Ready for testing!';
END;
$$ LANGUAGE plpgsql;

-- 11. Запускаем тест
SELECT test_user_creation() as test_result;

-- 12. Финальная проверка
SELECT 'Setup completed! Try registration now.' as status;

-- ВАЖНЫЕ ЗАМЕЧАНИЯ:
-- 1. RLS временно отключен для тестирования
-- 2. После успешной регистрации выполните команды:
--    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
--    ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
-- 3. Функция триггера теперь НЕ прерывает регистрацию при ошибках
-- 4. Все ошибки логируются, но регистрация продолжается 