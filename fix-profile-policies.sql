-- Исправление RLS политик для user_profiles
-- Включаем RLS если он отключен
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики если они есть
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;

-- Создаем новые политики
-- Просмотр собственного профиля
CREATE POLICY "Users can view their own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

-- Обновление собственного профиля
CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Создание собственного профиля
CREATE POLICY "Users can insert their own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Проверяем RLS для employees тоже
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики employees
DROP POLICY IF EXISTS "Users can view their own employee record" ON public.employees;
DROP POLICY IF EXISTS "Users can update their own employee record" ON public.employees;

-- Создаем новые политики для employees
CREATE POLICY "Users can view their own employee record" ON public.employees
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own employee record" ON public.employees
    FOR UPDATE USING (auth.uid() = user_id);

-- Политика для админов (позволяет им видеть и редактировать всех)
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can manage all employees" ON public.employees;

CREATE POLICY "Admins can manage all profiles" ON public.user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND email = 'egordolgih@mail.ru'
        )
    );

CREATE POLICY "Admins can manage all employees" ON public.employees
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = auth.users.id 
            AND email = 'egordolgih@mail.ru'
        )
    ); 