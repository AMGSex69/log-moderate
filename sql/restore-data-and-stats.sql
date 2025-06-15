-- ===========================================
-- ВОССТАНОВЛЕНИЕ ДАННЫХ И СТАТИСТИКИ
-- ===========================================

-- 1. Проверяем текущее состояние данных
SELECT 'Текущие данные пользователя:' as check_type;
SELECT 
    up.id,
    up.full_name,
    up.position,
    up.admin_role,
    up.is_admin,
    up.office_id,
    up.avatar_url,
    o.name as office_name
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.id IN (
    SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru'
);

-- 2. Проверяем данные в employees
SELECT 'Данные в employees:' as check_type;
SELECT 
    e.id,
    e.user_id,
    e.full_name,
    e.position,
    e.admin_role,
    e.is_admin,
    e.office_id,
    e.is_active,
    o.name as office_name
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
WHERE e.user_id IN (
    SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru'
);

-- 3. Проверяем всех сотрудников в системе
SELECT 'Все сотрудники в системе:' as check_type;
SELECT 
    e.id,
    e.full_name,
    e.position,
    e.office_id,
    o.name as office_name,
    e.is_active
FROM employees e
LEFT JOIN offices o ON o.id = e.office_id
ORDER BY e.full_name;

-- 4. Восстанавливаем правильные данные для вашего профиля
DO $$
DECLARE
    user_uuid UUID;
    user_email TEXT := 'egordolgih@mail.ru';
    default_office_id INTEGER;
BEGIN
    -- Получаем UUID пользователя
    SELECT id INTO user_uuid FROM auth.users WHERE email = user_email;
    
    IF user_uuid IS NULL THEN
        RAISE NOTICE 'Пользователь % не найден', user_email;
        RETURN;
    END IF;
    
    -- Получаем ID офиса "Рассвет"
    SELECT id INTO default_office_id FROM offices WHERE name = 'Рассвет' LIMIT 1;
    IF default_office_id IS NULL THEN
        default_office_id := 1;
    END IF;
    
    -- Обновляем профиль с правильными данными (только существующие колонки)
    UPDATE user_profiles SET
        full_name = 'Егор Долгих',
        position = 'Супер-администратор',
        admin_role = 'super_admin',
        is_admin = true,
        office_id = default_office_id,
        work_schedule = '5/2',
        work_hours = 9,
        updated_at = NOW()
    WHERE id = user_uuid;
    
    -- Обновляем запись в employees (только существующие колонки)
    UPDATE employees SET
        full_name = 'Егор Долгих',
        position = 'Супер-администратор',
        admin_role = 'super_admin',
        is_admin = true,
        office_id = default_office_id,
        work_schedule = '5/2',
        work_hours = 9,
        is_active = true,
        updated_at = NOW()
    WHERE user_id = user_uuid;
    
    RAISE NOTICE 'Данные пользователя % восстановлены', user_email;
END $$;

-- 5. Создаем тестовых сотрудников если их нет
DO $$
DECLARE
    default_office_id INTEGER;
BEGIN
    -- Получаем ID офиса "Рассвет"
    SELECT id INTO default_office_id FROM offices WHERE name = 'Рассвет' LIMIT 1;
    
    -- Создаем тестовых сотрудников для демонстрации (только существующие колонки)
    INSERT INTO employees (
        full_name, position, office_id, work_schedule, work_hours,
        is_admin, admin_role, is_active, created_at, updated_at
    ) VALUES 
    ('Иван Петров', 'Менеджер', default_office_id, '5/2', 8, false, 'user', true, NOW(), NOW()),
    ('Мария Сидорова', 'Специалист', default_office_id, '5/2', 8, false, 'user', true, NOW(), NOW()),
    ('Алексей Козлов', 'Аналитик', default_office_id, '5/2', 8, false, 'user', true, NOW(), NOW())
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Тестовые сотрудники созданы';
END $$;

-- 6. Проверяем функции статистики
SELECT 'Тест функции статистики офиса:' as test_type;
SELECT * FROM get_office_statistics(
    (SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru')
);

-- 7. Проверяем функцию лидерборда (если существует)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_leaderboard_with_current_user') THEN
        PERFORM * FROM get_leaderboard_with_current_user(
            (SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru')
        ) LIMIT 5;
        RAISE NOTICE 'Функция лидерборда протестирована';
    ELSE
        RAISE NOTICE 'Функция лидерборда не найдена';
    END IF;
END $$;

-- 8. Создаем тестовые рабочие сессии для статистики
DO $$
DECLARE
    user_employee_id INTEGER;
    today_date DATE := CURRENT_DATE;
BEGIN
    -- Получаем employee_id пользователя
    SELECT id INTO user_employee_id 
    FROM employees 
    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru');
    
    IF user_employee_id IS NOT NULL THEN
        -- Создаем рабочую сессию на сегодня
        INSERT INTO work_sessions (
            employee_id, date, clock_in_time, total_work_minutes, created_at, updated_at
        ) VALUES (
            user_employee_id, 
            today_date, 
            CURRENT_TIMESTAMP - INTERVAL '4 hours',
            240, -- 4 часа работы
            NOW(), 
            NOW()
        ) ON CONFLICT (employee_id, date) DO UPDATE SET
            total_work_minutes = EXCLUDED.total_work_minutes,
            updated_at = NOW();
        
        RAISE NOTICE 'Тестовая рабочая сессия создана для employee_id %', user_employee_id;
    ELSE
        RAISE NOTICE 'Employee не найден для создания рабочей сессии';
    END IF;
END $$;

-- 9. Финальная проверка восстановленных данных
SELECT 'Восстановленные данные:' as final_check;
SELECT 
    up.id,
    up.full_name,
    up.position,
    up.admin_role,
    up.is_admin,
    up.office_id,
    o.name as office_name,
    up.work_schedule,
    up.work_hours
FROM user_profiles up
LEFT JOIN offices o ON o.id = up.office_id
WHERE up.id IN (
    SELECT id FROM auth.users WHERE email = 'egordolgih@mail.ru'
);

-- 10. Проверяем количество сотрудников
SELECT 'Количество сотрудников в системе:' as count_check;
SELECT COUNT(*) as total_employees FROM employees WHERE is_active = true;

-- Скрипт завершен - данные пользователя и статистика восстановлены 