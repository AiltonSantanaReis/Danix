@echo off
setlocal
set "ROOT=%~dp0"
set "ELECTRON_RUN_AS_NODE="

set "NODE="
for /f "delims=" %%I in ('where node') do (
  set "NODE=%%I"
  goto :node_found
)

echo [build-portable] Node.js nao encontrado no PATH.
echo Instale Node.js 20 LTS ou superior e tente novamente.
exit /b 1

:node_found

"%NODE%" --preserve-symlinks --preserve-symlinks-main "%ROOT%node_modules\next\dist\bin\next" build --webpack
if errorlevel 1 exit /b %errorlevel%

if exist "%ROOT%.next\standalone\local-data" rmdir /s /q "%ROOT%.next\standalone\local-data"
"%NODE%" --preserve-symlinks --preserve-symlinks-main "%ROOT%scripts\prepare-standalone.cjs"
if errorlevel 1 exit /b %errorlevel%
if exist "%ROOT%.next\standalone\.next\static" rmdir /s /q "%ROOT%.next\standalone\.next\static"
xcopy "%ROOT%.next\static" "%ROOT%.next\standalone\.next\static" /E /I /Y >nul
if exist "%ROOT%public" xcopy "%ROOT%public" "%ROOT%.next\standalone\public" /E /I /Y >nul

"%NODE%" --preserve-symlinks --preserve-symlinks-main "%ROOT%node_modules\electron-builder\cli.js" --win dir --config.directories.output=dist-portable-ready
if errorlevel 1 exit /b %errorlevel%

if exist "%ROOT%dist-portable-ready\win-unpacked\resources\standalone" rmdir /s /q "%ROOT%dist-portable-ready\win-unpacked\resources\standalone"
xcopy "%ROOT%.next\standalone" "%ROOT%dist-portable-ready\win-unpacked\resources\standalone" /E /I /Y >nul
if errorlevel 1 exit /b %errorlevel%
if not exist "%ROOT%dist-portable-ready\win-unpacked\resources\node" mkdir "%ROOT%dist-portable-ready\win-unpacked\resources\node"
copy "%NODE%" "%ROOT%dist-portable-ready\win-unpacked\resources\node\node.exe" >nul
if errorlevel 1 exit /b %errorlevel%
copy "%ROOT%Danix.ico" "%ROOT%dist-portable-ready\win-unpacked\resources\Danix.ico" >nul
if errorlevel 1 exit /b %errorlevel%

if exist "%ROOT%dist-portable-ready\Danix-Portable.zip" del "%ROOT%dist-portable-ready\Danix-Portable.zip"
pushd "%ROOT%dist-portable-ready\win-unpacked"
tar -a -cf "%ROOT%dist-portable-ready\Danix-Portable.zip" *
if errorlevel 1 (
  popd
  exit /b %errorlevel%
)
popd
