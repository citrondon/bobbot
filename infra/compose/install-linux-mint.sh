#!/usr/bin/env bash
# BobBot auf Linux Mint installieren — ohne Vorkenntnisse.
#
# Dieses Skript bereitet nur den Rechner vor (Docker installieren, Rechte setzen,
# Ordner anlegen) und ruft danach den bestehenden Installer install-images.sh auf.
# Es dupliziert dessen Download-/Compose-/Env-Logik absichtlich NICHT: install-images.sh
# bleibt der einzige Installer und wird hier unveraendert weiterverwendet.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR

DOWNLOAD_BASE="${BOBBOT_DOWNLOAD_BASE:-${RAKAZO_DOWNLOAD_BASE:-https://raw.githubusercontent.com/elie222/rakazo/main/infra/compose}}"
while [[ "$DOWNLOAD_BASE" == */ ]]; do
  DOWNLOAD_BASE="${DOWNLOAD_BASE%/}"
done
case "$DOWNLOAD_BASE" in
  https://*) ;;
  *)
    echo "Fehler: BOBBOT_DOWNLOAD_BASE muss mit https:// beginnen." >&2
    exit 1
    ;;
esac
readonly DOWNLOAD_BASE
export BOBBOT_DOWNLOAD_BASE="$DOWNLOAD_BASE"

prepare_only=false
installer_args=()
workdir="${BOBBOT_INSTALL_DIR:-$HOME/bobbot}"

usage() {
  cat <<'EOF'
Aufruf: bash install-linux-mint.sh [Optionen]

  --prepare-only   Nur Dateien und .env vorbereiten, BobBot noch nicht starten
  --local          Vorhandene Dateien im Zielordner verwenden (nichts herunterladen)
  --pull-never     Images nicht herunterladen (muessen schon vorhanden sein)
  --offline        Wie --local und --pull-never zusammen
  --dir=PFAD       Zielordner (Standard: ~/bobbot)
  -h, --help       Diese Hilfe
EOF
}

while (($#)); do
  case "$1" in
    --prepare-only)
      prepare_only=true
      installer_args+=("$1")
      ;;
    --local | --pull-never | --offline)
      installer_args+=("$1")
      ;;
    --dir=*)
      workdir="${1#--dir=}"
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unbekannte Option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

[[ -n "$workdir" ]] || {
  echo "Fehler: --dir darf nicht leer sein." >&2
  exit 2
}

step() { printf '\n=== %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
fail() {
  printf '\nFehler: %s\n' "$*" >&2
  exit 1
}
as_root() {
  if [[ "$(id -u)" == "0" ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

print_relogin_hint() {
  cat <<EOF

Fast fertig — eine Anmeldung fehlt noch:

  1. Melde dich am Rechner ab und einmal neu an (oder starte den Rechner neu).
     Erst danach darfst du Docker ohne Passwort benutzen.
  2. Fuehre dieses Skript dann noch einmal aus:

       curl -fsSLO ${DOWNLOAD_BASE}/install-linux-mint.sh && bash install-linux-mint.sh --dir=$workdir

     Beim zweiten Lauf ist Docker fertig eingerichtet und BobBot startet.
EOF
}

print_model_hint() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0
  if grep -qE '^OPENCODE_API_KEY=.+' "$env_file"; then
    return 0
  fi
  cat <<EOF

Noch kein Modellschluessel eingetragen:

  In ${env_file} fehlt OPENCODE_API_KEY. BobBot startet auch ohne, fragt aber
  beim ersten Chat nach einem Modell ("Connect a model"). So traegst du ihn ein:

    cd $workdir
    nano .env

  Drei Zeilen anpassen (die Raute davor entfernen, falls vorhanden):

    OPENCODE_API_KEY=dein-schluessel
    PI_DEFAULT_PROVIDER=opencode-go
    PI_DEFAULT_MODEL=deepseek-v4.1-flash

  Danach neu starten:  cd $workdir && bash install-linux-mint.sh
EOF
}

[[ "$(id -u)" != "0" ]] ||
  fail "Bitte als normaler Benutzer starten, nicht mit sudo. Das Skript fragt nur dort nach einem Passwort, wo es noetig ist."

current_user="$(id -un)"

step "1/4 — Linux-Version pruefen"
[[ -r /etc/os-release ]] ||
  fail "/etc/os-release fehlt. Dieses Skript ist fuer Linux Mint gedacht."
# shellcheck source=/dev/null
. /etc/os-release
distro_id="${ID:-unknown}"
case "$distro_id" in
  linuxmint | ubuntu | debian | lmde | pop | zorin | elementary) ;;
  *) info "Hinweis: '${PRETTY_NAME:-$distro_id}' ist kein Linux Mint. Das Script macht weiter, solange apt vorhanden ist." ;;
esac
command -v apt-get >/dev/null 2>&1 ||
  fail "apt-get ist nicht vorhanden. Dieses Skript braucht eine apt-Distribution wie Linux Mint."

# Mint traegt in os-release seinen eigenen Namen (z. B. wilma) als VERSION_CODENAME;
# die Docker-Pakete sind nach der Ubuntu-Basis benannt (z. B. noble).
case "$distro_id" in
  debian | lmde)
    docker_repo_family=debian
    docker_codename="${VERSION_CODENAME:-}"
    ;;
  *)
    docker_repo_family=ubuntu
    docker_codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
    ;;
esac
[[ -n "$docker_codename" ]] ||
  fail "Konnte den Paket-Namen der Distribution nicht bestimmen (UBUNTU_CODENAME/VERSION_CODENAME fehlen in /etc/os-release)."
info "${PRETTY_NAME:-$distro_id} erkannt — Docker-Pakete fuer '${docker_repo_family} ${docker_codename}'."

install_docker_repo() {
  info "Docker-Paketquelle einrichten ..."
  as_root apt-get update
  as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg
  as_root install -m 0755 -d /etc/apt/keyrings
  as_root rm -f /etc/apt/keyrings/docker.gpg
  curl -fsSL --retry 3 --retry-delay 2 --proto-redir =https \
    "https://download.docker.com/linux/${docker_repo_family}/gpg" |
    as_root gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  as_root chmod a+r /etc/apt/keyrings/docker.gpg
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/%s %s stable\n' \
    "$(dpkg --print-architecture)" "$docker_repo_family" "$docker_codename" |
    as_root tee /etc/apt/sources.list.d/docker.list >/dev/null
  as_root apt-get update
  info "Docker installieren (das dauert ein paar Minuten) ..."
  as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

step "2/4 — Docker pruefen"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  info "Docker und 'docker compose' sind schon vorhanden."
elif command -v docker >/dev/null 2>&1; then
  # Docker ist da, aber die Compose-Erweiterung fehlt: erst das Mint-Paket probieren.
  if as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends docker-compose-v2 &&
    docker compose version >/dev/null 2>&1; then
    info "'docker compose' aus den Mint-Quellen nachinstalliert."
  else
    info "Kein passendes Compose-Paket gefunden — Docker wird komplett installiert."
    install_docker_repo
  fi
else
  info "Docker ist noch nicht installiert."
  install_docker_repo
fi

docker compose version >/dev/null 2>&1 ||
  fail "Docker wurde eingerichtet, aber 'docker compose' antwortet nicht. Bitte melden: docker compose version"

if command -v systemctl >/dev/null 2>&1; then
  as_root systemctl enable --now docker >/dev/null 2>&1 ||
    info "Hinweis: Der Docker-Dienst liess sich nicht automatisch starten."
fi

step "3/4 — Rechte fuer Docker"
was_in_docker_group=false
if id -nG "$current_user" 2>/dev/null | tr ' ' '\n' | grep -qx docker; then
  was_in_docker_group=true
  info "Der Benutzer '$current_user' darf Docker schon benutzen."
else
  info "Der Benutzer '$current_user' wird in die Gruppe 'docker' aufgenommen ..."
  as_root usermod -aG docker "$current_user"
fi

if ! docker info >/dev/null 2>&1; then
  if [[ "$was_in_docker_group" == true ]]; then
    info "Docker antwortet nicht — der Dienst wird gestartet ..."
    if command -v systemctl >/dev/null 2>&1; then
      as_root systemctl start docker >/dev/null 2>&1 || true
    fi
    docker info >/dev/null 2>&1 ||
      fail "Docker laeuft nicht. Bitte den Dienst pruefen: sudo systemctl status docker"
  else
    print_relogin_hint
    exit 0
  fi
fi

step "4/4 — BobBot installieren"
mkdir -p -- "$workdir" || fail "Der Zielordner '$workdir' laesst sich nicht anlegen."
cd -- "$workdir"
info "Zielordner: $workdir"

installer=""
if [[ -f "$workdir/install-images.sh" ]]; then
  installer="$workdir/install-images.sh"
elif [[ -f "$SCRIPT_DIR/install-images.sh" ]]; then
  installer="$SCRIPT_DIR/install-images.sh"
else
  info "BobBot-Installer herunterladen ..."
  temporary_file="$(mktemp "$workdir/.install-images.sh.XXXXXX")"
  if ! curl -fsSL --retry 3 --retry-delay 2 --proto-redir =https \
    "${DOWNLOAD_BASE}/install-images.sh" -o "$temporary_file"; then
    rm -f -- "$temporary_file"
    fail "Konnte den BobBot-Installer nicht herunterladen (${DOWNLOAD_BASE}). Bitte Internetverbindung pruefen."
  fi
  chmod +x -- "$temporary_file"
  mv -- "$temporary_file" "$workdir/install-images.sh"
  installer="$workdir/install-images.sh"
fi

print_model_hint "$workdir/.env"

bash "$installer" ${installer_args[@]+"${installer_args[@]}"} ||
  fail "Der BobBot-Installer wurde abgebrochen. Die Meldung oberhalb nennt die Ursache."

printf '\n=== Fertig\n'
if [[ "$prepare_only" == true ]]; then
  info "BobBot ist noch nicht gestartet (--prepare-only)."
  info "Erst ${workdir}/.env ausfuellen, dann starten:"
  info "  cd $workdir && bash install-linux-mint.sh"
else
  info "BobBot laeuft. Im Browser oeffnen: http://127.0.0.1:5173"
fi
info "Einstellungen und Dateien: $workdir"
info "Stoppen:  cd $workdir && docker compose -f docker-compose.images.yml down"
info "Fehlersuche:  cd $workdir && docker compose -f docker-compose.images.yml logs -f api"
info "Erste Schritte ohne Technik: docs/bobbot-erste-schritte.md"
print_model_hint "$workdir/.env"
