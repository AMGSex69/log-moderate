-- 🚀 Быстрое исправление кнопки "Начать рабочий день"
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Исправляем RLS политики user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

CREATE POLICY "Users can view own profile" ON public.user_profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Создаем профиль для текущего пользователя если отсутствует
INSERT INTO public.user_profiles (
    id, 
    full_name, 
    email,
    work_schedule, 
    work_hours,
    position,
    is_admin,
    is_online,
    created_at,
    updated_at
) VALUES (
    auth.uid(),
    COALESCE(
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = auth.uid()),
        (SELECT email FROM auth.users WHERE id = auth.uid()),
        'Пользователь'
    ),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    '8+1',
    8,
    'Сотрудник',
    false,
    false,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW(),
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    email = COALESCE(EXCLUDED.email, user_profiles.email);

-- 3. Создаем employee если отсутствует
INSERT INTO public.employees (
    user_id,
    full_name,
    position,
    work_schedule,
    work_hours,
    is_admin,
    is_online,
    created_at,
    updated_at
) VALUES (
    auth.uid(),
    COALESCE(
        (SELECT full_name FROM public.user_profiles WHERE id = auth.uid()),
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = auth.uid()),
        'Сотрудник'
    ),
    'Сотрудник',
    '8+1',
    8,
    false,
    false,
    NOW(),
    NOW()
) ON CONFLICT (user_id) DO UPDATE SET
    updated_at = NOW(),
    full_name = COALESCE(EXCLUDED.full_name, employees.full_name);

-- 4. Проверяем результат
SELECT 'SUCCESS: Profile created/updated' as status, * FROM public.user_profiles WHERE id = auth.uid();
SELECT 'SUCCESS: Employee created/updated' as status, * FROM public.employees WHERE user_id = auth.uid();

-- 5. Показываем текущего пользователя для отладки
SELECT 'Current user ID:' as info, auth.uid() as user_id;
SELECT 'Auth user email:' as info, email FROM auth.users WHERE id = auth.uid(); 