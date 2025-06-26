-- УЛЬТРА-ПРОСТОЕ ИСПРАВЛЕНИЕ ДЛЯ ТАНИ

-- Создаем профиль для Тани если его нет
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
) 
SELECT 
    'ca465c0e-6317-4666-b277-b45f9cbeedae',
    COALESCE(au.email, 'tanya@example.com'),
    'Таня',
    'Сотрудник',
    '5/2',
    9,
    COALESCE((SELECT id FROM public.offices WHERE name = 'Рассвет' LIMIT 1), 1),
    false,
    'user',
    'user',
    true,
    0,
    0,
    1,
    '[]'::jsonb,
    COALESCE(au.created_at, NOW()),
    NOW(),
    NOW()
FROM auth.users au
WHERE au.id = 'ca465c0e-6317-4666-b277-b45f9cbeedae'
AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = 'ca465c0e-6317-4666-b277-b45f9cbeedae'
);

-- Проверяем результат
SELECT 
    '✅ ПРОФИЛЬ ТАНИ' as status,
    id,
    email,
    full_name,
    office_id,
    employee_id,
    created_at
FROM public.user_profiles 
WHERE id = 'ca465c0e-6317-4666-b277-b45f9cbeedae';

SELECT '🔄 ТАНЯ, ОБНОВИТЕ СТРАНИЦУ!' as message; 