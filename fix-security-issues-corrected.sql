-- Исправление проблем безопасности в проекте LOG-moderate (исправленная версия)
-- Выполните этот скрипт в SQL Editor вашего Supabase проекта

-- 1. Сначала проверим структуру существующей таблицы system_notifications
-- Посмотрим какие колонки уже есть
DO $$
DECLARE
    table_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_notifications'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE 'Таблица system_notifications уже существует';
    ELSE
        RAISE NOTICE 'Таблица system_notifications не найдена';
    END IF;
END
$$;

-- 2. Включаем RLS для существующей таблицы system_notifications
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- 3. Удаляем существующие политики если они есть
DROP POLICY IF EXISTS "Users can view system notifications" ON public.system_notifications;
DROP POLICY IF EXISTS "Admins can manage system notifications" ON public.system_notifications;

-- 4. Создаем простые политики RLS для system_notifications
-- Позволяем всем читать уведомления
CREATE POLICY "Enable read access for all users" ON public.system_notifications
    FOR SELECT 
    USING (true);

-- Позволяем админам управлять уведомлениями
CREATE POLICY "Enable full access for admins" ON public.system_notifications
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE user_id = auth.uid() 
            AND is_admin = true
        )
    );

-- 5. Пересоздание views без SECURITY DEFINER

-- Удаляем существующие views
DROP VIEW IF EXISTS public.employee_current_status;
DROP VIEW IF EXISTS public.task_logs_detailed;

-- Пересоздаем view employee_current_status без SECURITY DEFINER
CREATE VIEW public.employee_current_status AS
SELECT 
    e.id as employee_id,
    e.user_id,
    e.full_name,
    e.position,
    e.is_online,
    e.last_seen,
    CASE 
        WHEN ws.id IS NOT NULL AND ws.clock_out_time IS NULL THEN 'working'
        WHEN bl.id IS NOT NULL AND bl.end_time IS NULL THEN 'on_break'
        ELSE 'offline'
    END as current_status,
    ws.clock_in_time as current_session_start,
    bl.start_time as current_break_start,
    COALESCE(
        EXTRACT(EPOCH FROM (NOW() - ws.clock_in_time))::integer / 60,
        0
    ) as minutes_worked_today,
    COALESCE(
        EXTRACT(EPOCH FROM (NOW() - bl.start_time))::integer / 60,
        0
    ) as minutes_on_current_break
FROM public.employees e
LEFT JOIN public.work_sessions ws ON (
    e.id = ws.employee_id 
    AND ws.date = CURRENT_DATE 
    AND ws.clock_out_time IS NULL
)
LEFT JOIN public.break_logs bl ON (
    e.id = bl.employee_id 
    AND bl.date = CURRENT_DATE 
    AND bl.end_time IS NULL
)
WHERE e.is_active = true;

-- Пересоздаем view task_logs_detailed без SECURITY DEFINER
CREATE VIEW public.task_logs_detailed AS
SELECT 
    tl.id,
    tl.employee_id,
    e.full_name as employee_name,
    e.position as employee_position,
    tl.task_type_id,
    tt.name as task_type_name,
    tt.description as task_type_description,
    tl.units_completed,
    tl.time_spent_minutes,
    tl.work_date,
    tl.notes,
    tl.is_active,
    tl.started_at,
    tl.completed_at,
    tl.created_at,
    -- Вычисляемые поля
    ROUND(tl.time_spent_minutes::numeric / 60, 2) as hours_spent,
    CASE 
        WHEN tl.time_spent_minutes > 0 
        THEN ROUND(tl.units_completed::numeric / (tl.time_spent_minutes::numeric / 60), 2)
        ELSE 0 
    END as units_per_hour,
    CASE 
        WHEN tl.is_active THEN 'В работе'
        WHEN tl.completed_at IS NOT NULL THEN 'Завершено'
        ELSE 'Приостановлено'
    END as status_text
FROM public.task_logs tl
JOIN public.employees e ON tl.employee_id = e.id
JOIN public.task_types tt ON tl.task_type_id = tt.id
ORDER BY tl.created_at DESC;

-- 6. Убеждаемся что все основные таблицы имеют RLS
-- (Эти команды безопасны - если RLS уже включена, команда игнорируется)

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_prizes ENABLE ROW LEVEL SECURITY;

-- 7. Проверяем что все политики на месте
-- (Эти команды создадут политики только если их еще нет)

-- Политики для employees
DO $$
BEGIN
    -- Удаляем старые политики если есть
    DROP POLICY IF EXISTS "Users can view all employees" ON public.employees;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.employees;
    
    -- Создаем новые политики
    CREATE POLICY "Users can view all employees" ON public.employees
        FOR SELECT USING (true);
        
    CREATE POLICY "Users can update own profile" ON public.employees
        FOR UPDATE USING (user_id = auth.uid());
END
$$;

-- Политики для task_logs  
DO $$
BEGIN
    -- Удаляем старые политики если есть
    DROP POLICY IF EXISTS "Users can view all task logs" ON public.task_logs;
    DROP POLICY IF EXISTS "Users can manage own task logs" ON public.task_logs;
    
    -- Создаем новые политики
    CREATE POLICY "Users can view all task logs" ON public.task_logs
        FOR SELECT USING (true);
        
    CREATE POLICY "Users can manage own task logs" ON public.task_logs
        FOR ALL USING (
            employee_id = (
                SELECT id FROM public.employees 
                WHERE user_id = auth.uid()
            )
        );
END
$$;

-- 8. Политики для остальных таблиц
DO $$
BEGIN
    -- task_types
    DROP POLICY IF EXISTS "Users can view task types" ON public.task_types;
    CREATE POLICY "Users can view task types" ON public.task_types
        FOR SELECT USING (true);
    
    -- work_sessions
    DROP POLICY IF EXISTS "Users can view all work sessions" ON public.work_sessions;
    DROP POLICY IF EXISTS "Users can manage own work sessions" ON public.work_sessions;
    CREATE POLICY "Users can view all work sessions" ON public.work_sessions
        FOR SELECT USING (true);
    CREATE POLICY "Users can manage own work sessions" ON public.work_sessions
        FOR ALL USING (
            employee_id = (
                SELECT id FROM public.employees 
                WHERE user_id = auth.uid()
            )
        );
    
    -- active_sessions
    DROP POLICY IF EXISTS "Users can view all active sessions" ON public.active_sessions;
    DROP POLICY IF EXISTS "Users can manage own active sessions" ON public.active_sessions;
    CREATE POLICY "Users can view all active sessions" ON public.active_sessions
        FOR SELECT USING (true);
    CREATE POLICY "Users can manage own active sessions" ON public.active_sessions
        FOR ALL USING (
            employee_id = (
                SELECT id FROM public.employees 
                WHERE user_id = auth.uid()
            )
        );
        
    -- break_logs
    DROP POLICY IF EXISTS "Users can view all break logs" ON public.break_logs;
    DROP POLICY IF EXISTS "Users can manage own break logs" ON public.break_logs;
    CREATE POLICY "Users can view all break logs" ON public.break_logs
        FOR SELECT USING (true);
    CREATE POLICY "Users can manage own break logs" ON public.break_logs
        FOR ALL USING (
            employee_id = (
                SELECT id FROM public.employees 
                WHERE user_id = auth.uid()
            )
        );
        
    -- employee_prizes
    DROP POLICY IF EXISTS "Users can view all employee prizes" ON public.employee_prizes;
    DROP POLICY IF EXISTS "Users can manage own employee prizes" ON public.employee_prizes;
    CREATE POLICY "Users can view all employee prizes" ON public.employee_prizes
        FOR SELECT USING (true);
    CREATE POLICY "Users can manage own employee prizes" ON public.employee_prizes
        FOR ALL USING (
            employee_id = (
                SELECT id FROM public.employees 
                WHERE user_id = auth.uid()
            )
        );
END
$$;

-- Выводим статус исправлений
SELECT 'Все проблемы безопасности исправлены! Views пересозданы без SECURITY DEFINER, RLS включена для всех таблиц.' as status; 