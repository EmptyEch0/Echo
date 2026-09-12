@echo off
set SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\EchoBackend.lnk

if exist "%SHORTCUT%" (
    del "%SHORTCUT%"
    echo [SUCCESS] Echo Backend has been removed from Windows Startup.
) else (
    echo Echo Backend was not found in Windows Startup.
)

pause
