-- Исправление доступа к user_profiles - решение проблемы 403 ошибок
-- Этот скрипт должен быть выполнен в Supabase SQL Editor

-- Сначала отключаем RLS временно для очистки
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;

-- Удаляем ВСЕ существующие политики для чистого старта
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Удаляем все политики для user_profiles
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'user_profiles' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.schemaname || '.' || r.tablename;
    END LOOP;
    
    -- Удаляем все политики для employees
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'employees' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.schemaname || '.' || r.tablename;
    END LOOP;
END $$;

-- Включаем RLS обратно
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Создаем простые и надежные политики для user_profiles
-- Политика для просмотра своего профиля
CREATE POLICY "user_profiles_select_own" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- Политика для обновления своего профиля  
CREATE POLICY "user_profiles_update_own" ON public.user_profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Политика для создания своего профиля
CREATE POLICY "user_profiles_insert_own" ON public.user_profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

-- Политика для админа (полный доступ)
CREATE POLICY "user_profiles_admin_all" ON public.user_profiles
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.email = 'egordolgih@mail.ru'
        )
    );

-- Аналогичные политики для employees
CREATE POLICY "employees_select_own" ON public.employees
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "employees_update_own" ON public.employees
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "employees_insert_own" ON public.employees
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "employees_admin_all" ON public.employees
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.email = 'egordolgih@mail.ru'
        )
    );

-- Проверяем, что политики созданы
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'employees')
ORDER BY tablename, policyname;

-- Проверяем, что RLS включен
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'employees'); 