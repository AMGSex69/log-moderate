-- ===========================================
-- ОЧИСТКА ПОСЛЕ МИГРАЦИИ НА ОФИСЫ
-- ===========================================

-- 1. УДАЛЯЕМ СТАРЫЕ ПРЕДСТАВЛЕНИЯ И ФУНКЦИИ ДЛЯ ОКРУГОВ
DROP VIEW IF EXISTS employee_district_stats CASCADE;

-- 2. СОЗДАЕМ НОВОЕ ПРЕДСТАВЛЕНИЕ ДЛЯ ОФИСОВ
CREATE OR REPLACE VIEW office_employee_stats AS
SELECT 
    o.id as office_id,
    o.name as office_name,
    COUNT(DISTINCT e.id) as total_employees,
    COUNT(DISTINCT CASE WHEN e.is_online = true THEN e.id END) as working_employees,
    COALESCE(SUM(
        CASE WHEN ws.date = CURRENT_DATE THEN ws.total_work_minutes ELSE 0 END
    ), 0) as total_work_minutes_today,
    COALESCE(AVG(
        CASE WHEN ws.date = CURRENT_DATE THEN ws.total_work_minutes ELSE NULL END
    ), 0) as avg_work_minutes_today
FROM offices o
LEFT JOIN employees e ON e.office_id = o.id
LEFT JOIN work_sessions ws ON ws.employee_id = e.id
GROUP BY o.id, o.name
ORDER BY o.name;

-- 3. ОБНОВЛЯЕМ RLS ПОЛИТИКИ ДЛЯ ВСЕХ ТАБЛИЦ
-- Включаем RLS для всех важных таблиц
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- 4. СОЗДАЕМ ПОЛИТИКИ ДЛЯ work_sessions
DROP POLICY IF EXISTS "Users can manage work sessions from same office" ON public.work_sessions;
CREATE POLICY "Users can manage work sessions from same office" ON public.work_sessions
    FOR ALL USING (
        employee_id IN (
            SELECT e.id FROM public.employees e
            WHERE e.office_id = get_user_office_id(auth.uid()) OR
                  get_user_role(auth.uid()) IN ('office_admin', 'super_admin')
        )
    );

-- 5. СОЗДАЕМ ПОЛИТИКИ ДЛЯ task_logs
DROP POLICY IF EXISTS "Users can manage task logs from same office" ON public.task_logs;
CREATE POLICY "Users can manage task logs from same office" ON public.task_logs
    FOR ALL USING (
        employee_id IN (
            SELECT e.id FROM public.employees e
            WHERE e.office_id = get_user_office_id(auth.uid()) OR
                  get_user_role(auth.uid()) IN ('office_admin', 'super_admin')
        )
    );

-- 6. СОЗДАЕМ ПОЛИТИКИ ДЛЯ active_sessions
DROP POLICY IF EXISTS "Users can manage active sessions from same office" ON public.active_sessions;
CREATE POLICY "Users can manage active sessions from same office" ON public.active_sessions
    FOR ALL USING (
        employee_id IN (
            SELECT e.id FROM public.employees e
            WHERE e.office_id = get_user_office_id(auth.uid()) OR
                  get_user_role(auth.uid()) IN ('office_admin', 'super_admin')
        )
    );

-- 7. ОБНОВЛЯЕМ ФУНКЦИЮ get_leaderboard_with_current_user ДЛЯ КОРРЕКТНЫХ ЧАСОВ
CREATE OR REPLACE FUNCTION get_leaderboard_with_current_user(current_user_uuid UUID)
RETURNS TABLE (
    employee_id INTEGER,
    full_name TEXT,
    total_hours NUMERIC,
    rank_position BIGINT,
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
        up.office_id,
        COALESCE(up.role, 'user')
    INTO user_office_id, user_role
    FROM user_profiles up
    WHERE up.id = current_user_uuid;

    -- Возвращаем лидерборд в зависимости от роли
    RETURN QUERY
    SELECT 
        e.id as employee_id,
        e.full_name,
        COALESCE(SUM(ws.total_work_minutes / 60.0), 0) as total_hours, -- Переводим минуты в часы
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ws.total_work_minutes), 0) DESC) as rank_position,
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
    ORDER BY total_hours DESC;
END;
$$;

-- 8. ПОКАЗЫВАЕМ РЕЗУЛЬТАТЫ ОЧИСТКИ
SELECT 'РЕЗУЛЬТАТЫ ОЧИСТКИ И ОБНОВЛЕНИЯ:' as info;

SELECT 'Представления для офисов:' as info;
SELECT * FROM office_employee_stats;

SELECT 'Пользователи по ролям:' as info;
SELECT 
    COALESCE(role, 'user') as role,
    COUNT(*) as count
FROM user_profiles
GROUP BY role
ORDER BY role;

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

SELECT 'ОЧИСТКА ЗАВЕРШЕНА ✅' as status; 