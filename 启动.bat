@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
if not errorlevel 1 (
  py -3 server.py
  goto finish
)
python -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
if not errorlevel 1 (
  python server.py
  goto finish
)
python3 -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
if not errorlevel 1 (
  python3 server.py
  goto finish
)
echo Python 3.10+ is required. See INSTALL.md or https://www.python.org/downloads/
:finish
pause
endlocal
