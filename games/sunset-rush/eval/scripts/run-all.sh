#!/bin/bash
# 2 実装ずつ並列に run.mjs を流す(O4 パフォーマンスは別に単独で流す: node run.mjs <effort> O4)
cd "$(dirname "$0")"
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
node run.mjs low > ../raw/log-low.txt 2>&1 &
node run.mjs medium > ../raw/log-medium.txt 2>&1 &
wait
node run.mjs high > ../raw/log-high.txt 2>&1 &
node run.mjs xhigh > ../raw/log-xhigh.txt 2>&1 &
wait
node run.mjs max > ../raw/log-max.txt 2>&1
