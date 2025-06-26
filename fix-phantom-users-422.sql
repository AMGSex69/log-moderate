-- ИСПРАВЛЕНИЕ ОШИБКИ 422 "User already registered"
-- Создаем профили для пользователей, которые есть в auth.users, но отсутствуют в user_profiles

-- 1. Показываем пользователей, которых будем исправлять
SELECT 'ПОЛЬЗОВАТЕЛИ ДЛЯ ИСПРАВЛЕНИЯ:' as step_1;

SELECT 
    u.id,
    u.email,
    u.created_at,
    u.raw_user_meta_data->>'full_name' as intended_name,
    u.raw_user_meta_data->>'work_schedule' as intended_schedule,
    u.raw_user_meta_data->>'office_id' as intended_office_id
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
WHERE up.id IS NULL
ORDER BY u.created_at DESC;

-- 2. Подсчитываем количество
DO $$
DECLARE
    phantom_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO phantom_count
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON u.id = up.id
    WHERE up.id IS NULL;
    
    RAISE NOTICE 'Найдено % фантомных пользователей для исправления', phantom_count;
END $$;

-- 3. ИСПРАВЛЕНИЕ: Создаем профили для фантомных пользователей
DO $$
DECLARE
    user_record RECORD;
    default_office_id INTEGER;
    created_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    -- Получаем ID офиса по умолчанию
    SELECT id INTO default_office_id 
    FROM public.offices 
    WHERE name ILIKE '%рассвет%' OR name ILIKE '%main%' OR name ILIKE '%default%'
    LIMIT 1;
    
    -- Если офис не найден, используем первый доступный
    IF default_office_id IS NULL THEN
        SELECT id INTO default_office_id FROM public.offices LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Используем офис по умолчанию с ID: %', COALESCE(default_office_id, 0);
    
    -- Создаем профили для каждого фантомного пользователя
    FOR user_record IN 
        SELECT 
            u.id,
            u.email,
            u.created_at,
            u.raw_user_meta_data
        FROM auth.users u
        LEFT JOIN public.user_profiles up ON u.id = up.id
        WHERE up.id IS NULL
        ORDER BY u.created_at
    LOOP
        BEGIN
            -- Извлекаем данные из метаданных или используем значения по умолчанию
            INSERT INTO public.user_profiles (
                id,
                full_name,
                position,
                is_admin,
                work_schedule,
                work_hours,
                office_id,
                role,
                admin_role,
                is_active,
                coins,
                experience,
                level,
                achievements,
                email,
                created_at,
                updated_at,
                last_activity
            ) VALUES (
                user_record.id,
                COALESCE(
                    user_record.raw_user_meta_data->>'full_name',
                    SPLIT_PART(user_record.email, '@', 1),
                    'Пользователь'
                ),
                'Сотрудник',
                false,
                COALESCE(user_record.raw_user_meta_data->>'work_schedule', '5/2'),
                CASE 
                    WHEN COALESCE(user_record.raw_user_meta_data->>'work_schedule', '5/2') = '2/2' 
                    THEN 12 
                    ELSE 9 
                END,
                COALESCE(
                    (user_record.raw_user_meta_data->>'office_id')::INTEGER,
                    default_office_id
                ),
                'user',
                'user',
                true,
                0,  -- начальные монеты
                0,  -- начальный опыт
                1,  -- начальный уровень
                '[]'::jsonb,  -- пустые достижения
                user_record.email,
                user_record.created_at,
                NOW(),
                NOW()
            );
            
            created_count := created_count + 1;
            RAISE NOTICE 'Создан профиль для пользователя: % (ID: %)', user_record.email, user_record.id;
            
        EXCEPTION
            WHEN unique_violation THEN
                RAISE NOTICE 'Профиль уже существует для: % (ID: %)', user_record.email, user_record.id;
            WHEN OTHERS THEN
                error_count := error_count + 1;
                RAISE WARNING 'Ошибка создания профиля для: % (ID: %). Ошибка: %', 
                    user_record.email, user_record.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ РЕЗУЛЬТАТЫ ИСПРАВЛЕНИЯ:';
    RAISE NOTICE '   Создано профилей: %', created_count;
    RAISE NOTICE '   Ошибок: %', error_count;
    RAISE NOTICE '';
    
    IF created_count > 0 THEN
        RAISE NOTICE '🎉 Фантомные пользователи исправлены!';
        RAISE NOTICE '💡 Теперь они смогут войти в систему с существующими учетными данными';
    END IF;
END $$;

-- 4. Проверяем результат исправления
SELECT 'ПРОВЕРКА ПОСЛЕ ИСПРАВЛЕНИЯ:' as step_4;

-- Подсчитываем оставшихся фантомных пользователей
SELECT 
    COUNT(*) as remaining_phantom_users,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Все исправлены!'
        ELSE '⚠️ Остались нерешенные проблемы'
    END as status
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
WHERE up.id IS NULL;

-- 5. Показываем итоговую статистику
SELECT 'ИТОГОВАЯ СТАТИСТИКА:' as step_5;

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
INNER JOIN public.user_profiles up ON u.id = up.id;

-- 6. Проверяем созданные профили
SELECT 'СОЗДАННЫЕ ПРОФИЛИ:' as step_6;

SELECT 
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
WHERE up.updated_at > up.created_at  -- Недавно обновленные (только что созданные)
   OR up.updated_at >= NOW() - INTERVAL '1 hour'  -- Созданные в последний час
ORDER BY up.updated_at DESC
LIMIT 10;

-- 7. Финальные рекомендации
DO $$
DECLARE
    remaining_phantoms INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_phantoms
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON u.id = up.id
    WHERE up.id IS NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 ФИНАЛЬНЫЕ РЕКОМЕНДАЦИИ:';
    
    IF remaining_phantoms = 0 THEN
        RAISE NOTICE '✅ Все фантомные пользователи исправлены!';
        RAISE NOTICE '💡 Теперь можно тестировать регистрацию новых пользователей';
        RAISE NOTICE '🔄 Убедитесь, что триггер handle_new_user работает для новых регистраций';
    ELSE
        RAISE NOTICE '⚠️ Остается % нерешенных проблем', remaining_phantoms;
        RAISE NOTICE '🔧 Рекомендуем проверить:';
        RAISE NOTICE '   - Права доступа к таблице user_profiles';
        RAISE NOTICE '   - RLS политики';
        RAISE NOTICE '   - Целостность данных в метаданных пользователей';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🧪 ТЕСТИРОВАНИЕ:';
    RAISE NOTICE '   1. Попробуйте войти с исправленными учетными данными';
    RAISE NOTICE '   2. Попробуйте зарегистрировать совершенно нового пользователя';
    RAISE NOTICE '   3. Если проблемы остаются - выполните diagnose-phantom-user-422.sql';
END $$; 