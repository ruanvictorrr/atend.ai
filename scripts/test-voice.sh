#!/usr/bin/env bash
set -euo pipefail

BASE="https://lise-multilamellar-overconstantly.ngrok-free.dev"

TO="+14155238886"
FROM="+5581999999999"

echo "== [1] Início (voice webhook) =="
curl -s -X POST "$BASE/api/webhooks/twilio/voice" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "To=$TO" \
  --data-urlencode "From=$FROM" | sed -e 's/></>\n</g'
echo

echo "== [2] Dizer: quero marcar consulta =="
curl -s -X POST "$BASE/api/webhooks/twilio/voice/gather" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "To=$TO" \
  --data-urlencode "From=$FROM" \
  --data-urlencode "SpeechResult=quero marcar consulta" | sed -e 's/></>\n</g'
echo

echo "== [3] Escolher serviço 1 (Digits=1) =="
curl -s -X POST "$BASE/api/webhooks/twilio/voice/gather" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "To=$TO" \
  --data-urlencode "From=$FROM" \
  --data-urlencode "Digits=1" | sed -e 's/></>\n</g'
echo

echo "== [4] Escolher horário 1 (Digits=1) =="
curl -s -X POST "$BASE/api/webhooks/twilio/voice/gather" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "To=$TO" \
  --data-urlencode "From=$FROM" \
  --data-urlencode "Digits=1" | sed -e 's/></>\n</g'
echo

echo "== [5] Dizer nome (SpeechResult) =="
curl -s -X POST "$BASE/api/webhooks/twilio/voice/gather" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "To=$TO" \
  --data-urlencode "From=$FROM" \
  --data-urlencode "SpeechResult=Ruan Galvao" | sed -e 's/></>\n</g'
echo

echo "✅ Fim. Se no passo [5] apareceu confirmação + hangup, está 100%."
