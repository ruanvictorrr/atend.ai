#!/usr/bin/env bash
set -euo pipefail

BASE="https://lise-multilamellar-overconstantly.ngrok-free.dev"
CLINIC_ID="cmjc0mh0n00007aons85qjoym"

TO="+14155238886"
FROM="+5581999999999"

echo "== [0] Ping health =="
curl -i --max-time 10 "$BASE/api/health"
echo

echo "== [1] Reset session (voice) =="
curl -i --max-time 10 -X POST "$BASE/api/dev/reset-session" \
  -H "Content-Type: application/json" \
  --data-raw "{\"clinicId\":\"$CLINIC_ID\",\"channel\":\"voice\",\"userKey\":\"$FROM\"}"
echo

echo "== [2] Início (voice webhook) =="
curl -i --max-time 10 -X POST "$BASE/api/webhooks/twilio/voice" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "To=$TO" \
  --data-urlencode "From=$FROM"
echo

echo "== [3] Dizer: quero marcar consulta =="
curl -i --max-time 10 -X POST "$BASE/api/webhooks/twilio/voice/gather" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "To=$TO" \
  --data-urlencode "From=$FROM" \
  --data-urlencode "SpeechResult=quero marcar consulta"
echo

echo "== [4] Escolher serviço 1 (Digits=1) =="
curl -i --max-time 10 -X POST "$BASE/api/webhooks/twilio/voice/gather" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "To=$TO" \
  --data-urlencode "From=$FROM" \
  --data-urlencode "Digits=1"
echo

echo "== [5] Escolher horário 1 (Digits=1) =="
curl -i --max-time 10 -X POST "$BASE/api/webhooks/twilio/voice/gather" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "To=$TO" \
  --data-urlencode "From=$FROM" \
  --data-urlencode "Digits=1"
echo

echo "== [6] Dizer nome (SpeechResult) =="
curl -i --max-time 10 -X POST "$BASE/api/webhooks/twilio/voice/gather" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "To=$TO" \
  --data-urlencode "From=$FROM" \
  --data-urlencode "SpeechResult=Ruan Galvao"
echo

echo "✅ Fim."
