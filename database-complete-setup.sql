-- Полная настройка базы данных Task Logger для Supabase
-- Выполните этот скрипт в SQL Editor вашего Supabase проекта

-- Включаем Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ВНИМАНИЕ: Удаляем существующие объекты если они есть
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
DROP TRIGGER IF EXISTS update_work_sessions_updated_at ON work_sessions;
DROP TRIGGER IF EXISTS update_active_sessions_heartbeat ON active_sessions;

DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_heartbeat_column() CASCADE;
DROP FUNCTION IF EXISTS get_employee_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_employee_dashboard_stats(UUID) CASCADE;

DROP TABLE IF EXISTS break_logs CASCADE;
DROP TABLE IF EXISTS active_sessions CASCADE;
DROP TABLE IF EXISTS employee_prizes CASCADE;
DROP TABLE IF EXISTS work_sessions CASCADE;
DROP TABLE IF EXISTS task_logs CASCADE;
DROP TABLE IF EXISTS task_types CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- 1. Таблица сотрудников
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    position TEXT DEFAULT 'Сотрудник',
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    work_schedule TEXT DEFAULT '8+1',
    work_hours INTEGER DEFAULT 8,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Таблица типов задач
CREATE TABLE task_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Таблица логов задач
CREATE TABLE task_logs (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    task_type_id INTEGER REFERENCES task_types(id) ON DELETE CASCADE,
    units_completed INTEGER NOT NULL DEFAULT 1,
    time_spent_minutes INTEGER NOT NULL,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Таблица рабочих сессий (совместимость с компонентами)
CREATE TABLE work_sessions (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    clock_in_time TIMESTAMP WITH TIME ZONE,
    clock_out_time TIMESTAMP WITH TIME ZONE,
    expected_end_time TIMESTAMP WITH TIME ZONE,
    is_auto_clocked_out BOOLEAN DEFAULT FALSE,
    is_paused BOOLEAN DEFAULT FALSE,
    pause_start_time TIMESTAMP WITH TIME ZONE,
    total_work_minutes INTEGER DEFAULT 0,
    total_task_minutes INTEGER DEFAULT 0,
    total_idle_minutes INTEGER DEFAULT 0,
    total_break_minutes INTEGER DEFAULT 0,
    overtime_minutes INTEGER DEFAULT 0,
    break_duration_minutes INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    -- Поля для совместимости со старой схемой
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    session_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Таблица активных сессий (для отслеживания работы в реальном времени)
CREATE TABLE active_sessions (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    task_type_id INTEGER REFERENCES task_types(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_units INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Таблица перерывов
CREATE TABLE break_logs (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    break_type TEXT DEFAULT 'break', -- 'break', 'lunch', 'personal'
    duration_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Таблица призов сотрудников
CREATE TABLE employee_prizes (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    prize_name TEXT NOT NULL,
    prize_description TEXT,
    prize_icon TEXT,
    prize_rarity TEXT DEFAULT 'common',
    won_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMP WITH TIME ZONE
);

-- 8. Индексы для оптимизации
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_is_active ON employees(is_active);
CREATE INDEX idx_task_logs_employee_id ON task_logs(employee_id);
CREATE INDEX idx_task_logs_work_date ON task_logs(work_date);
CREATE INDEX idx_task_logs_task_type_id ON task_logs(task_type_id);
CREATE INDEX idx_work_sessions_employee_id ON work_sessions(employee_id);
CREATE INDEX idx_work_sessions_date ON work_sessions(date);
CREATE INDEX idx_work_sessions_clock_in ON work_sessions(clock_in_time);
CREATE INDEX idx_active_sessions_employee_id ON active_sessions(employee_id);
CREATE INDEX idx_active_sessions_active ON active_sessions(is_active);
CREATE INDEX idx_break_logs_employee_id ON break_logs(employee_id);
CREATE INDEX idx_break_logs_date ON break_logs(date);

-- 9. Заполнение начальных данных - типы задач
INSERT INTO task_types (name, description) VALUES
    ('Разработка', 'Программирование и разработка функций'),
    ('Тестирование', 'QA тестирование и проверка качества'),
    ('Документация', 'Написание и обновление документации'),
    ('Анализ', 'Аналитические задачи и исследования'),
    ('Дизайн', 'UI/UX дизайн и графические работы'),
    ('Планирование', 'Планирование проектов и задач'),
    ('Код ревью', 'Проверка и анализ кода'),
    ('Настройка', 'Настройка систем и инфраструктуры'),
    ('Исправление багов', 'Поиск и исправление ошибок'),
    ('Оптимизация', 'Улучшение производительности'),
    ('Интеграция', 'Интеграция с внешними системами'),
    ('Деплой', 'Развертывание и выпуск'),
    ('Обучение', 'Изучение новых технологий'),
    ('Консультации', 'Консультирование коллег'),
    ('Митинги', 'Совещания и планерки')
ON CONFLICT (name) DO NOTHING;

-- 10. Функции для обновления временных меток
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_heartbeat_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_heartbeat = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Триггеры для автообновления timestamps
CREATE TRIGGER update_employees_updated_at 
    BEFORE UPDATE ON employees 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_sessions_updated_at 
    BEFORE UPDATE ON work_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_active_sessions_heartbeat 
    BEFORE UPDATE ON active_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_heartbeat_column();

-- 12. RLS (Row Level Security) политики
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE break_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_types ENABLE ROW LEVEL SECURITY;

-- Политики для employees
CREATE POLICY "Users can view all employees" ON employees 
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own employee record" ON employees 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own employee record" ON employees 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Политики для task_logs
CREATE POLICY "Users can view all task logs" ON task_logs 
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own task logs" ON task_logs 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = task_logs.employee_id 
            AND employees.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own task logs" ON task_logs 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = task_logs.employee_id 
            AND employees.user_id = auth.uid()
        )
    );

-- Политики для work_sessions
CREATE POLICY "Users can view all work sessions" ON work_sessions 
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own work sessions" ON work_sessions 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = work_sessions.employee_id 
            AND employees.user_id = auth.uid()
        )
    );

-- Политики для active_sessions
CREATE POLICY "Users can view all active sessions" ON active_sessions 
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own active sessions" ON active_sessions 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = active_sessions.employee_id 
            AND employees.user_id = auth.uid()
        )
    );

-- Политики для break_logs
CREATE POLICY "Users can view all break logs" ON break_logs 
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own break logs" ON break_logs 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = break_logs.employee_id 
            AND employees.user_id = auth.uid()
        )
    );

-- Политики для employee_prizes
CREATE POLICY "Users can view all prizes" ON employee_prizes 
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own prizes" ON employee_prizes 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.id = employee_prizes.employee_id 
            AND employees.user_id = auth.uid()
        )
    );

-- Политики для task_types (только чтение для всех)
CREATE POLICY "Anyone can view task types" ON task_types 
    FOR SELECT USING (true);

-- 13. Функция для создания сотрудника при регистрации
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO employees (user_id, full_name, email, position)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Новый сотрудник'),
        NEW.email,
        'Сотрудник'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Триггер для автоматического создания записи сотрудника
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 15. Функция для получения базовой статистики сотрудника
CREATE OR REPLACE FUNCTION get_employee_stats(employee_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_tasks', COUNT(*),
        'total_units', COALESCE(SUM(units_completed), 0),
        'total_time', COALESCE(SUM(time_spent_minutes), 0),
        'today_tasks', COUNT(*) FILTER (WHERE work_date = CURRENT_DATE),
        'this_week_tasks', COUNT(*) FILTER (WHERE work_date >= CURRENT_DATE - INTERVAL '7 days'),
        'avg_time_per_unit', CASE 
            WHEN COALESCE(SUM(units_completed), 0) > 0 
            THEN ROUND(COALESCE(SUM(time_spent_minutes), 0)::NUMERIC / COALESCE(SUM(units_completed), 1), 2)
            ELSE 0 
        END
    ) INTO result
    FROM task_logs tl
    JOIN employees e ON e.id = tl.employee_id
    WHERE e.user_id = employee_user_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. Функция для получения расширенной статистики дашборда
CREATE OR REPLACE FUNCTION get_employee_dashboard_stats(employee_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    employee_record RECORD;
    today_date DATE := CURRENT_DATE;
    week_start DATE := CURRENT_DATE - INTERVAL '7 days';
BEGIN
    -- Получаем данные сотрудника
    SELECT * INTO employee_record 
    FROM employees 
    WHERE user_id = employee_user_id;

    IF employee_record IS NULL THEN
        RETURN json_build_object('error', 'Employee not found');
    END IF;

    SELECT json_build_object(
        'employee_id', employee_record.id,
        'full_name', employee_record.full_name,
        'position', employee_record.position,
        'is_online', employee_record.is_online,
        'today_stats', json_build_object(
            'tasks_completed', COUNT(*) FILTER (WHERE work_date = today_date),
            'units_completed', COALESCE(SUM(units_completed) FILTER (WHERE work_date = today_date), 0),
            'time_spent', COALESCE(SUM(time_spent_minutes) FILTER (WHERE work_date = today_date), 0)
        ),
        'week_stats', json_build_object(
            'tasks_completed', COUNT(*) FILTER (WHERE work_date >= week_start),
            'units_completed', COALESCE(SUM(units_completed) FILTER (WHERE work_date >= week_start), 0),
            'time_spent', COALESCE(SUM(time_spent_minutes) FILTER (WHERE work_date >= week_start), 0)
        ),
        'total_stats', json_build_object(
            'tasks_completed', COUNT(*),
            'units_completed', COALESCE(SUM(units_completed), 0),
            'time_spent', COALESCE(SUM(time_spent_minutes), 0),
            'avg_time_per_unit', CASE 
                WHEN COALESCE(SUM(units_completed), 0) > 0 
                THEN ROUND(COALESCE(SUM(time_spent_minutes), 0)::NUMERIC / COALESCE(SUM(units_completed), 1), 2)
                ELSE 0 
            END
        )
    ) INTO result
    FROM task_logs tl
    WHERE tl.employee_id = employee_record.id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 17. Триггер для автоматического заполнения полей совместимости в work_sessions
CREATE OR REPLACE FUNCTION sync_work_sessions_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Синхронизируем поля для совместимости
    NEW.start_time = COALESCE(NEW.clock_in_time, NEW.start_time);
    NEW.end_time = COALESCE(NEW.clock_out_time, NEW.end_time);
    NEW.session_date = COALESCE(NEW.date, NEW.session_date);
    
    -- Обратная синхронизация
    NEW.clock_in_time = COALESCE(NEW.clock_in_time, NEW.start_time);
    NEW.clock_out_time = COALESCE(NEW.clock_out_time, NEW.end_time);
    NEW.date = COALESCE(NEW.date, NEW.session_date, CURRENT_DATE);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_work_sessions_fields_trigger
    BEFORE INSERT OR UPDATE ON work_sessions
    FOR EACH ROW EXECUTE FUNCTION sync_work_sessions_fields();

-- 18. Комментарии к таблицам
COMMENT ON TABLE employees IS 'Таблица сотрудников с профилями пользователей';
COMMENT ON TABLE task_types IS 'Типы задач для трекинга времени';
COMMENT ON TABLE task_logs IS 'Логи выполненных задач с затраченным временем';
COMMENT ON TABLE work_sessions IS 'Рабочие смены и сессии сотрудников';
COMMENT ON TABLE active_sessions IS 'Активные сессии работы в реальном времени';
COMMENT ON TABLE break_logs IS 'Логи перерывов сотрудников';
COMMENT ON TABLE employee_prizes IS 'Призы и достижения сотрудников';

-- 19. Представления для удобного доступа к данным
CREATE OR REPLACE VIEW employee_current_status AS
SELECT 
    e.id,
    e.user_id,
    e.full_name,
    e.position,
    e.is_online,
    e.last_seen,
    ws.id as session_id,
    ws.clock_in_time,
    ws.clock_out_time,
    ws.expected_end_time,
    ws.is_paused,
    CASE 
        WHEN ws.clock_in_time IS NOT NULL AND ws.clock_out_time IS NULL THEN true
        ELSE false
    END as is_working,
    as_active.task_type_id as current_task_type_id,
    tt.name as current_task_name
FROM employees e
LEFT JOIN work_sessions ws ON e.id = ws.employee_id AND ws.date = CURRENT_DATE
LEFT JOIN active_sessions as_active ON e.id = as_active.employee_id AND as_active.is_active = true
LEFT JOIN task_types tt ON as_active.task_type_id = tt.id
WHERE e.is_active = true;

-- Создаем представление для детальной статистики задач
CREATE OR REPLACE VIEW task_logs_detailed AS
SELECT 
    tl.*,
    e.full_name as employee_name,
    e.position as employee_position,
    tt.name as task_type_name,
    tt.description as task_type_description
FROM task_logs tl
JOIN employees e ON tl.employee_id = e.id
JOIN task_types tt ON tl.task_type_id = tt.id;

-- 20. Финальная проверка и очистка
-- Автоматически создаем запись сотрудника для существующих пользователей без записей
INSERT INTO employees (user_id, full_name, email, position)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'Сотрудник') as full_name,
    au.email,
    'Сотрудник' as position
FROM auth.users au
LEFT JOIN employees e ON e.user_id = au.id
WHERE e.id IS NULL
ON CONFLICT DO NOTHING;

-- Выводим информацию о созданных объектах
SELECT 'База данных Task Logger успешно настроена!' as status; 