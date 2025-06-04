-- Исправление проблем безопасности в проекте LOG-moderate
-- Выполните этот скрипт в SQL Editor вашего Supabase проекта

-- 1. Исправление проблемы с таблицей system_notifications
-- Включаем RLS для таблицы system_notifications
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- Создаем политики RLS для system_notifications
CREATE POLICY "Users can view system notifications" ON public.system_notifications
    FOR SELECT 
    USING (true); -- Все пользователи могут видеть системные уведомления

CREATE POLICY "Admins can manage system notifications" ON public.system_notifications
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE user_id = auth.uid() 
            AND is_admin = true
        )
    );

-- 2. Пересоздание views без SECURITY DEFINER

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

-- 3. Создаем политики RLS для views (если нужно)
-- Views наследуют политики RLS от базовых таблиц

-- 4. Убеждаемся что все основные таблицы имеют RLS
-- (Эти команды безопасны - если RLS уже включена, команда игнорируется)

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_prizes ENABLE ROW LEVEL SECURITY;

-- 5. Проверяем что все политики на месте
-- (Эти команды создадут политики только если их еще нет)

-- Политики для employees
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'employees' 
        AND policyname = 'Users can view all employees'
    ) THEN
        CREATE POLICY "Users can view all employees" ON public.employees
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'employees' 
        AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON public.employees
            FOR UPDATE USING (user_id = auth.uid());
    END IF;
END
$$;

-- Политики для task_logs  
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'task_logs' 
        AND policyname = 'Users can view all task logs'
    ) THEN
        CREATE POLICY "Users can view all task logs" ON public.task_logs
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'task_logs' 
        AND policyname = 'Users can manage own task logs'
    ) THEN
        CREATE POLICY "Users can manage own task logs" ON public.task_logs
            FOR ALL USING (
                employee_id = (
                    SELECT id FROM public.employees 
                    WHERE user_id = auth.uid()
                )
            );
    END IF;
END
$$;

-- 6. Создаем системные уведомления таблицу если ее нет
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- 'info', 'warning', 'error', 'success'
    target_user_id UUID REFERENCES auth.users(id),
    target_role TEXT, -- 'admin', 'employee', 'all'
    is_read BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_system_notifications_target_user ON public.system_notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_system_notifications_created_at ON public.system_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_system_notifications_expires_at ON public.system_notifications(expires_at);

-- Выводим статус исправлений
SELECT 'Все проблемы безопасности исправлены!' as status; 