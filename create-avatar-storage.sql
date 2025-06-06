-- Создание bucket для аватаров
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB в байтах
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- Разрешения на загрузку для аутентифицированных пользователей
CREATE POLICY "Allow authenticated users to upload avatars" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = 'avatars'
);

-- Разрешения на просмотр для всех
CREATE POLICY "Allow public to view avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Разрешения на удаление для владельцев файлов
CREATE POLICY "Allow users to delete their own avatars" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  owner = auth.uid()
);

-- Разрешения на обновление для владельцев файлов
CREATE POLICY "Allow users to update their own avatars" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  owner = auth.uid()
); 