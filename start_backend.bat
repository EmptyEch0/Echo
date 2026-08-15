@echo off
echo Starting Echo AI Local FastAPI Backend...
cd /d "%~dp0backend"
python -m pip install -r requirements.txt
python main.py
pause
