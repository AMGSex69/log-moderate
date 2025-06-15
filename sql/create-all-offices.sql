-- Create all 10 offices from the code
INSERT INTO offices (name, description) VALUES
    ('Рассвет', 'Офис Рассвет - Округа (СЗАО/САО)'),
    ('Будапешт', 'Офис Будапешт - Округа (СВАО/САО)'),
    ('Янтарь', 'Офис Янтарь - Округ (ВАО)'),
    ('Саяны', 'Офис Саяны - Округ (ЮВАО)'),
    ('Бирюсинка', 'Офис Бирюсинка - Округ (ЮАО)'),
    ('Витязь', 'Офис Витязь - Округ (ЮЗАО)'),
    ('Планета', 'Офис Планета - Округ (ЗАО)'),
    ('Зеленоград', 'Офис Зеленоград - Округ (ЗелАО)'),
    ('Тульская', 'Офис Тульская - Округа (ЦАО/ЮАО)'),
    ('Чистые пруды', 'Офис Чистые пруды - Администрация и редакция')
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description;

-- Check all offices now exist
SELECT 
    'All offices created' as info,
    id,
    name,
    description
FROM offices
ORDER BY id;

-- Show count
SELECT 
    'Total offices' as info,
    COUNT(*) as count
FROM offices; 