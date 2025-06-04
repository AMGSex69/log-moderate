# 📋 Руководство по обновлению типов задач

## 🚀 Быстрое развертывание новых задач

### 1. Добавление новых типов задач в базу данных

**Выполните SQL скрипт в Supabase SQL Editor:**

```sql
-- Скопируйте и выполните содержимое файла:
-- add-new-task-types.sql
```

Этот скрипт добавит **38 новых типов задач**, сгруппированных по 8 категориям:

### 📊 Новые группы задач:

1. **Актуализация** (9 задач)
   - Актуализация ОСС, Обзвоны по рисовке, Отчеты физикам и др.

2. **Работа с админкой** (2 задачи)
   - Актуализация реестра домов, Модерация чатов

3. **ОСС и Опросы** (7 задач)
   - Модерация опросов, Спецопросы, Письма в дирекции

4. **Поддержка/Прочее** (6 задач)
   - АСГУФ, Валидация, Задачи руководства

5. **МЖИ** (3 задачи)
   - Внесение решений, Проверка протоколов

6. **Офисные задачи** (6 задач)
   - Входящие звонки, Курьер ЭД, Работа с посетителями

7. **Обходы** (3 задачи)
   - Обходы домов, Заполнение карточек

8. **СТП** (3 задачи)
   - Нетиповые обращения, Отмена ОСС, Подселенцы

### 2. Обновление конфигурации игрофикации

Файл `lib/game-config.ts` был обновлен для поддержки:

✅ **Новых групп задач** с цветовой кодировкой  
✅ **Обновленной системы наград** (5-30 баллов за задачу)  
✅ **Настроек многозадачности** (до 3 одновременных задач)  
✅ **Специальных бонусов** за эффективность и группы  
✅ **Новых достижений** для многозадачности  

### 3. Новые возможности многозадачности

#### Основные функции:

- **Одновременная работа** над 3 задачами максимум
- **Переключение между задачами** без потери прогресса  
- **Автоматическая пауза** неактивных задач через 30 минут
- **Heartbeat система** для отслеживания активности
- **Бонусы за многозадачность** (+20% к очкам)

#### Новые методы DatabaseService:

```typescript
// Получить активные сессии сотрудника
await DatabaseService.getActiveSessionsByEmployee(employeeId)

// Переключиться на другую задачу
await DatabaseService.switchActiveTask(employeeId, taskTypeId)

// Приостановить/возобновить задачу
await DatabaseService.pauseActiveSession(sessionId)
await DatabaseService.resumeActiveSession(sessionId)

// Завершить все активные задачи
await DatabaseService.endAllActiveSessionsForEmployee(employeeId)

// Очистить неактивные сессии
await DatabaseService.cleanupIdleSessions()

// Получить статистику многозадачности
await DatabaseService.getMultitaskingStats(employeeId, startDate, endDate)

// Получить задачи сгруппированные по категориям
await DatabaseService.getTaskTypesByGroup()

// Аналитика по группам
await DatabaseService.getGroupAnalytics(startDate, endDate)
```

## 🔧 Обновление компонентов

### 1. Компонент выбора задач

Обновите компонент для отображения задач по группам:

```typescript
import { DatabaseService } from '@/lib/database-service'
import { getTaskGroupColor } from '@/lib/game-config'

// Получаем задачи сгруппированные
const { data: groupedTasks } = await DatabaseService.getTaskTypesByGroup()

// Отображаем по группам с цветами
{Object.entries(groupedTasks).map(([groupKey, group]) => (
  <div key={groupKey} style={{ borderLeft: `4px solid ${group.color}` }}>
    <h3>{group.name}</h3>
    {group.tasks.map(task => (
      <TaskButton key={task.id} task={task} />
    ))}
  </div>
))}
```

### 2. Компонент активных задач

Создайте компонент для управления несколькими активными задачами:

```typescript
const ActiveTasksPanel = ({ employeeId }) => {
  const [activeSessions, setActiveSessions] = useState([])
  
  useEffect(() => {
    loadActiveSessions()
  }, [employeeId])

  const loadActiveSessions = async () => {
    const { data } = await DatabaseService.getActiveSessionsByEmployee(employeeId)
    setActiveSessions(data || [])
  }

  const switchTask = async (taskTypeId) => {
    await DatabaseService.switchActiveTask(employeeId, taskTypeId)
    loadActiveSessions()
  }

  return (
    <div className="active-tasks-panel">
      {activeSessions.map(session => (
        <ActiveTaskCard 
          key={session.id} 
          session={session}
          onSwitch={() => switchTask(session.task_type_id)}
          onEnd={() => endTask(session.id)}
        />
      ))}
    </div>
  )
}
```

### 3. Heartbeat система

Добавьте автоматическое обновление активности:

```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    // Обновляем heartbeat для всех активных сессий
    for (const session of activeSessions) {
      await DatabaseService.updateActiveSessionHeartbeat(session.id)
    }
    
    // Очищаем неактивные сессии
    await DatabaseService.cleanupIdleSessions()
  }, 60000) // каждую минуту

  return () => clearInterval(interval)
}, [activeSessions])
```

## 📊 Обновленная аналитика

### Новые виды отчетов:

1. **Аналитика по группам задач**
   ```typescript
   const { data: groupStats } = await DatabaseService.getGroupAnalytics(startDate, endDate)
   ```

2. **Статистика многозадачности**
   ```typescript
   const { data: multitaskStats } = await DatabaseService.getMultitaskingStats(employeeId)
   ```

3. **Рекомендации по оптимизации**
   ```typescript
   const { data: suggestions } = await DatabaseService.getWorkOptimizationSuggestions(employeeId)
   ```

## ✅ Чек-лист обновления

### База данных:
- [ ] Выполнен скрипт `add-new-task-types.sql`
- [ ] Добавлено 38 новых типов задач
- [ ] Проверена работа многозадачности

### Код:
- [ ] Обновлен `lib/game-config.ts`
- [ ] Обновлен `lib/database-service.ts` 
- [ ] Компоненты используют новые методы
- [ ] Добавлена поддержка групп задач
- [ ] Реализована система heartbeat

### Интерфейс:
- [ ] Задачи отображаются по группам
- [ ] Работает переключение между задачами
- [ ] Показываются активные задачи
- [ ] Обновлена аналитика

### Тестирование:
- [ ] Создание активных сессий работает
- [ ] Переключение между задачами работает
- [ ] Лимит 3 задач соблюдается
- [ ] Heartbeat обновляется
- [ ] Неактивные сессии очищаются

## 🔄 Миграция существующих данных

Если у вас есть существующие активные сессии, они останутся работать. Новые ограничения применяются только к новым сессиям.

## 📱 Рекомендации по UX

1. **Визуальные индикаторы**: Используйте цвета групп для выделения задач
2. **Уведомления**: Показывайте предупреждения при превышении лимита задач
3. **Автосохранение**: Регулярно сохраняйте прогресс активных задач
4. **Быстрое переключение**: Добавьте горячие клавиши для смены задач

---

**Время обновления**: ~15-20 минут  
**Версия**: 3.0 (многозадачность + новые типы задач)  
**Статус**: ✅ Готово к внедрению 