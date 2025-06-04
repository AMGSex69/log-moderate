# 🚀 Руководство по настройке Supabase для Task Logger

## Вариант 1: Восстановление существующего проекта

1. Зайдите на https://supabase.com/dashboard
2. Найдите проект `qodmtekryabmcnuvvbyf`
3. Если проект приостановлен (paused), нажмите **"Restore Project"**
4. Дождитесь восстановления (несколько минут)
5. Проект должен заработать!

## Вариант 2: Создание нового проекта

### Шаг 1: Создайте новый проект Supabase

1. Зайдите на https://supabase.com/dashboard
2. Нажмите **"New Project"**
3. Выберите организацию
4. Введите название: `task-logger-new`
5. Создайте пароль для базы данных (сохраните его!)
6. Выберите регион: **Central EU (Frankfurt)** (ближе к вам)
7. Нажмите **"Create new project"**

### Шаг 2: Настройте базу данных

1. После создания проекта перейдите в **SQL Editor**
2. Скопируйте и выполните содержимое файла `database-complete-setup.sql`
3. Дождитесь выполнения (может занять 1-2 минуты)

### Шаг 3: Обновите конфигурацию приложения

1. В Supabase Dashboard перейдите в **Settings** → **API**
2. Скопируйте:
   - **Project URL** (например: `https://abcdefg.supabase.co`)
   - **anon public** ключ

3. Обновите файл `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ваш-новый-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш-новый-anon-key
```

### Шаг 4: Перезапустите приложение

```bash
npm run dev
```

## Вариант 3: Предотвращение будущих пауз

Чтобы ваш Supabase проект не приостанавливался в будущем, добавьте keep-alive функциональность:

### Создайте API endpoint для поддержания активности

Создайте файл `app/api/keep-alive/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Простой запрос к базе данных для поддержания активности
    const { data, error } = await supabase
      .from('task_types')
      .select('id')
      .limit(1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      status: 'success', 
      timestamp: new Date().toISOString(),
      message: 'Database is active'
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Keep alive failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
```

### Настройте cron job (для продакшена)

Создайте файл `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/keep-alive",
      "schedule": "0 0 */3 * *"
    }
  ]
}
```

## Проверка работоспособности

После настройки проверьте:

1. ✅ Приложение загружается без ошибок
2. ✅ В консоли видно "✅ Auth initialization complete"  
3. ✅ Mock пользователь "Разработчик" создан
4. ✅ Данные загружаются корректно

## Контакты для помощи

Если возникли проблемы:
- Проверьте консоль браузера на ошибки
- Убедитесь, что все переменные окружения правильно заданы
- Проверьте статус Supabase проекта в Dashboard

## Дополнительная информация

- Supabase проекты на бесплатном тарифе приостанавливаются после 7 дней неактивности
- Восстановление возможно в течение 90 дней
- Keep-alive функция предотвращает автоматическую паузу 