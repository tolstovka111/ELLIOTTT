#!/usr/bin/env bash
#
# Downloads the two native pieces the production tunnel needs and drops them where
# Gradle expects them:
#
#   android/app/libs/libv2ray.aar                 — Xray-core, built with gomobile
#   android/app/src/main/jniLibs/<abi>/libtun2socks.so — TUN <-> SOCKS bridge
#
# Both are third-party artifacts; this repository does not vendor them. Check the
# upstream licences before shipping a build to users.
#
# Usage:
#   ./scripts/fetch-vpn-core.sh                       # latest known-good versions
#   XRAY_LIB_TAG=v1.8.23 ./scripts/fetch-vpn-core.sh  # pin a version
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIBS_DIR="${ROOT}/android/app/libs"
JNI_DIR="${ROOT}/android/app/src/main/jniLibs"

XRAY_LIB_REPO="${XRAY_LIB_REPO:-2dust/AndroidLibXrayLite}"
XRAY_LIB_TAG="${XRAY_LIB_TAG:-latest}"
V2RAYNG_REPO="${V2RAYNG_REPO:-2dust/v2rayNG}"
V2RAYNG_TAG="${V2RAYNG_TAG:-latest}"
ABIS=("arm64-v8a" "armeabi-v7a" "x86_64")

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mОшибка:\033[0m %s\n' "$*" >&2; exit 1; }

for tool in curl unzip python3; do
  command -v "${tool}" >/dev/null 2>&1 || die "нужна утилита ${tool}"
done

release_json() {
  local repo="$1" tag="$2" url
  local -a auth=()
  # An anonymous call is rate-limited to 60/hour; CI passes a token.
  [[ -n "${GITHUB_TOKEN:-}" ]] && auth=(-H "Authorization: Bearer ${GITHUB_TOKEN}")

  if [[ "${tag}" == "latest" ]]; then
    url="https://api.github.com/repos/${repo}/releases/latest"
  else
    url="https://api.github.com/repos/${repo}/releases/tags/${tag}"
  fi
  curl -fsSL -H 'Accept: application/vnd.github+json' "${auth[@]}" "${url}"
}

# Reads a release JSON on stdin and prints the download URL of the first asset
# matching the given regex. When nothing matches it lists what the release did
# contain — upstream asset naming changes from time to time.
asset_url() {
  python3 - "$1" <<PY
import json, re, sys
data = json.loads(sys.stdin.read())
pattern = re.compile(sys.argv[1])
for asset in data.get("assets", []):
    if pattern.search(asset["name"]):
        print(asset["browser_download_url"])
        break
else:
    names = ", ".join(a["name"] for a in data.get("assets", [])) or "(нет ассетов)"
    print(f"NO_MATCH:{names}", file=sys.stderr)
    sys.exit(3)
PY
}

log "Забираем ядро Xray из ${XRAY_LIB_REPO}@${XRAY_LIB_TAG}"
mkdir -p "${LIBS_DIR}"
xray_json="$(release_json "${XRAY_LIB_REPO}" "${XRAY_LIB_TAG}")" \
  || die "не удалось получить релиз ${XRAY_LIB_REPO}"
xray_url="$(printf '%s' "${xray_json}" | asset_url '\.aar$')" \
  || die "в релизе нет .aar — укажите XRAY_LIB_TAG вручную"
curl -fsSL "${xray_url}" -o "${LIBS_DIR}/libv2ray.aar"
log "  → ${LIBS_DIR#"${ROOT}/"}/libv2ray.aar ($(du -h "${LIBS_DIR}/libv2ray.aar" | cut -f1))"

log "Забираем tun2socks из APK ${V2RAYNG_REPO}@${V2RAYNG_TAG}"
apk_json="$(release_json "${V2RAYNG_REPO}" "${V2RAYNG_TAG}")" \
  || die "не удалось получить релиз ${V2RAYNG_REPO}"
apk_url="$(printf '%s' "${apk_json}" | asset_url 'universal.*\.apk$|\.apk$')" \
  || die "в релизе нет apk — укажите V2RAYNG_TAG вручную"

tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
curl -fsSL "${apk_url}" -o "${tmp}/v2rayng.apk"

found=0
for abi in "${ABIS[@]}"; do
  if unzip -o -q "${tmp}/v2rayng.apk" "lib/${abi}/libtun2socks.so" -d "${tmp}" 2>/dev/null; then
    mkdir -p "${JNI_DIR}/${abi}"
    mv "${tmp}/lib/${abi}/libtun2socks.so" "${JNI_DIR}/${abi}/libtun2socks.so"
    log "  → jniLibs/${abi}/libtun2socks.so"
    found=$((found + 1))
  fi
done
[[ "${found}" -gt 0 ]] || die "libtun2socks.so не найден в APK (возможно, сборка split-per-abi)"

log "Готово. Пересоберите приложение: cd android && ./gradlew assembleRelease"
