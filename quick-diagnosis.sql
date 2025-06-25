-- БЫСТРАЯ ДИАГНОСТИКА ПРОБЛЕМ С ДАННЫМИ

SELECT '=== ДИАГНОСТИКА ПРОБЛЕМ С ДАННЫМИ ===' as title;

-- Общая статистика таблиц
SELECT 
    'ОБЩАЯ СТАТИСТИКА' as section,
    (SELECT COUNT(*) FROM user_profiles) as user_profiles_count,
    (SELECT COUNT(*) FROM employees) as employees_count,
    (SELECT COUNT(*) FROM task_logs) as task_logs_count,
    (SELECT COUNT(*) FROM work_sessions) as work_sessions_count,
    (SELECT COUNT(*) FROM active_sessions) as active_sessions_count;

-- Проверяем orphaned записи в task_logs
SELECT 'ORPHANED TASK_LOGS' as section;
SELECT 
    tl.employee_id,
    COUNT(*) as orphaned_count
FROM task_logs tl
LEFT JOIN employees e ON e.id = tl.employee_id
WHERE e.id IS NULL
GROUP BY tl.employee_id
ORDER BY tl.employee_id;

-- Проверяем orphaned записи в work_sessions
SELECT 'ORPHANED WORK_SESSIONS' as section;
SELECT 
    ws.employee_id,
    COUNT(*) as orphaned_count
FROM work_sessions ws
LEFT JOIN employees e ON e.id = ws.employee_id
WHERE e.id IS NULL
GROUP BY ws.employee_id
ORDER BY ws.employee_id;

-- Проверяем orphaned записи в active_sessions
SELECT 'ORPHANED ACTIVE_SESSIONS' as section;
SELECT 
    acs.employee_id,
    COUNT(*) as orphaned_count
FROM active_sessions acs
LEFT JOIN employees e ON e.id = acs.employee_id
WHERE e.id IS NULL
GROUP BY acs.employee_id
ORDER BY acs.employee_id;

-- Итоговая статистика orphaned записей
SELECT 
    'ИТОГО ORPHANED ЗАПИСЕЙ' as section,
    (SELECT COUNT(*) FROM task_logs tl LEFT JOIN employees e ON e.id = tl.employee_id WHERE e.id IS NULL) as orphaned_task_logs,
    (SELECT COUNT(*) FROM work_sessions ws LEFT JOIN employees e ON e.id = ws.employee_id WHERE e.id IS NULL) as orphaned_work_sessions,
    (SELECT COUNT(*) FROM active_sessions acs LEFT JOIN employees e ON e.id = acs.employee_id WHERE e.id IS NULL) as orphaned_active_sessions;

SELECT 'ДИАГНОСТИКА ЗАВЕРШЕНА' as status; 