-- ===========================================
-- ИСПРАВЛЕНИЕ ФУНКЦИИ ИЗБРАННЫХ ЗАДАЧ
-- ===========================================

-- Исправляем функцию get_user_favorite_tasks
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
        COALESCE(tt.group_name, 'Другое') as task_group,  -- Используем COALESCE для безопасности
        COALESCE(tt.icon, '📋') as task_icon,
        COALESCE(tt.color, '#6B7280') as task_color,
        ft.created_at as added_to_favorites
    FROM favorite_tasks ft
    JOIN task_types tt ON tt.id = ft.task_type_id
    WHERE ft.user_id = target_user_id
    ORDER BY ft.created_at DESC;
END;
$$;

-- Проверяем структуру таблицы task_types
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'task_types' 
ORDER BY ordinal_position;

-- Если столбец group_name не существует, добавляем его
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'task_types' AND column_name = 'group_name'
    ) THEN
        ALTER TABLE task_types ADD COLUMN group_name TEXT;
        
        -- Обновляем group_name на основе существующих данных
        UPDATE task_types SET group_name = 
            CASE 
                WHEN name IN ('Решения МЖИ', 'Протоколы МЖИ') THEN 'МЖИ'
                WHEN name IN ('Обзвоны', 'Опросы', 'Юридически значимые опросы') THEN 'Коммуникации'
                WHEN name IN ('Обходы', 'Развешивание плакатов') THEN 'Полевая работа'
                WHEN name IN ('Актуализация', 'Протоколы', 'Отчёты') THEN 'Документооборот'
                WHEN name IN ('Модерация ОСС', 'Модерация чатов') THEN 'Модерация'
                WHEN name IN ('АСГУФ') THEN 'Системы'
                WHEN name IN ('Задачи руководства', 'Особые задачи') THEN 'Управление'
                ELSE 'Другое'
            END;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'task_types' AND column_name = 'icon'
    ) THEN
        ALTER TABLE task_types ADD COLUMN icon TEXT DEFAULT '📋';
        
        -- Обновляем иконки
        UPDATE task_types SET icon = 
            CASE 
                WHEN name = 'Решения МЖИ' THEN '📋'
                WHEN name = 'Протоколы МЖИ' THEN '📄'
                WHEN name = 'Обзвоны' THEN '📞'
                WHEN name = 'Обходы' THEN '🚶‍♂️'
                WHEN name = 'Развешивание плакатов' THEN '📋'
                WHEN name = 'Актуализация' THEN '🔄'
                WHEN name = 'Протоколы' THEN '📝'
                WHEN name = 'Отчёты' THEN '📊'
                WHEN name = 'Опросы' THEN '❓'
                WHEN name = 'Юридически значимые опросы' THEN '⚖️'
                WHEN name = 'Модерация ОСС' THEN '🏢'
                WHEN name = 'Модерация чатов' THEN '💬'
                WHEN name = 'АСГУФ' THEN '🖥️'
                WHEN name = 'Задачи руководства' THEN '👔'
                WHEN name = 'Особые задачи' THEN '⭐'
                ELSE '📋'
            END;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'task_types' AND column_name = 'color'
    ) THEN
        ALTER TABLE task_types ADD COLUMN color TEXT DEFAULT '#6B7280';
        
        -- Обновляем цвета
        UPDATE task_types SET color = 
            CASE 
                WHEN group_name = 'МЖИ' THEN '#10B981'
                WHEN group_name = 'Коммуникации' THEN '#3B82F6'
                WHEN group_name = 'Полевая работа' THEN '#F59E0B'
                WHEN group_name = 'Документооборот' THEN '#EF4444'
                WHEN group_name = 'Модерация' THEN '#8B5CF6'
                WHEN group_name = 'Системы' THEN '#06B6D4'
                WHEN group_name = 'Управление' THEN '#EC4899'
                ELSE '#6B7280'
            END;
    END IF;
END $$;

-- Предоставляем права на выполнение функции
GRANT EXECUTE ON FUNCTION get_user_favorite_tasks(UUID) TO authenticated;

-- Проверяем результат
SELECT 'Функция get_user_favorite_tasks исправлена' as status; 