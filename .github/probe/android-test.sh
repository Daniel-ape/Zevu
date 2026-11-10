#!/bin/bash
set -x
mkdir -p out
adb install -r hintaopas.apk
for p in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION CAMERA POST_NOTIFICATIONS; do adb shell pm grant fi.hintaopas.app android.permission.$p || true; done
adb shell cmd uimode night yes   # phone in dark mode: the app must still look light
adb logcat -c
adb shell am start -W -n fi.hintaopas.app/.MainActivity
sleep 15
SOCK=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
adb forward tcp:9222 localabstract:$SOCK
timeout 300 node check.mjs || echo "check failed"
adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" > out/foreground.txt
adb shell pidof fi.hintaopas.app > out/pid.txt || echo "NOT RUNNING" > out/pid.txt
timeout 20 adb logcat -d > out/logcat.txt
grep -iE 'chromium|webview|Capacitor|ActivityManager.*hintaopas|lowmemory|killing' out/logcat.txt | tail -200 > out/relevant.txt
grep -E "FATAL EXCEPTION|ANR in" out/logcat.txt > out/crashes.txt || echo "no crashes" > out/crashes.txt
true
