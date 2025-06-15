-- Простое исправление RLS для employees
-- Выполнить в Supabase Dashboard -> SQL Editor

-- 1. Отключаем RLS временно
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- 2. Тестируем запрос
SELECT 
    'Тест без RLS' as test,
    COUNT(*) as count
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE o.name = 'Рассвет' AND e.is_active = true;

-- 3. Показываем данные
SELECT 
    e.id,
    e.full_name,
    e.user_id,
    e.is_online,
    e.position,
    e.is_active,
    e.work_hours,
    o.name as office_name
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE o.name = 'Рассвет' AND e.is_active = true
LIMIT 5;

-- 4. Включаем RLS обратно
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 5. Удаляем старые политики
DROP POLICY IF EXISTS "employees_select_policy" ON employees;
DROP POLICY IF EXISTS "employees_read_policy" ON employees;
DROP POLICY IF EXISTS "employees_public_read" ON employees;
DROP POLICY IF EXISTS "employees_auth_read" ON employees;
DROP POLICY IF EXISTS "employees_read_all" ON employees;

-- 6. Создаем разрешающую политику
CREATE POLICY "employees_public_select" ON employees
    FOR SELECT 
    USING (true);

-- 7. Финальный тест
SELECT 
    'Финальный тест' as test,
    COUNT(*) as count
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE o.name = 'Рассвет' AND e.is_active = true; 