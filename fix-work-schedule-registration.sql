-- Исправление триггера для корректной обработки графика работы при регистрации

-- Обновляем функцию для создания сотрудника при регистрации
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    work_schedule_value TEXT;
    work_hours_value INTEGER;
BEGIN
    -- Извлекаем график работы из user_metadata
    work_schedule_value := COALESCE(NEW.raw_user_meta_data->>'work_schedule', '5/2');
    
    -- Определяем количество рабочих часов на основе графика
    work_hours_value := CASE 
        WHEN work_schedule_value = '2/2' THEN 12
        WHEN work_schedule_value = '5/2' THEN 9
        ELSE 9 -- по умолчанию
    END;

    INSERT INTO employees (user_id, full_name, email, position, work_schedule, work_hours)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Новый сотрудник'),
        NEW.email,
        'Сотрудник',
        work_schedule_value,
        work_hours_value
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Обновляем также функцию getEmployeeId в auth.ts, чтобы она использовала правильный график
-- Но это нужно будет сделать в коде, а здесь мы обновим существующих пользователей

-- Обновляем существующих пользователей, у которых установлен неправильный график
UPDATE employees 
SET 
    work_schedule = CASE 
        WHEN work_schedule = '8+1' THEN '5/2'
        WHEN work_schedule = '12' THEN '2/2'
        ELSE work_schedule
    END,
    work_hours = CASE 
        WHEN work_schedule = '8+1' OR work_schedule = '5/2' THEN 9
        WHEN work_schedule = '12' OR work_schedule = '2/2' THEN 12
        ELSE work_hours
    END,
    updated_at = NOW()
WHERE work_schedule IN ('8+1', '12') OR work_hours IS NULL;

-- Информационное сообщение
SELECT 'Триггер обновлен! Теперь график работы будет корректно сохраняться при регистрации.' as status; 