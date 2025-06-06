-- ===========================================
-- ИСПРАВЛЕНИЕ ДАННЫХ ВСЕХ СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ
-- ===========================================

-- 1. СОЗДАЕМ НЕДОСТАЮЩИЕ user_profiles ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ
INSERT INTO public.user_profiles (
    id,
    full_name,
    position,
    is_admin,
    work_schedule,
    work_hours,
    role,
    district_id,
    created_at,
    updated_at
)
SELECT 
    au.id,
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        e.full_name,
        au.email,
        'Сотрудник'
    ) as full_name,
    'Сотрудник' as position,
    false as is_admin,
    COALESCE(
        au.raw_user_meta_data->>'work_schedule',
        e.work_schedule,
        '5/2'
    ) as work_schedule,
    COALESCE(
        CASE 
            WHEN COALESCE(au.raw_user_meta_data->>'work_schedule', e.work_schedule, '5/2') = '2/2' THEN 12
            ELSE 9
        END
    ) as work_hours,
    'user' as role,
    COALESCE(
        (au.raw_user_meta_data->>'district_id')::INTEGER,
        e.district_id
    ) as district_id,
    COALESCE(au.created_at, NOW()) as created_at,
    NOW() as updated_at
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
LEFT JOIN public.employees e ON e.user_id = au.id
WHERE up.id IS NULL
ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    work_schedule = COALESCE(EXCLUDED.work_schedule, user_profiles.work_schedule),
    work_hours = COALESCE(EXCLUDED.work_hours, user_profiles.work_hours),
    district_id = COALESCE(EXCLUDED.district_id, user_profiles.district_id),
    updated_at = NOW();

-- 2. СОЗДАЕМ НЕДОСТАЮЩИЕ employees ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ
INSERT INTO public.employees (
    user_id,
    full_name,
    position,
    work_schedule,
    work_hours,
    is_admin,
    is_online,
    district_id,
    created_at,
    updated_at
)
SELECT 
    au.id,
    COALESCE(
        up.full_name,
        au.raw_user_meta_data->>'full_name',
        au.email,
        'Сотрудник'
    ) as full_name,
    'Сотрудник' as position,
    COALESCE(
        up.work_schedule,
        au.raw_user_meta_data->>'work_schedule',
        '5/2'
    ) as work_schedule,
    COALESCE(
        up.work_hours,
        CASE 
            WHEN COALESCE(up.work_schedule, au.raw_user_meta_data->>'work_schedule', '5/2') = '2/2' THEN 12
            ELSE 9
        END
    ) as work_hours,
    COALESCE(up.is_admin, false) as is_admin,
    false as is_online,
    COALESCE(
        up.district_id,
        (au.raw_user_meta_data->>'district_id')::INTEGER
    ) as district_id,
    COALESCE(au.created_at, NOW()) as created_at,
    NOW() as updated_at
FROM auth.users au
LEFT JOIN public.employees e ON e.user_id = au.id
LEFT JOIN public.user_profiles up ON up.id = au.id
WHERE e.id IS NULL
ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, employees.full_name),
    work_schedule = COALESCE(EXCLUDED.work_schedule, employees.work_schedule),
    work_hours = COALESCE(EXCLUDED.work_hours, employees.work_hours),
    district_id = COALESCE(EXCLUDED.district_id, employees.district_id),
    updated_at = NOW();

-- 3. СИНХРОНИЗИРУЕМ district_id МЕЖДУ user_profiles И employees
-- Обновляем user_profiles если у employees есть district_id, а у profiles нет
UPDATE public.user_profiles 
SET 
    district_id = e.district_id,
    updated_at = NOW()
FROM public.employees e
WHERE user_profiles.id = e.user_id 
    AND user_profiles.district_id IS NULL 
    AND e.district_id IS NOT NULL;

-- Обновляем employees если у user_profiles есть district_id, а у employees нет
UPDATE public.employees 
SET 
    district_id = up.district_id,
    updated_at = NOW()
FROM public.user_profiles up
WHERE employees.user_id = up.id 
    AND employees.district_id IS NULL 
    AND up.district_id IS NOT NULL;

-- 4. СИНХРОНИЗИРУЕМ ОСТАЛЬНЫЕ ПОЛЯ МЕЖДУ ТАБЛИЦАМИ
-- Обновляем полные имена если они отличаются
UPDATE public.user_profiles 
SET 
    full_name = e.full_name,
    updated_at = NOW()
FROM public.employees e
WHERE user_profiles.id = e.user_id 
    AND user_profiles.full_name != e.full_name
    AND e.full_name IS NOT NULL
    AND e.full_name != '';

UPDATE public.employees 
SET 
    full_name = up.full_name,
    updated_at = NOW()
FROM public.user_profiles up
WHERE employees.user_id = up.id 
    AND employees.full_name != up.full_name
    AND up.full_name IS NOT NULL
    AND up.full_name != '';

-- 5. ОБНОВЛЯЕМ ПОЛЯ role И is_admin ПО УМОЛЧАНИЮ
UPDATE public.user_profiles 
SET 
    role = 'user',
    updated_at = NOW()
WHERE role IS NULL;

UPDATE public.user_profiles 
SET 
    is_admin = false,
    updated_at = NOW()
WHERE is_admin IS NULL;

-- 6. ПРОВЕРЯЕМ РЕЗУЛЬТАТЫ ИСПРАВЛЕНИЯ
SELECT 'РЕЗУЛЬТАТЫ ИСПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЕЙ:' as info;

SELECT 'Общая статистика ПОСЛЕ исправления:' as info;
SELECT 
    'auth.users' as table_name,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as count
FROM public.user_profiles
UNION ALL
SELECT 
    'employees' as table_name,
    COUNT(*) as count
FROM public.employees;

-- Показываем пользователей БЕЗ округов (которые нужно будет исправить вручную)
SELECT 'ПОЛЬЗОВАТЕЛИ БЕЗ ОКРУГОВ (требуют ручного исправления):' as info;
SELECT 
    au.email,
    au.id::text as user_id,
    up.full_name,
    'Нужно выбрать округ' as action
FROM auth.users au
JOIN public.user_profiles up ON up.id = au.id
JOIN public.employees e ON e.user_id = au.id
WHERE up.district_id IS NULL AND e.district_id IS NULL
ORDER BY au.created_at;

-- Показываем итоговую статистику
SELECT 'ИТОГОВАЯ СТАТИСТИКА:' as info;
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN up.id IS NOT NULL THEN 1 END) as users_with_profiles,
    COUNT(CASE WHEN e.id IS NOT NULL THEN 1 END) as users_with_employees,
    COUNT(CASE WHEN up.district_id IS NOT NULL OR e.district_id IS NOT NULL THEN 1 END) as users_with_districts,
    COUNT(CASE WHEN up.id IS NOT NULL AND e.id IS NOT NULL THEN 1 END) as complete_users
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
LEFT JOIN public.employees e ON e.user_id = au.id;

SELECT 'ИСПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЕЙ ЗАВЕРШЕНО ✅' as status; 