# Деплой Task Logger на Vercel

## Подготовка к деплою

### 1. Проверьте что проект готов
```bash
# Убедитесь что билд проходит без ошибок
npm run build

# Проверьте что все зависимости установлены
npm install
```

### 2. Убедитесь что все SQL скрипты выполнены
- ✅ `fix-auth-registration.sql` 
- ✅ `fix-missing-employees-final.sql`
- ✅ Проверьте что регистрация и начало рабочего дня работают локально

## Деплой на Vercel

### Способ 1: Через Vercel CLI (Рекомендуется)

1. **Установите Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Авторизуйтесь**:
   ```bash
   vercel login
   ```

3. **Инициализируйте проект**:
   ```bash
   vercel
   ```
   - Выберите "Link to existing project?" → No
   - Введите название проекта: `task-logger` 
   - Оставьте настройки по умолчанию

4. **Настройте переменные окружения**:
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
   
   Введите значения из вашего `.env.local` файла

5. **Деплой**:
   ```bash
   vercel --prod
   ```

### Способ 2: Через GitHub (если код в репозитории)

1. Перейдите на [vercel.com](https://vercel.com)
2. Нажмите "New Project"
3. Импортируйте ваш GitHub репозиторий
4. Добавьте переменные окружения в настройках проекта
5. Нажмите "Deploy"

### Способ 3: Прямая загрузка

1. Перейдите на [vercel.com](https://vercel.com)
2. Нажмите "Deploy" → "Browse" 
3. Выберите папку с проектом
4. Добавьте переменные окружения
5. Нажмите "Deploy"

## Настройка переменных окружения в Vercel

В панели управления Vercel проекта перейдите в **Settings** → **Environment Variables** и добавьте:

```
NEXT_PUBLIC_SUPABASE_URL=https://ваш-проект.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

⚠️ **Важно**: Скопируйте точные значения из вашего `.env.local` файла!

## Настройка домена в Supabase

После деплоя вам нужно обновить настройки в Supabase:

1. Откройте **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Добавьте ваш Vercel URL в **Site URL**: `https://ваш-проект.vercel.app`
3. Добавьте в **Redirect URLs**: `https://ваш-проект.vercel.app/**`

## Проверка деплоя

После успешного деплоя проверьте:

1. **Авторизация работает** - попробуйте войти/зарегистрироваться
2. **База данных доступна** - проверьте что данные загружаются
3. **Все функции работают** - начать рабочий день, создать задачу, профиль

## Полезные команды

```bash
# Посмотреть логи деплоя
vercel logs

# Посмотреть информацию о проекте  
vercel inspect

# Переключиться на production
vercel --prod

# Откатиться к предыдущей версии
vercel rollback
```

## Возможные проблемы и решения

### Ошибка "Module not found"
```bash
npm install
npm run build
vercel --prod
```

### Ошибки подключения к Supabase
- Проверьте переменные окружения в Vercel
- Убедитесь что URL и ключ правильные
- Проверьте настройки CORS в Supabase

### Проблемы с аутентификацией
- Добавьте Vercel URL в настройки Supabase
- Проверьте Redirect URLs
- Убедитесь что RLS политики настроены правильно

## После деплоя

1. **Протестируйте все функции** на production
2. **Настройте мониторинг** в Vercel Analytics  
3. **Добавьте кастомный домен** если нужно
4. **Настройте уведомления** о деплое

---

**Ваш проект будет доступен по адресу**: `https://ваш-проект.vercel.app` 