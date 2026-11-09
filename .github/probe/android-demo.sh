#!/bin/bash
set -x
mkdir -p out
adb install -r hintaopas.apk
for p in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION CAMERA POST_NOTIFICATIONS; do adb shell pm grant fi.hintaopas.app android.permission.$p || true; done
adb shell settings put system show_touches 1
adb shell am start -W -n fi.hintaopas.app/.MainActivity
sleep 15
SOCK=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
adb forward tcp:9222 localabstract:$SOCK
# skip the welcome page and restart so the recording starts on the start animation
node -e "
(async()=>{const l=await (await fetch('http://localhost:9222/json')).json();const ws=new WebSocket(l[0].webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:\"localStorage.setItem('hintaopas:welcomed','1');localStorage.setItem('hintaopas:lang','\\\"sv\\\"');localStorage.setItem('hintaopas:posAsked','denied')\"}}));await new Promise(r=>setTimeout(r,800));process.exit(0)})()"
adb shell am force-stop fi.hintaopas.app
adb shell screenrecord --bit-rate 8000000 --time-limit 120 /sdcard/demo.mp4 &
REC=$!
sleep 1
adb shell am start -n fi.hintaopas.app/.MainActivity
sleep 12
SOCK=$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
adb forward --remove-all; adb forward tcp:9222 localabstract:$SOCK
node demo.mjs || echo "demo failed"
sleep 2
adb shell pkill -INT screenrecord || true
sleep 3
adb pull /sdcard/demo.mp4 out/demo.mp4
adb logcat -d | grep -E "FATAL EXCEPTION|ANR in" > out/crashes.txt || echo "no crashes" > out/crashes.txt
true
