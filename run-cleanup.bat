@echo off
echo Запуск очистки базы данных...
psql "postgresql://postgres.jnqmqcchxhwsxqpbtzlk:HkVB7y2TQdXKNcYr@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" -f check-and-cleanup-db.sql
echo Очистка завершена
pause 