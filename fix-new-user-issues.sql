-- ===========================================
-- ИСПРАВЛЕНИЕ ПРОБЛЕМ С НОВЫМИ ПОЛЬЗОВАТЕЛЯМИ
-- ===========================================

-- 1. ДИАГНОСТИКА ТЕКУЩИХ ПРОБЛЕМ
DO $$ 
BEGIN
    RAISE NOTICE 'Диагностика проблем для новых пользователей...';
END $$;

-- Проверяем RLS политики
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    CASE WHEN rowsecurity THEN 'ВКЛЮЧЕНА' ELSE 'ВЫКЛЮЧЕНА' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('employees', 'work_sessions', 'task_logs')
ORDER BY tablename;

-- 2. ИСПРАВЛЯЕМ RLS ПОЛИТИКИ ДЛЯ EMPLOYEES
DO $$
BEGIN
    -- Удаляем проблемные политики
    DROP POLICY IF EXISTS "Users can view their own employee record" ON public.employees;
    DROP POLICY IF EXISTS "Users can update their own employee record" ON public.employees;
    DROP POLICY IF EXISTS "Service role can create employees" ON public.employees;
    DROP POLICY IF EXISTS "Auth system can create employees" ON public.employees;
    
    -- Создаем исправленные политики
    CREATE POLICY "Users can view their employee record"
        ON public.employees FOR SELECT
        USING (user_id = auth.uid() OR auth.role() = 'service_role');
    
    CREATE POLICY "Users can update their employee record"
        ON public.employees FOR UPDATE
        USING (user_id = auth.uid() OR auth.role() = 'service_role');
        
    CREATE POLICY "System can create employees"
        ON public.employees FOR INSERT
        WITH CHECK (true); -- Разрешаем создание для аутентифицированных пользователей
        
    CREATE POLICY "System can delete employees"
        ON public.employees FOR DELETE
        USING (auth.role() = 'service_role');

    RAISE NOTICE 'RLS политики для employees исправлены';
END $$;

-- 3. ИСПРАВЛЯЕМ RLS ПОЛИТИКИ ДЛЯ WORK_SESSIONS
DO $$
BEGIN
    -- Удаляем проблемные политики
    DROP POLICY IF EXISTS "Users can view their own work sessions" ON public.work_sessions;
    DROP POLICY IF EXISTS "Users can manage their own work sessions" ON public.work_sessions;
    
    -- Создаем исправленные политики
    CREATE POLICY "Users can view their work sessions"
        ON public.work_sessions FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.employees e 
                WHERE e.id = work_sessions.employee_id 
                AND e.user_id = auth.uid()
            ) OR auth.role() = 'service_role'
        );
    
    CREATE POLICY "Users can manage their work sessions"
        ON public.work_sessions FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM public.employees e 
                WHERE e.id = work_sessions.employee_id 
                AND e.user_id = auth.uid()
            ) OR auth.role() = 'service_role'
        );

    RAISE NOTICE 'RLS политики для work_sessions исправлены';
END $$;

-- 4. СОЗДАЕМ ОТСУТСТВУЮЩУЮ ФУНКЦИЮ ЛИДЕРБОРДА
CREATE OR REPLACE FUNCTION public.get_leaderboard_with_current_user(current_user_id UUID)
RETURNS TABLE (
    rank BIGINT,
    name TEXT,
    score TEXT,
    is_current_user BOOLEAN
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH weekly_stats AS (
        SELECT 
            e.id,
            e.user_id,
            COALESCE(up.full_name, 'Пользователь') as full_name,
            COUNT(tl.id) as tasks_completed,
            SUM(COALESCE(tl.units_completed, 0)) as total_units,
            SUM(COALESCE(tl.time_spent_minutes, 0)) as total_minutes,
            SUM(
                CASE 
                    WHEN tt.name = 'Решения МЖИ' THEN COALESCE(tl.units_completed, 0) * 15
                    WHEN tt.name = 'Протоколы МЖИ' THEN COALESCE(tl.units_completed, 0) * 10
                    WHEN tt.name = 'Обзвоны' THEN COALESCE(tl.units_completed, 0) * 8
                    WHEN tt.name = 'Обходы' THEN COALESCE(tl.units_completed, 0) * 12
                    WHEN tt.name = 'Актуализация' THEN COALESCE(tl.units_completed, 0) * 5
                    WHEN tt.name = 'Протоколы' THEN COALESCE(tl.units_completed, 0) * 7
                    WHEN tt.name = 'Отчёты' THEN COALESCE(tl.units_completed, 0) * 10
                    WHEN tt.name = 'Опросы' THEN COALESCE(tl.units_completed, 0) * 6
                    WHEN tt.name = 'Модерация ОСС' THEN COALESCE(tl.units_completed, 0) * 8
                    WHEN tt.name = 'Модерация чатов' THEN COALESCE(tl.units_completed, 0) * 6
                    ELSE COALESCE(tl.units_completed, 0) * 5
                END
            ) as total_score
        FROM public.employees e
        LEFT JOIN public.user_profiles up ON e.user_id = up.id
        LEFT JOIN public.task_logs tl ON e.id = tl.employee_id 
            AND tl.work_date >= CURRENT_DATE - INTERVAL '7 days'
        LEFT JOIN public.task_types tt ON tl.task_type_id = tt.id
        GROUP BY e.id, e.user_id, up.full_name
    ),
    ranked_stats AS (
        SELECT 
            ROW_NUMBER() OVER (ORDER BY total_score DESC, full_name) as user_rank,
            full_name,
            total_score,
            user_id
        FROM weekly_stats
        WHERE total_score > 0
    ),
    top_5 AS (
        SELECT 
            user_rank as rank, 
            full_name as name, 
            total_score::text as score, 
            (user_id = current_user_id) as is_current_user
        FROM ranked_stats
        WHERE user_rank <= 5
    ),
    current_user_stats AS (
        SELECT 
            user_rank as rank, 
            CASE WHEN user_id = current_user_id THEN 'Вы' ELSE full_name END as name, 
            total_score::text as score,
            true as is_current_user
        FROM ranked_stats
        WHERE user_id = current_user_id AND user_rank > 5
        LIMIT 1
    )
    SELECT * FROM top_5
    UNION ALL
    SELECT * FROM current_user_stats
    ORDER BY rank;
END $$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_leaderboard_with_current_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_with_current_user(UUID) TO anon;

-- 5. ИСПРАВЛЯЕМ ФУНКЦИЮ СОЗДАНИЯ EMPLOYEE
CREATE OR REPLACE FUNCTION public.ensure_employee_exists(user_id UUID)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    existing_employee_id INTEGER;
    new_employee_id INTEGER;
    user_name TEXT;
BEGIN
    -- Сначала проверяем существующего employee
    SELECT id INTO existing_employee_id
    FROM public.employees
    WHERE employees.user_id = ensure_employee_exists.user_id;
    
    IF existing_employee_id IS NOT NULL THEN
        RETURN existing_employee_id;
    END IF;
    
    -- Получаем имя пользователя
    SELECT COALESCE(full_name, email, 'Новый пользователь') INTO user_name
    FROM public.user_profiles
    WHERE id = ensure_employee_exists.user_id;
    
    -- Создаем нового employee
    INSERT INTO public.employees (user_id, full_name, position, created_at)
    VALUES (
        ensure_employee_exists.user_id,
        COALESCE(user_name, 'Новый пользователь'),
        'Сотрудник',
        NOW()
    )
    RETURNING id INTO new_employee_id;
    
    RETURN new_employee_id;
    
EXCEPTION WHEN OTHERS THEN
    -- Возвращаем NULL при ошибке
    RETURN NULL;
END $$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.ensure_employee_exists(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_employee_exists(UUID) TO anon;

-- 6. СОЗДАЕМ ФУНКЦИЮ БЕЗОПАСНОГО ПОЛУЧЕНИЯ EMPLOYEE_ID
CREATE OR REPLACE FUNCTION public.get_or_create_employee_id(user_id UUID)
RETURNS TABLE (employee_id INTEGER, error_message TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    found_employee_id INTEGER;
    user_name TEXT;
BEGIN
    -- Проверяем существующего employee
    SELECT id INTO found_employee_id
    FROM public.employees
    WHERE employees.user_id = get_or_create_employee_id.user_id;
    
    IF found_employee_id IS NOT NULL THEN
        RETURN QUERY SELECT found_employee_id, NULL::TEXT;
        RETURN;
    END IF;
    
    -- Получаем данные пользователя
    SELECT COALESCE(full_name, email, 'Новый пользователь') INTO user_name
    FROM public.user_profiles
    WHERE id = get_or_create_employee_id.user_id;
    
    -- Создаем нового employee
    INSERT INTO public.employees (user_id, full_name, position, created_at)
    VALUES (
        get_or_create_employee_id.user_id,
        COALESCE(user_name, 'Новый пользователь'),
        'Сотрудник',
        NOW()
    )
    RETURNING id INTO found_employee_id;
    
    RETURN QUERY SELECT found_employee_id, NULL::TEXT;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT NULL::INTEGER, SQLERRM;
END $$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.get_or_create_employee_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_employee_id(UUID) TO anon;

-- 7. ПРОВЕРЯЕМ И ИСПРАВЛЯЕМ ТРИГГЕР
-- ВАЖНО: Сначала удаляем триггер, потом функцию!
DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
    user_email TEXT;
    user_name TEXT;
BEGIN
    -- Получаем email из auth.users
    user_email := COALESCE(NEW.email, 'user@example.com');
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(user_email, '@', 1));
    
    -- Создаем профиль пользователя
    INSERT INTO public.user_profiles (
        id, 
        email, 
        full_name, 
        position,
        is_admin,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        user_email,
        user_name,
        'Сотрудник',
        false,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(user_profiles.full_name, EXCLUDED.full_name),
        updated_at = NOW();
    
    -- Создаем employee запись
    INSERT INTO public.employees (
        user_id,
        full_name,
        position,
        created_at
    ) VALUES (
        NEW.id,
        user_name,
        'Сотрудник',
        NOW()
    ) ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Логируем ошибку, но не блокируем регистрацию
    RAISE WARNING 'Ошибка создания профиля для пользователя %: %', NEW.id, SQLERRM;
    RETURN NEW;
END $$;

-- Создаем триггер
CREATE TRIGGER on_auth_user_created_create_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. ФИНАЛЬНАЯ ПРОВЕРКА
DO $$ 
BEGIN
    RAISE NOTICE 'Проверяем созданные объекты...';
    
    -- Проверяем функции
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_leaderboard_with_current_user') THEN
        RAISE NOTICE '✅ Функция get_leaderboard_with_current_user создана';
    ELSE
        RAISE NOTICE '❌ Функция get_leaderboard_with_current_user НЕ создана';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_or_create_employee_id') THEN
        RAISE NOTICE '✅ Функция get_or_create_employee_id создана';
    ELSE
        RAISE NOTICE '❌ Функция get_or_create_employee_id НЕ создана';
    END IF;
    
    -- Проверяем триггер
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_create_profile') THEN
        RAISE NOTICE '✅ Триггер on_auth_user_created_create_profile создан';
    ELSE
        RAISE NOTICE '❌ Триггер on_auth_user_created_create_profile НЕ создан';
    END IF;
    
    RAISE NOTICE 'Исправление проблем завершено!';
END $$; 