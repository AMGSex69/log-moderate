-- ПРОВЕРКА КОНКРЕТНЫХ ФАНТОМНЫХ ПОЛЬЗОВАТЕЛЕЙ
-- Артём Устинов (ustinov.artemy@yandex.ru) и Анна Корабельникова (anuitakor@yandex.ru)

-- 1. ПРОВЕРЯЕМ АРТЁМА УСТИНОВА
SELECT '=== ПРОВЕРКА АРТЁМА УСТИНОВА ===' as step_1;

-- В user_profiles
SELECT 
    'user_profiles' as table_name,
    up.id,
    up.email,
    up.full_name,
    up.position,
    up.work_schedule,
    up.office_id,
    o.name as office_name,
    up.created_at,
    up.updated_at
FROM public.user_profiles up
LEFT JOIN public.offices o ON up.office_id = o.id
WHERE up.email = 'ustinov.artemy@yandex.ru' 
   OR up.full_name ILIKE '%артём%устинов%'
   OR up.full_name ILIKE '%artemy%'
   OR up.id = '8bc87de5-aee3-49a0-ac04-19912029f8ab';

-- В auth.users
SELECT 
    'auth.users' as table_name,
    au.id,
    au.email,
    au.created_at,
    au.email_confirmed_at,
    au.raw_user_meta_data->>'full_name' as metadata_name,
    au.raw_user_meta_data->>'work_schedule' as metadata_schedule,
    au.raw_user_meta_data->>'office_id' as metadata_office
FROM auth.users au
WHERE au.email = 'ustinov.artemy@yandex.ru'
   OR au.id = '8bc87de5-aee3-49a0-ac04-19912029f8ab';

-- 2. ПРОВЕРЯЕМ АННУ КОРАБЕЛЬНИКОВУ
SELECT '=== ПРОВЕРКА АННЫ КОРАБЕЛЬНИКОВОЙ ===' as step_2;

-- В user_profiles
SELECT 
    'user_profiles' as table_name,
    up.id,
    up.email,
    up.full_name,
    up.position,
    up.work_schedule,
    up.office_id,
    o.name as office_name,
    up.created_at,
    up.updated_at
FROM public.user_profiles up
LEFT JOIN public.offices o ON up.office_id = o.id
WHERE up.email = 'anuitakor@yandex.ru' 
   OR up.full_name ILIKE '%анна%корабельникова%'
   OR up.full_name ILIKE '%anna%'
   OR up.id = '831d65f5-3293-4dcc-b23e-75704f5f95a4';

-- В auth.users
SELECT 
    'auth.users' as table_name,
    au.id,
    au.email,
    au.created_at,
    au.email_confirmed_at,
    au.raw_user_meta_data->>'full_name' as metadata_name,
    au.raw_user_meta_data->>'work_schedule' as metadata_schedule,
    au.raw_user_meta_data->>'office_id' as metadata_office
FROM auth.users au
WHERE au.email = 'anuitakor@yandex.ru'
   OR au.id = '831d65f5-3293-4dcc-b23e-75704f5f95a4';

-- 3. ОБЩИЙ АНАЛИЗ ПРОБЛЕМЫ
SELECT '=== АНАЛИЗ СИНХРОНИЗАЦИИ ===' as step_3;

-- Проверяем все случаи рассинхронизации
WITH sync_check AS (
    SELECT 
        COALESCE(au.email, up.email) as email,
        COALESCE(au.id, up.id) as user_id,
        au.id as auth_id,
        up.id as profile_id,
        au.created_at as auth_created,
        up.created_at as profile_created,
        CASE 
            WHEN au.id IS NOT NULL AND up.id IS NOT NULL THEN '✅ СИНХРОНИЗОВАН'
            WHEN au.id IS NOT NULL AND up.id IS NULL THEN '❌ ТОЛЬКО В AUTH'
            WHEN au.id IS NULL AND up.id IS NOT NULL THEN '❌ ТОЛЬКО В PROFILES'
            ELSE '❓ НЕИЗВЕСТНО'
        END as sync_status
    FROM auth.users au
    FULL OUTER JOIN public.user_profiles up ON au.id = up.id
    WHERE au.email IN ('ustinov.artemy@yandex.ru', 'anuitakor@yandex.ru')
       OR up.email IN ('ustinov.artemy@yandex.ru', 'anuitakor@yandex.ru')
       OR au.id IN ('8bc87de5-aee3-49a0-ac04-19912029f8ab', '831d65f5-3293-4dcc-b23e-75704f5f95a4')
       OR up.id IN ('8bc87de5-aee3-49a0-ac04-19912029f8ab', '831d65f5-3293-4dcc-b23e-75704f5f95a4')
)
SELECT * FROM sync_check;

-- 4. ОПРЕДЕЛЯЕМ ТИП ПРОБЛЕМЫ
DO $$
DECLARE
    artem_auth_exists BOOLEAN := FALSE;
    artem_profile_exists BOOLEAN := FALSE;
    anna_auth_exists BOOLEAN := FALSE;
    anna_profile_exists BOOLEAN := FALSE;
BEGIN
    -- Проверяем Артёма
    SELECT EXISTS(
        SELECT 1 FROM auth.users 
        WHERE email = 'ustinov.artemy@yandex.ru' OR id = '8bc87de5-aee3-49a0-ac04-19912029f8ab'
    ) INTO artem_auth_exists;
    
    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles 
        WHERE email = 'ustinov.artemy@yandex.ru' OR id = '8bc87de5-aee3-49a0-ac04-19912029f8ab'
    ) INTO artem_profile_exists;
    
    -- Проверяем Анну
    SELECT EXISTS(
        SELECT 1 FROM auth.users 
        WHERE email = 'anuitakor@yandex.ru' OR id = '831d65f5-3293-4dcc-b23e-75704f5f95a4'
    ) INTO anna_auth_exists;
    
    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles 
        WHERE email = 'anuitakor@yandex.ru' OR id = '831d65f5-3293-4dcc-b23e-75704f5f95a4'
    ) INTO anna_profile_exists;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 ДИАГНОСТИКА ФАНТОМНЫХ ПОЛЬЗОВАТЕЛЕЙ:';
    RAISE NOTICE '';
    RAISE NOTICE '👤 АРТЁМ УСТИНОВ (ustinov.artemy@yandex.ru):';
    RAISE NOTICE '   В auth.users: %', CASE WHEN artem_auth_exists THEN '✅ ЕСТЬ' ELSE '❌ НЕТ' END;
    RAISE NOTICE '   В user_profiles: %', CASE WHEN artem_profile_exists THEN '✅ ЕСТЬ' ELSE '❌ НЕТ' END;
    
    IF artem_profile_exists AND NOT artem_auth_exists THEN
        RAISE NOTICE '   🚨 ПРОБЛЕМА: Профиль есть, но нет в auth.users!';
        RAISE NOTICE '   💡 РЕШЕНИЕ: Нужно создать пользователя в auth.users или удалить профиль';
    ELSIF artem_auth_exists AND NOT artem_profile_exists THEN
        RAISE NOTICE '   🚨 ПРОБЛЕМА: Есть в auth.users, но нет профиля!';
        RAISE NOTICE '   💡 РЕШЕНИЕ: Нужно создать профиль или удалить из auth.users';
    ELSIF artem_auth_exists AND artem_profile_exists THEN
        RAISE NOTICE '   ✅ НОРМА: Пользователь синхронизирован';
    ELSE
        RAISE NOTICE '   ❓ СТРАННО: Пользователь не найден нигде';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '👤 АННА КОРАБЕЛЬНИКОВА (anuitakor@yandex.ru):';
    RAISE NOTICE '   В auth.users: %', CASE WHEN anna_auth_exists THEN '✅ ЕСТЬ' ELSE '❌ НЕТ' END;
    RAISE NOTICE '   В user_profiles: %', CASE WHEN anna_profile_exists THEN '✅ ЕСТЬ' ELSE '❌ НЕТ' END;
    
    IF anna_profile_exists AND NOT anna_auth_exists THEN
        RAISE NOTICE '   🚨 ПРОБЛЕМА: Профиль есть, но нет в auth.users!';
        RAISE NOTICE '   💡 РЕШЕНИЕ: Нужно создать пользователя в auth.users или удалить профиль';
    ELSIF anna_auth_exists AND NOT anna_profile_exists THEN
        RAISE NOTICE '   🚨 ПРОБЛЕМА: Есть в auth.users, но нет профиля!';
        RAISE NOTICE '   💡 РЕШЕНИЕ: Нужно создать профиль или удалить из auth.users';
    ELSIF anna_auth_exists AND anna_profile_exists THEN
        RAISE NOTICE '   ✅ НОРМА: Пользователь синхронизирован';
    ELSE
        RAISE NOTICE '   ❓ СТРАННО: Пользователь не найден нигде';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔧 РЕКОМЕНДАЦИИ:';
    
    IF (artem_profile_exists AND NOT artem_auth_exists) OR (anna_profile_exists AND NOT anna_auth_exists) THEN
        RAISE NOTICE '   📋 У вас обратная проблема - профили есть, но нет записей в auth.users';
        RAISE NOTICE '   💡 Это может происходить если:';
        RAISE NOTICE '      - Пользователей создавали вручную через админку';
        RAISE NOTICE '      - Была произведена миграция данных';
        RAISE NOTICE '      - Записи в auth.users были случайно удалены';
        RAISE NOTICE '   🔨 РЕШЕНИЕ: Создайте записи в auth.users или удалите профили';
    END IF;
    
    IF (artem_auth_exists AND NOT artem_profile_exists) OR (anna_auth_exists AND NOT anna_profile_exists) THEN
        RAISE NOTICE '   📋 Классическая проблема - есть в auth.users, но нет профилей';
        RAISE NOTICE '   💡 Используйте fix-phantom-users-422.sql для создания профилей';
    END IF;
END $$;

-- 5. ПОИСК СВЯЗАННЫХ ДАННЫХ
SELECT '=== СВЯЗАННЫЕ ДАННЫЕ ===' as step_5;

-- Проверяем есть ли какие-то активности у этих пользователей
SELECT 
    'task_logs' as table_name,
    COUNT(*) as records_count
FROM public.task_logs tl
JOIN public.user_profiles up ON tl.employee_id = up.employee_id
WHERE up.id IN ('8bc87de5-aee3-49a0-ac04-19912029f8ab', '831d65f5-3293-4dcc-b23e-75704f5f95a4');

SELECT 
    'work_sessions' as table_name,
    COUNT(*) as records_count
FROM public.work_sessions ws
JOIN public.user_profiles up ON ws.employee_id = up.employee_id
WHERE up.id IN ('8bc87de5-aee3-49a0-ac04-19912029f8ab', '831d65f5-3293-4dcc-b23e-75704f5f95a4');

SELECT 
    'active_sessions' as table_name,
    COUNT(*) as records_count
FROM public.active_sessions as_tbl
JOIN public.user_profiles up ON as_tbl.employee_id = up.employee_id
WHERE up.id IN ('8bc87de5-aee3-49a0-ac04-19912029f8ab', '831d65f5-3293-4dcc-b23e-75704f5f95a4'); 