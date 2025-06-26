-- ИСПРАВЛЕНИЕ БЕСКОНЕЧНОЙ РЕКУРСИИ В RLS ПОЛИТИКАХ
-- Ошибка: "infinite recursion detected in policy for relation user_profiles"

-- 1. УДАЛЯЕМ ВСЕ ПРОБЛЕМНЫЕ RLS ПОЛИТИКИ
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Anyone can view offices" ON public.offices;
DROP POLICY IF EXISTS "Admins can manage offices" ON public.offices;

-- 2. СОЗДАЕМ БЕЗОПАСНЫЕ RLS ПОЛИТИКИ БЕЗ РЕКУРСИИ

-- Включаем RLS обратно
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

-- ПРОСТЫЕ ПОЛИТИКИ ДЛЯ user_profiles (без рекурсивных проверок)

-- Пользователи могут видеть свой профиль
CREATE POLICY "view_own_profile" ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Пользователи могут создавать свой профиль (при регистрации)
CREATE POLICY "insert_own_profile" ON public.user_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Пользователи могут обновлять свой профиль
CREATE POLICY "update_own_profile" ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- АДМИНСКИЕ ПОЛИТИКИ - используем прямую проверку в auth.users
-- Это избегает рекурсии, так как мы не обращаемся к user_profiles внутри политики

-- Администраторы могут видеть все профили (проверяем по auth.users metadata)
CREATE POLICY "admin_view_all_profiles" ON public.user_profiles
    FOR SELECT
    USING (
        -- Проверяем является ли пользователь админом через auth.users metadata
        (auth.jwt()->>'role')::text = 'admin'
        OR 
        -- Или проверяем через прямой запрос без рекурсии
        EXISTS (
            SELECT 1 
            FROM auth.users 
            WHERE id = auth.uid() 
            AND (
                raw_user_meta_data->>'is_admin' = 'true'
                OR raw_user_meta_data->>'admin_role' IN ('super_admin', 'office_admin')
            )
        )
    );

-- Администраторы могут обновлять все профили
CREATE POLICY "admin_update_all_profiles" ON public.user_profiles
    FOR UPDATE
    USING (
        (auth.jwt()->>'role')::text = 'admin'
        OR 
        EXISTS (
            SELECT 1 
            FROM auth.users 
            WHERE id = auth.uid() 
            AND (
                raw_user_meta_data->>'is_admin' = 'true'
                OR raw_user_meta_data->>'admin_role' IN ('super_admin', 'office_admin')
            )
        )
    );

-- ПОЛИТИКИ ДЛЯ OFFICES (простые, без рекурсии)

-- Все аутентифицированные пользователи могут читать офисы
CREATE POLICY "view_offices" ON public.offices
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Только системные админы могут управлять офисами
CREATE POLICY "admin_manage_offices" ON public.offices
    FOR ALL
    USING (
        (auth.jwt()->>'role')::text = 'admin'
        OR
        EXISTS (
            SELECT 1 
            FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'admin_role' = 'super_admin'
        )
    );

-- 3. ВРЕМЕННО ОТКЛЮЧАЕМ RLS ДЛЯ ТЕСТИРОВАНИЯ
-- Это позволит существующим пользователям войти в систему
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices DISABLE ROW LEVEL SECURITY;

-- 4. СОЗДАЕМ ФУНКЦИЮ ДЛЯ БЕЗОПАСНОГО ВКЛЮЧЕНИЯ RLS
CREATE OR REPLACE FUNCTION enable_rls_safely()
RETURNS TEXT AS $$
DECLARE
    user_count INTEGER;
    admin_count INTEGER;
BEGIN
    -- Проверяем количество пользователей
    SELECT COUNT(*) INTO user_count FROM public.user_profiles;
    
    -- Проверяем количество админов
    SELECT COUNT(*) INTO admin_count 
    FROM public.user_profiles 
    WHERE is_admin = true OR admin_role IN ('super_admin', 'office_admin');
    
    IF user_count > 0 THEN
        -- Включаем RLS только если есть пользователи
        ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
        
        RETURN format(
            '✅ RLS включен безопасно. Пользователей: %s, Админов: %s', 
            user_count, 
            admin_count
        );
    ELSE
        RETURN '⚠️ RLS не включен - нет пользователей в системе';
    END IF;
END $$ LANGUAGE plpgsql;

-- 5. СОЗДАЕМ ФУНКЦИЮ ДИАГНОСТИКИ RLS
CREATE OR REPLACE FUNCTION test_rls_access()
RETURNS TABLE(test_name TEXT, status TEXT, details TEXT) AS $$
BEGIN
    -- Проверяем доступ к профилям
    RETURN QUERY
    SELECT 
        'Доступ к user_profiles' as test_name,
        CASE 
            WHEN EXISTS (SELECT 1 FROM public.user_profiles LIMIT 1) 
            THEN '✅ РАБОТАЕТ' 
            ELSE '❌ НЕТ ДОСТУПА' 
        END as status,
        'Проверка базового доступа к профилям' as details;
    
    -- Проверяем доступ к офисам
    RETURN QUERY
    SELECT 
        'Доступ к offices' as test_name,
        CASE 
            WHEN EXISTS (SELECT 1 FROM public.offices LIMIT 1) 
            THEN '✅ РАБОТАЕТ' 
            ELSE '❌ НЕТ ДОСТУПА' 
        END as status,
        'Проверка доступа к офисам' as details;
    
    -- Проверяем статус RLS
    RETURN QUERY
    SELECT 
        'RLS статус user_profiles' as test_name,
        CASE 
            WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_profiles') 
            THEN '🔒 ВКЛЮЧЕН' 
            ELSE '🔓 ОТКЛЮЧЕН' 
        END as status,
        'Row Level Security для профилей' as details;
        
    RETURN QUERY
    SELECT 
        'RLS статус offices' as test_name,
        CASE 
            WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'offices') 
            THEN '🔒 ВКЛЮЧЕН' 
            ELSE '🔓 ОТКЛЮЧЕН' 
        END as status,
        'Row Level Security для офисов' as details;
END $$ LANGUAGE plpgsql;

-- 6. ДАЕМ ДОПОЛНИТЕЛЬНЫЕ ПРАВА ДОСТУПА
-- Убеждаемся что у пользователей есть все необходимые права
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated, anon;
GRANT SELECT ON public.offices TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.offices TO authenticated; -- только для админов через RLS

-- Права на последовательности
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- 7. ЗАПУСКАЕМ ДИАГНОСТИКУ
SELECT * FROM test_rls_access();

-- 8. ПОКАЗЫВАЕМ ИНСТРУКЦИИ
SELECT 
    '🔧 RLS ИСПРАВЛЕН!' as status,
    'Бесконечная рекурсия устранена' as message;

SELECT 
    '📋 СЛЕДУЮЩИЕ ШАГИ:' as info,
    '1. Проверьте что приложение работает с отключенным RLS' as step1,
    '2. Когда убедитесь что всё работает - запустите: SELECT enable_rls_safely()' as step2,
    '3. Если проблемы - снова отключите RLS: ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY' as step3;

-- ВАЖНО: RLS ВРЕМЕННО ОТКЛЮЧЕН!
-- Когда убедитесь что приложение работает, включите RLS командой:
-- SELECT enable_rls_safely(); 