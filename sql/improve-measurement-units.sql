-- Улучшаем единицы измерения для конкретных задач

UPDATE task_types 
SET measurement_unit = CASE 
    WHEN name ILIKE '%обзвон%' THEN 'звонков'
    WHEN name ILIKE '%звонки%' OR name ILIKE '%звонок%' THEN 'звонков'
    WHEN name ILIKE '%писем%' OR name ILIKE '%письм%' THEN 'писем'
    WHEN name ILIKE '%протокол%' THEN 'протоколов'
    WHEN name ILIKE '%модерация%' THEN 'модераций'
    WHEN name ILIKE '%проверка%' THEN 'проверок'
    WHEN name ILIKE '%актуализация%' THEN 'актуализаций'
    WHEN name ILIKE '%обход%' THEN 'обходов'
    WHEN name ILIKE '%статистика%' THEN 'отчётов'
    WHEN name ILIKE '%валидация%' THEN 'валидаций'
    WHEN name ILIKE '%созвон%' THEN 'созвонов'
    WHEN name ILIKE '%обучение%' THEN 'обучений'
    WHEN name ILIKE '%курьер%' THEN 'доставок'
    WHEN name ILIKE '%плакат%' THEN 'плакатов'
    WHEN name ILIKE '%скрипт%' THEN 'скриптов'
    WHEN name ILIKE '%карточек%' THEN 'карточек'
    WHEN name ILIKE '%таблиц%' THEN 'таблиц'
    WHEN name ILIKE '%реестр%' THEN 'реестров'
    WHEN name ILIKE '%опрос%' THEN 'опросов'
    WHEN name ILIKE '%чат%' THEN 'чатов'
    WHEN name ILIKE '%выгрузк%' THEN 'выгрузок'
    WHEN name ILIKE '%посетител%' THEN 'посетителей'
    WHEN name ILIKE '%обращени%' THEN 'обращений'
    ELSE measurement_unit
END;

-- Показываем обновлённый результат
SELECT 'ОБНОВЛЁННЫЕ ЕДИНИЦЫ ИЗМЕРЕНИЯ:' as status;
SELECT id, name, measurement_unit 
FROM task_types 
WHERE measurement_unit != 'единиц'
ORDER BY measurement_unit, name; 