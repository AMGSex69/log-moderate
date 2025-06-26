-- УДАЛЕНИЕ ФАНТОМНЫХ ПОЛЬЗОВАТЕЛЕЙ (ошибка 422)
-- ⚠️ ВНИМАНИЕ: Этот скрипт УДАЛЯЕТ пользователей из auth.users!
-- ⚠️ Выполняйте ТОЛЬКО после диагностики с помощью diagnose-phantom-user-422.sql
-- ⚠️ Это действие НЕОБРАТИМО!

-- 1. СНАЧАЛА ПОКАЗЫВАЕМ ЧТО БУДЕМ УДАЛЯТЬ
SELECT 'ПОЛЬЗОВАТЕЛИ ДЛЯ УДАЛЕНИЯ (ФАНТОМНЫЕ):' as warning_step_1;

SELECT 
    u.id,
    u.email,  
    u.created_at,
    u.raw_user_meta_data->>'full_name' as intended_name,
    EXTRACT(EPOCH FROM (NOW() - u.created_at))/3600 as hours_since_registration,
    CASE 
        WHEN u.email_confirmed_at IS NULL THEN '❌ НЕ ПОДТВЕРЖДЕН'
        ELSE '✅ ПОДТВЕРЖДЕН'
    END as email_status
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
WHERE up.id IS NULL
ORDER BY u.created_at DESC;

-- 2. ПОДСЧИТЫВАЕМ КОЛИЧЕСТВО
DO $$
DECLARE
    phantom_count INTEGER;
    old_phantom_count INTEGER;
    recent_phantom_count INTEGER;
BEGIN
    -- Общее количество
    SELECT COUNT(*) INTO phantom_count
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON u.id = up.id
    WHERE up.id IS NULL;
    
    -- Старые фантомы (больше 24 часов)
    SELECT COUNT(*) INTO old_phantom_count
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON u.id = up.id
    WHERE up.id IS NULL 
    AND u.created_at < NOW() - INTERVAL '24 hours';
    
    -- Недавние фантомы (менее 24 часов)
    SELECT COUNT(*) INTO recent_phantom_count
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON u.id = up.id
    WHERE up.id IS NULL 
    AND u.created_at >= NOW() - INTERVAL '24 hours';
    
    RAISE NOTICE '';
    RAISE NOTICE '🚨 АНАЛИЗ ФАНТОМНЫХ ПОЛЬЗОВАТЕЛЕЙ:';
    RAISE NOTICE '   Всего фантомных пользователей: %', phantom_count;
    RAISE NOTICE '   Старых (>24ч): %', old_phantom_count;
    RAISE NOTICE '   Недавних (<24ч): %', recent_phantom_count;
    RAISE NOTICE '';
    
    IF phantom_count = 0 THEN
        RAISE NOTICE '✅ Фантомных пользователей не найдено!';
        RAISE NOTICE '💡 Возможно, проблема уже решена или ошибка 422 вызвана другими причинами';
    ELSIF recent_phantom_count > 0 THEN
        RAISE NOTICE '⚠️ ВНИМАНИЕ: Найдены недавние фантомы!';
        RAISE NOTICE '💡 Возможно, триггер handle_new_user не работает для новых регистраций';
        RAISE NOTICE '🔧 Сначала рекомендуем запустить fix-phantom-users-422.sql';
    END IF;
END $$;

-- 3. ОПЦИОНАЛЬНОЕ УДАЛЕНИЕ (раскомментируйте блок ниже для выполнения)
/*
⚠️ РАСКОММЕНТИРУЙТЕ БЛОК НИЖЕ ТОЛЬКО ЕСЛИ УВЕРЕНЫ В УДАЛЕНИИ!

-- 3.1. Удаляем только СТАРЫХ фантомных пользователей (>24 часа)
DO $$
DECLARE
    user_record RECORD;
    deleted_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Начинаем удаление старых фантомных пользователей...';
    
    FOR user_record IN 
        SELECT 
            u.id,
            u.email,
            u.created_at
        FROM auth.users u
        LEFT JOIN public.user_profiles up ON u.id = up.id
        WHERE up.id IS NULL
        AND u.created_at < NOW() - INTERVAL '24 hours'  -- Только старые
        ORDER BY u.created_at
    LOOP
        BEGIN
            -- Удаляем пользователя из auth.users
            -- ВНИМАНИЕ: Это также удалит связанные записи в auth.sessions и т.д.
            DELETE FROM auth.users WHERE id = user_record.id;
            
            deleted_count := deleted_count + 1;
            RAISE NOTICE 'Удален фантомный пользователь: % (ID: %, создан: %)', 
                user_record.email, user_record.id, user_record.created_at;
            
        EXCEPTION
            WHEN OTHERS THEN
                error_count := error_count + 1;
                RAISE WARNING 'Ошибка удаления пользователя: % (ID: %). Ошибка: %', 
                    user_record.email, user_record.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🗑️ РЕЗУЛЬТАТЫ УДАЛЕНИЯ:';
    RAISE NOTICE '   Удалено пользователей: %', deleted_count;
    RAISE NOTICE '   Ошибок: %', error_count;
    RAISE NOTICE '';
    
    IF deleted_count > 0 THEN
        RAISE NOTICE '✅ Старые фантомные пользователи удалены!';
        RAISE NOTICE '💡 Теперь эти email адреса можно использовать для новой регистрации';
    END IF;
END $$;
*/

-- 4. АЛЬТЕРНАТИВНЫЙ ВАРИАНТ: Удаление ВСЕХ фантомных пользователей
/*
⚠️ КРАЙНЕ ОПАСНО! Раскомментируйте ТОЛЬКО в критической ситуации!

DELETE FROM auth.users 
WHERE id IN (
    SELECT u.id
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON u.id = up.id
    WHERE up.id IS NULL
);
*/

-- 5. ПРОВЕРКА ПОСЛЕ УДАЛЕНИЯ
SELECT 'ПРОВЕРКА ПОСЛЕ УДАЛЕНИЯ:' as step_5;

-- Подсчитываем оставшихся фантомных пользователей
SELECT 
    COUNT(*) as remaining_phantom_users,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Все фантомы удалены!'
        ELSE '⚠️ Остались фантомные пользователи'
    END as status
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
WHERE up.id IS NULL;

-- 6. ИТОГОВАЯ СТАТИСТИКА
SELECT 'ИТОГОВАЯ СТАТИСТИКА:' as step_6;

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
FROM auth.users u
INNER JOIN public.user_profiles up ON u.id = up.id
UNION ALL
SELECT 
    'Фантомных пользователей' as metric,
    COUNT(*) as count
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
WHERE up.id IS NULL;

-- 7. ФИНАЛЬНЫЕ РЕКОМЕНДАЦИИ
DO $$
DECLARE
    remaining_phantoms INTEGER;
    total_users INTEGER;
    total_profiles INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_phantoms
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON u.id = up.id
    WHERE up.id IS NULL;
    
    SELECT COUNT(*) INTO total_users FROM auth.users;
    SELECT COUNT(*) INTO total_profiles FROM public.user_profiles;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 ФИНАЛЬНЫЙ ОТЧЕТ:';
    RAISE NOTICE '   Пользователей в auth.users: %', total_users;
    RAISE NOTICE '   Профилей в user_profiles: %', total_profiles;
    RAISE NOTICE '   Фантомных пользователей: %', remaining_phantoms;
    RAISE NOTICE '';
    
    IF remaining_phantoms = 0 THEN
        RAISE NOTICE '✅ База данных очищена от фантомных пользователей!';
        RAISE NOTICE '🧪 ТЕСТИРОВАНИЕ:';
        RAISE NOTICE '   1. Попробуйте зарегистрировать нового пользователя';
        RAISE NOTICE '   2. Ошибка 422 "User already registered" должна исчезнуть';
        RAISE NOTICE '   3. Убедитесь, что триггер handle_new_user работает';
    ELSE
        RAISE NOTICE '⚠️ Остается % фантомных пользователей', remaining_phantoms;
        RAISE NOTICE '💡 Возможно, скрипт не был выполнен или есть проблемы с правами доступа';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔄 СЛЕДУЮЩИЕ ШАГИ:';
    RAISE NOTICE '   1. Проверьте работу триггера handle_new_user';
    RAISE NOTICE '   2. Убедитесь, что RLS политики настроены правильно';
    RAISE NOTICE '   3. Протестируйте регистрацию нового пользователя';
    RAISE NOTICE '   4. Если проблемы остаются - запустите diagnose-phantom-user-422.sql';
END $$; 