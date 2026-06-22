@echo off
cd /d "%~dp0"
echo 🚀 로컬 서버 시작 중...
echo.
echo 브라우저에서 이 주소로 접속하세요:
echo http://localhost:8000
echo.
python -m http.server 8000
pause
