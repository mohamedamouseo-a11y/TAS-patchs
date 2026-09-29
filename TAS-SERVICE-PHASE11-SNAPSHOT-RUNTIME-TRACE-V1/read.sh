#!/usr/bin/env bash
set -Eeuo pipefail
APP="${PM2_APP_NAME:-TAS}"
OUT="$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const r=JSON.parse(s||"[]");const p=r.find(x=>x.name===process.argv[1])||r.find(x=>/tas/i.test(x.name||""));process.stdout.write(String(p?.pm2_env?.pm_out_log_path||""))})' "$APP")"
ERR="$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const r=JSON.parse(s||"[]");const p=r.find(x=>x.name===process.argv[1])||r.find(x=>/tas/i.test(x.name||""));process.stdout.write(String(p?.pm2_env?.pm_err_log_path||""))})' "$APP")"
{ [ -n "$OUT" ] && tail -n 500 "$OUT" || true; [ -n "$ERR" ] && tail -n 500 "$ERR" || true; } | grep 'TAS_PHASE11_SNAPSHOT_TRACE_V1' | tail -n 1
