-- ИСПРАВЛЕНИЕ ДОСТУПА К ТАБЛИЦЕ EMPLOYEES
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. ПРОВЕРЯЕМ СУЩЕСТВОВАНИЕ ТАБЛИЦЫ
SELECT 'Проверяем таблицу employees:' as step_1;

SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'employees';

-- 2. УДАЛЯЕМ СТАРЫЕ ПОЛИТИКИ ДЛЯ EMPLOYEES
DROP POLICY IF EXISTS "Users can view employees from same office" ON public.employees;
DROP POLICY IF EXISTS "employees_select_policy" ON public.employees;
DROP POLICY IF EXISTS "Users can view employee info" ON public.employees;
DROP POLICY IF EXISTS "authenticated_users_can_view_employees" ON public.employees;
DROP POLICY IF EXISTS "open_access_employees" ON public.employees;

-- 3. ВКЛЮЧАЕМ RLS И СОЗДАЕМ ОТКРЫТУЮ ПОЛИТИКУ
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_open_read_access" ON public.employees
    FOR SELECT TO authenticated
    USING (true);

-- 4. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
SELECT 'Политики для employees:' as step_4;

SELECT 
    schemaname, 
    tablename, 
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'employees'
ORDER BY policyname;

-- 5. ТЕСТИРУЕМ ДОСТУП
SELECT 'Тест доступа к employees:' as step_5;

SELECT COUNT(*) as employees_count FROM employees;

SELECT 'ГОТОВО! Доступ к employees настроен.' as final_step; 