@echo off
echo ====================================================
echo  Setting up Echo Backend for Automatic Windows Boot
echo ====================================================

set SCRIPT=%~dp0start_silent.vbs
set SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\EchoBackend.lnk

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%SCRIPT%\"'; $s.WorkingDirectory = '%~dp0backend'; $s.Save()"

echo.
echo [SUCCESS] Echo Backend will now start silently in the background whenever you open your laptop!
echo (Shortcut created in your Windows Startup folder)
echo.
pause
