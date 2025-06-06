@echo off
echo Starting office migration...
psql -d "postgresql://postgres.exlybdxfxhmdoyfcoheu:XFPqpUDOSkpJR8vL@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" -f migrate-districts-to-offices.sql
echo.
echo Migration complete! Check above for any errors.
pause 