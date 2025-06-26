-- ИСПРАВЛЕНИЕ ОБРАТНОЙ ФАНТОМНОСТИ
-- Когда профили есть в user_profiles, но нет записей в auth.users
-- Артём Устинов и Анна Корабельникова

-- 1. БЫСТРАЯ ДИАГНОСТИКА
SELECT '=== ДИАГНОСТИКА ПРОБЛЕМЫ ===' as step;

-- Проверяем наличие пользователей
SELECT 
    'Артём Устинов' as user_name,
    'ustinov.artemy@yandex.ru' as email,
    EXISTS(SELECT 1 FROM auth.users WHERE email = 'ustinov.artemy@yandex.ru') as in_auth_users,
    EXISTS(SELECT 1 FROM public.user_profiles WHERE email = 'ustinov.artemy@yandex.ru') as in_user_profiles
UNION ALL
SELECT 
    'Анна Корабельникова' as user_name,
    'anuitakor@yandex.ru' as email,
    EXISTS(SELECT 1 FROM auth.users WHERE email = 'anuitakor@yandex.ru') as in_auth_users,
    EXISTS(SELECT 1 FROM public.user_profiles WHERE email = 'anuitakor@yandex.ru') as in_user_profiles;

-- 2. ПОКАЗЫВАЕМ ПРОБЛЕМНЫХ ПОЛЬЗОВАТЕЛЕЙ
SELECT '=== ПОЛЬЗОВАТЕЛИ ТОЛЬКО В USER_PROFILES ===' as step;

SELECT 
    up.id,
    up.email,
    up.full_name,
    up.position,
    up.work_schedule,
    up.office_id,
    o.name as office_name,
    up.created_at,
    up.updated_at,
    CASE 
        WHEN up.email IN ('ustinov.artemy@yandex.ru', 'anuitakor@yandex.ru') THEN '🚨 ПРОБЛЕМНЫЙ'
        ELSE '✅ НОРМАЛЬНЫЙ'
    END as status
FROM public.user_profiles up
LEFT JOIN public.offices o ON up.office_id = o.id
LEFT JOIN auth.users au ON up.id = au.id
WHERE au.id IS NULL
AND up.email IN ('ustinov.artemy@yandex.ru', 'anuitakor@yandex.ru')
ORDER BY up.created_at DESC;

-- 3. РЕШЕНИЕ A: УДАЛЕНИЕ ПРОБЛЕМНЫХ ПРОФИЛЕЙ (чтобы пользователи могли зарегистрироваться заново)
SELECT '=== РЕШЕНИЕ A: УДАЛЕНИЕ ПРОФИЛЕЙ ===' as step;

DO $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Удаляем проблемные профили чтобы пользователи могли зарегистрироваться заново...';
    
    -- Удаляем связанные данные сначала (если есть)
    DELETE FROM public.task_logs 
    WHERE employee_id IN (
        SELECT employee_id FROM public.user_profiles 
        WHERE email IN ('ustinov.artemy@yandex.ru', 'anuitakor@yandex.ru')
        AND id NOT IN (SELECT id FROM auth.users)
    );
    
    DELETE FROM public.work_sessions 
    WHERE employee_id IN (
        SELECT employee_id FROM public.user_profiles 
        WHERE email IN ('ustinov.artemy@yandex.ru', 'anuitakor@yandex.ru')
        AND id NOT IN (SELECT id FROM auth.users)
    );
    
    DELETE FROM public.active_sessions 
    WHERE employee_id IN (
        SELECT employee_id FROM public.user_profiles 
        WHERE email IN ('ustinov.artemy@yandex.ru', 'anuitakor@yandex.ru')
        AND id NOT IN (SELECT id FROM auth.users)
    );
    
    -- Удаляем профили без соответствующих записей в auth.users
    DELETE FROM public.user_profiles 
    WHERE email IN ('ustinov.artemy@yandex.ru', 'anuitakor@yandex.ru')
    AND id NOT IN (SELECT id FROM auth.users);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Удалено % проблемных профилей', deleted_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ ТЕПЕРЬ ПОЛЬЗОВАТЕЛИ МОГУТ ЗАРЕГИСТРИРОВАТЬСЯ ЗАНОВО!';
    RAISE NOTICE '💡 Попросите Артёма и Анну попробовать регистрацию ещё раз';
    RAISE NOTICE '';
END $$;

-- 4. ПРОВЕРКА ПОСЛЕ УДАЛЕНИЯ
SELECT '=== ПРОВЕРКА ПОСЛЕ ИСПРАВЛЕНИЯ ===' as step;

-- Проверяем что пользователей больше нет нигде
SELECT 
    'После удаления' as status,
    'ustinov.artemy@yandex.ru' as email,
    EXISTS(SELECT 1 FROM auth.users WHERE email = 'ustinov.artemy@yandex.ru') as in_auth_users,
    EXISTS(SELECT 1 FROM public.user_profiles WHERE email = 'ustinov.artemy@yandex.ru') as in_user_profiles
UNION ALL
SELECT 
    'После удаления' as status,
    'anuitakor@yandex.ru' as email,
    EXISTS(SELECT 1 FROM auth.users WHERE email = 'anuitakor@yandex.ru') as in_auth_users,
    EXISTS(SELECT 1 FROM public.user_profiles WHERE email = 'anuitakor@yandex.ru') as in_user_profiles;

-- 5. ПРОВЕРЯЕМ ОБЩУЮ СИНХРОНИЗАЦИЮ
SELECT '=== ОБЩАЯ СТАТИСТИКА СИНХРОНИЗАЦИИ ===' as step;

SELECT 
    'Пользователей в auth.users' as metric,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
    'Профилей в user_profiles' as metric,
    COUNT(*) as count
FROM public.user_profiles
UNION ALL
SELECT 
    'Синхронизированных пользователей' as metric,
    COUNT(*) as count
FROM auth.users au
INNER JOIN public.user_profiles up ON au.id = up.id
UNION ALL
SELECT 
    'Фантомов в auth.users (без профилей)' as metric,
    COUNT(*) as count
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL
UNION ALL
SELECT 
    'Обратных фантомов в user_profiles (без auth)' as metric,
    COUNT(*) as count
FROM public.user_profiles up
LEFT JOIN auth.users au ON up.id = au.id
WHERE au.id IS NULL;

-- 6. ФИНАЛЬНЫЕ РЕКОМЕНДАЦИИ
DO $$
DECLARE
    reverse_phantoms INTEGER;
    normal_phantoms INTEGER;
BEGIN
    -- Подсчитываем оставшиеся проблемы
    SELECT COUNT(*) INTO reverse_phantoms
    FROM public.user_profiles up
    LEFT JOIN auth.users au ON up.id = au.id
    WHERE au.id IS NULL;
    
    SELECT COUNT(*) INTO normal_phantoms
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON au.id = up.id
    WHERE up.id IS NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 ФИНАЛЬНЫЙ СТАТУС:';
    RAISE NOTICE '   Обратных фантомов: %', reverse_phantoms;
    RAISE NOTICE '   Обычных фантомов: %', normal_phantoms;
    RAISE NOTICE '';
    
    IF reverse_phantoms = 0 AND normal_phantoms = 0 THEN
        RAISE NOTICE '🎉 ОТЛИЧНО! База данных полностью синхронизирована!';
        RAISE NOTICE '✅ Анна и Артём теперь могут зарегистрироваться заново';
        RAISE NOTICE '🧪 Попросите их попробовать регистрацию ещё раз';
    ELSE
        RAISE NOTICE '⚠️ Остались другие проблемы синхронизации';
        IF reverse_phantoms > 0 THEN
            RAISE NOTICE '💡 Есть ещё % обратных фантомов', reverse_phantoms;
        END IF;
        IF normal_phantoms > 0 THEN
            RAISE NOTICE '💡 Есть % обычных фантомов', normal_phantoms;
            RAISE NOTICE '🔧 Используйте fix-phantom-users-422.sql для исправления';
        END IF;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📱 ИНСТРУКЦИЯ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ:';
    RAISE NOTICE '   1. Очистите кеш браузера';
    RAISE NOTICE '   2. Попробуйте зарегистрироваться заново';
    RAISE NOTICE '   3. Если ошибка повторяется - сообщите администратору';
END $$; 