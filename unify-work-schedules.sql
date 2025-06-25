-- УНИФИКАЦИЯ РАБОЧИХ ГРАФИКОВ В СИСТЕМЕ
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard

-- Стандартизируем значения:
-- 5/2 = 9 рабочих часов (8 работы + 1 час обед)
-- 2/2 = 12 рабочих часов (11 работы + 1 час обед)

BEGIN;

-- 1. Обновляем user_profiles - приводим все к единому стандарту
UPDATE user_profiles 
SET 
    work_schedule = CASE 
        WHEN work_schedule IN ('8+1', '8', '9') THEN '5/2'
        WHEN work_schedule IN ('12', '11+1') THEN '2/2'
        WHEN work_schedule IS NULL THEN '5/2'
        ELSE work_schedule
    END,
    work_hours = CASE 
        WHEN work_schedule IN ('8+1', '8', '9') OR work_schedule IS NULL THEN 9
        WHEN work_schedule IN ('12', '11+1') THEN 12
        WHEN work_schedule = '5/2' THEN 9
        WHEN work_schedule = '2/2' THEN 12
        ELSE work_hours
    END,
    updated_at = NOW()
WHERE work_schedule IN ('8+1', '8', '9', '12', '11+1') OR work_schedule IS NULL OR work_hours IS NULL;

-- 2. Обновляем employees - приводим все к единому стандарту
UPDATE employees 
SET 
    work_schedule = CASE 
        WHEN work_schedule IN ('8+1', '8', '9') THEN '5/2'
        WHEN work_schedule IN ('12', '11+1') THEN '2/2'
        WHEN work_schedule IS NULL THEN '5/2'
        ELSE work_schedule
    END,
    work_hours = CASE 
        WHEN work_schedule IN ('8+1', '8', '9') OR work_schedule IS NULL THEN 9
        WHEN work_schedule IN ('12', '11+1') THEN 12
        WHEN work_schedule = '5/2' THEN 9
        WHEN work_schedule = '2/2' THEN 12
        ELSE work_hours
    END,
    updated_at = NOW()
WHERE work_schedule IN ('8+1', '8', '9', '12', '11+1') OR work_schedule IS NULL OR work_hours IS NULL;

-- 3. Обновляем функцию создания нового пользователя для использования правильных значений
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    existing_profile_id UUID;
    existing_employee_id INTEGER;
    user_full_name TEXT;
    user_work_schedule TEXT;
    user_work_hours INTEGER;
    employee_num TEXT;
    default_office_id INTEGER;
BEGIN
    -- Проверяем, не существует ли уже профиль
    SELECT id INTO existing_profile_id 
    FROM user_profiles 
    WHERE id = NEW.id;
    
    SELECT id INTO existing_employee_id 
    FROM employees 
    WHERE user_id = NEW.id;
    
    -- Если записи уже существуют, просто возвращаем
    IF existing_profile_id IS NOT NULL AND existing_employee_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Получаем данные пользователя
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.email,
        'Новый пользователь'
    );
    
    -- Унифицируем график работы
    user_work_schedule := CASE 
        WHEN NEW.raw_user_meta_data->>'work_schedule' IN ('2/2', '12', '11+1') THEN '2/2'
        WHEN NEW.raw_user_meta_data->>'work_schedule' IN ('5/2', '8+1', '8', '9') THEN '5/2'
        ELSE '5/2' -- по умолчанию
    END;
    
    user_work_hours := CASE 
        WHEN user_work_schedule = '2/2' THEN 12
        ELSE 9
    END;

    -- Получаем ID офиса по умолчанию
    SELECT id INTO default_office_id FROM offices WHERE name = 'Рассвет' LIMIT 1;
    IF default_office_id IS NULL THEN
        SELECT id INTO default_office_id FROM offices ORDER BY id LIMIT 1;
    END IF;

    -- Генерируем номер сотрудника
    SELECT COALESCE(
        'EMP-' || LPAD(
            (COALESCE(
                (SELECT MAX(
                    CASE 
                        WHEN employee_number ~ '^EMP-[0-9]+$' 
                        THEN CAST(SUBSTRING(employee_number FROM 5) AS INTEGER)
                        ELSE 0 
                    END
                ) FROM employees), 
                0
            ) + 1)::TEXT, 
            4, 
            '0'
        ),
        'EMP-0001'
    ) INTO employee_num;

    -- Создаем профиль если не существует
    IF existing_profile_id IS NULL THEN
        INSERT INTO user_profiles (
            id,
            full_name,
            position,
            work_schedule,
            work_hours,
            is_admin,
            is_online,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            user_full_name,
            'Сотрудник',
            user_work_schedule,
            user_work_hours,
            false,
            false,
            NOW(),
            NOW()
        );
    END IF;

    -- Создаем employee если не существует
    IF existing_employee_id IS NULL THEN
        INSERT INTO employees (
            user_id,
            employee_number,
            full_name,
            position,
            work_schedule,
            work_hours,
            is_admin,
            is_active,
            is_online,
            office_id,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            employee_num,
            user_full_name,
            'Сотрудник',
            user_work_schedule,
            user_work_hours,
            false,
            true,
            false,
            default_office_id,
            NOW(),
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Добавляем ограничения для валидации графиков
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS valid_work_schedule;

ALTER TABLE user_profiles 
ADD CONSTRAINT valid_work_schedule 
CHECK (work_schedule IN ('5/2', '2/2'));

ALTER TABLE employees 
DROP CONSTRAINT IF EXISTS valid_work_schedule;

ALTER TABLE employees 
ADD CONSTRAINT valid_work_schedule 
CHECK (work_schedule IN ('5/2', '2/2'));

-- 5. Создаем функцию для получения информации о графике работы
CREATE OR REPLACE FUNCTION get_work_schedule_info(schedule_type TEXT)
RETURNS TABLE (
    schedule_name TEXT,
    daily_hours INTEGER,
    work_hours INTEGER,
    break_hours INTEGER,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN schedule_type = '5/2' THEN '5/2 (Пятидневка)'::TEXT
            WHEN schedule_type = '2/2' THEN '2/2 (Сменный)'::TEXT
            ELSE 'Неизвестный график'::TEXT
        END as schedule_name,
        CASE 
            WHEN schedule_type = '5/2' THEN 9
            WHEN schedule_type = '2/2' THEN 12
            ELSE 8
        END as daily_hours,
        CASE 
            WHEN schedule_type = '5/2' THEN 8
            WHEN schedule_type = '2/2' THEN 11
            ELSE 7
        END as work_hours,
        1 as break_hours,
        CASE 
            WHEN schedule_type = '5/2' THEN '8 часов работы + 1 час обед'::TEXT
            WHEN schedule_type = '2/2' THEN '11 часов работы + 1 час обед'::TEXT
            ELSE 'Стандартный график'::TEXT
        END as description;
END;
$$ LANGUAGE plpgsql;

-- 6. Проверяем результат
SELECT 
    'Обновление завершено!' as status,
    COUNT(CASE WHEN work_schedule = '5/2' THEN 1 END) as users_5_2,
    COUNT(CASE WHEN work_schedule = '2/2' THEN 1 END) as users_2_2,
    COUNT(CASE WHEN work_schedule NOT IN ('5/2', '2/2') THEN 1 END) as invalid_schedules
FROM user_profiles;

COMMIT;

SELECT 'Унификация рабочих графиков завершена!' as final_status; 