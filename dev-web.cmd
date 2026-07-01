@echo off
setlocal
set "ROOT=%~dp0"
set "NODE=%ROOT%.tools\node-v20.19.3-win-x64\node.exe"

"%NODE%" --preserve-symlinks --preserve-symlinks-main "%ROOT%node_modules\next\dist\bin\next" dev
