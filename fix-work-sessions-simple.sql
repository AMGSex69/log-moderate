-- ПРОСТОЕ ИСПРАВЛЕНИЕ: Добавление уникального ограничения для work_sessions
-- Этот скрипт безопасно добавляет уникальное ограничение

-- 1. Показываем текущее состояние
SELECT 'Текущие ограничения на work_sessions:' as info;
SELECT 
    constraint_name, 
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'work_sessions';

-- 2. Проверяем дубликаты
SELECT 'Проверка дубликатов:' as info;
SELECT 
    employee_id, 
    date, 
    COUNT(*) as count
FROM work_sessions 
GROUP BY employee_id, date 
HAVING COUNT(*) > 1;

-- 3. Удаляем дубликаты если есть
DELETE FROM work_sessions w1
WHERE w1.id NOT IN (
    SELECT MIN(w2.id)
    FROM work_sessions w2
    WHERE w2.employee_id = w1.employee_id 
    AND w2.date = w1.date
);

-- 4. Добавляем уникальное ограничение
ALTER TABLE work_sessions 
ADD CONSTRAINT work_sessions_employee_date_unique 
UNIQUE (employee_id, date);

-- 5. Проверяем результат
SELECT 'Ограничение добавлено успешно!' as result;
SELECT 
    constraint_name, 
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'work_sessions'
AND constraint_type = 'UNIQUE'; 