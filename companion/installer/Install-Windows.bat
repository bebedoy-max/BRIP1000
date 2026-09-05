@echo off
setlocal enabledelayedexpansion
title SuperIT Event Uploader - Installer (Windows)
cd /d "%~dp0"

echo ============================================
echo   SuperIT Event Uploader 1.2.12 - Installer
echo ============================================
echo.

set "PY="
where py >nul 2>&1
if %errorlevel%==0 (
  for %%V in (3.11 3.12) do (
    if not defined PY (
      py -%%V --version >nul 2>&1
      if !errorlevel!==0 set "PY=py -%%V"
    )
  )
)

if not defined PY (
  python --version >nul 2>&1
  if !errorlevel!==0 (
    for /f "tokens=2" %%A in ('python --version 2^>^&1') do set "PYVER=%%A"
    for /f "tokens=1,2 delims=." %%A in ("!PYVER!") do (
      if "%%A"=="3" (
        if %%B GEQ 11 if %%B LEQ 12 set "PY=python"
      )
    )
  )
)

if not defined PY (
  echo [X] Python 3.11 atau 3.12 64-bit tidak ditemukan.
  echo     Unduh Python 3.11 64-bit di https://www.python.org/downloads/windows/
  echo     Centang "Add python.exe to PATH" saat instalasi, lalu jalankan lagi file ini.
  pause
  exit /b 1
)

echo Menggunakan: %PY%
%PY% --version

set "APPDIR=%LOCALAPPDATA%\SuperITEventUploader"
set "SOURCEDIR=%~dp0app"
if not exist "%SOURCEDIR%\requirements.txt" set "SOURCEDIR=%~dp0"

if not exist "%SOURCEDIR%\requirements.txt" (
  echo [X] Paket installer tidak lengkap: requirements.txt tidak ditemukan.
  echo     Ekstrak seluruh isi ZIP ke satu folder, lalu jalankan Install-Windows.bat dari folder tersebut.
  pause
  exit /b 1
)
if not exist "%SOURCEDIR%\run.py" (
  echo [X] Paket installer tidak lengkap: run.py tidak ditemukan.
  pause
  exit /b 1
)

echo [1/4] Menyalin file ke %APPDIR% ...
if exist "%APPDIR%" rmdir /S /Q "%APPDIR%"
mkdir "%APPDIR%"
xcopy /E /I /Y /Q "%SOURCEDIR%\*" "%APPDIR%\" >nul
if errorlevel 1 (
  echo [X] Gagal menyalin file aplikasi dari "%SOURCEDIR%".
  pause
  exit /b 1
)
if not exist "%APPDIR%\requirements.txt" (
  echo [X] requirements.txt gagal disalin. Instalasi dihentikan.
  pause
  exit /b 1
)

echo [2/4] Membuat virtual environment ...
if exist "%APPDIR%\.venv" rmdir /S /Q "%APPDIR%\.venv"
%PY% -m venv "%APPDIR%\.venv" || (echo [X] Gagal membuat venv & pause & exit /b 1)

echo [3/4] Memasang dependensi (butuh internet, +- 5 menit) ...
set "PIP_CACHE_DIR=%APPDIR%\.pipcache"
"%APPDIR%\.venv\Scripts\python.exe" -m pip install --upgrade pip setuptools wheel >nul
"%APPDIR%\.venv\Scripts\python.exe" -m pip install --no-deps "%APPDIR%\vendor\insightface-0.7.3-py3-none-any.whl"
if errorlevel 1 (
  echo [X] Wheel InsightFace bawaan tidak ditemukan atau gagal dipasang.
  pause
  exit /b 1
)
"%APPDIR%\.venv\Scripts\python.exe" -m pip install --only-binary=:all: --no-cache-dir -r "%APPDIR%\requirements.txt"
if errorlevel 1 (
  echo [X] Gagal memasang wheel dependensi. Tidak ada kompilasi C/C++ yang dijalankan.
  echo     Pastikan memakai Python 3.11/3.12 64-bit dan koneksi internet aktif.
  pause
  exit /b 1
)

echo [4/4] Membuat shortcut di Desktop ...
> "%APPDIR%\SuperITEventUploader.bat" echo @echo off
>> "%APPDIR%\SuperITEventUploader.bat" echo cd /d "%APPDIR%"
>> "%APPDIR%\SuperITEventUploader.bat" echo "%APPDIR%\.venv\Scripts\pythonw.exe" run.py

powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\SuperIT Event Uploader.lnk');" ^
  "$s.TargetPath='%APPDIR%\SuperITEventUploader.bat'; $s.WorkingDirectory='%APPDIR%'; $s.Save()"

echo.
echo [OK] Instalasi selesai. Buka "SuperIT Event Uploader" dari Desktop.
pause
