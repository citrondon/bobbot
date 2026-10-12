#!/usr/bin/env bash
# Prueft install-linux-mint.sh ohne Docker, ohne apt und ohne Netz: nur die
# Systemgrenzen (id/sudo/docker/curl/systemctl/usermod) sind gestubbt.
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
src="$root/install-linux-mint.sh"
fail() {
  echo "FAIL: $*" >&2
  exit 1
}
# BSD grep needs -e so patterns starting with -- are not flags.
g() { grep -F -e "$1" "$src" >/dev/null || fail "missing $1"; }

# It must delegate to the real installer instead of re-implementing it.
g 'install-images.sh'
# shellcheck disable=SC2016 # the $ must stay literal: this greps the file for it.
g 'installer_args[@]+"${installer_args[@]}"'
g '--prepare-only)'
g '--local | --pull-never | --offline)'
g '--dir=*'
g 'BOBBOT_DOWNLOAD_BASE'
g 'https://download.docker.com/linux/'
g 'UBUNTU_CODENAME'
g 'docker-compose-v2'
g 'docker-compose-plugin'
g 'usermod -aG docker'
g 'Bitte als normaler Benutzer starten'
g 'docker compose version'
g 'Unbekannte Option'

bash -n "$src" || fail "bash -n failed"

set +e
out="$(bash "$src" --not-a-flag 2>&1)"
code=$?
set -e
[[ "$code" -eq 2 ]] || fail "expected exit 2 for unknown flag, got $code"
[[ "$out" == *"Aufruf: bash install-linux-mint.sh"* ]] || fail "usage missing from stderr"

set +e
out="$(bash "$src" --help 2>&1)"
code=$?
set -e
[[ "$code" -eq 0 ]] || fail "expected exit 0 for --help, got $code"
[[ "$out" == *"--dir=PFAD"* ]] || fail "--help is missing the --dir option"

tmp="$(mktemp -d "${TMPDIR:-/tmp}/install-linux-mint-smoke.XXXXXX")"
cleanup_tmp() { rm -rf "$tmp"; }
trap cleanup_tmp EXIT

# The script prefers a sibling install-images.sh; copy it out of the repo so the
# download branch runs and the fake installer is the one that executes.
mkdir -p "$tmp/script" "$tmp/bin"
cp "$src" "$tmp/script/install-linux-mint.sh"
runner="$tmp/script/install-linux-mint.sh"

write_stubs() {
  local bin="$1" groups="$2" docker_info_code="$3"
  mkdir -p "$bin"
  cat > "$bin/id" <<SH
#!/usr/bin/env bash
case "\$1" in
  -u) echo 1000 ;;
  -un) echo tester ;;
  -nG) echo "$groups" ;;
  *) echo "" ;;
esac
SH
  cat > "$bin/sudo" <<'SH'
#!/usr/bin/env bash
exec "$@"
SH
  cat > "$bin/docker" <<SH
#!/usr/bin/env bash
if [[ "\$1" == "info" ]]; then exit $docker_info_code; fi
if [[ "\$1" == "compose" && "\$2" == "version" ]]; then echo "Docker Compose version v2.30.0"; exit 0; fi
exit 0
SH
  # curl writes the downloaded file: here, a stand-in for install-images.sh.
  cat > "$bin/curl" <<'SH'
#!/usr/bin/env bash
out=""
while (($#)); do
  case "$1" in
    -o)
      out="$2"
      shift 2
      ;;
    *) shift ;;
  esac
done
[[ -n "$out" ]] || exit 0
cat > "$out" <<'EOF'
#!/usr/bin/env bash
echo "FAKE-INSTALLER ARGS: $*"
exit 0
EOF
SH
  printf '#!/usr/bin/env bash\nexit 0\n' > "$bin/systemctl"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$bin/usermod"
  chmod +x "$bin"/*
}

write_stubs "$tmp/bin-ok" "tester other docker" 0

workdir="$tmp/home/bobbot"
mkdir -p "$workdir"
printf 'OPENCODE_API_KEY=\n' > "$workdir/.env"

set +e
out="$(PATH="$tmp/bin-ok:$PATH" HOME="$tmp/home" bash "$runner" --dir="$workdir" --prepare-only 2>&1)"
code=$?
set -e
[[ "$code" -eq 0 ]] || fail "expected the fake install to succeed, got $code: $out"
[[ "$out" == *"FAKE-INSTALLER ARGS: --prepare-only"* ]] ||
  fail "--prepare-only was not passed to install-images.sh: $out"
[[ "$out" == *"BobBot ist noch nicht gestartet"* ]] || fail "missing --prepare-only summary: $out"
[[ "$out" == *"Noch kein Modellschluessel eingetragen"* ]] ||
  fail "empty OPENCODE_API_KEY should be called out: $out"
[[ -f "$workdir/install-images.sh" ]] || fail "install-images.sh was not placed in the workdir"

# With the key present, no model hint — and the normal start path is announced.
printf 'OPENCODE_API_KEY=oc_test\n' > "$workdir/.env"
set +e
out="$(PATH="$tmp/bin-ok:$PATH" HOME="$tmp/home" bash "$runner" --dir="$workdir" 2>&1)"
code=$?
set -e
[[ "$code" -eq 0 ]] || fail "expected the second fake install to succeed, got $code: $out"
[[ "$out" == *"BobBot laeuft"* ]] || fail "missing start summary: $out"
[[ "$out" != *"Noch kein Modellschluessel eingetragen"* ]] || fail "model hint shown despite a key: $out"

# Without docker group membership and a silent daemon: ask for the re-login, stop there.
write_stubs "$tmp/bin-fresh" "tester other" 3
set +e
out="$(PATH="$tmp/bin-fresh:$PATH" HOME="$tmp/home" bash "$runner" --dir="$tmp/home/bobbot2" 2>&1)"
code=$?
set -e
[[ "$code" -eq 0 ]] || fail "re-login path should exit 0, got $code: $out"
[[ "$out" == *"Melde dich am Rechner ab"* ]] || fail "missing re-login hint: $out"
[[ "$out" != *"FAKE-INSTALLER"* ]] || fail "installer ran before the re-login: $out"

echo "install-linux-mint smoke ok"
