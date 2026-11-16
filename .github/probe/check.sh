#!/bin/bash
# Judges a walk-through log: FAIL on errors, failed steps, a missing finish,
# or steps far slower than they should be (limits are generous: the CI
# simulator and emulator are much slower than a phone).
LOG=$1; bad=0
[ -s "$LOG" ] || { echo "FAIL no log"; exit 1; }
grep -q "PROBE DONE" "$LOG" || { echo "FAIL walk-through did not finish"; bad=1; }
if grep -E "PROBE (FAIL|ERROR)" "$LOG"; then echo "FAIL errors above"; bad=1; fi
limit() { # step max_ms
  ms=$(grep -E "PROBE STEP $1 " "$LOG" | head -1 | sed -E 's/.*ms=([0-9]+).*/\1/')
  [ -z "$ms" ] && return
  if [ "$ms" -gt "$2" ]; then echo "FAIL $1 took $ms ms (limit $2)"; bad=1; else echo "ok $1 $ms ms"; fi
}
limit add-0 4000; limit add-1 4000; limit add-2 4000
limit open-product 4000; limit back 4000; limit tab-lists 4000
limit stepper-plus 3000; limit stepper-minus 3000
limit responsive-after-stress 4000
[ $bad = 0 ] && echo PASS
exit $bad
