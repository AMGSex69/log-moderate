-- Добавляем колонку measurement_unit в таблицу task_types

-- Проверяем существует ли уже колонка
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'task_types' 
        AND column_name = 'measurement_unit'
        AND table_schema = 'public'
    ) THEN
        -- Добавляем колонку
        ALTER TABLE task_types 
        ADD COLUMN measurement_unit TEXT DEFAULT 'единиц';
        
        RAISE NOTICE 'Колонка measurement_unit добавлена в task_types';
    ELSE
        RAISE NOTICE 'Колонка measurement_unit уже существует в task_types';
    END IF;
END $$;

-- Обновляем существующие записи с подходящими единицами измерения
UPDATE task_types 
SET measurement_unit = CASE 
    WHEN name ILIKE '%время%' OR name ILIKE '%час%' OR name ILIKE '%минут%' THEN 'часов'
    WHEN name ILIKE '%звонок%' OR name ILIKE '%звонки%' THEN 'звонков'
    WHEN name ILIKE '%встреч%' OR name ILIKE '%встречи%' THEN 'встреч'
    WHEN name ILIKE '%письм%' OR name ILIKE '%email%' THEN 'писем'
    WHEN name ILIKE '%задач%' THEN 'задач'
    WHEN name ILIKE '%клиент%' THEN 'клиентов'
    WHEN name ILIKE '%документ%' THEN 'документов'
    WHEN name ILIKE '%отчёт%' OR name ILIKE '%отчет%' THEN 'отчётов'
    ELSE 'единиц'
END
WHERE measurement_unit IS NULL OR measurement_unit = 'единиц';

-- Проверяем результат
SELECT 'РЕЗУЛЬТАТ ОБНОВЛЕНИЯ:' as status;
SELECT id, name, measurement_unit 
FROM task_types 
ORDER BY id; 