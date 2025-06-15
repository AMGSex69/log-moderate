-- Очистка конфликтующих RLS политик для employees и user_profiles
-- Эти политики дают слишком широкий доступ и нарушают безопасность

-- Удаляем проблемные политики для employees
DROP POLICY IF EXISTS "employees_all_access" ON public.employees;
DROP POLICY IF EXISTS "employees_full_access" ON public.employees;

-- Удаляем возможные проблемные политики для user_profiles
DROP POLICY IF EXISTS "user_profiles_all_access" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_full_access" ON public.user_profiles;

-- Проверяем, что RLS включен
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Оставляем только необходимые политики для employees:
-- 1. Пользователи могут видеть свою запись
-- 2. Пользователи могут обновлять свою запись  
-- 3. Админы могут управлять всеми записями
-- 4. Пользователи могут видеть коллег из того же офиса

-- Убеждаемся, что у нас есть политика INSERT для employees (может понадобиться)
DROP POLICY IF EXISTS "Users can insert their own employee record" ON public.employees;
CREATE POLICY "Users can insert their own employee record" ON public.employees
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Для user_profiles убеждаемся что есть все нужные политики
-- (они уже должны быть созданы предыдущим скриптом)

-- Проверяем результат - показываем оставшиеся политики
SELECT schemaname, tablename, policyname, permissive, roles, cmd, 
       LEFT(qual, 100) as qual_short,
       LEFT(with_check, 100) as with_check_short
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('employees', 'user_profiles')
ORDER BY tablename, policyname; 