@echo off
setlocal
set "ROOT=%~dp0"

start "Danix Web" cmd /c "%ROOT%dev-web.cmd"
node --preserve-symlinks --preserve-symlinks-main "%ROOT%node_modules\wait-on\bin\wait-on" tcp:3000
if errorlevel 1 exit /b %errorlevel%

call "%ROOT%dev-desktop.cmd"
