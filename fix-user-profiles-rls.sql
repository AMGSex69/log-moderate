-- Исправление RLS политик для user_profiles

-- 1. Проверяем текущие политики
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'user_profiles';

-- 2. Проверяем структуру таблицы user_profiles
\d public.user_profiles;

-- 3. Удаляем старые политики (если есть проблемы)
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- 4. Создаем правильные RLS политики
-- Политика для просмотра собственного профиля
CREATE POLICY "Users can view own profile" ON public.user_profiles
FOR SELECT USING (auth.uid() = id);

-- Политика для обновления собственного профиля  
CREATE POLICY "Users can update own profile" ON public.user_profiles
FOR UPDATE USING (auth.uid() = id);

-- Политика для вставки профиля при регистрации
CREATE POLICY "Users can insert own profile" ON public.user_profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Убеждаемся что RLS включен
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 6. Проверяем подключение к auth.users
SELECT 
    up.id,
    up.full_name,
    up.work_schedule,
    up.work_hours,
    u.email
FROM public.user_profiles up
LEFT JOIN auth.users u ON u.id = up.id
LIMIT 5;

-- 7. Проверяем что нет проблем с индексами
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' AND tablename = 'user_profiles';

-- 8. Создаем недостающий индекс если нужно
CREATE INDEX IF NOT EXISTS user_profiles_id_idx ON public.user_profiles(id);

-- 9. Показываем все профили для отладки
SELECT id, full_name, email, work_schedule, work_hours, created_at
FROM public.user_profiles
ORDER BY created_at DESC; 