-- Добавляем недостающие колонки профиля в таблицу employees

-- Добавляем avatar_url если её нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'avatar_url'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE employees 
        ADD COLUMN avatar_url TEXT;
        
        RAISE NOTICE 'Колонка avatar_url добавлена в employees';
    ELSE
        RAISE NOTICE 'Колонка avatar_url уже существует в employees';
    END IF;
END $$;

-- Проверяем и добавляем другие полезные колонки профиля если их нет
DO $$ 
BEGIN
    -- Добавляем phone если её нет
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'phone'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE employees 
        ADD COLUMN phone TEXT;
        
        RAISE NOTICE 'Колонка phone добавлена в employees';
    END IF;
    
    -- Добавляем bio если её нет
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'bio'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE employees 
        ADD COLUMN bio TEXT;
        
        RAISE NOTICE 'Колонка bio добавлена в employees';
    END IF;
    
    -- Добавляем website если её нет
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'website'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE employees 
        ADD COLUMN website TEXT;
        
        RAISE NOTICE 'Колонка website добавлена в employees';
    END IF;
END $$;

-- Проверяем финальную структуру
SELECT 'ОБНОВЛЁННАЯ СТРУКТУРА employees:' as status;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND table_schema = 'public'
AND column_name IN ('avatar_url', 'phone', 'bio', 'website', 'full_name', 'email')
ORDER BY column_name; 