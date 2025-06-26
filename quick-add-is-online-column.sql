-- БЫСТРОЕ ИСПРАВЛЕНИЕ: Добавляем колонку is_online
-- Ошибка: "Could not find the 'is_online' column of 'user_profiles' in the schema cache"

-- 1. Добавляем недостающую колонку is_online
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- 2. Устанавливаем значения по умолчанию для существующих записей
UPDATE public.user_profiles 
SET is_online = false 
WHERE is_online IS NULL;

-- 3. Проверяем результат
SELECT 
    '✅ Колонка is_online добавлена' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_online = false THEN 1 END) as offline_users,
    COUNT(CASE WHEN is_online = true THEN 1 END) as online_users
FROM public.user_profiles;

-- 4. Показываем структуру колонки
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name = 'is_online'
AND table_schema = 'public'; 