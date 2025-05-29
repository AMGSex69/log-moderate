-- Скрипт для исправления несовместимости типов данных
-- Выполните этот скрипт если получили ошибку о несовместимых типах

-- ВНИМАНИЕ: Этот скрипт удалит все существующие данные!
-- Сначала сделайте резервную копию если у вас есть важные данные

-- 1. Удаляем все существующие таблицы
DROP TABLE IF EXISTS employee_prizes CASCADE;
DROP TABLE IF EXISTS work_sessions CASCADE;
DROP TABLE IF EXISTS task_logs CASCADE;
DROP TABLE IF EXISTS task_types CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- 2. Удаляем существующие функции и триггеры
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS get_employee_stats(UUID) CASCADE;

-- 3. Пересоздаем все с правильными типами данных
-- Таблица сотрудников
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    position TEXT DEFAULT 'Сотрудник',
    is_admin BOOLEAN DEFAULT FALSE,
    work_schedule TEXT DEFAULT '8+1',
    work_hours INTEGER DEFAULT 8,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица типов задач
CREATE TABLE task_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица логов задач
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

-- Таблица рабочих сессий
CREATE TABLE work_sessions (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE,
    break_duration_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица призов сотрудников
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

-- Индексы
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_task_logs_employee_id ON task_logs(employee_id);
CREATE INDEX idx_task_logs_work_date ON task_logs(work_date);
CREATE INDEX idx_task_logs_task_type_id ON task_logs(task_type_id);
CREATE INDEX idx_work_sessions_employee_id ON work_sessions(employee_id);
CREATE INDEX idx_work_sessions_session_date ON work_sessions(session_date);

-- Заполнение типов задач
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
    ('Митинги', 'Совещания и планерки');

-- Функции
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_employees_updated_at 
    BEFORE UPDATE ON employees 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS политики
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
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

-- Политики для task_types
CREATE POLICY "Anyone can view task types" ON task_types 
    FOR SELECT USING (true);

-- Функция для создания сотрудника при регистрации
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO employees (user_id, full_name, position)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Новый сотрудник'),
        'Сотрудник'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер для автоматического создания записи сотрудника
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Функция для получения статистики
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
        'this_week_tasks', COUNT(*) FILTER (WHERE work_date >= CURRENT_DATE - INTERVAL '7 days')
    ) INTO result
    FROM task_logs tl
    JOIN employees e ON e.id = tl.employee_id
    WHERE e.user_id = employee_user_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 