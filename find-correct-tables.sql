-- ОПРЕДЕЛЯЕМ ПРАВИЛЬНУЮ СТРУКТУРУ БАЗЫ ДАННЫХ
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. НАХОДИМ ВСЕ ТАБЛИЦЫ СВЯЗАННЫЕ С ПОЛЬЗОВАТЕЛЯМИ
SELECT 'Все таблицы в базе данных:' as info;

SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. ИЩЕМ ТАБЛИЦЫ ПОХОЖИЕ НА ПРОФИЛИ ПОЛЬЗОВАТЕЛЕЙ
SELECT 'Таблицы для профилей пользователей:' as info;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (
    table_name ILIKE '%user%' OR 
    table_name ILIKE '%profile%' OR 
    table_name ILIKE '%employee%' OR
    table_name = 'profiles'
)
ORDER BY table_name;

-- 3. ПРОВЕРЯЕМ СТРУКТУРУ НАЙДЕННЫХ ТАБЛИЦ
SELECT 'Структура таблицы user_profiles (если существует):' as info;

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 4. ПРОВЕРЯЕМ СТРУКТУРУ ТАБЛИЦЫ EMPLOYEES
SELECT 'Структура таблицы employees:' as info;

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'employees'
ORDER BY ordinal_position;

-- 5. ИЩЕМ СВЯЗЬ МЕЖДУ ПОЛЬЗОВАТЕЛЯМИ И СОТРУДНИКАМИ
SELECT 'Поиск связей с auth.users:' as info;

SELECT 
    t.table_name,
    c.column_name
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
AND c.column_name ILIKE '%user_id%'
ORDER BY t.table_name;

-- 6. ПРОВЕРЯЕМ RLS ПОЛИТИКИ НА СУЩЕСТВУЮЩИХ ТАБЛИЦАХ
SELECT 'Текущие RLS политики:' as info;

SELECT 
    schemaname, 
    tablename, 
    policyname
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname; 