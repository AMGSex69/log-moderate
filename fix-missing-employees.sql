-- Исправление отсутствующих записей сотрудников
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard

-- 1. Проверяем какие пользователи есть в user_profiles но нет в employees
SELECT 
    up.id,
    up.full_name,
    e.id as employee_id
FROM public.user_profiles up
LEFT JOIN public.employees e ON e.user_id = up.id
WHERE e.id IS NULL;

-- 2. Создаем записи сотрудников для всех пользователей у которых их нет
INSERT INTO public.employees (user_id, employee_number, created_at, is_active)
SELECT 
    up.id,
    'EMP-' || LPAD((ROW_NUMBER() OVER (ORDER BY up.created_at) + COALESCE(MAX(e.id), 0))::TEXT, 4, '0'),
    up.created_at,
    true
FROM public.user_profiles up
LEFT JOIN public.employees e ON e.user_id = up.id
CROSS JOIN (SELECT COALESCE(MAX(id), 0) as max_id FROM public.employees) max_emp
WHERE e.id IS NULL
GROUP BY up.id, up.created_at, max_emp.max_id;

-- 3. Исправляем RLS политики для employees (более мягкие)
DROP POLICY IF EXISTS "Users can view own employee record" ON public.employees;
DROP POLICY IF EXISTS "Users can insert own employee record" ON public.employees;
DROP POLICY IF EXISTS "Users can update own employee record" ON public.employees;

-- Политики которые позволяют больше операций
CREATE POLICY "Users can view own employee record" ON public.employees
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own employee record" ON public.employees
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own employee record" ON public.employees
    FOR UPDATE USING (auth.uid() = user_id);

-- 4. Также добавляем политику для аутентифицированных пользователей
CREATE POLICY "Authenticated users can view all employees" ON public.employees
    FOR SELECT USING (auth.role() = 'authenticated');

-- 5. Проверяем что записи созданы
SELECT 
    up.id as user_id,
    up.full_name,
    e.id as employee_id,
    e.employee_number
FROM public.user_profiles up
JOIN public.employees e ON e.user_id = up.id
ORDER BY up.created_at;

-- 6. Исправляем функцию handle_new_employee для более надежной работы
CREATE OR REPLACE FUNCTION public.handle_new_employee()
RETURNS TRIGGER AS $$
BEGIN
    -- Проверяем что запись сотрудника еще не существует
    IF NOT EXISTS (SELECT 1 FROM public.employees WHERE user_id = NEW.id) THEN
        INSERT INTO public.employees (user_id, employee_number)
        VALUES (
            NEW.id, 
            'EMP-' || LPAD((SELECT COALESCE(MAX(id), 0) + 1 FROM public.employees)::TEXT, 4, '0')
        );
    END IF;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error creating employee record: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Проверяем что work_sessions таблица доступна
ALTER TABLE IF EXISTS public.work_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own work sessions" ON public.work_sessions;
CREATE POLICY "Users can manage own work sessions" ON public.work_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.employees e 
            WHERE e.id = work_sessions.employee_id 
            AND e.user_id = auth.uid()
        )
    );

COMMIT; 