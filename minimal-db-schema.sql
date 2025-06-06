-- ===========================================
-- МИНИМАЛЬНАЯ СХЕМА БД ДЛЯ TASK LOGGER
-- ===========================================

-- ОСНОВНЫЕ ТАБЛИЦЫ (необходимые для работы)

-- 1. ОФИСЫ
-- Создаем только если не существует
DO $$ BEGIN
    CREATE TABLE IF NOT EXISTS offices (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        address TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- 2. ПРОФИЛИ ПОЛЬЗОВАТЕЛЕЙ  
-- Основная таблица для хранения профилей
DO $$ BEGIN
    CREATE TABLE IF NOT EXISTS user_profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        position TEXT DEFAULT 'Сотрудник',
        work_schedule TEXT DEFAULT '5/2',
        work_hours INTEGER DEFAULT 9,
        is_admin BOOLEAN DEFAULT FALSE,
        role TEXT DEFAULT 'user',
        is_online BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP WITH TIME ZONE,
        office_id INTEGER REFERENCES offices(id) DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- 3. СОТРУДНИКИ
-- Дублирующая таблица (может быть удалена в будущем)
DO $$ BEGIN
    CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        position TEXT DEFAULT 'Сотрудник',
        work_schedule TEXT DEFAULT '5/2',
        work_hours INTEGER DEFAULT 9,
        is_admin BOOLEAN DEFAULT FALSE,
        is_online BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP WITH TIME ZONE,
        office_id INTEGER REFERENCES offices(id) DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- 4. РАБОЧИЕ СЕССИИ
DO $$ BEGIN
    CREATE TABLE IF NOT EXISTS work_sessions (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        clock_in_time TIMESTAMP WITH TIME ZONE,
        clock_out_time TIMESTAMP WITH TIME ZONE,
        expected_end_time TIMESTAMP WITH TIME ZONE,
        start_time TIMESTAMP WITH TIME ZONE, -- Для совместимости
        end_time TIMESTAMP WITH TIME ZONE,   -- Для совместимости
        is_paused BOOLEAN DEFAULT FALSE,
        pause_start_time TIMESTAMP WITH TIME ZONE,
        total_work_minutes INTEGER DEFAULT 0,
        total_break_minutes INTEGER DEFAULT 0,
        overtime_minutes INTEGER DEFAULT 0,
        is_auto_clocked_out BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(employee_id, date)
    );
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- 5. ТИПЫ ЗАДАЧ
DO $$ BEGIN
    CREATE TABLE IF NOT EXISTS task_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- 6. ЗАДАЧИ
DO $$ BEGIN
    CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        task_type_id INTEGER REFERENCES task_types(id) ON DELETE CASCADE,
        start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        end_time TIMESTAMP WITH TIME ZONE,
        duration_minutes INTEGER,
        is_completed BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- ===========================================
-- БАЗОВЫЕ ДАННЫЕ
-- ===========================================

-- Добавляем офисы если их нет
INSERT INTO offices (name, description) VALUES
('Рассвет', 'Основной офис'),
('Будапешт', 'Офис Будапешт'),
('Янтарь', 'Офис Янтарь'),
('Саяны', 'Офис Саяны'),
('Бирюсинка', 'Офис Бирюсинка'),
('Витязь', 'Офис Витязь'),
('Планета', 'Офис Планета'),
('Зеленоград', 'Офис Зеленоград'),
('Тульская', 'Офис Тульская'),
('Чистые пруды', 'Офис Чистые пруды')
ON CONFLICT (name) DO NOTHING;

-- Добавляем базовые типы задач
INSERT INTO task_types (name, description) VALUES
('Обработка заявок', 'Работа с клиентскими заявками'),
('Консультации', 'Консультирование клиентов'),
('Документооборот', 'Работа с документами'),
('Планерка', 'Участие в планерках и совещаниях'),
('Обучение', 'Обучение и развитие'),
('Административные задачи', 'Прочие административные задачи')
ON CONFLICT DO NOTHING;

-- ===========================================
-- ОСНОВНЫЕ ФУНКЦИИ
-- ===========================================

-- 1. ПОЛУЧЕНИЕ ИЛИ СОЗДАНИЕ EMPLOYEE_ID
CREATE OR REPLACE FUNCTION get_or_create_employee_id(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    employee_id INTEGER;
    user_name TEXT;
    default_office_id INTEGER;
BEGIN
    -- Проверяем существующего сотрудника
    SELECT id INTO employee_id FROM employees WHERE user_id = user_uuid;
    
    IF employee_id IS NOT NULL THEN
        RETURN employee_id;
    END IF;
    
    -- Получаем имя пользователя
    SELECT COALESCE(up.full_name, au.email, 'Пользователь') INTO user_name
    FROM auth.users au
    LEFT JOIN user_profiles up ON up.id = au.id
    WHERE au.id = user_uuid;
    
    -- Получаем ID офиса "Рассвет"
    SELECT id INTO default_office_id FROM offices WHERE name = 'Рассвет' LIMIT 1;
    
    -- Создаем нового сотрудника
    INSERT INTO employees (
        user_id, full_name, position, work_schedule, work_hours,
        is_admin, is_online, office_id, created_at, updated_at
    ) VALUES (
        user_uuid, user_name, 'Сотрудник', '5/2', 9,
        false, false, default_office_id, NOW(), NOW()
    )
    RETURNING id INTO employee_id;
    
    RETURN employee_id;
END;
$$;

-- 2. СТАТИСТИКА ОФИСА
CREATE OR REPLACE FUNCTION get_office_statistics(requesting_user_uuid UUID)
RETURNS TABLE (
    office_id INTEGER,
    office_name TEXT,
    total_employees BIGINT,
    working_employees BIGINT,
    total_hours_today NUMERIC,
    avg_hours_today NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_office_id INTEGER := 1;
BEGIN
    -- Получаем офис пользователя
    SELECT COALESCE(up.office_id, e.office_id, 1) INTO user_office_id
    FROM auth.users au
    LEFT JOIN user_profiles up ON up.id = au.id
    LEFT JOIN employees e ON e.user_id = au.id
    WHERE au.id = requesting_user_uuid;
    
    -- Возвращаем статистику
    RETURN QUERY
    SELECT 
        user_office_id::INTEGER,
        COALESCE(o.name, 'Рассвет')::TEXT,
        COALESCE(COUNT(DISTINCT e.id), 0)::BIGINT,
        COALESCE(COUNT(DISTINCT CASE 
            WHEN ws.clock_in_time IS NOT NULL AND ws.clock_out_time IS NULL 
            THEN e.id 
        END), 0)::BIGINT,
        COALESCE(SUM(ws.total_work_minutes) / 60.0, 0)::NUMERIC,
        COALESCE(AVG(CASE WHEN ws.total_work_minutes > 0 THEN ws.total_work_minutes END) / 60.0, 0)::NUMERIC
    FROM offices o
    LEFT JOIN employees e ON e.office_id = o.id
    LEFT JOIN work_sessions ws ON ws.employee_id = e.id AND ws.date = CURRENT_DATE
    WHERE o.id = user_office_id
    GROUP BY o.id, o.name;
END;
$$;

-- 3. ЛИДЕРБОРД
CREATE OR REPLACE FUNCTION get_leaderboard_with_current_user(current_user_uuid UUID)
RETURNS TABLE (
    name TEXT,
    score TEXT,
    rank INTEGER,
    is_current_user BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_office_id INTEGER := 1;
BEGIN
    -- Получаем офис пользователя
    SELECT COALESCE(up.office_id, e.office_id, 1) INTO user_office_id
    FROM auth.users au
    LEFT JOIN user_profiles up ON up.id = au.id
    LEFT JOIN employees e ON e.user_id = au.id
    WHERE au.id = current_user_uuid;
    
    -- Возвращаем лидерборд офиса
    RETURN QUERY
    SELECT 
        e.full_name::TEXT,
        COALESCE(ROUND(SUM(ws.total_work_minutes) / 60.0, 1)::TEXT || ' ч', '0 ч')::TEXT,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ws.total_work_minutes), 0) DESC)::INTEGER,
        (e.user_id = current_user_uuid)::BOOLEAN
    FROM employees e
    LEFT JOIN work_sessions ws ON ws.employee_id = e.id 
        AND ws.date >= CURRENT_DATE - INTERVAL '7 days'
    WHERE e.office_id = user_office_id
    GROUP BY e.id, e.full_name, e.user_id
    HAVING SUM(ws.total_work_minutes) > 0
    ORDER BY COALESCE(SUM(ws.total_work_minutes), 0) DESC
    LIMIT 10;
END;
$$;

-- ===========================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ===========================================

-- Индексы для work_sessions
CREATE INDEX IF NOT EXISTS idx_work_sessions_employee_date ON work_sessions(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_work_sessions_date ON work_sessions(date);

-- Индексы для employees
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_office_id ON employees(office_id);

-- Индексы для user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_office_id ON user_profiles(office_id);

-- Индексы для tasks
CREATE INDEX IF NOT EXISTS idx_tasks_employee_id ON tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_start_time ON tasks(start_time);

-- ===========================================
-- RLS ПОЛИТИКИ (базовые)
-- ===========================================

-- Включаем RLS для основных таблиц
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Политики для user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR ALL USING (auth.uid() = id);

-- Политики для employees (более открытые для совместимости)
DROP POLICY IF EXISTS "Employees can view office data" ON employees;
CREATE POLICY "Employees can view office data" ON employees
    FOR SELECT USING (true); -- Временно открытое чтение

DROP POLICY IF EXISTS "Users can manage own employee record" ON employees;
CREATE POLICY "Users can manage own employee record" ON employees
    FOR ALL USING (auth.uid() = user_id);

-- Политики для work_sessions
DROP POLICY IF EXISTS "Users can manage own work sessions" ON work_sessions;
CREATE POLICY "Users can manage own work sessions" ON work_sessions
    FOR ALL USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );

-- Политики для tasks
DROP POLICY IF EXISTS "Users can manage own tasks" ON tasks;
CREATE POLICY "Users can manage own tasks" ON tasks
    FOR ALL USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );

SELECT 'МИНИМАЛЬНАЯ СХЕМА СОЗДАНА ✅' as status; 