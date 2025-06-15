-- Проверяем и добавляем колонку avatar_url в user_profiles если её нет
DO $$ 
BEGIN
    -- Проверяем существование колонки
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'avatar_url'
        AND table_schema = 'public'
    ) THEN
        -- Добавляем колонку если её нет
        ALTER TABLE public.user_profiles 
        ADD COLUMN avatar_url TEXT;
        
        RAISE NOTICE 'Колонка avatar_url добавлена в таблицу user_profiles';
    ELSE
        RAISE NOTICE 'Колонка avatar_url уже существует в таблице user_profiles';
    END IF;
END $$;

-- Проверяем существование bucket для аватаров
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'avatars'
    ) THEN
        -- Создаем bucket
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'avatars',
            'avatars', 
            true,
            2097152, -- 2MB
            ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        );
        
        RAISE NOTICE 'Bucket avatars создан';
    ELSE
        RAISE NOTICE 'Bucket avatars уже существует';
    END IF;
END $$;

-- Создаем RLS политики для storage если их нет
DO $$
BEGIN
    -- Политика для загрузки
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Allow authenticated users to upload avatars'
    ) THEN
        CREATE POLICY "Allow authenticated users to upload avatars" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id = 'avatars' AND
            auth.role() = 'authenticated' AND
            (storage.foldername(name))[1] = 'avatars'
        );
        
        RAISE NOTICE 'Политика загрузки для avatars создана';
    END IF;

    -- Политика для просмотра
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Allow public to view avatars'
    ) THEN
        CREATE POLICY "Allow public to view avatars" ON storage.objects
        FOR SELECT USING (bucket_id = 'avatars');
        
        RAISE NOTICE 'Политика просмотра для avatars создана';
    END IF;

    -- Политика для удаления
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Allow users to delete their own avatars'
    ) THEN
        CREATE POLICY "Allow users to delete their own avatars" ON storage.objects
        FOR DELETE USING (
            bucket_id = 'avatars' AND
            auth.role() = 'authenticated' AND
            owner = auth.uid()
        );
        
        RAISE NOTICE 'Политика удаления для avatars создана';
    END IF;

    -- Политика для обновления
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Allow users to update their own avatars'
    ) THEN
        CREATE POLICY "Allow users to update their own avatars" ON storage.objects
        FOR UPDATE USING (
            bucket_id = 'avatars' AND
            auth.role() = 'authenticated' AND
            owner = auth.uid()
        );
        
        RAISE NOTICE 'Политика обновления для avatars создана';
    END IF;
END $$; 