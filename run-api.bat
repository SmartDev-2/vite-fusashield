@echo off
title FusaShield API Server
cd /d "%~dp0fusashield-api"
echo Memulai FusaShield API...
.\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause

