@echo off
rem Launch the transparent minimap + its controller against the local dev server.
rem NOTE: Vite binds IPv6 only by default, so use the explicit [::1] address —
rem Electron resolves "localhost" to IPv4 first and gets nothing (black windows).
cd /d "%~dp0"
start "" "%~dp0node_modules\electron\dist\electron.exe" . --url=http://[::1]:5173
