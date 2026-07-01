@echo off
setlocal
set "ROOT=%~dp0"
set "NODE=%ROOT%.tools\node-v20.19.3-win-x64\node.exe"

start "Danix Web" cmd /c "%ROOT%dev-web.cmd"
"%NODE%" --preserve-symlinks --preserve-symlinks-main "%ROOT%node_modules\wait-on\bin\wait-on" tcp:3000
if errorlevel 1 exit /b %errorlevel%

call "%ROOT%dev-desktop.cmd"
