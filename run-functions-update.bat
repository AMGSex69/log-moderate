@echo off
echo Starting functions update...
psql -d "postgresql://postgres.exlybdxfxhmdoyfcoheu:XFPqpUDOSkpJR8vL@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" -f update-functions-for-offices.sql
echo.
echo Functions update complete! Check above for any errors.
pause 