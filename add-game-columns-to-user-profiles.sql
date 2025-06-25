-- Добавление игровых колонок в таблицу user_profiles
-- Добавляем coins, experience, level если их нет

BEGIN;

-- Добавляем колонку coins (монеты)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'coins') THEN
        ALTER TABLE user_profiles ADD COLUMN coins INTEGER DEFAULT 0 NOT NULL;
        RAISE NOTICE 'Колонка coins добавлена';
    ELSE
        RAISE NOTICE 'Колонка coins уже существует';
    END IF;
END $$;

-- Добавляем колонку experience (опыт)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'experience') THEN
        ALTER TABLE user_profiles ADD COLUMN experience INTEGER DEFAULT 0 NOT NULL;
        RAISE NOTICE 'Колонка experience добавлена';
    ELSE
        RAISE NOTICE 'Колонка experience уже существует';
    END IF;
END $$;

-- Добавляем колонку level (уровень)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'level') THEN
        ALTER TABLE user_profiles ADD COLUMN level INTEGER DEFAULT 1 NOT NULL;
        RAISE NOTICE 'Колонка level добавлена';
    ELSE
        RAISE NOTICE 'Колонка level уже существует';
    END IF;
END $$;

-- Добавляем колонку achievements (достижения) как JSON
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'achievements') THEN
        ALTER TABLE user_profiles ADD COLUMN achievements JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Колонка achievements добавлена';
    ELSE
        RAISE NOTICE 'Колонка achievements уже существует';
    END IF;
END $$;

-- Добавляем колонку last_activity (последняя активность)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'last_activity') THEN
        ALTER TABLE user_profiles ADD COLUMN last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Колонка last_activity добавлена';
    ELSE
        RAISE NOTICE 'Колонка last_activity уже существует';
    END IF;
END $$;

COMMIT;

-- Проверяем результат
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
AND column_name IN ('coins', 'experience', 'level', 'achievements', 'last_activity')
ORDER BY column_name;

-- Показываем обновленную структуру пользователей
SELECT 
    id,
    full_name,
    coins,
    experience,
    level,
    office_id,
    employee_id
FROM user_profiles 
WHERE employee_id IS NOT NULL
ORDER BY full_name
LIMIT 5; 