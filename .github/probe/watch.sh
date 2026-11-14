#!/bin/bash
# Follows the app's log while the walk-through runs and takes a screenshot at
# every "PROBE SHOT name" line. $1 = log file, $2 = screenshot command prefix
# (gets the output path appended), $3 = output folder, $4 = max seconds.
LOG=$1; SHOT=$2; OUT=$3; MAX=${4:-300}
mkdir -p "$OUT"; seen=0; t=0
while [ $t -lt $MAX ]; do
  n=$(grep -c "PROBE SHOT" "$LOG" 2>/dev/null || echo 0)
  while [ $seen -lt $n ]; do
    seen=$((seen+1))
    name=$(grep "PROBE SHOT" "$LOG" | sed -n "${seen}p" | sed 's/.*PROBE SHOT //' | tr -cd 'a-z0-9-')
    sleep 1; eval "$SHOT \"$OUT/$name.png\"" || true
  done
  grep -q "PROBE DONE" "$LOG" && break
  sleep 1; t=$((t+1))
done
grep "PROBE" "$LOG" > "$OUT/probe.txt" || true
echo "---- $OUT"; cat "$OUT/probe.txt"
