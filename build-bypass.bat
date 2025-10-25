@echo off
echo === Building Project Drift Bypass ===
echo.

REM Find MSBuild using vswhere
set "MSBUILD="
if exist "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" (
    for /f "usebackq tokens=*" %%i in (`"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -latest -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe`) do (
        set "MSBUILD=%%i"
    )
)

REM Try alternate path for VS 2022
if not defined MSBUILD (
    if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe" (
        set "MSBUILD=C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe"
    )
)

REM Check if found
if not defined MSBUILD (
    where msbuild >nul 2>&1
    if %errorlevel% equ 0 (
        set "MSBUILD=msbuild"
    ) else (
        echo ERROR: MSBuild not found. Please install Visual Studio 2022 with C++ workload.
        echo Download from: https://visualstudio.microsoft.com/downloads/
        pause
        exit /b 1
    )
)

echo Found MSBuild: %MSBUILD%
echo.

REM Build bypass DLL
echo Building bypass.dll...
cd "%~dp0bypass"
"%MSBUILD%" bypass.vcxproj /p:Configuration=Release /p:Platform=x64 /v:minimal
if %errorlevel% neq 0 (
    echo Failed to build bypass.dll
    pause
    exit /b 1
)

REM Build injector
echo.
echo Building injector.exe...
cd "%~dp0injector"
"%MSBUILD%" injector.vcxproj /p:Configuration=Release /p:Platform=x64 /v:minimal
if %errorlevel% neq 0 (
    echo Failed to build injector.exe
    pause
    exit /b 1
)

REM Copy outputs to release folder
echo.
echo Copying binaries to release folder...
if not exist "%~dp0release\bypass" mkdir "%~dp0release\bypass"

copy "%~dp0bypass\x64\Release\bypass.dll" "%~dp0release\bypass\bypass.dll" >nul
copy "%~dp0injector\x64\Release\injector.exe" "%~dp0release\bypass\injector.exe" >nul

echo.
echo === Build Complete ===
echo Output: release\bypass\
echo   - bypass.dll
echo   - injector.exe
echo.
pause
