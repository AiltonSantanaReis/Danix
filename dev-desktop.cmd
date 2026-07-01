@echo off
setlocal
set "ROOT=%~dp0"

set "ELECTRON_DEV=1"
node --preserve-symlinks --preserve-symlinks-main "%ROOT%node_modules\electron\cli.js" .
