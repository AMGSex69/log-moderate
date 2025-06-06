-- ИСПРАВЛЕНИЕ ДАННЫХ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ (СОГЛАСНО РЕАЛЬНОЙ СХЕМЕ БД)
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Создаем user_profile для текущего пользователя (согласно реальной схеме)
INSERT INTO public.user_profiles (
    id,
    full_name,
    position,
    is_admin,
    work_schedule,
    work_hours,
    role,
    created_at,
    updated_at
) VALUES (
    'd096d488-f045-4d15-a0ab-3c31a3323faf',
    COALESCE(
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'),
        (SELECT email FROM auth.users WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'),
        'Сотрудник'
    ),
    'Сотрудник',
    false,
    '5/2',
    9,
    'user',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    updated_at = NOW();

-- 2. Обновляем employee запись с полными данными (согласно реальной схеме)
UPDATE public.employees 
SET 
    full_name = COALESCE(
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'),
        (SELECT email FROM auth.users WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'),
        'Сотрудник'
    ),
    email = (SELECT email FROM auth.users WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'),
    position = 'Сотрудник',
    work_schedule = '5/2',
    work_hours = 9,
    is_online = false,
    updated_at = NOW()
WHERE user_id = 'd096d488-f045-4d15-a0ab-3c31a3323faf';

-- 3. ИСПРАВЛЯЕМ RLS ПОЛИТИКИ ДЛЯ USER_PROFILES (более мягкие)
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
CREATE POLICY "user_profiles_select_policy" ON public.user_profiles
    FOR SELECT USING (true); -- Временно разрешаем всем читать

-- 4. ИСПРАВЛЯЕМ RLS ПОЛИТИКИ ДЛЯ WORK_SESSIONS 
DROP POLICY IF EXISTS "work_sessions_select_policy" ON public.work_sessions;
CREATE POLICY "work_sessions_select_policy" ON public.work_sessions
    FOR SELECT USING (true); -- Временно разрешаем всем читать для отладки

-- 5. Проверяем структуру таблиц
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN ('user_profiles', 'employees', 'work_sessions')
    AND column_name IN ('id', 'user_id', 'full_name', 'email', 'is_online', 'district_id', 'role')
ORDER BY table_name, column_name;

-- 6. Показываем итоговое состояние таблиц
SELECT 'user_profiles' as table_name, COUNT(*) as count FROM public.user_profiles
UNION ALL
SELECT 'employees' as table_name, COUNT(*) as count FROM public.employees
UNION ALL  
SELECT 'work_sessions' as table_name, COUNT(*) as count FROM public.work_sessions
UNION ALL
SELECT 'districts' as table_name, COUNT(*) as count FROM public.districts;

-- 7. Показываем данные для проблемного пользователя
SELECT 
    'auth.users' as source,
    id::text,
    email,
    raw_user_meta_data->>'full_name' as full_name,
    created_at::text
FROM auth.users 
WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'
UNION ALL
SELECT 
    'user_profiles' as source,
    id::text,
    'N/A' as email,
    full_name,
    created_at::text
FROM public.user_profiles 
WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'
UNION ALL
SELECT 
    'employees' as source,
    id::text,
    email,
    full_name,
    created_at::text
FROM public.employees 
WHERE user_id = 'd096d488-f045-4d15-a0ab-3c31a3323faf';

-- 8. Показываем активные работающие сессии
SELECT 
    ws.id,
    ws.employee_id,
    e.full_name,
    e.email,
    ws.date,
    ws.clock_in_time,
    ws.clock_out_time,
    ws.is_active
FROM public.work_sessions ws
JOIN public.employees e ON e.id = ws.employee_id
WHERE ws.date = CURRENT_DATE
    AND ws.is_active = true
ORDER BY ws.clock_in_time DESC;

-- 9. Показываем работающие RLS политики
SELECT 
    pp.tablename,
    pp.policyname,
    pp.cmd,
    pp.permissive
FROM pg_policies pp
WHERE pp.schemaname = 'public' 
    AND pp.tablename IN ('user_profiles', 'employees', 'work_sessions')
ORDER BY pp.tablename, pp.policyname;

-- 10. Проверяем триггеры
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%auth_user%' OR trigger_name LIKE '%handle_new%'; 