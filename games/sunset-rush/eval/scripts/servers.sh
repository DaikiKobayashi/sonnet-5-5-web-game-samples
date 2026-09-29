#!/bin/bash
# 使い方: servers.sh start | stop
# start: impl/<effort>/ をルートに 510x、impl/<effort>/dist/ をルートに 520x で python3 -m http.server を起動し、PID を記録する
# stop : 記録した PID を kill し、ポートが空いたことを確認する
GAME="$(cd "$(dirname "$0")/../.." && pwd)"
PIDFILE="$GAME/eval/scripts/.server-pids"
EFFORTS=(low medium high xhigh max)
case "$1" in
  start)
    : > "$PIDFILE"
    for i in 0 1 2 3 4; do
      e=${EFFORTS[$i]}; p1=$((5101+i)); p2=$((5201+i))
      nohup python3 -m http.server $p1 --bind 127.0.0.1 --directory "$GAME/impl/$e" >/dev/null 2>&1 &
      echo $! >> "$PIDFILE"
      nohup python3 -m http.server $p2 --bind 127.0.0.1 --directory "$GAME/impl/$e/dist" >/dev/null 2>&1 &
      echo $! >> "$PIDFILE"
    done
    sleep 1; cat "$PIDFILE" | tr '\n' ' '; echo
    ;;
  stop)
    for pid in $(cat "$PIDFILE"); do kill "$pid" 2>/dev/null; done
    sleep 1
    for p in 5101 5102 5103 5104 5105 5201 5202 5203 5204 5205; do
      if (echo > /dev/tcp/127.0.0.1/$p) 2>/dev/null; then echo "port $p still open"; else echo "port $p free"; fi
    done
    rm -f "$PIDFILE"
    ;;
esac
