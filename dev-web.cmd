@echo off
setlocal
set "ROOT=%~dp0"

node --preserve-symlinks --preserve-symlinks-main "%ROOT%node_modules\next\dist\bin\next" dev
