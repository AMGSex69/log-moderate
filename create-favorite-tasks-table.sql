-- ===========================================
-- СОЗДАНИЕ ТАБЛИЦЫ ИЗБРАННЫХ ЗАДАЧ
-- ===========================================

-- 1. Создаем таблицу favorite_tasks
CREATE TABLE IF NOT EXISTS favorite_tasks (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_type_id INTEGER NOT NULL REFERENCES task_types(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Уникальная комбинация пользователь + тип задачи
    UNIQUE(user_id, task_type_id)
);

-- 2. Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_favorite_tasks_user_id ON favorite_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_tasks_task_type_id ON favorite_tasks(task_type_id);
CREATE INDEX IF NOT EXISTS idx_favorite_tasks_created_at ON favorite_tasks(created_at);

-- 3. Включаем RLS (Row Level Security)
ALTER TABLE favorite_tasks ENABLE ROW LEVEL SECURITY;

-- 4. Создаем RLS политики
-- Пользователи могут видеть только свои избранные задачи
CREATE POLICY "Users can view their own favorite tasks" ON favorite_tasks
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Пользователи могут добавлять только свои избранные задачи
CREATE POLICY "Users can insert their own favorite tasks" ON favorite_tasks
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Пользователи могут удалять только свои избранные задачи
CREATE POLICY "Users can delete their own favorite tasks" ON favorite_tasks
    FOR DELETE 
    USING (auth.uid() = user_id);

-- 5. Создаем функцию для добавления/удаления избранных задач
CREATE OR REPLACE FUNCTION toggle_favorite_task(target_task_type_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    favorite_exists BOOLEAN;
BEGIN
    -- Получаем ID текущего пользователя
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;
    
    -- Проверяем, существует ли уже эта задача в избранном
    SELECT EXISTS(
        SELECT 1 FROM favorite_tasks 
        WHERE user_id = current_user_id 
        AND task_type_id = target_task_type_id
    ) INTO favorite_exists;
    
    IF favorite_exists THEN
        -- Удаляем из избранного
        DELETE FROM favorite_tasks 
        WHERE user_id = current_user_id 
        AND task_type_id = target_task_type_id;
        
        RETURN FALSE; -- Возвращаем FALSE, значит задача удалена из избранного
    ELSE
        -- Добавляем в избранное
        INSERT INTO favorite_tasks (user_id, task_type_id)
        VALUES (current_user_id, target_task_type_id);
        
        RETURN TRUE; -- Возвращаем TRUE, значит задача добавлена в избранное
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Ошибка при работе с избранными задачами: %', SQLERRM;
END;
$$;

-- 6. Создаем функцию для получения избранных задач пользователя
CREATE OR REPLACE FUNCTION get_user_favorite_tasks(target_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    task_type_id INTEGER,
    task_name TEXT,
    task_group TEXT,
    task_icon TEXT,
    task_color TEXT,
    added_to_favorites TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    requesting_user_id UUID;
BEGIN
    -- Получаем ID текущего пользователя
    requesting_user_id := auth.uid();
    
    -- Если target_user_id не указан, используем текущего пользователя
    IF target_user_id IS NULL THEN
        target_user_id := requesting_user_id;
    END IF;
    
    -- Проверяем права доступа (пользователь может видеть только свои избранные)
    IF requesting_user_id != target_user_id THEN
        RAISE EXCEPTION 'Доступ запрещен';
    END IF;
    
    -- Возвращаем избранные задачи с деталями
    RETURN QUERY
    SELECT 
        tt.id as task_type_id,
        tt.name as task_name,
        tt.group_name as task_group,
        tt.icon as task_icon,
        tt.color as task_color,
        ft.created_at as added_to_favorites
    FROM favorite_tasks ft
    JOIN task_types tt ON tt.id = ft.task_type_id
    WHERE ft.user_id = target_user_id
    ORDER BY ft.created_at DESC;
END;
$$;

-- 7. Предоставляем права на выполнение функций
GRANT EXECUTE ON FUNCTION toggle_favorite_task(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_favorite_tasks(UUID) TO authenticated;

-- 8. Создаем триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_favorite_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_favorite_tasks_updated_at
    BEFORE UPDATE ON favorite_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_favorite_tasks_updated_at();

-- 9. Тестовые данные (опционально)
-- Раскомментируйте следующие строки, если хотите добавить тестовые избранные задачи
/*
-- Добавляем несколько тестовых избранных задач для текущего пользователя
INSERT INTO favorite_tasks (user_id, task_type_id)
SELECT 
    auth.uid(),
    id
FROM task_types 
WHERE name IN ('Обработка заявок', 'Консультации', 'Документооборот')
ON CONFLICT (user_id, task_type_id) DO NOTHING;
*/

-- 10. Проверяем созданную структуру
SELECT 
    'Таблица favorite_tasks создана успешно' as status,
    COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'favorite_tasks';

SELECT 
    'RLS политики для favorite_tasks:' as info,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'favorite_tasks'; 