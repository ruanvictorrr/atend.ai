#!/usr/bin/env bash
set -euo pipefail

BASE="https://lise-multilamellar-overconstantly.ngrok-free.dev"
CLINIC_ID="cmjc0mh0n00007aons85qjoym"

# WhatsApp Cloud API phone_number_id (o seu)
PHONE_NUMBER_ID="447860088970"

# "from" do usuário (wa_id). Pode ser qualquer número pra teste
USER="5581998887777"

echo "== [0] Reset session (whatsapp) =="
curl -s -X POST "$BASE/api/dev/reset-session" \
  -H "Content-Type: application/json" \
  --data-raw "{
    \"clinicId\":\"$CLINIC_ID\",
    \"channel\":\"whatsapp\",
    \"userKey\":\"$USER\"
  }"
echo
echo

echo "== [1] Enviar: quero marcar consulta =="
curl -s -X POST "$BASE/api/webhooks/whatsapp" \
  -H "Content-Type: application/json" \
  --data-raw "{
    \"object\":\"whatsapp_business_account\",
    \"entry\":[
      {
        \"id\":\"WHATSAPP_BUSINESS_ACCOUNT_ID\",
        \"changes\":[
          {
            \"field\":\"messages\",
            \"value\":{
              \"metadata\":{\"phone_number_id\":\"$PHONE_NUMBER_ID\"},
              \"messages\":[
                {
                  \"from\":\"$USER\",
                  \"id\":\"wamid.TEST1\",
                  \"timestamp\":\"$(date +%s)\",
                  \"type\":\"text\",
                  \"text\":{\"body\":\"quero marcar consulta\"}
                }
              ]
            }
          }
        ]
      }
    ]
  }"
echo
echo

echo "== [2] Escolher serviço 1 =="
curl -s -X POST "$BASE/api/webhooks/whatsapp" \
  -H "Content-Type: application/json" \
  --data-raw "{
    \"object\":\"whatsapp_business_account\",
    \"entry\":[
      {
        \"id\":\"WHATSAPP_BUSINESS_ACCOUNT_ID\",
        \"changes\":[
          {
            \"field\":\"messages\",
            \"value\":{
              \"metadata\":{\"phone_number_id\":\"$PHONE_NUMBER_ID\"},
              \"messages\":[
                {
                  \"from\":\"$USER\",
                  \"id\":\"wamid.TEST2\",
                  \"timestamp\":\"$(date +%s)\",
                  \"type\":\"text\",
                  \"text\":{\"body\":\"1\"}
                }
              ]
            }
          }
        ]
      }
    ]
  }"
echo
echo

echo "== [3] Escolher horário 1 =="
curl -s -X POST "$BASE/api/webhooks/whatsapp" \
  -H "Content-Type: application/json" \
  --data-raw "{
    \"object\":\"whatsapp_business_account\",
    \"entry\":[
      {
        \"id\":\"WHATSAPP_BUSINESS_ACCOUNT_ID\",
        \"changes\":[
          {
            \"field\":\"messages\",
            \"value\":{
              \"metadata\":{\"phone_number_id\":\"$PHONE_NUMBER_ID\"},
              \"messages\":[
                {
                  \"from\":\"$USER\",
                  \"id\":\"wamid.TEST3\",
                  \"timestamp\":\"$(date +%s)\",
                  \"type\":\"text\",
                  \"text\":{\"body\":\"1\"}
                }
              ]
            }
          }
        ]
      }
    ]
  }"
echo
echo

echo "== [4] Enviar nome =="
curl -s -X POST "$BASE/api/webhooks/whatsapp" \
  -H "Content-Type: application/json" \
  --data-raw "{
    \"object\":\"whatsapp_business_account\",
    \"entry\":[
      {
        \"id\":\"WHATSAPP_BUSINESS_ACCOUNT_ID\",
        \"changes\":[
          {
            \"field\":\"messages\",
            \"value\":{
              \"metadata\":{\"phone_number_id\":\"$PHONE_NUMBER_ID\"},
              \"messages\":[
                {
                  \"from\":\"$USER\",
                  \"id\":\"wamid.TEST4\",
                  \"timestamp\":\"$(date +%s)\",
                  \"type\":\"text\",
                  \"text\":{\"body\":\"Ruan Galvão\"}
                }
              ]
            }
          }
        ]
      }
    ]
  }"
echo
echo

echo "== [5] Ver último booking desse telefone =="
curl -s "$BASE/api/dev/last-booking?clinicId=$CLINIC_ID&phone=$USER"
echo
echo

echo "✅ Se o last-booking retornar googleEventId preenchido, WhatsApp está OK."
