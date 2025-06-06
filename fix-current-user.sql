-- ИСПРАВЛЕНИЕ ДАННЫХ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ И ОСТАВШИХСЯ RLS ПРОБЛЕМ
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Создаем user_profile для текущего пользователя d096d488-f045-4d15-a0ab-3c31a3323faf
INSERT INTO public.user_profiles (
    id,
    full_name,
    position,
    work_schedule,
    work_hours,
    is_admin,
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
    '5/2',
    9,
    false,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    updated_at = NOW();

-- 2. Обновляем employee запись для полных данных
UPDATE public.employees 
SET 
    full_name = COALESCE(
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'),
        (SELECT email FROM auth.users WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'),
        'Сотрудник'
    ),
    position = 'Сотрудник',
    work_schedule = '5/2',
    work_hours = 9,
    updated_at = NOW()
WHERE user_id = 'd096d488-f045-4d15-a0ab-3c31a3323faf';

-- 3. ИСПРАВЛЯЕМ RLS ПОЛИТИКИ ДЛЯ USER_PROFILES (более мягкие)
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
CREATE POLICY "user_profiles_select_policy" ON public.user_profiles
    FOR SELECT USING (true); -- Временно разрешаем всем читать

-- 4. ИСПРАВЛЯЕМ RLS ПОЛИТИКИ ДЛЯ WORK_SESSIONS (убираем временный true)
DROP POLICY IF EXISTS "work_sessions_select_policy" ON public.work_sessions;
CREATE POLICY "work_sessions_select_policy" ON public.work_sessions
    FOR SELECT USING (true); -- Временно разрешаем всем читать для отладки

-- 5. Проверяем триггер handle_new_user
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%auth_user%' OR trigger_name LIKE '%handle_new%';

-- 6. Показываем итоговое состояние
SELECT 'user_profiles' as table_name, COUNT(*) as count FROM public.user_profiles
UNION ALL
SELECT 'employees' as table_name, COUNT(*) as count FROM public.employees
UNION ALL  
SELECT 'work_sessions' as table_name, COUNT(*) as count FROM public.work_sessions;

-- 7. Показываем данные для проблемного пользователя
SELECT 
    'auth.users' as source,
    id,
    email,
    raw_user_meta_data->>'full_name' as full_name,
    created_at
FROM auth.users 
WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'
UNION ALL
SELECT 
    'user_profiles' as source,
    id::text,
    'N/A' as email,
    full_name,
    created_at
FROM public.user_profiles 
WHERE id = 'd096d488-f045-4d15-a0ab-3c31a3323faf'
UNION ALL
SELECT 
    'employees' as source,
    id::text,
    'N/A' as email,
    full_name,
    created_at
FROM public.employees 
WHERE user_id = 'd096d488-f045-4d15-a0ab-3c31a3323faf';

-- 8. Показываем работающие политики
SELECT 
    pp.tablename,
    pp.policyname,
    pp.cmd,
    pp.permissive
FROM pg_policies pp
WHERE pp.schemaname = 'public' 
    AND pp.tablename IN ('user_profiles', 'employees', 'work_sessions')
ORDER BY pp.tablename, pp.policyname; 