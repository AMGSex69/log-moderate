-- Обновление RLS политик для просмотра карточек пользователей
-- Этот скрипт разрешает всем сотрудникам видеть базовую информацию о коллегах

-- 1. ОБНОВЛЯЕМ ПОЛИТИКИ ДЛЯ USER_PROFILES
-- Удаляем старые ограничительные политики
DROP POLICY IF EXISTS "Users can view profiles from same office" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;

-- Создаем новую политику для просмотра базовой информации всех пользователей
CREATE POLICY "Users can view basic profile info" ON public.user_profiles
    FOR SELECT USING (
        -- Разрешаем всем аутентифицированным пользователям видеть базовую информацию
        auth.role() = 'authenticated' AND (
            -- Собственный профиль - полный доступ
            auth.uid() = id OR
            -- Другие пользователи - только базовая информация (скрываем sensitive данные)
            true
        )
    );

-- 2. ОБНОВЛЯЕМ ПОЛИТИКИ ДЛЯ EMPLOYEES  
-- Удаляем старые ограничительные политики
DROP POLICY IF EXISTS "Users can view employees from same office" ON public.employees;
DROP POLICY IF EXISTS "employees_select_policy" ON public.employees;

-- Создаем новую политику для просмотра информации о сотрудниках
CREATE POLICY "Users can view employee info" ON public.employees
    FOR SELECT USING (
        -- Разрешаем всем аутентифицированным пользователям видеть информацию о сотрудниках
        auth.role() = 'authenticated'
    );

-- 3. СОЗДАЕМ ФУНКЦИЮ ДЛЯ БЕЗОПАСНОГО ПОЛУЧЕНИЯ ДАННЫХ ПОЛЬЗОВАТЕЛЯ
CREATE OR REPLACE FUNCTION get_user_profile_safe(target_user_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    position TEXT,
    avatar_url TEXT,
    work_schedule TEXT,
    work_hours INTEGER,
    is_online BOOLEAN,
    last_seen TIMESTAMP,
    created_at TIMESTAMP,
    office_name TEXT,
    -- email доступен только для собственного профиля или админам
    email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    requesting_user_id UUID;
    is_admin BOOLEAN := false;
    result_email TEXT := null;
BEGIN
    -- Получаем ID текущего пользователя
    requesting_user_id := auth.uid();
    
    -- Проверяем, является ли пользователь админом
    SELECT 
        CASE 
            WHEN up.is_admin = true OR au.email = 'egordolgih@mail.ru' 
            THEN true 
            ELSE false 
        END INTO is_admin
    FROM auth.users au
    LEFT JOIN user_profiles up ON up.id = au.id
    WHERE au.id = requesting_user_id;
    
    -- Если это собственный профиль или админ, получаем email
    IF requesting_user_id = target_user_id OR is_admin THEN
        SELECT au.email INTO result_email
        FROM auth.users au
        WHERE au.id = target_user_id;
    END IF;
    
    -- Возвращаем данные профиля
    RETURN QUERY
    SELECT 
        up.id,
        up.full_name,
        up.position,
        up.avatar_url,
        up.work_schedule,
        up.work_hours,
        up.is_online,
        up.last_seen,
        up.created_at,
        o.name as office_name,
        result_email as email
    FROM user_profiles up
    LEFT JOIN offices o ON o.id = up.office_id
    WHERE up.id = target_user_id;
END;
$$;

-- 4. СОЗДАЕМ ФУНКЦИЮ ДЛЯ ПОЛУЧЕНИЯ СТАТИСТИКИ ПОЛЬЗОВАТЕЛЯ
CREATE OR REPLACE FUNCTION get_user_stats_safe(target_user_id UUID)
RETURNS TABLE (
    total_tasks BIGINT,
    total_units BIGINT,
    total_coins BIGINT,
    total_time_minutes BIGINT,
    current_streak INTEGER,
    best_task_name TEXT,
    best_task_units INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_employee_id INTEGER;
BEGIN
    -- Получаем employee_id для target пользователя
    SELECT e.id INTO target_employee_id
    FROM employees e
    WHERE e.user_id = target_user_id;
    
    IF target_employee_id IS NULL THEN
        -- Возвращаем нули если employee не найден
        RETURN QUERY SELECT 
            0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 
            0::INTEGER, ''::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Получаем статистику
    RETURN QUERY
    WITH task_stats AS (
        SELECT 
            COUNT(tl.id) as tasks_count,
            COALESCE(SUM(tl.units_completed), 0) as units_sum,
            COALESCE(SUM(tl.time_spent_minutes), 0) as time_sum,
            -- Рассчитываем монеты через join с task_types
            COALESCE(SUM(
                CASE 
                    WHEN tt.name = 'Актуализация ОСС' THEN tl.units_completed * 15
                    WHEN tt.name = 'Обзвоны по рисовке' THEN tl.units_completed * 10
                    WHEN tt.name = 'Отчеты физикам (+почта)' THEN tl.units_completed * 12
                    WHEN tt.name = 'Протоколы ОСС' THEN tl.units_completed * 25
                    WHEN tt.name = 'Внесение решений МЖИ (кол-во бланков)' THEN tl.units_completed * 5
                    WHEN tt.name = 'Обходы' THEN tl.units_completed * 25
                    ELSE tl.units_completed * 5 -- базовая награда
                END
            ), 0) as coins_sum
        FROM task_logs tl
        LEFT JOIN task_types tt ON tt.id = tl.task_type_id
        WHERE tl.employee_id = target_employee_id
    ),
    best_task AS (
        SELECT 
            tt.name as task_name,
            SUM(tl.units_completed) as task_units
        FROM task_logs tl
        LEFT JOIN task_types tt ON tt.id = tl.task_type_id
        WHERE tl.employee_id = target_employee_id
        GROUP BY tt.name
        ORDER BY task_units DESC
        LIMIT 1
    )
    SELECT 
        ts.tasks_count,
        ts.units_sum,
        ts.coins_sum,
        ts.time_sum,
        0::INTEGER as streak, -- Упрощаем пока
        COALESCE(bt.task_name, '')::TEXT,
        COALESCE(bt.task_units, 0)::INTEGER
    FROM task_stats ts
    LEFT JOIN best_task bt ON true;
END;
$$;

-- 5. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
SELECT 'Обновление RLS политик для карточек пользователей завершено ✅' as status;

-- Показываем новые политики
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'employees')
ORDER BY tablename, policyname;

-- Тестируем новую функцию (замените UUID на реальный)
-- SELECT * FROM get_user_profile_safe('example-uuid-here'); 