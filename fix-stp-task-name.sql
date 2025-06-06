-- Исправление названия задачи СТП
UPDATE task_types 
SET name = 'Работа с нетиповыми обращениями'
WHERE name = 'Работа с нетиповыми обращениями СТП';

-- Проверяем результат
SELECT name FROM task_types 
WHERE name LIKE '%нетиповыми обращениями%' OR name LIKE '%СТП%'; 