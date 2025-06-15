-- Проверка RLS политик для employees после очистки
SELECT schemaname, tablename, policyname, permissive, roles, cmd, 
       LEFT(qual, 100) as qual_short,
       LEFT(with_check, 100) as with_check_short
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'employees'
ORDER BY policyname; 