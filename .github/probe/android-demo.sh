#!/bin/bash
set -x
mkdir -p out
adb install -r hintaopas.apk
for p in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION CAMERA POST_NOTIFICATIONS; do adb shell pm grant fi.hintaopas.app android.permission.$p || true; done
adb shell screenrecord --bit-rate 8000000 --time-limit 150 /sdcard/demo.mp4 &
sleep 1
adb shell am start -n fi.hintaopas.app/.MainActivity
sleep 9
SOCK=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
adb forward tcp:9222 localabstract:$SOCK
timeout 170 node demo.mjs || echo "demo failed"
sleep 2
adb shell pkill -INT screenrecord || true
sleep 4
timeout 60 adb pull /sdcard/demo.mp4 out/demo.mp4
timeout 20 adb logcat -d | grep -E "FATAL EXCEPTION|ANR in" > out/crashes.txt || echo "no crashes" > out/crashes.txt
true
