@echo off
cd /d "%~dp0"
set OVERLAY_URL=http://localhost:5173/?view=overlay
start "" "%~dp0node_modules\electron\dist\electron.exe" .
