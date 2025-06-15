-- ПРОСТОЕ ИСПРАВЛЕНИЕ RLS ДЛЯ EMPLOYEES
-- Выполнить в Supabase Dashboard -> SQL Editor

-- 1. Проверяем текущий статус RLS
SELECT 
    'Текущий статус RLS' as info,
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename IN ('employees', 'offices');

-- 2. Отключаем RLS на employees
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- 3. Отключаем RLS на offices (если нужно)
ALTER TABLE offices DISABLE ROW LEVEL SECURITY;

-- 4. Тестируем запрос как в фронтенде
SELECT 
    'Тест запроса фронтенда' as test,
    COUNT(*) as count
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE o.name = 'Рассвет' AND e.is_active = true;

-- 5. Показываем данные
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
ORDER BY e.full_name
LIMIT 10;

-- 6. Проверяем статус после отключения
SELECT 
    'Статус после отключения RLS' as info,
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename IN ('employees', 'offices');

-- Исправляем RLS политики для employees (упрощённая версия)

-- Удаляем все существующие политики UPDATE
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "employees_admin_update" ON employees;
    DROP POLICY IF EXISTS "employees_own_profile_update" ON employees;
    DROP POLICY IF EXISTS "employees_update_own" ON employees;
    DROP POLICY IF EXISTS "employees_update_policy" ON employees;
    DROP POLICY IF EXISTS "Users can update own employee profile" ON employees;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Некоторые политики уже отсутствуют: %', SQLERRM;
END $$;

-- Создаём простую политику - разрешить UPDATE для всех аутентифицированных пользователей
CREATE POLICY "employees_authenticated_update" ON employees
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Альтернативно, создаём политику только для своих записей
CREATE POLICY "employees_own_record_update" ON employees
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Убеждаемся что RLS включён
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Проверяем новые политики
SELECT 'НОВЫЕ УПРОЩЁННЫЕ RLS ПОЛИТИКИ:' as status;
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'employees'
AND cmd = 'UPDATE';

-- Тестируем доступ
SELECT 'ТЕСТ ДОСТУПА:' as test_info;
SELECT 'Текущий пользователь: ' || auth.uid()::text as current_user; 