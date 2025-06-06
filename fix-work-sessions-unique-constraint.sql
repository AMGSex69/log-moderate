-- ИСПРАВЛЕНИЕ: Добавление уникального ограничения для work_sessions
-- Этот скрипт проверяет и добавляет уникальное ограничение если его нет

-- 1. Проверяем существующие ограничения
SELECT 'Проверка существующих ограничений:' as info;
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'work_sessions' 
AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.constraint_name, kcu.ordinal_position;

-- 2. Проверяем наличие дублирующих записей
SELECT 'Проверка дублирующих записей:' as info;
SELECT 
    employee_id, 
    date, 
    COUNT(*) as count
FROM work_sessions 
GROUP BY employee_id, date 
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 3. Если есть дубликаты, удаляем их (оставляем последний по created_at)
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH duplicates AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY employee_id, date 
                ORDER BY created_at DESC, id DESC
            ) as rn
        FROM work_sessions
    ),
    to_delete AS (
        SELECT id FROM duplicates WHERE rn > 1
    )
    DELETE FROM work_sessions 
    WHERE id IN (SELECT id FROM to_delete);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Удалено дублирующих записей: %', deleted_count;
END $$;

-- 4. Добавляем уникальное ограничение если его нет
DO $$
BEGIN
    -- Проверяем существует ли ограничение на комбинацию employee_id, date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu1 ON tc.constraint_name = kcu1.constraint_name
        JOIN information_schema.key_column_usage kcu2 ON tc.constraint_name = kcu2.constraint_name
        WHERE tc.table_name = 'work_sessions' 
        AND tc.constraint_type = 'UNIQUE'
        AND kcu1.column_name = 'employee_id'
        AND kcu2.column_name = 'date'
        AND kcu1.constraint_name = kcu2.constraint_name
    ) THEN
        -- Добавляем уникальное ограничение
        ALTER TABLE work_sessions 
        ADD CONSTRAINT work_sessions_employee_date_unique 
        UNIQUE (employee_id, date);
        
        RAISE NOTICE 'Уникальное ограничение добавлено: work_sessions_employee_date_unique';
    ELSE
        RAISE NOTICE 'Уникальное ограничение уже существует';
    END IF;
EXCEPTION 
    WHEN duplicate_table THEN 
        RAISE NOTICE 'Ограничение уже существует';
    WHEN OTHERS THEN
        RAISE NOTICE 'Ошибка добавления ограничения: %', SQLERRM;
END $$;

-- 5. Проверяем результат
SELECT 'Итоговые ограничения на work_sessions:' as info;
SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'work_sessions' 
AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_type, tc.constraint_name;

-- 6. Проверяем что больше нет дубликатов
SELECT 'Финальная проверка дубликатов:' as info;
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Дубликатов нет'
        ELSE '❌ Найдено дубликатов: ' || COUNT(*)
    END as result
FROM (
    SELECT employee_id, date, COUNT(*) 
    FROM work_sessions 
    GROUP BY employee_id, date 
    HAVING COUNT(*) > 1
) duplicates;

SELECT 'Ограничение готово! Теперь можно использовать ON CONFLICT' as status; 