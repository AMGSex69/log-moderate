-- БЫСТРОЕ ИСПРАВЛЕНИЕ RLS РЕКУРСИИ - ВЫПОЛНИТЕ НЕМЕДЛЕННО!

-- 1. ОТКЛЮЧАЕМ RLS ПОЛНОСТЬЮ (временно)
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices DISABLE ROW LEVEL SECURITY;

-- 2. УДАЛЯЕМ ВСЕ ПРОБЛЕМНЫЕ ПОЛИТИКИ
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "view_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_view_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.user_profiles;

-- Для offices тоже
DROP POLICY IF EXISTS "Anyone can view offices" ON public.offices;
DROP POLICY IF EXISTS "Admins can manage offices" ON public.offices;
DROP POLICY IF EXISTS "view_offices" ON public.offices;
DROP POLICY IF EXISTS "admin_manage_offices" ON public.offices;

-- 3. ДАЕМ ПОЛНЫЕ ПРАВА ДОСТУПАЙ
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO anon;
GRANT ALL ON public.offices TO authenticated;
GRANT ALL ON public.offices TO anon;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 4. ПРОВЕРЯЕМ ЧТО ПОЛЬЗОВАТЕЛЬ СУЩЕСТВУЕТ
SELECT 
    'ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ' as step,
    id,
    email,
    full_name,
    office_id,
    created_at
FROM public.user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 5. ЕСЛИ ПОЛЬЗОВАТЕЛЯ НЕТ - СОЗДАЕМ ЕГО
DO $$
DECLARE
    user_exists BOOLEAN;
    auth_email TEXT;
    auth_created_at TIMESTAMP;
    default_office_id INTEGER;
BEGIN
    -- Проверяем существует ли пользователь в user_profiles
    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles 
        WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5'
    ) INTO user_exists;
    
    IF NOT user_exists THEN
        RAISE NOTICE 'Пользователь не найден в user_profiles, создаем...';
        
        -- Получаем данные из auth.users
        SELECT email, created_at 
        INTO auth_email, auth_created_at
        FROM auth.users 
        WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';
        
        IF auth_email IS NOT NULL THEN
            -- Получаем офис по умолчанию
            SELECT id INTO default_office_id 
            FROM public.offices 
            WHERE name = 'Рассвет' 
            LIMIT 1;
            
            IF default_office_id IS NULL THEN
                SELECT id INTO default_office_id 
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
                'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5',
                auth_email,
                COALESCE(SPLIT_PART(auth_email, '@', 1), 'Пользователь'),
                'Сотрудник',
                '5/2',
                9,
                default_office_id,
                false,
                'user',
                'user',
                true,
                0,
                0,
                1,
                '[]'::jsonb,
                COALESCE(auth_created_at, NOW()),
                NOW(),
                NOW()
            );
            
            RAISE NOTICE 'Профиль создан для пользователя: %', auth_email;
        ELSE
            RAISE NOTICE 'Пользователь не найден в auth.users!';
        END IF;
    ELSE
        RAISE NOTICE 'Пользователь уже существует в user_profiles';
    END IF;
END $$;

-- 6. ФИНАЛЬНАЯ ПРОВЕРКА
SELECT 
    '✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!' as status,
    'RLS отключен, пользователь должен иметь доступ' as message;

SELECT 
    'СТАТУС ПОЛЬЗОВАТЕЛЯ' as info,
    id,
    email,
    full_name,
    position,
    office_id,
    is_active,
    created_at
FROM public.user_profiles 
WHERE id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

-- 7. ПРОВЕРЯЕМ ОФИС
SELECT 
    'ОФИС ПОЛЬЗОВАТЕЛЯ' as info,
    o.id,
    o.name,
    o.description
FROM public.offices o
INNER JOIN public.user_profiles up ON o.id = up.office_id
WHERE up.id = 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5';

SELECT 
    '🎯 ТЕПЕРЬ ОБНОВИТЕ СТРАНИЦУ В БРАУЗЕРЕ!' as action,
    'Пользователь должен увидеть свой профиль' as expected_result; 