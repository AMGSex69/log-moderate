-- ОКОНЧАТЕЛЬНОЕ ИСПРАВЛЕНИЕ ПРОБЛЕМ С РЕГИСТРАЦИЕЙ ПОЛЬЗОВАТЕЛЕЙ
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard

-- 1. Проверяем и создаем таблицу user_profiles с корректной структурой
DROP TABLE IF EXISTS public.user_profiles CASCADE;
CREATE TABLE public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    position TEXT DEFAULT 'Сотрудник',
    is_admin BOOLEAN DEFAULT false,
    role TEXT DEFAULT 'user',
    work_schedule TEXT DEFAULT '5/2',
    work_hours INTEGER DEFAULT 9,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Создаем или обновляем таблицу employees с корректной структурой
DROP TABLE IF EXISTS public.employees CASCADE;
CREATE TABLE public.employees (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    employee_number TEXT UNIQUE,
    full_name TEXT NOT NULL,
    position TEXT DEFAULT 'Сотрудник',
    is_admin BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    work_schedule TEXT DEFAULT '5/2',
    work_hours INTEGER DEFAULT 9,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Создаем безопасные RLS политики для user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Удаляем все старые политики
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.user_profiles;

-- Создаем новые безопасные политики
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- 4. RLS политики для employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Удаляем все старые политики
DROP POLICY IF EXISTS "Users can view own employee record" ON public.employees;
DROP POLICY IF EXISTS "Users can insert own employee record" ON public.employees;
DROP POLICY IF EXISTS "Users can update own employee record" ON public.employees;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.employees;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.employees;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.employees;

-- Создаем новые политики
CREATE POLICY "Users can view own employee record" ON public.employees
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own employee record" ON public.employees
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own employee record" ON public.employees
    FOR UPDATE USING (auth.uid() = user_id);

-- 5. Функция для безопасного создания профиля пользователя
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_full_name TEXT;
    user_work_schedule TEXT;
    user_work_hours INTEGER;
    employee_num TEXT;
BEGIN
    -- Получаем данные из метаданных пользователя
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.email,
        'Новый пользователь'
    );
    
    user_work_schedule := COALESCE(
        NEW.raw_user_meta_data->>'work_schedule',
        '5/2'
    );
    
    user_work_hours := CASE 
        WHEN user_work_schedule = '2/2' THEN 12
        ELSE 9
    END;

    -- Генерируем номер сотрудника
    employee_num := 'EMP-' || LPAD(nextval('employees_id_seq')::TEXT, 4, '0');

    -- Создаем профиль пользователя
    INSERT INTO public.user_profiles (
        id, 
        full_name, 
        position, 
        is_admin, 
        role, 
        work_schedule, 
        work_hours, 
        is_online,
        created_at,
        updated_at
    ) VALUES (
        NEW.id, 
        user_full_name, 
        'Сотрудник', 
        false, 
        'user', 
        user_work_schedule, 
        user_work_hours, 
        false,
        NOW(),
        NOW()
    );

    -- Создаем запись сотрудника
    INSERT INTO public.employees (
        user_id, 
        employee_number, 
        full_name, 
        position, 
        is_admin, 
        is_active, 
        work_schedule, 
        work_hours, 
        is_online,
        created_at,
        updated_at
    ) VALUES (
        NEW.id, 
        employee_num, 
        user_full_name, 
        'Сотрудник', 
        false, 
        true, 
        user_work_schedule, 
        user_work_hours, 
        false,
        NOW(),
        NOW()
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Детальное логирование ошибки
        RAISE WARNING 'Error in handle_new_user for user %: % %', NEW.id, SQLSTATE, SQLERRM;
        -- Не прерываем регистрацию, но возвращаем ошибку
        RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Удаляем старые триггеры и создаем новый
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_user_profile_created ON public.user_profiles;

-- Создаем триггер для автоматического создания профиля при регистрации
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- 7. Проверяем что таблица task_types существует
CREATE TABLE IF NOT EXISTS public.task_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    measurement_unit TEXT DEFAULT 'штук',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Добавляем базовые типы задач если их нет
INSERT INTO public.task_types (name, description, measurement_unit) VALUES
    ('Актуализация ОСС', 'Обновление данных ОСС', 'штук'),
    ('Обзвоны по рисовке', 'Телефонные звонки', 'штук'),
    ('Входящие звонки', 'Прием входящих звонков', 'штук'),
    ('Работа с посетителями', 'Обслуживание посетителей', 'штук'),
    ('Проверка документов ОСС', 'Проверка документации', 'штук')
ON CONFLICT (name) DO NOTHING;

-- 8. Создаем таблицы для сессий если их нет
CREATE TABLE IF NOT EXISTS public.active_sessions (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES public.employees(id) ON DELETE CASCADE,
    task_type_id INTEGER REFERENCES public.task_types(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. RLS для всех таблиц
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Политики для task_types (все могут читать)
CREATE POLICY "Anyone can view task types" ON public.task_types FOR SELECT USING (true);

-- Политики для active_sessions (только свои)
CREATE POLICY "Users can view own sessions" ON public.active_sessions 
    FOR SELECT USING (employee_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own sessions" ON public.active_sessions 
    FOR INSERT WITH CHECK (employee_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update own sessions" ON public.active_sessions 
    FOR UPDATE USING (employee_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
    ));

-- 10. Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_employee_id ON public.active_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_is_active ON public.active_sessions(is_active);

-- 11. Функция для получения следующего номера сотрудника
CREATE OR REPLACE FUNCTION public.get_next_employee_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(employee_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.employees 
    WHERE employee_number LIKE 'EMP-%';
    
    RETURN 'EMP-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 12. Добавляем права на выполнение функций
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_employee_number() TO authenticated;

-- 13. Проверяем что все права выданы
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.employees TO authenticated;
GRANT ALL ON public.task_types TO authenticated;
GRANT ALL ON public.active_sessions TO authenticated;
GRANT USAGE ON SEQUENCE employees_id_seq TO authenticated;

-- Завершаем транзакцию
COMMIT;

-- Диагностическая информация
SELECT 'Registration fix script completed successfully' AS status;
SELECT COUNT(*) AS user_profiles_count FROM public.user_profiles;
SELECT COUNT(*) AS employees_count FROM public.employees;
SELECT COUNT(*) AS task_types_count FROM public.task_types;

-- СОЗДАНИЕ ПРЕДСТАВЛЕНИЯ ДЛЯ ЛИДЕРОВ
CREATE OR REPLACE VIEW public.leaderboard AS
WITH weekly_stats AS (
    SELECT 
        e.id,
        up.full_name,
        COUNT(tl.id) as tasks_completed,
        SUM(tl.units_completed) as total_units,
        SUM(tl.time_spent_minutes) as total_minutes,
        -- Рассчитываем очки на основе конфигурации игры
        SUM(
            CASE 
                WHEN tt.name = 'Решения МЖИ' THEN tl.units_completed * 15
                WHEN tt.name = 'Протоколы МЖИ' THEN tl.units_completed * 10
                WHEN tt.name = 'Обзвоны' THEN tl.units_completed * 8
                WHEN tt.name = 'Обходы' THEN tl.units_completed * 12
                WHEN tt.name = 'Актуализация' THEN tl.units_completed * 5
                WHEN tt.name = 'Протоколы' THEN tl.units_completed * 7
                WHEN tt.name = 'Отчёты' THEN tl.units_completed * 10
                WHEN tt.name = 'Опросы' THEN tl.units_completed * 6
                WHEN tt.name = 'Модерация ОСС' THEN tl.units_completed * 8
                WHEN tt.name = 'Модерация чатов' THEN tl.units_completed * 6
                ELSE tl.units_completed * 5
            END
        ) as total_score
    FROM employees e
    JOIN user_profiles up ON e.user_id = up.id
    LEFT JOIN task_logs tl ON e.id = tl.employee_id 
        AND tl.work_date >= CURRENT_DATE - INTERVAL '7 days'
    LEFT JOIN task_types tt ON tl.task_type_id = tt.id
    GROUP BY e.id, up.full_name
)
SELECT 
    ROW_NUMBER() OVER (ORDER BY total_score DESC) as rank,
    full_name as name,
    total_score::text as score,
    false as is_current_user
FROM weekly_stats
WHERE total_score > 0
ORDER BY total_score DESC
LIMIT 10;

-- Создаем функцию для получения лидеров с отметкой текущего пользователя
CREATE OR REPLACE FUNCTION get_leaderboard_with_current_user(current_user_id UUID)
RETURNS TABLE (
    rank BIGINT,
    name TEXT,
    score TEXT,
    is_current_user BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH weekly_stats AS (
        SELECT 
            e.id,
            e.user_id,
            up.full_name,
            COUNT(tl.id) as tasks_completed,
            SUM(tl.units_completed) as total_units,
            SUM(tl.time_spent_minutes) as total_minutes,
            SUM(
                CASE 
                    WHEN tt.name = 'Решения МЖИ' THEN tl.units_completed * 15
                    WHEN tt.name = 'Протоколы МЖИ' THEN tl.units_completed * 10
                    WHEN tt.name = 'Обзвоны' THEN tl.units_completed * 8
                    WHEN tt.name = 'Обходы' THEN tl.units_completed * 12
                    WHEN tt.name = 'Актуализация' THEN tl.units_completed * 5
                    WHEN tt.name = 'Протоколы' THEN tl.units_completed * 7
                    WHEN tt.name = 'Отчёты' THEN tl.units_completed * 10
                    WHEN tt.name = 'Опросы' THEN tl.units_completed * 6
                    WHEN tt.name = 'Модерация ОСС' THEN tl.units_completed * 8
                    WHEN tt.name = 'Модерация чатов' THEN tl.units_completed * 6
                    ELSE tl.units_completed * 5
                END
            ) as total_score
        FROM employees e
        JOIN user_profiles up ON e.user_id = up.id
        LEFT JOIN task_logs tl ON e.id = tl.employee_id 
            AND tl.work_date >= CURRENT_DATE - INTERVAL '7 days'
        LEFT JOIN task_types tt ON tl.task_type_id = tt.id
        GROUP BY e.id, e.user_id, up.full_name
    ),
    ranked_stats AS (
        SELECT 
            ROW_NUMBER() OVER (ORDER BY total_score DESC) as user_rank,
            full_name,
            total_score,
            user_id
        FROM weekly_stats
        WHERE total_score > 0
    ),
    top_5 AS (
        SELECT user_rank as rank, full_name as name, total_score::text as score, 
               (user_id = current_user_id) as is_current_user
        FROM ranked_stats
        WHERE user_rank <= 5
    ),
    current_user_stats AS (
        SELECT user_rank as rank, 
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 