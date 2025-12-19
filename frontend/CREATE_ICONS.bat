@echo off
echo Creating placeholder icons...
cd /d %~dp0
python create_placeholder_icons.py
pause

