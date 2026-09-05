@echo off
setlocal enabledelayedexpansion
title SuperIT Event Uploader - Build EXE (Windows)

echo ==========================================================
echo   SuperIT Event Uploader - Pembuat Installer EXE
echo ==========================================================
echo.

set "ROOT=%~dp0"
set "SRC=%ROOT%app"
if not exist "%SRC%\run.py" set "SRC=%ROOT%"
if not exist "%SRC%\run.py" (
  echo [X] File run.py tidak ditemukan. Jalankan skrip ini di dalam folder hasil ekstrak ZIP.
  pause
  exit /b 1
)

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
  echo     Pasang Python 3.11 64-bit dari python.org ^(direkomendasikan^).
  echo     Centang "Add python.exe to PATH", lalu jalankan skrip ini lagi.
  pause
  exit /b 1
)

echo Menggunakan: %PY%
%PY% --version

set "BUILD=%ROOT%build-exe"
echo [1/5] Menyiapkan folder build ...
if exist "%BUILD%" rmdir /s /q "%BUILD%"
mkdir "%BUILD%"
xcopy "%SRC%" "%BUILD%" /e /i /y /q >nul

echo [2/5] Membuat virtual environment ...
%PY% -m venv "%BUILD%\.venv"
if errorlevel 1 goto :fail

echo [3/5] Memasang dependensi (butuh internet, bisa beberapa menit) ...
call "%BUILD%\.venv\Scripts\python.exe" -m pip install --upgrade pip setuptools wheel
if errorlevel 1 goto :fail
call "%BUILD%\.venv\Scripts\python.exe" -m pip install --no-deps "%BUILD%\vendor\insightface-0.7.3-py3-none-any.whl"
if errorlevel 1 goto :fail
call "%BUILD%\.venv\Scripts\python.exe" -m pip install --only-binary=:all: --no-cache-dir -r "%BUILD%\requirements.txt"
if errorlevel 1 goto :fail
call "%BUILD%\.venv\Scripts\python.exe" -m pip install --only-binary=:all: --no-cache-dir "pyinstaller==6.15.0"
if errorlevel 1 goto :fail

echo [4/5] Membangun EXE dengan PyInstaller ...
pushd "%BUILD%"
call ".venv\Scripts\pyinstaller.exe" --noconfirm --clean SuperITEventUploader.spec
set "RC=%errorlevel%"
popd
if not "%RC%"=="0" goto :fail
if not exist "%BUILD%\dist\SuperITEventUploader.exe" goto :fail

echo [5/5] Menyalin hasil ...
set "OUT=%ROOT%dist-exe"
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%"
copy /y "%BUILD%\dist\SuperITEventUploader.exe" "%OUT%\SuperITEventUploader.exe" >nul
if errorlevel 1 goto :fail

echo.
echo ==========================================================
echo   SELESAI
echo   File: %OUT%\SuperITEventUploader.exe
echo   Copy file itu ke PC lain, klik dua kali, langsung jalan.
echo   (Tidak perlu Python di PC tujuan.)
echo ==========================================================
echo.
pause
exit /b 0

:fail
echo.
echo ==========================================================
echo   BUILD GAGAL - file EXE belum dibuat
echo ==========================================================
echo Salin pesan error di atas dan kirim ke admin.
echo Gunakan Python 3.11 64-bit lalu coba lagi.
pause
exit /b 1
