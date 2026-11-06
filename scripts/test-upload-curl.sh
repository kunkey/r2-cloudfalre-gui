#!/usr/bin/env bash
# =============================================================================
# test-upload-curl.sh — Test upload API bằng cURL thuần
# =============================================================================
#
# Test các chế độ upload của R2 Gallery:
#   1. Upload file local (multipart/form-data)
#   2. Import từ URL (application/json)
#   3. Presigned PUT (upload thẳng lên R2, không đi qua server)
#   4. Kiểm tra auth: không key / sai key / đúng key
#   5. Kiểm tra file đã upload có truy cập được không
#   6. Dọn dẹp file test (DELETE /api/objects)
#
# ---------------------------------------------------------------------------
# Cách dùng
# ---------------------------------------------------------------------------
#   bash scripts/test-upload-curl.sh                      # chạy tất cả
#   bash scripts/test-upload-curl.sh --no-cleanup         # giữ lại file test
#   bash scripts/test-upload-curl.sh --file ./a.gif        # test 1 file cụ thể
#   bash scripts/test-upload-curl.sh --url https://x/a.gif # test 1 URL cụ thể
#   bash scripts/test-upload-curl.sh --api https://api.x.com
#   bash scripts/test-upload-curl.sh --pass mysecret
#   bash scripts/test-upload-curl.sh --folder MyFolder
#
# Biến môi trường (thay thế cho flag):
#   API_BASE, APP_PASSWORD, TEST_FOLDER
#
# ---------------------------------------------------------------------------
# Yêu cầu: bash + curl. Không cần jq (dùng python3 fallback hoặc grep).
# =============================================================================

set -uo pipefail

# ─── Config ────────────────────────────────────────────────────────────────
API_BASE="${API_BASE:-}"
APP_PASSWORD="${APP_PASSWORD:-}"
TEST_FOLDER="${TEST_FOLDER:-Test_Uploads/CurlTest}"
CLEANUP=1
TARGET_FILE=""
TARGET_URL=""

# ─── Parse args ────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api)      API_BASE="$2"; shift 2 ;;
    --pass)     APP_PASSWORD="$2"; shift 2 ;;
    --folder)   TEST_FOLDER="$2"; shift 2 ;;
    --file)     TARGET_FILE="$2"; shift 2 ;;
    --url)      TARGET_URL="$2"; shift 2 ;;
    --no-cleanup) CLEANUP=0; shift ;;
    -h|--help)  sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ─── Load .env ─────────────────────────────────────────────────────────────
load_env() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *=* ]] && continue
    local key="${line%%=*}"
    local val="${line#*=}"
    key="${key// /}"
    # Bỏ dấu quote
    val="${val%\"}"; val="${val#\"}"
    val="${val%\'}"; val="${val#\'}"
    # Không ghi đè biến đã set sẵn từ CLI
    if [[ ! -v "$key" ]]; then
      export "$key=$val"
    fi
  done < "$env_file"
}
load_env "$PROJECT_DIR/.env"

# ─── Auto-detect API base ──────────────────────────────────────────────────
detect_api_base() {
  # Ưu tiên: localhost (chạy trên Windows/WSL cùng máy)
  for host in "localhost" "127.0.0.1"; do
    if curl -s -o /dev/null --max-time 3 "http://${host}:3423/api/health"; then
      echo "http://${host}:3423"
      return 0
    fi
  done

  # WSL2: tìm IP của Windows host qua default route / resolv.conf
  local host_ip
  host_ip=$(ip route show default 2>/dev/null | awk '{print $3}' | head -1)
  if [[ -z "$host_ip" ]]; then
    host_ip=$(awk '/^nameserver/ { print $2 }' /etc/resolv.conf 2>/dev/null | head -1)
  fi
  if [[ -n "$host_ip" ]]; then
    if curl -s -o /dev/null --max-time 3 "http://${host_ip}:3423/api/health"; then
      echo "http://${host_ip}:3423"
      return 0
    fi
  fi

  return 1
}

if [[ -z "$API_BASE" ]]; then
  API_BASE=$(detect_api_base)
  if [[ -z "$API_BASE" ]]; then
    echo "✗ Không tìm thấy API server."
    echo "  Hãy chạy 'npm run dev' trước, hoặc truyền --api http://host:3423"
    exit 1
  fi
  echo "ℹ  Auto-detect API base: $API_BASE"
fi

if [[ -z "$APP_PASSWORD" ]]; then
  APP_PASSWORD="${NEXT_PUBLIC_APP_PASSWORD:-}"
fi

API_BASE="${API_BASE%/}"
UPLOAD_URL="${API_BASE}/api/uploads/direct"
PRESIGN_URL="${API_BASE}/api/uploads/presign"
OBJECTS_URL="${API_BASE}/api/objects"

# ─── Helpers ───────────────────────────────────────────────────────────────
PASS_COUNT=0
FAIL_COUNT=0
UPLOADED_KEYS=()

RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
BLUE=$'\033[34m'; CYAN=$'\033[36m'; DIM=$'\033[2m'; RESET=$'\033[0m'

section() { printf "\n${CYAN}────────────────────────────────────────────────────────${RESET}\n"; printf "${CYAN}  %s${RESET}\n" "$1"; printf "${CYAN}────────────────────────────────────────────────────────${RESET}\n"; }
info()    { printf "  ${DIM}%s${RESET}\n" "$1"; }
pass()    { PASS_COUNT=$((PASS_COUNT+1)); printf "  ${GREEN}✓ PASS${RESET} %s\n" "$1"; }
fail()    { FAIL_COUNT=$((FAIL_COUNT+1)); printf "  ${RED}✗ FAIL${RESET} %s\n" "$1"; }

# Trích giá trị JSON đơn giản (không cần jq).
# json_get '<json>' '<key1>' '<key2>' ...  → giá trị cuối cùng (string hoặc số)
json_get() {
  local json="$1"; shift
  local key="$1"; shift
  python3 - "$json" "$key" "$@" <<'PYEOF' 2>/dev/null
import json, sys
raw = sys.argv[1]
key = sys.argv[2]
idx = sys.argv[3:]
try:
    data = json.loads(raw)
except Exception:
    # Thử parse lại nếu bị escape
    try:
        data = json.loads(raw.encode().decode('unicode_escape'))
    except Exception:
        print("")
        sys.exit(0)
for k in [key] + idx:
    if isinstance(data, list):
        try:
            data = data[int(k)]
        except Exception:
            print(""); sys.exit(0)
    elif isinstance(data, dict):
        data = data.get(k, "")
    else:
        print(""); sys.exit(0)
    if data is None:
        data = ""
print(data if isinstance(data, str) else json.dumps(data))
PYEOF
}

# Lấy mảng string từ JSON key (vd: uploaded, urls)
json_array() {
  local json="$1"; local key="$2"
  python3 - "$json" "$key" <<'PYEOF' 2>/dev/null
import json, sys
try:
    data = json.loads(sys.argv[1])
except Exception:
    print(""); sys.exit(0)
arr = data.get(sys.argv[2], []) if isinstance(data, dict) else []
if isinstance(arr, list):
    for item in arr:
        print(item)
PYEOF
}

# ─── Bắt đầu ───────────────────────────────────────────────────────────────
printf "${BLUE}╔══════════════════════════════════════════════════════════════╗${RESET}\n"
printf "${BLUE}║${RESET}  ${BOLD:-}R2 Gallery — Test Upload API bằng cURL${RESET}\n"
printf "${BLUE}╚══════════════════════════════════════════════════════════════╝${RESET}\n"
info "API base : $API_BASE"
info "Passkey  : ${APP_PASSWORD:+<đã set>}${APP_PASSWORD:-<CHƯA SET>}"
info "Folder   : $TEST_FOLDER"

# ─── 0. Health check ───────────────────────────────────────────────────────
section "0. Health check"
HEALTH=$(curl -s -w "\n%{http_code}" --max-time 10 "$API_BASE/api/health")
HEALTH_CODE=$(echo "$HEALTH" | tail -1)
HEALTH_BODY=$(echo "$HEALTH" | sed '$d')
info "GET $API_BASE/api/health → $HEALTH_CODE $HEALTH_BODY"
if [[ "$HEALTH_CODE" == "200" ]]; then
  pass "Server đang hoạt động"
else
  fail "Server không phản hồi (code=$HEALTH_CODE)"
  exit 1
fi

if [[ -z "$APP_PASSWORD" ]]; then
  fail "Thiếu APP_PASSWORD — không test được phần auth. Set trong .env hoặc dùng --pass"
  exit 1
fi

AUTH_HEADER="Authorization: Bearer ${APP_PASSWORD}"

# ─── 1. Test auth ──────────────────────────────────────────────────────────
section "1. Test authentication (endpoint upload phải bắt buộc passkey)"

# 1a. Không gửi key → phải 401
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST "$UPLOAD_URL" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/a.png"}')
if [[ "$CODE" == "401" ]]; then
  pass "Không có key → 401 (bị chặn đúng)"
else
  fail "Không có key → $CODE (mong đợi 401)"
fi

# 1b. Sai key → phải 401
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST "$UPLOAD_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sai-key-hoan-toan" \
  -d '{"url":"https://example.com/a.png"}')
if [[ "$CODE" == "401" ]]; then
  pass "Sai key → 401 (bị chặn đúng)"
else
  fail "Sai key → $CODE (mong đợi 401)"
fi

# 1c. Đúng key, dạng x-api-key → phải qua auth (không phải 401)
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 \
  -X POST "$UPLOAD_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${APP_PASSWORD}" \
  -d '{"url":"https://example.com/a.png"}')
if [[ "$CODE" != "401" ]]; then
  pass "x-api-key header → $CODE (auth OK)"
else
  fail "x-api-key header → 401 (không được chấp nhận)"
fi

# ─── 2. Tạo file test ─────────────────────────────────────────────────────
section "2. Chuẩn bị file test"
TMPDIR_TEST="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_TEST"' EXIT

# 1x1 PNG hợp lệ
printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' \
  | base64 -d > "$TMPDIR_TEST/test-pixel.png"

# 1x1 GIF hợp lệ
printf '%s' 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' \
  | base64 -d > "$TMPDIR_TEST/test-anim.gif"

info "Tạo file test trong $TMPDIR_TEST"
ls -la "$TMPDIR_TEST" | sed 's/^/    /'

# ─── 3. Upload file local (multipart) ──────────────────────────────────────
section "3. Upload file local (multipart/form-data)"

upload_local() {
  local file="$1"; local folder="$2"; local label="$3"
  local resp code body key url

  resp=$(curl -s -w "\n%{http_code}" --max-time 60 \
    -X POST "$UPLOAD_URL" \
    -H "$AUTH_HEADER" \
    -F "file=@${file}" \
    -F "folder=${folder}")

  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')

  if [[ "$code" != "200" ]]; then
    fail "[$label] HTTP $code — $body"
    return 1
  fi

  key=$(json_get "$body" "uploaded" "0")
  url=$(json_get "$body" "urls" "0")

  if [[ -z "$key" ]]; then
    fail "[$label] Response không có key — $body"
    return 1
  fi

  UPLOADED_KEYS+=("$key")
  pass "[$label] Upload OK"
  info "key  : $key"
  info "url  : $url"

  # Verify public URL truy cập được
  if [[ -n "$url" ]]; then
    local head_code head_ct
    head_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -I "$url")
    head_ct=$(curl -s -o /dev/null -w "%{content_type}" --max-time 15 -I "$url")
    if [[ "$head_code" == "200" ]]; then
      pass "[$label] Public URL truy cập OK (HTTP $head_code, $head_ct)"
    else
      fail "[$label] Public URL lỗi (HTTP $head_code)"
    fi
  fi
  return 0
}

upload_local "$TMPDIR_TEST/test-pixel.png" "$TEST_FOLDER/Images" "PNG"
upload_local "$TMPDIR_TEST/test-anim.gif"  "$TEST_FOLDER/Gifs"   "GIF"

# Upload nhiều file cùng lúc (nhiều field "file")
section "3b. Upload nhiều file cùng lúc"
MULTI_RESP=$(curl -s -w "\n%{http_code}" --max-time 60 \
  -X POST "$UPLOAD_URL" \
  -H "$AUTH_HEADER" \
  -F "file=@${TMPDIR_TEST}/test-pixel.png" \
  -F "file=@${TMPDIR_TEST}/test-anim.gif" \
  -F "folder=${TEST_FOLDER}/Multi")
MULTI_CODE=$(echo "$MULTI_RESP" | tail -1)
MULTI_BODY=$(echo "$MULTI_RESP" | sed '$d')
if [[ "$MULTI_CODE" == "200" ]]; then
  while IFS= read -r k; do
    [[ -n "$k" ]] && UPLOADED_KEYS+=("$k")
  done < <(json_array "$MULTI_BODY" "uploaded")
  MULTI_COUNT=$(json_array "$MULTI_BODY" "uploaded" | grep -c . )
  pass "Upload 2 file cùng lúc OK (count=$MULTI_COUNT)"
else
  fail "Upload nhiều file → $MULTI_CODE — $MULTI_BODY"
fi

# ─── 4. Import từ URL (JSON) ───────────────────────────────────────────────
section "4. Import từ URL (application/json)"

upload_from_url() {
  local src_url="$1"; local folder="$2"; local label="$3"
  local resp code body key url

  resp=$(curl -s -w "\n%{http_code}" --max-time 60 \
    -X POST "$UPLOAD_URL" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "{\"url\":\"${src_url}\",\"folder\":\"${folder}\"}")

  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')

  if [[ "$code" != "200" ]]; then
    fail "[$label] HTTP $code — $body"
    return 1
  fi

  key=$(json_get "$body" "uploaded" "0")
  url=$(json_get "$body" "urls" "0")
  UPLOADED_KEYS+=("$key")
  pass "[$label] Import OK"
  info "key  : $key"
  info "url  : $url"
  return 0
}

upload_from_url "https://upload.wikimedia.org/wikipedia/commons/c/ca/1x1.png" "$TEST_FOLDER/FromUrl" "URL PNG"
upload_from_url "https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif" "$TEST_FOLDER/FromUrl" "URL GIF"

# ─── 5. Upload với key tùy chỉnh ───────────────────────────────────────────
section "5. Upload với key tùy chỉnh (folder + key)"
CUSTOM_KEY="${TEST_FOLDER}/Custom/custom-name.png"
CUSTOM_RESP=$(curl -s -w "\n%{http_code}" --max-time 60 \
  -X POST "$UPLOAD_URL" \
  -H "$AUTH_HEADER" \
  -F "file=@${TMPDIR_TEST}/test-pixel.png" \
  -F "key=${CUSTOM_KEY}")
CUSTOM_CODE=$(echo "$CUSTOM_RESP" | tail -1)
CUSTOM_BODY=$(echo "$CUSTOM_RESP" | sed '$d')
if [[ "$CUSTOM_CODE" == "200" ]]; then
  GOT_KEY=$(json_get "$CUSTOM_BODY" "uploaded" "0")
  UPLOADED_KEYS+=("$GOT_KEY")
  if [[ "$GOT_KEY" == "$CUSTOM_KEY" ]]; then
    pass "Key tùy chỉnh được giữ nguyên: $GOT_KEY"
  else
    fail "Key không khớp (mong đợi $CUSTOM_KEY, nhận $GOT_KEY)"
  fi
else
  fail "Upload custom key → $CUSTOM_CODE — $CUSTOM_BODY"
fi

# ─── 6. Presigned PUT ──────────────────────────────────────────────────────
section "6. Presigned PUT (upload thẳng lên R2)"
# Size phải khớp CHÍNH XÁC với Content-Length khi PUT, nếu không R2 trả 403 SignatureDoesNotMatch.
PRESIGN_SIZE=$(wc -c < "$TMPDIR_TEST/test-pixel.png" | tr -d ' ')
PRESIGN_BODY="{\"files\":[{\"key\":\"${TEST_FOLDER}/Presign/test-presign.png\",\"contentType\":\"image/png\",\"size\":${PRESIGN_SIZE}}]}"
PRESIGN_RESP=$(curl -s -w "\n%{http_code}" --max-time 30 \
  -X POST "$PRESIGN_URL" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "$PRESIGN_BODY")
PRESIGN_CODE=$(echo "$PRESIGN_RESP" | tail -1)
PRESIGN_OUT=$(echo "$PRESIGN_RESP" | sed '$d')
if [[ "$PRESIGN_CODE" != "200" ]]; then
  fail "Lấy presigned URL → $PRESIGN_CODE — $PRESIGN_OUT"
else
  PRESIGNED=$(json_get "$PRESIGN_OUT" "urls" "0")
  if [[ -z "$PRESIGNED" ]]; then
    fail "Presigned URL rỗng — $PRESIGN_OUT"
  else
    pass "Lấy presigned URL OK"
    info "url: ${PRESIGNED:0:110}..."
    # PUT thẳng file lên R2
    PUT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 \
      -X PUT "$PRESIGNED" \
      -H "Content-Type: image/png" \
      --data-binary "@${TMPDIR_TEST}/test-pixel.png")
    if [[ "$PUT_CODE" == "200" ]]; then
      pass "PUT thẳng lên R2 OK (HTTP 200)"
      UPLOADED_KEYS+=("${TEST_FOLDER}/Presign/test-presign.png")
    else
      fail "PUT thẳng lên R2 → $PUT_CODE (kiểm tra Content-Type/Content-Length có khớp không)"
    fi
  fi
fi

# ─── 7. Test file cụ thể (nếu có --file / --url) ───────────────────────────
if [[ -n "$TARGET_FILE" ]]; then
  section "7. Upload file cụ thể: $TARGET_FILE"
  if [[ -f "$TARGET_FILE" ]]; then
    upload_local "$TARGET_FILE" "$TEST_FOLDER" "$(basename "$TARGET_FILE")"
  else
    fail "Không tìm thấy file: $TARGET_FILE"
  fi
fi

if [[ -n "$TARGET_URL" ]]; then
  section "7. Import URL cụ thể: $TARGET_URL"
  upload_from_url "$TARGET_URL" "$TEST_FOLDER" "custom-url"
fi

# ─── 8. Kiểm tra tồn tại ───────────────────────────────────────────────────
section "8. Kiểm tra file đã upload tồn tại (/api/objects/exists)"
if [[ ${#UPLOADED_KEYS[@]} -gt 0 ]]; then
  EXISTS_BODY=$(printf '{"keys":[%s]}' \
    "$(for k in "${UPLOADED_KEYS[@]}"; do printf '"%s",' "$k"; done | sed 's/,$//')")
  EXISTS_RESP=$(curl -s --max-time 30 \
    -X POST "$API_BASE/api/objects/exists" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "$EXISTS_BODY")
  FOUND=$(python3 - "$EXISTS_RESP" <<'PYEOF' 2>/dev/null
import json, sys
try:
    ex = json.loads(sys.argv[1]).get("exists", {})
except Exception:
    print(0); sys.exit(0)
print(sum(1 for v in ex.values() if v))
PYEOF
)
  TOTAL=${#UPLOADED_KEYS[@]}
  if [[ "$FOUND" == "$TOTAL" ]]; then
    pass "Tất cả $TOTAL/$TOTAL file tồn tại trên R2"
  else
    info "Tồn tại $FOUND/$TOTAL file"
  fi
fi

# ─── 9. Dọn dẹp ────────────────────────────────────────────────────────────
if [[ $CLEANUP -eq 1 && ${#UPLOADED_KEYS[@]} -gt 0 ]]; then
  section "9. Dọn dẹp file test"
  DEL_BODY=$(printf '{"keys":[%s]}' \
    "$(for k in "${UPLOADED_KEYS[@]}"; do printf '"%s",' "$k"; done | sed 's/,$//')")
  DEL_RESP=$(curl -s -w "\n%{http_code}" --max-time 60 \
    -X DELETE "$OBJECTS_URL" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "$DEL_BODY")
  DEL_CODE=$(echo "$DEL_RESP" | tail -1)
  if [[ "$DEL_CODE" == "200" ]]; then
    pass "Đã xóa ${#UPLOADED_KEYS[@]} file test"
  else
    fail "Dọn dẹp thất bại (HTTP $DEL_CODE)"
    printf '    Keys: %s\n' "${UPLOADED_KEYS[*]}"
  fi
else
  section "9. Dọn dẹp"
  if [[ $CLEANUP -eq 0 && ${#UPLOADED_KEYS[@]} -gt 0 ]]; then
    info "Bỏ qua dọn dẹp (--no-cleanup). File còn lại trên R2:"
    for k in "${UPLOADED_KEYS[@]}"; do printf "    - %s\n" "$k"; done
  fi
fi

# ─── Tổng kết ──────────────────────────────────────────────────────────────
section "KẾT QUẢ"
printf "  ${GREEN}PASS: %d${RESET}\n" "$PASS_COUNT"
if [[ $FAIL_COUNT -gt 0 ]]; then
  printf "  ${RED}FAIL: %d${RESET}\n" "$FAIL_COUNT"
  exit 1
else
  printf "  ${YELLOW}FAIL: 0${RESET}\n"
  printf "\n  ${GREEN}✓ Tất cả test đều pass${RESET}\n\n"
  exit 0
fi
