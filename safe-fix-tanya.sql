-- БЕЗОПАСНОЕ ИСПРАВЛЕНИЕ ДЛЯ ТАНИ - БЕЗ КОНФЛИКТОВ
-- User ID: ca465c0e-6317-4666-b277-b45f9cbeedae

-- 1. ПРОВЕРЯЕМ ПОЛЬЗОВАТЕЛЯ В AUTH.USERS
SELECT 
    '🔍 ПРОВЕРКА В AUTH.USERS' as step,
    id,
    email,
    created_at
FROM auth.users 
WHERE id = 'ca465c0e-6317-4666-b277-b45f9cbeedae';

-- 2. ПРОВЕРЯЕМ СУЩЕСТВУЕТ ЛИ ПРОФИЛЬ
SELECT 
    '🔍 ПРОВЕРКА В USER_PROFILES' as step,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ ПРОФИЛЬ СУЩЕСТВУЕТ'
        ELSE '❌ ПРОФИЛЬ НЕ НАЙДЕН'
    END as status,
    COUNT(*) as count
FROM public.user_profiles 
WHERE id = 'ca465c0e-6317-4666-b277-b45f9cbeedae';

-- 3. СОЗДАЕМ ОФИС "РАССВЕТ" ЕСЛИ НЕ СУЩЕСТВУЕТ
INSERT INTO public.offices (name, description)
SELECT 'Рассвет', 'Основной офис'
WHERE NOT EXISTS (SELECT 1 FROM public.offices WHERE name = 'Рассвет');

-- 4. СОЗДАЕМ ПРОФИЛЬ ДЛЯ ТАНИ
DO $$
DECLARE
    user_email TEXT;
    user_name TEXT;
    rassvет_office_id INTEGER;
    existing_profile_count INTEGER;
BEGIN
    -- Проверяем есть ли уже профиль
    SELECT COUNT(*) INTO existing_profile_count
    FROM public.user_profiles 
    WHERE id = 'ca465c0e-6317-4666-b277-b45f9cbeedae';
    
    IF existing_profile_count > 0 THEN
        RAISE NOTICE 'Профиль уже существует для пользователя';
        RETURN;
    END IF;
    
    -- Получаем данные из auth.users
    SELECT email INTO user_email
    FROM auth.users 
    WHERE id = 'ca465c0e-6317-4666-b277-b45f9cbeedae';
    
    -- Определяем имя пользователя
    user_name := CASE 
        WHEN user_email LIKE '%tanya%' OR user_email LIKE '%таня%' THEN 'Таня'
        WHEN user_email IS NOT NULL THEN SPLIT_PART(user_email, '@', 1)
        ELSE 'Новый пользователь'
    END;
    
    -- Получаем ID офиса Рассвет
    SELECT id INTO rassvет_office_id 
    FROM public.offices 
    WHERE name = 'Рассвет' 
    LIMIT 1;
    
    -- Если офиса нет, берем первый доступный
    IF rassvет_office_id IS NULL THEN
        SELECT id INTO rassvет_office_id 
        FROM public.offices 
        ORDER BY id 
        LIMIT 1;
    END IF;
    
    -- Создаем профиль
    INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        position,
        work_schedule,
        work_hours,
        office_id,
        is_admin,
        role,
        admin_role,
        is_active,
        coins,
        experience,
        level,
        achievements,
        created_at,
        updated_at,
        last_activity
    ) VALUES (
        'ca465c0e-6317-4666-b277-b45f9cbeedae',
        user_email,
        user_name,
        'Сотрудник',
        '5/2',
        9,
        rassvет_office_id,
        false,
        'user',
        'user',
        true,
        0,
        0,
        1,
        '[]'::jsonb,
        NOW(),
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Профиль создан для пользователя: % с именем: %', user_email, user_name;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Ошибка создания профиля: %', SQLERRM;
END $$;

-- 5. ПРОВЕРЯЕМ РЕЗУЛЬТАТ СОЗДАНИЯ
SELECT 
    '✅ ПРОФИЛЬ СОЗДАН' as status,
    id,
    email,
    full_name,
    position,
    office_id,
    employee_id,
    work_schedule,
    is_active,
    created_at
FROM public.user_profiles 
WHERE id = 'ca465c0e-6317-4666-b277-b45f9cbeedae';

-- 6. ПРОВЕРЯЕМ ОФИС
SELECT 
    '🏢 ОФИС ПОЛЬЗОВАТЕЛЯ' as info,
    o.id,
    o.name,
    o.description
FROM public.offices o
INNER JOIN public.user_profiles up ON o.id = up.office_id
WHERE up.id = 'ca465c0e-6317-4666-b277-b45f9cbeedae';

-- 7. ФИНАЛЬНАЯ ПРОВЕРКА
SELECT 
    '🎉 ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!' as status,
    'Таня может обновить страницу' as message;

SELECT 
    '📊 СТАТИСТИКА:' as info,
    (SELECT COUNT(*) FROM public.user_profiles) as total_users,
    (SELECT COUNT(*) FROM public.offices) as total_offices;

SELECT 
    '🔄 ИНСТРУКЦИИ ДЛЯ ТАНИ:' as action,
    '1. Обновите страницу в браузере (F5 или Ctrl+R)' as step1,
    '2. Если проблема остается - очистите кеш (Ctrl+Shift+Del)' as step2,
    '3. Попробуйте перелогиниться' as step3; 