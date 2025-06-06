-- ===========================================
-- ОБНОВЛЕНИЕ ФУНКЦИЙ ДЛЯ РАБОТЫ С ОФИСАМИ
-- ===========================================

-- 1. БЕЗОПАСНОЕ ОБНОВЛЕНИЕ ФУНКЦИЙ И ТРИГГЕРОВ

-- Функция безопасного создания/обновления триггера
CREATE OR REPLACE FUNCTION safe_create_trigger()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- Удаляем старый триггер если существует
    DROP TRIGGER IF EXISTS update_work_session_trigger ON public.work_sessions;
    
    -- Создаем новый триггер
    CREATE TRIGGER update_work_session_trigger
        BEFORE INSERT OR UPDATE ON public.work_sessions
        FOR EACH ROW
        EXECUTE FUNCTION update_work_session_times();
END;
$$;

-- 2. ОБНОВЛЯЕМ ФУНКЦИЮ ЛИДЕРБОРДА ДЛЯ ОФИСОВ
CREATE OR REPLACE FUNCTION get_leaderboard_with_current_user(current_user_uuid UUID)
RETURNS TABLE (
    name TEXT,
    score TEXT,
    rank INTEGER,
    is_current_user BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_office_id INTEGER;
    user_role TEXT;
BEGIN
    -- Получаем офис и роль текущего пользователя
    SELECT 
        COALESCE(up.office_id, 1), -- По умолчанию офис "Рассвет"
        COALESCE(up.role, 'user')
    INTO user_office_id, user_role
    FROM user_profiles up
    WHERE up.id = current_user_uuid;

    -- Возвращаем лидерборд в зависимости от роли
    RETURN QUERY
    SELECT 
        e.full_name as name,
        COALESCE(ROUND(SUM(ws.total_work_minutes) / 60.0, 1)::TEXT || ' ч', '0 ч') as score,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ws.total_work_minutes), 0) DESC)::INTEGER as rank,
        (e.user_id = current_user_uuid) as is_current_user
    FROM employees e
    LEFT JOIN work_sessions ws ON ws.employee_id = e.id
    WHERE 
        CASE 
            WHEN user_role = 'super_admin' THEN true  -- Супер-админы видят всех
            WHEN user_role = 'office_admin' THEN e.office_id = user_office_id  -- Админы офиса видят свой офис
            ELSE e.office_id = user_office_id  -- Обычные пользователи видят свой офис
        END
    GROUP BY e.id, e.full_name, e.user_id
    ORDER BY COALESCE(SUM(ws.total_work_minutes), 0) DESC
    LIMIT 10;
END;
$$;

-- 3. СОЗДАЕМ ФУНКЦИЮ ДЛЯ УПРАВЛЕНИЯ ОФИСАМИ
CREATE OR REPLACE FUNCTION manage_office_assignment(
    admin_user_uuid UUID,
    target_user_uuid UUID,
    new_office_id INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_role TEXT;
    admin_office_id INTEGER;
BEGIN
    -- Проверяем права администратора
    SELECT 
        COALESCE(up.role, 'user'),
        up.office_id
    INTO admin_role, admin_office_id
    FROM user_profiles up
    WHERE up.id = admin_user_uuid;

    -- Проверяем права
    IF admin_role NOT IN ('super_admin', 'office_admin') THEN
        RETURN FALSE;
    END IF;

    -- Офис-админы могут назначать только в свой офис
    IF admin_role = 'office_admin' AND new_office_id != admin_office_id THEN
        RETURN FALSE;
    END IF;

    -- Обновляем офис пользователя
    UPDATE user_profiles 
    SET office_id = new_office_id
    WHERE id = target_user_uuid;

    -- Также обновляем в таблице employees если есть
    UPDATE employees 
    SET office_id = new_office_id
    WHERE user_id = target_user_uuid;

    RETURN TRUE;
END;
$$;

-- 4. ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ПОЛНОЙ СТАТИСТИКИ ОФИСА
CREATE OR REPLACE FUNCTION get_full_office_statistics(requesting_user_uuid UUID)
RETURNS TABLE (
    office_id INTEGER,
    office_name TEXT,
    total_employees BIGINT,
    working_employees BIGINT,
    total_hours_today NUMERIC,
    avg_hours_today NUMERIC,
    total_hours_week NUMERIC,
    total_hours_month NUMERIC
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

    -- Возвращаем полную статистику офиса
    RETURN QUERY
    SELECT 
        o.id as office_id,
        o.name as office_name,
        COUNT(DISTINCT e.id) as total_employees,
        COUNT(DISTINCT CASE WHEN ws_today.clock_in_time IS NOT NULL AND ws_today.clock_out_time IS NULL THEN e.id END) as working_employees,
        COALESCE(SUM(ws_today.total_work_minutes) / 60.0, 0) as total_hours_today,
        COALESCE(AVG(ws_today.total_work_minutes) / 60.0, 0) as avg_hours_today,
        COALESCE(SUM(ws_week.total_work_minutes) / 60.0, 0) as total_hours_week,
        COALESCE(SUM(ws_month.total_work_minutes) / 60.0, 0) as total_hours_month
    FROM offices o
    LEFT JOIN employees e ON e.office_id = o.id
    LEFT JOIN work_sessions ws_today ON ws_today.employee_id = e.id AND ws_today.date = CURRENT_DATE
    LEFT JOIN work_sessions ws_week ON ws_week.employee_id = e.id AND ws_week.date >= CURRENT_DATE - INTERVAL '7 days'
    LEFT JOIN work_sessions ws_month ON ws_month.employee_id = e.id AND ws_month.date >= CURRENT_DATE - INTERVAL '30 days'
    WHERE o.id = user_office_id
    GROUP BY o.id, o.name;
END;
$$;

-- 5. СОЗДАЕМ ФУНКЦИЮ ДЛЯ ПОЛУЧЕНИЯ СПИСКА РАБОТАЮЩИХ СОТРУДНИКОВ
CREATE OR REPLACE FUNCTION get_working_employees(requesting_user_uuid UUID)
RETURNS TABLE (
    employee_id INTEGER,
    full_name TEXT,
    position TEXT,
    clock_in_time TIMESTAMP WITH TIME ZONE,
    work_duration_minutes INTEGER
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
        COALESCE(up.office_id, 1),
        COALESCE(up.role, 'user')
    INTO user_office_id, user_role
    FROM user_profiles up
    WHERE up.id = requesting_user_uuid;

    -- Возвращаем работающих сотрудников
    RETURN QUERY
    SELECT 
        e.id as employee_id,
        e.full_name,
        COALESCE(e.position, 'Сотрудник') as position,
        ws.clock_in_time,
        EXTRACT(EPOCH FROM (NOW() - ws.clock_in_time))::INTEGER / 60 as work_duration_minutes
    FROM employees e
    INNER JOIN work_sessions ws ON ws.employee_id = e.id
    WHERE 
        ws.date = CURRENT_DATE
        AND ws.clock_in_time IS NOT NULL 
        AND ws.clock_out_time IS NULL
        AND CASE 
            WHEN user_role = 'super_admin' THEN true
            ELSE e.office_id = user_office_id
        END
    ORDER BY ws.clock_in_time ASC;
END;
$$;

-- 6. ОБНОВЛЯЕМ RLS ПОЛИТИКИ ДЛЯ ОФИСОВ
DO $$
BEGIN
    -- Включаем RLS для основных таблиц
    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

    -- Политики для offices - все могут видеть все офисы
    DROP POLICY IF EXISTS "Everyone can view offices" ON public.offices;
    CREATE POLICY "Everyone can view offices" ON public.offices
        FOR SELECT USING (true);

    -- Политики для user_profiles - пользователи видят профили своего офиса + админы
    DROP POLICY IF EXISTS "Users can view profiles from same office" ON public.user_profiles;
    CREATE POLICY "Users can view profiles from same office" ON public.user_profiles
        FOR SELECT USING (
            office_id = get_user_office_id(auth.uid()) OR
            get_user_role(auth.uid()) IN ('office_admin', 'super_admin')
        );

    -- Политики для employees - аналогично
    DROP POLICY IF EXISTS "Users can view employees from same office" ON public.employees;
    CREATE POLICY "Users can view employees from same office" ON public.employees
        FOR SELECT USING (
            office_id = get_user_office_id(auth.uid()) OR
            get_user_role(auth.uid()) IN ('office_admin', 'super_admin')
        );
END;
$$;

-- 7. БЕЗОПАСНО СОЗДАЕМ ТРИГГЕР
SELECT safe_create_trigger();

-- Удаляем временную функцию
DROP FUNCTION safe_create_trigger();

-- 8. ПОКАЗЫВАЕМ РЕЗУЛЬТАТЫ
SELECT 'РЕЗУЛЬТАТЫ ОБНОВЛЕНИЯ ФУНКЦИЙ:' as info;

SELECT 'Доступные функции для офисов:' as info;
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%office%'
ORDER BY routine_name;

SELECT 'Включенные RLS политики:' as info;
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT 'ОБНОВЛЕНИЕ ФУНКЦИЙ ЗАВЕРШЕНО ✅' as status; 