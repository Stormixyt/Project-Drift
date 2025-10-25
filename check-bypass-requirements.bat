@echo off
echo === Project Drift Bypass - Build Check ===
echo.

echo Checking for Visual Studio...
where msbuild >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] MSBuild NOT FOUND
    echo.
    echo You need Visual Studio 2022 with C++ workload.
    echo Download: https://visualstudio.microsoft.com/downloads/
    echo.
    echo Free "Community" edition works fine.
    echo During install, select "Desktop development with C++"
    echo.
    goto :end
) else (
    echo [OK] MSBuild found
)

echo Checking MinHook library...
if exist "bypass\minhook\MinHook.h" (
    echo [OK] MinHook library present
) else (
    echo [X] MinHook library missing
    echo Run: cd bypass ^&^& git clone https://github.com/TsudaKageyu/minhook.git minhook-temp
    goto :end
)

echo Checking project files...
if exist "bypass\bypass.vcxproj" (
    echo [OK] Bypass project found
) else (
    echo [X] Bypass project missing
    goto :end
)

if exist "injector\injector.vcxproj" (
    echo [OK] Injector project found
) else (
    echo [X] Injector project missing
    goto :end
)

echo.
echo === All checks passed! ===
echo.
echo Ready to build. Run: build-bypass.bat
echo.

goto :end

:end
pause
