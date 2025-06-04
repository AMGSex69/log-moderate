-- Проверка структуры таблицы employees
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard

-- 1. Проверяем существует ли таблица employees и её структуру
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'employees'
ORDER BY ordinal_position;

-- 2. Проверяем какие записи уже есть в таблице
SELECT * FROM public.employees LIMIT 5;

-- 3. Проверяем пользователей без записей employees
SELECT 
    up.id,
    up.full_name,
    e.id as employee_id
FROM public.user_profiles up
LEFT JOIN public.employees e ON e.user_id = up.id
WHERE e.id IS NULL;

-- 4. Показываем связи между user_profiles и employees
SELECT 
    up.id as user_id,
    up.full_name,
    e.id as employee_id,
    e.created_at
FROM public.user_profiles up
FULL OUTER JOIN public.employees e ON e.user_id = up.id
ORDER BY up.created_at; 