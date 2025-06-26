-- ДИАГНОСТИКА ОШИБКИ 422 "User already registered"
-- Этот скрипт помогает найти пользователей в auth.users без профилей в user_profiles

-- 1. Проверяем количество пользователей в auth.users
SELECT 'Всего пользователей в auth.users:' as check_name, COUNT(*) as count
FROM auth.users;

-- 2. Проверяем количество профилей в user_profiles
SELECT 'Всего профилей в user_profiles:' as check_name, COUNT(*) as count
FROM public.user_profiles;

-- 3. КЛЮЧЕВАЯ ПРОВЕРКА: Находим пользователей без профилей
SELECT 'Пользователи без профилей:' as check_name;

SELECT 
    u.id,
    u.email,
    u.created_at as auth_created_at,
    u.email_confirmed_at,
    CASE WHEN up.id IS NULL THEN '❌ MISSING' ELSE '✅ EXISTS' END as profile_status
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
WHERE up.id IS NULL
ORDER BY u.created_at DESC;

-- 4. Проверяем последние регистрации в auth.users
SELECT 'Последние 5 регистраций в auth.users:' as check_name;

SELECT 
    u.id,
    u.email,
    u.created_at,
    u.email_confirmed_at,
    CASE WHEN up.id IS NULL THEN '❌ NO PROFILE' ELSE '✅ HAS PROFILE' END as profile_status,
    up.full_name,
    up.position
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
ORDER BY u.created_at DESC
LIMIT 5;

-- 5. Показываем проблемные записи с email
SELECT 'Проблемные пользователи (есть в auth.users, нет в user_profiles):' as check_name;

SELECT 
    u.id as user_id,
    u.email,
    u.created_at as registered_at,
    u.raw_user_meta_data->>'full_name' as intended_name,
    u.raw_user_meta_data->>'work_schedule' as intended_schedule,
    u.raw_user_meta_data->>'office_id' as intended_office_id,
    u.email_confirmed_at,
    EXTRACT(EPOCH FROM (NOW() - u.created_at))/3600 as hours_since_registration
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
WHERE up.id IS NULL
ORDER BY u.created_at DESC;

-- 6. Если есть фантомные пользователи, показываем детали для исправления
DO $$
DECLARE
    phantom_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO phantom_count
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON u.id = up.id
    WHERE up.id IS NULL;
    
    IF phantom_count > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '🚨 НАЙДЕНО % ФАНТОМНЫХ ПОЛЬЗОВАТЕЛЕЙ!', phantom_count;
        RAISE NOTICE '💡 Это пользователи, которые есть в auth.users, но отсутствуют в user_profiles';
        RAISE NOTICE '📋 Причины:';
        RAISE NOTICE '   - Триггер handle_new_user не сработал при регистрации';
        RAISE NOTICE '   - Ошибка в триггере при создании профиля';
        RAISE NOTICE '   - RLS политики заблокировали создание профиля';
        RAISE NOTICE '   - Профиль был случайно удален';
        RAISE NOTICE '';
        RAISE NOTICE '🔧 РЕШЕНИЯ:';
        RAISE NOTICE '   1. Выполните скрипт fix-phantom-users-422.sql для исправления';
        RAISE NOTICE '   2. Или удалите фантомных пользователей из auth.users';
        RAISE NOTICE '   3. Проверьте работу триггера handle_new_user';
        RAISE NOTICE '';
    ELSE
        RAISE NOTICE '✅ Фантомных пользователей не найдено!';
        RAISE NOTICE '💡 Ошибка 422 может быть вызвана другими причинами:';
        RAISE NOTICE '   - Пользователь действительно уже зарегистрирован';
        RAISE NOTICE '   - Проблемы с кешированием в браузере';
        RAISE NOTICE '   - Лимиты Supabase на регистрацию';
    END IF;
END $$;

-- 7. Проверяем работу триггеров
SELECT 'Статус триггеров:' as check_name;

SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation,
    CASE WHEN trigger_name IS NOT NULL THEN '✅ ACTIVE' ELSE '❌ MISSING' END as status
FROM information_schema.triggers 
WHERE trigger_name LIKE '%auth_user%' OR trigger_name LIKE '%new_user%'
ORDER BY trigger_name;

-- 8. Проверяем функцию handle_new_user
SELECT 'Функция handle_new_user:' as check_name;

SELECT 
    routine_name,
    routine_type,
    routine_definition LIKE '%user_profiles%' as works_with_user_profiles,
    routine_definition LIKE '%employees%' as works_with_employees,
    CASE WHEN routine_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 9. Показываем итоговые рекомендации
SELECT 'ИТОГОВЫЕ РЕКОМЕНДАЦИИ:' as final_recommendations;

DO $$
DECLARE
    phantom_count INTEGER;
    has_trigger BOOLEAN := FALSE;
    has_function BOOLEAN := FALSE;
BEGIN
    -- Подсчитываем фантомных пользователей
    SELECT COUNT(*) INTO phantom_count
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON u.id = up.id
    WHERE up.id IS NULL;
    
    -- Проверяем триггер
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name LIKE '%auth_user%' OR trigger_name LIKE '%new_user%'
    ) INTO has_trigger;
    
    -- Проверяем функцию
    SELECT EXISTS(
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'handle_new_user'
    ) INTO has_function;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 ИТОГОВАЯ ДИАГНОСТИКА:';
    RAISE NOTICE '   Фантомных пользователей: %', phantom_count;
    RAISE NOTICE '   Триггер активен: %', CASE WHEN has_trigger THEN 'Да' ELSE 'Нет' END;
    RAISE NOTICE '   Функция существует: %', CASE WHEN has_function THEN 'Да' ELSE 'Нет' END;
    RAISE NOTICE '';
    
    IF phantom_count > 0 THEN
        RAISE NOTICE '🔧 РЕКОМЕНДУЕМЫЕ ДЕЙСТВИЯ:';
        RAISE NOTICE '   1. Запустите fix-phantom-users-422.sql для создания профилей';
        RAISE NOTICE '   2. Или запустите delete-phantom-users-422.sql для удаления';
        RAISE NOTICE '   3. После исправления проверьте регистрацию новых пользователей';
    ELSE
        RAISE NOTICE '✅ База данных в порядке!';
        RAISE NOTICE '💡 Если ошибка 422 все еще возникает:';
        RAISE NOTICE '   - Очистите кеш браузера';
        RAISE NOTICE '   - Проверьте, не превышены ли лимиты Supabase';
        RAISE NOTICE '   - Убедитесь, что email действительно новый';
    END IF;
END $$; 