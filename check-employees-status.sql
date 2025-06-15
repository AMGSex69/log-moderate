-- ПРОВЕРКА СТАТУСА ДОСТУПА К EMPLOYEES
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. ПРОВЕРЯЕМ СУЩЕСТВУЮЩИЕ ПОЛИТИКИ
SELECT 'Текущие политики для employees:' as step_1;

SELECT 
    schemaname, 
    tablename, 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'employees'
ORDER BY policyname;

-- 2. ПРОВЕРЯЕМ RLS СТАТУС
SELECT 'RLS статус employees:' as step_2;

SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename = 'employees';

-- 3. ТЕСТИРУЕМ ДОСТУП К ДАННЫМ
SELECT 'Тест доступа к employees:' as step_3;

SELECT 
    COUNT(*) as total_employees,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT office_id) as unique_offices
FROM employees;

-- 4. ПРОВЕРЯЕМ ПРИМЕРЫ ДАННЫХ
SELECT 'Пример данных employees:' as step_4;

SELECT 
    id,
    full_name,
    position,
    user_id,
    office_id,
    is_online
FROM employees 
LIMIT 3;

-- 5. ИТОГОВЫЙ СТАТУС
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ ДОСТУП К EMPLOYEES РАБОТАЕТ!'
        ELSE '❌ Нет доступа к employees'
    END as final_status
FROM employees; 