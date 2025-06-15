-- Execute Employee Data Cleanup (ИСПРАВЛЕННАЯ ВЕРСИЯ)
-- Исправляет дублированные записи nikita

-- Создаём резервную копию
CREATE TABLE IF NOT EXISTS employees_backup_cleanup AS 
SELECT * FROM employees WHERE id IN (301, 302);

BEGIN;

-- Обновляем первую запись nikita (301) правильными данными
UPDATE employees 
SET 
    full_name = 'Никита Тимофеев',
    email = 'nikita.timofeev.2022@mail.ru',
    updated_at = NOW()
WHERE id = 301;

-- Удаляем дубликат (302)
DELETE FROM employees WHERE id = 302;

-- Проверяем изменения
SELECT 'ПОСЛЕ ОЧИСТКИ - Обновлённая запись:' as status;
SELECT id, full_name, email, position, is_active
FROM employees 
WHERE id = 301;

-- Подтверждаем удаление
SELECT 'ПРОВЕРКА УДАЛЕНИЯ:' as status;
SELECT CASE 
    WHEN COUNT(*) = 0 THEN 'УСПЕХ: Дубликат ID 302 удалён'
    ELSE 'ОШИБКА: ID 302 всё ещё существует'
END as result
FROM employees WHERE id = 302;

-- Показываем итоговый список всех активных сотрудников
SELECT 'ФИНАЛЬНЫЙ СПИСОК СОТРУДНИКОВ:' as status;
SELECT id, full_name, email, position, is_active
FROM employees 
WHERE is_active = true
ORDER BY position DESC, full_name;

COMMIT;

-- Сообщение об успехе
SELECT 'ОЧИСТКА ВЫПОЛНЕНА УСПЕШНО' as final_status; 