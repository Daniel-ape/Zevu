#!/bin/bash
# Installs the latest APK on an emulator, opens the app, walks through it and
# records crashes, console errors and screenshots.
set -x
mkdir -p out
adb install -r hintaopas.apk
adb logcat -c
adb shell am start -W -n fi.hintaopas.app/.MainActivity
sleep 20
adb exec-out screencap -p > out/01-start.png
# Connect to the app's web view (debug builds allow it) and drive it.
SOCK=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
echo "socket: $SOCK"
adb forward tcp:9222 localabstract:$SOCK
node drive.mjs || echo "drive failed"
sleep 3
adb exec-out screencap -p > out/99-end.png
adb shell pidof fi.hintaopas.app > out/pid.txt || echo "APP NOT RUNNING" > out/pid.txt
adb logcat -d > out/logcat.txt
grep -E "FATAL EXCEPTION|AndroidRuntime|ANR in|Process: fi.hintaopas" out/logcat.txt > out/crashes.txt || echo "no crashes" > out/crashes.txt
adb logcat -d -s chromium:* Capacitor:* Capacitor/Console:* > out/console.txt
true
