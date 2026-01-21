@echo off

rem ##########################################################################
rem
rem  Gradle startup script for Windows
rem
rem ##########################################################################

rem Set local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" setlocal

rem Check if gradle is installed
where gradle >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    gradle %*
) else (
    echo Gradle is not installed. Please install Gradle to build the Java server.
    echo Visit https://gradle.org/install/ for installation instructions.
    exit /b 1
) 