#!/bin/bash
set -x
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
(adb logcat -v raw 'Capacitor/Console:I' '*:S' > android.log 2>&1 &)
adb shell am start -n fi.hintaopas.app/.MainActivity
bash .github/probe/watch.sh android.log "adb exec-out screencap -p >" out/android 420 || true
# screencap writes to stdout; the helper above passes the path after '>'
adb shell dumpsys meminfo fi.hintaopas.app | head -30 > out/android/meminfo.txt || true
adb logcat -d -v brief '*:E' | grep -i -E "hintaopas|chromium|crash|fatal" | tail -60 > out/android/errors.txt || true
