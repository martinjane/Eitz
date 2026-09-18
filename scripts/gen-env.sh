#!/bin/bash
set -e
PG_PASS=$(openssl rand -base64 24)
SESSION_SEC=$(openssl rand -hex 64)
printf "DOMAIN=localhost\nPOSTGRES_USER=eitashot\nPOSTGRES_PASSWORD=%s\nPOSTGRES_DB=eitashot\nDATABASE_URL=postgresql://eitashot:%s@postgres:5432/eitashot\nSESSION_SECRET=%s\nEITAA_BOT_TOKEN=\nADMIN_USERNAME=dev_user\nIDPAY_API_KEY=\nAPP_BASE_URL=http://94.183.176.145\nFRONTEND_URL=http://94.183.176.145\nTEST_MODE=true\n" "$PG_PASS" "$PG_PASS" "$SESSION_SEC" > /opt/eitashot/deploy/.env
chmod 600 /opt/eitashot/deploy/.env
echo "DONE: .env created with $(wc -l < /opt/eitashot/deploy/.env) lines"
