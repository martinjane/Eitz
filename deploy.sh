#!/bin/bash
# ============================================================================
# Eitashot — Automated Deployment Script
#
# Deploys the full Eitashot application (API server + React frontend + PostgreSQL)
# on a fresh Ubuntu 24.04 LTS VPS.
#
# Usage:
#   git clone https://github.com/martinjane/Eitz.git eitashot
#   cd eitashot
#   chmod +x deploy.sh
#   ./deploy.sh
#
# What this script does:
#   1. Installs system dependencies (Node.js 20, PostgreSQL 16, pnpm)
#   2. Configures npm registry with mirror fallback (for boycotted countries)
#   3. Creates PostgreSQL role and database
#   4. Installs project dependencies
#   5. Generates environment configuration
#   6. Runs database migrations
#   7. Starts API server (port 8081) and frontend (port 80) in a screen session
#   8. Verifies the deployment is working
# ============================================================================
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }
step()  { echo -e "\n${CYAN}═══ $1 ═══${NC}"; }

# ── Configuration ───────────────────────────────────────────────────────────
APP_NAME="eitashot"
APP_DIR="$(pwd)"
FRONTEND_PORT=80
API_PORT=8081
PG_USER="eitashot"
PG_DB="eitashot"
NODE_MAJOR=20
PG_VERSION=16
SCREEN_SESSION="eitashot"
MIN_PNPM_VERSION="9"

# ── Detect public IP ────────────────────────────────────────────────────────
detect_public_ip() {
    local ip=""
    # Try multiple services to detect public IP
    for url in "https://api.ipify.org" "https://ifconfig.me" "https://icanhazip.com" "https://checkip.amazonaws.com"; do
        ip=$(curl -s --connect-timeout 5 "$url" 2>/dev/null | tr -d '[:space:]') || true
        if [[ -n "$ip" && "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "$ip"
            return 0
        fi
    done
    return 1
}

# ── Check if a port is reachable (testing from localhost) ────────────────────
wait_for_port() {
    local port=$1
    local max_wait=${2:-30}
    local waited=0
    while ! curl -s -o /dev/null --connect-timeout 2 "http://127.0.0.1:$port" 2>/dev/null; do
        sleep 1
        waited=$((waited + 1))
        if [ $waited -ge $max_wait ]; then
            return 1
        fi
    done
    return 0
}

# ── Check if npm registry is reachable ──────────────────────────────────────
check_npm_registry() {
    local url=$1
    curl -s --connect-timeout 5 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "200"
}

# ── Detect system info ──────────────────────────────────────────────────────
detect_system() {
    step "Detecting system environment"

    if [ "$(id -u)" -ne 0 ]; then
        err "This script must be run as root or with sudo."
        exit 1
    fi

    # Detect OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        info "OS: $PRETTY_NAME"
        if [[ "$ID" != "ubuntu" ]]; then
            warn "This script is designed for Ubuntu. Detected: $ID. Continuing anyway."
        fi
    else
        err "Cannot detect OS. /etc/os-release not found."
        exit 1
    fi

    # Detect IP
    PUBLIC_IP=$(detect_public_ip) || {
        err "Could not detect public IP. Check your internet connection."
        exit 1
    }
    info "Public IP: $PUBLIC_IP"

    # Check minimum resources
    local ram_gb
    ram_gb=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$ram_gb" -lt 1 ]; then
        warn "Less than 1GB RAM detected (${ram_gb}GB). The app may run slowly."
    fi

    local disk_gb
    disk_gb=$(df -BG / | awk 'NR==2{gsub("G","",$4); print $4}')
    if [ "$disk_gb" -lt 10 ]; then
        warn "Less than 10GB free disk space (${disk_gb}GB). Installation may fail."
    fi

    log "System check complete"
}

# ============================================================================
# STEP 1: Install system dependencies
# ============================================================================
install_system_deps() {
    step "Installing system dependencies"

    # Update apt
    info "Updating apt package lists..."
    apt-get update -qq

    # Install essential packages
    info "Installing essential packages..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        curl \
        git \
        gnupg \
        ca-certificates \
        lsb-release \
        openssl \
        > /dev/null 2>&1

    log "Essential packages installed"
}

# ============================================================================
# STEP 2: Install Node.js
# ============================================================================
install_nodejs() {
    step "Installing Node.js $NODE_MAJOR"

    # Check if already installed and correct version
    if command -v node &>/dev/null; then
        local current_version
        current_version=$(node --version | sed 's/v//' | cut -d. -f1)
        if [ "$current_version" -ge "$NODE_MAJOR" ]; then
            log "Node.js $(node --version) already installed"
            return 0
        fi
    fi

    # Install via NodeSource
    info "Adding NodeSource repository..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - > /dev/null 2>&1

    info "Installing Node.js..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs > /dev/null 2>&1

    # Verify
    if command -v node &>/dev/null; then
        log "Node.js $(node --version) installed"
        log "npm $(npm --version) installed"
    else
        err "Node.js installation failed"
        exit 1
    fi

    # Grant capability to bind port 80 (privileged port) without root
    info "Granting Node.js capability to bind port 80..."
    setcap cap_net_bind_service=+ep "$(which node)" 2>/dev/null || {
        warn "Could not set port 80 capability on node binary"
        warn "If frontend fails to bind port 80, you may need to run as root"
    }
    log "Node.js setup complete"
}

# ============================================================================
# STEP 3: Install pnpm
# ============================================================================
install_pnpm() {
    step "Installing pnpm"

    # Check if already installed
    if command -v pnpm &>/dev/null; then
        local pnpm_ver
        pnpm_ver=$(pnpm --version 2>/dev/null || echo "0")
        if [ "$(echo "$pnpm_ver" | cut -d. -f1)" -ge "$MIN_PNPM_VERSION" ]; then
            log "pnpm $pnpm_ver already installed"
            return 0
        fi
    fi

    # First, configure npm registry with mirror fallback
    info "Configuring npm registry..."

    # Try default npmjs.org first
    if check_npm_registry "https://registry.npmjs.org/pnpm/latest"; then
        info "registry.npmjs.org is reachable, using default registry"
        npm config set registry https://registry.npmjs.org
    elif check_npm_registry "https://registry.npmmirror.com/pnpm/latest"; then
        warn "registry.npmjs.org is unreachable (may be blocked). Using npmmirror.com"
        npm config set registry https://registry.npmmirror.com
    elif check_npm_registry "https://registry.npm.taobao.org/pnpm/latest"; then
        warn "Using Taobao registry mirror"
        npm config set registry https://registry.npm.taobao.org
    else
        warn "No npm mirror found reachable. Trying default anyway..."
    fi

    # Install pnpm via npm
    info "Installing pnpm via npm..."
    npm install -g pnpm 2>&1 | tail -3

    # If the global install created a broken corepack shim, fix it
    local pnpm_bin
    pnpm_bin=$(npm root -g)/pnpm/bin/pnpm.cjs
    if [ -f "$pnpm_bin" ]; then
        # Ensure the symlink points to the real binary, not a corepack shim
        local current_target
        current_target=$(readlink -f "$(which pnpm 2>/dev/null)" 2>/dev/null || true)
        if echo "$current_target" | grep -q "corepack"; then
            info "Fixing broken corepack shim..."
            ln -sf "$pnpm_bin" /usr/local/bin/pnpm
            ln -sf "$pnpm_bin" /usr/bin/pnpm
        fi
    fi

    # Verify
    if command -v pnpm &>/dev/null && pnpm --version &>/dev/null; then
        log "pnpm $(pnpm --version) installed"
    else
        # Last resort: try to locate and link manually
        warn "pnpm not on PATH. Attempting manual fix..."
        local found_pnpm
        found_pnpm=$(find /usr/lib/node_modules /usr/local/lib/node_modules -name "pnpm.cjs" -path "*/bin/*" 2>/dev/null | head -1)
        if [ -n "$found_pnpm" ]; then
            ln -sf "$found_pnpm" /usr/local/bin/pnpm
            chmod +x "$found_pnpm"
            if pnpm --version &>/dev/null; then
                log "pnpm $(pnpm --version) installed (manual fix)"
                return 0
            fi
        fi
        err "pnpm installation failed. Try: npm install -g pnpm"
        exit 1
    fi
}

# ============================================================================
# STEP 4: Install PostgreSQL
# ============================================================================
install_postgresql() {
    step "Installing PostgreSQL $PG_VERSION"

    # Check if already installed
    if command -v psql &>/dev/null && pg_isready &>/dev/null; then
        log "PostgreSQL already installed and running"
    else
        info "Installing PostgreSQL..."
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
            postgresql postgresql-contrib > /dev/null 2>&1

        # Wait for PostgreSQL to start
        info "Waiting for PostgreSQL to start..."
        local waited=0
        while ! pg_isready &>/dev/null; do
            sleep 1
            waited=$((waited + 1))
            if [ $waited -ge 30 ]; then
                err "PostgreSQL failed to start within 30 seconds"
                exit 1
            fi
        done

        log "PostgreSQL $(psql --version | head -1) installed and running"
    fi
}

# ============================================================================
# STEP 5: Configure PostgreSQL database
# ============================================================================
setup_database() {
    step "Setting up PostgreSQL database"

    # Generate a secure password
    local pg_password
    pg_password=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)

    # Check if role already exists
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'" 2>/dev/null | grep -q 1; then
        warn "PostgreSQL role '$PG_USER' already exists. Updating password..."
        sudo -u postgres psql -c "ALTER ROLE $PG_USER WITH PASSWORD '$pg_password';" > /dev/null 2>&1
    else
        info "Creating PostgreSQL role '$PG_USER'..."
        sudo -u postgres psql -c "CREATE ROLE $PG_USER WITH LOGIN PASSWORD '$pg_password';" > /dev/null 2>&1
    fi

    # Check if database already exists
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" 2>/dev/null | grep -q 1; then
        warn "Database '$PG_DB' already exists. Skipping creation."
    else
        info "Creating database '$PG_DB'..."
        sudo -u postgres psql -c "CREATE DATABASE $PG_DB OWNER $PG_USER;" > /dev/null 2>&1
    fi

    # Verify connection
    if PGPASSWORD="$pg_password" psql -h 127.0.0.1 -U "$PG_USER" -d "$PG_DB" -c "SELECT 1" &>/dev/null; then
        log "Database connection verified"
    else
        err "Database connection failed"
        exit 1
    fi

    # Export for use in env generation
    export PG_PASSWORD="$pg_password"
}

# ============================================================================
# STEP 6: Clone or update repository
# ============================================================================
setup_repository() {
    step "Setting up application repository"

    # Check if we're already in the project directory
    if [ -f "$APP_DIR/package.json" ] && grep -q "workspace" "$APP_DIR/package.json" 2>/dev/null; then
        log "Already in project directory: $APP_DIR"
    else
        # Check if repo exists
        if [ -d "$APP_DIR/.git" ]; then
            log "Git repository found at $APP_DIR"
        else
            err "Not in a valid Eitashot project directory."
            err "Please run this script from the project root, or clone the repo first:"
            err "  git clone https://github.com/martinjane/Eitz.git eitashot"
            err "  cd eitashot"
            err "  ./deploy.sh"
            exit 1
        fi
    fi
}

# ============================================================================
# STEP 7: Install project dependencies
# ============================================================================
install_dependencies() {
    step "Installing project dependencies"

    cd "$APP_DIR"

    # Ensure pnpm registry matches npm registry
    local npm_registry
    npm_registry=$(npm config get registry 2>/dev/null || echo "https://registry.npmjs.org")
    pnpm config set registry "$npm_registry" 2>/dev/null || true

    # Set CI=true to avoid interactive prompts
    export CI=true

    # Install with --no-frozen-lockfile (lockfile may have platform-specific differences)
    info "Running pnpm install (this may take a few minutes)..."
    if pnpm install --no-frozen-lockfile 2>&1 | tail -5; then
        log "Dependencies installed successfully"
    elif [ -d "node_modules" ]; then
        warn "pnpm install reported errors but node_modules exists — continuing"
    else
        err "pnpm install failed"
        exit 1
    fi

    unset CI
}

# ============================================================================
# STEP 8: Generate environment configuration
# ============================================================================
generate_env() {
    step "Generating environment configuration"

    cd "$APP_DIR"

    local session_secret
    session_secret=$(openssl rand -hex 64)

    local database_url
    database_url="postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:5432/${PG_DB}"

    local env_file="$APP_DIR/.env.local"

    # Check if .env.local already exists
    if [ -f "$env_file" ]; then
        warn ".env.local already exists. Backing up to .env.local.bak"
        cp "$env_file" "${env_file}.bak"
    fi

    if [ "$TEST_MODE" = "true" ]; then
        info "Test mode: generating all values automatically"

        cat > "$env_file" << EOF
DOMAIN=localhost
POSTGRES_USER=${PG_USER}
POSTGRES_PASSWORD=${PG_PASSWORD}
POSTGRES_DB=${PG_DB}
DATABASE_URL=${database_url}
SESSION_SECRET=${session_secret}
EITAA_BOT_TOKEN=
ADMIN_USERNAME=dev_user
IDPAY_API_KEY=
APP_BASE_URL=http://${PUBLIC_IP}
FRONTEND_URL=http://${PUBLIC_IP}
TEST_MODE=true
EOF
    else
        info "Production mode: requesting operator credentials"

        echo ""
        echo -e "${CYAN}── Production Configuration ──${NC}"
        echo ""

        # Only ask for values we truly cannot determine
        read -rp "Domain name (e.g., eitashot.example.com): " domain_name
        if [ -z "$domain_name" ]; then
            domain_name="localhost"
            warn "No domain provided, using localhost"
        fi

        read -rp "Eitaa bot token: " eitaa_token
        if [ -z "$eitaa_token" ]; then
            warn "No Eitaa bot token provided. Login verification will not work."
        fi

        read -rp "IDPay API key: " idpay_key
        if [ -z "$idpay_key" ]; then
            warn "No IDPay API key provided. Payment processing will not work."
        fi

        echo ""
        info "Generating remaining configuration automatically..."

        cat > "$env_file" << EOF
DOMAIN=${domain_name}
POSTGRES_USER=${PG_USER}
POSTGRES_PASSWORD=${PG_PASSWORD}
POSTGRES_DB=${PG_DB}
DATABASE_URL=${database_url}
SESSION_SECRET=${session_secret}
EITAA_BOT_TOKEN=${eitaa_token}
ADMIN_USERNAME=dev_user
IDPAY_API_KEY=${idpay_key}
APP_BASE_URL=http://${PUBLIC_IP}
FRONTEND_URL=http://${PUBLIC_IP}
TEST_MODE=false
EOF
    fi

    chmod 600 "$env_file"
    log "Environment configuration written to $env_file"
}

# ============================================================================
# STEP 9: Run database migrations
# ============================================================================
run_migrations() {
    step "Running database migrations"

    cd "$APP_DIR"

    # Source the env file for DATABASE_URL
    set -a
    # shellcheck disable=SC1091
    source "$APP_DIR/.env.local"
    set +a

    info "Applying schema with drizzle-kit push..."
    pnpm --filter @workspace/db run push 2>&1 | tail -5

    log "Database schema applied successfully"
}

# ============================================================================
# STEP 10: Start application services (systemd, auto-restart)
# ============================================================================
start_services() {
    step "Starting application services"

    # ── Helpers ──────────────────────────────────────────────────────────────

    write_service_launcher() {
        # Writes a small bash launcher that loads .env.local then execs the
        # service (frontend or api) inside its own shell, so systemd can
        # restart it on crash without re-running the whole script.
        local app_dir="$1"
        local port="$2"
        local role="$3"   # 'api' or 'frontend'

        local unit_name="${SYSTEMD_UNIT_PREFIX}-${role}.service"
        local service_file="${SYSTEMD_DIR}/${unit_name}"
        local launcher_path="/usr/local/bin/${APP_NAME}-${role}-launcher"

        # Determine which command the service runs
        local run_cmd
        if [ "$role" = "api" ]; then
            run_cmd="PORT=${port} pnpm --filter @workspace/api-server run dev"
        else
            run_cmd="PORT=${port} BASE_PATH=/ pnpm --filter @workspace/eitashot run dev"
        fi

        # Service unit
        cat > "$service_file" << SVCEOF
[Unit]
Description=${APP_NAME} ${role} service
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${SUDO_USER:-$USER}
WorkingDirectory=${app_dir}
EnvironmentFile=${app_dir}/.env.local
ExecStart=${launcher_path}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Allow binding to privileged port 80 if needed
AmbientCapabilities=cap_net_bind_service

[Install]
WantedBy=multi-user.target
SVCEOF

        # Launcher: source env then exec
        cat > "$launcher_path" << LAUNCHSCRIPT
#!/bin/bash
set -a
env_file="${app_dir}/.env.local"
if [ -f "\$env_file" ]; then
    . "\$env_file"
fi
set +a

export NODE_ENV=development
export ADMIN_USERNAME="\${ADMIN_USERNAME:-dev_user}"

cd "${app_dir}"

# If the launcher is for the API, wait for PostgreSQL to be ready first
if [ "\$role" = "api" ]; then
    for i in \$(seq 1 30); do
        if pg_isready -h 127.0.0.1 -U \${PG_USER} -d \${PG_DB} &>/dev/null; then
            break
        fi
        sleep 1
    done
fi

# Run the service (exec so systemd controls the PID)
exec ${run_cmd}
LAUNCHSCRIPT
        chmod +x "$launcher_path"
    }

    # ── Stop everything that may be occupying our ports ─────────────────────
    stop_services_cleanly() {
        local app_dir="$1"

        # Stop any already-installed systemd units for this app
        systemctl stop "${SYSTEMD_UNIT_PREFIX}-api.service" "${SYSTEMD_UNIT_PREFIX}-frontend.service" 2>/dev/null || true
        systemctl disable "${SYSTEMD_UNIT_PREFIX}-api.service" "${SYSTEMD_UNIT_PREFIX}-frontend.service" 2>/dev/null || true

        # Kill stray processes manually (in case they weren't managed by systemd)
        for port in ${API_PORT} ${FRONTEND_PORT}; do
            local pid
            pid=$(lsof -ti :"$port" 2>/dev/null || true)
            if [ -n "$pid" ]; then
                warn "Killing stray process on port $port (PID: $pid)"
                kill "$pid" 2>/dev/null || true
                sleep 1
                # If it respawned, kill again
                pid=$(lsof -ti :"$port" 2>/dev/null || true)
                if [ -n "$pid" ]; then
                    kill -9 "$pid" 2>/dev/null || true
                    sleep 1
                fi
            fi
        done

        # Also nuke any leftover screen session from an older deploy
        if command -v screen &>/dev/null && screen -ls 2>/dev/null | grep -q "${SCREEN_SESSION}"; then
            warn "Stopping legacy screen session '${SCREEN_SESSION}'..."
            screen -S "${SCREEN_SESSION}" -X quit 2>/dev/null || true
        fi

        log "Ports ${API_PORT} and ${FRONTEND_PORT} cleared"
    }

    # ── Install the systemd unit files ───────────────────────────────────────
    install_systemd_units() {
        local systemd_dir="$1"

        # Create a dedicated runtime directory for lock/pid files
        local run_dir="/run/${APP_NAME}"
        mkdir -p "$run_dir"
        chown "${SUDO_USER:-$USER}" "$run_dir" 2>/dev/null || true

        # Write the launcher + unit for each role
        write_service_launcher "${APP_DIR}" "${API_PORT}" "api"
        write_service_launcher "${APP_DIR}" "${FRONTEND_PORT}" "frontend"

        # Reload systemd, enable and start
        systemctl daemon-reload
        systemctl enable "${SYSTEMD_UNIT_PREFIX}-api.service" "${SYSTEMD_UNIT_PREFIX}-frontend.service"
        systemctl start "${SYSTEMD_UNIT_PREFIX}-api.service" "${SYSTEMD_UNIT_PREFIX}-frontend.service"
    }

    # ── Wait until a port is answering ───────────────────────────────────────
    wait_for_service() {
        local port="$1"
        local timeout="$2"
        local label="$3"
        local waited=0
        while ! curl -s -o /dev/null --connect-timeout 2 "http://127.0.0.1:${port}" 2>/dev/null; do
            sleep 1
            waited=$((waited + 1))
            if [ "$waited" -ge "$timeout" ]; then
                warn "${label} not ready after ${timeout}s"
                return 1
            fi
        done
        log "${label} ready on port ${port}"
        return 0
    }


    cd "$APP_DIR"

    # Kill any existing screen session
    if screen -ls | grep -q "$SCREEN_SESSION"; then
        warn "Stopping existing '$SCREEN_SESSION' screen session..."
        screen -S "$SCREEN_SESSION" -X quit 2>/dev/null || true
        sleep 2
    fi

    # Kill any processes on our ports
    for port in $FRONTEND_PORT $API_PORT; do
        local pid
        pid=$(lsof -ti :"$port" 2>/dev/null || true)
        if [ -n "$pid" ]; then
            warn "Killing process on port $port (PID: $pid)"
            kill "$pid" 2>/dev/null || true
            sleep 1
        fi
    done

    # ── Build a per-service launcher that loads the env and execs the service ──
    write_service_launcher "${APP_DIR}" "${API_PORT}" "api"
    write_service_launcher "${APP_DIR}" "${FRONTEND_PORT}" "frontend"

    # Stop anything running on those ports first (old screen session, stray procs)
    stop_services_cleanly "${APP_DIR}"

    # Install the systemd units into /etc/systemd/system/, enable and (re)start
    install_systemd_units "${SYSTEMD_DIR}"

    # Wait for them to come up
    wait_for_service "${API_PORT}" 45 "API server"
    wait_for_service "${FRONTEND_PORT}" 60 "Frontend"

    log "Services are running via systemd"
}

# ============================================================================
# STEP 11: Verify deployment
# ============================================================================
verify_deployment() {
    step "Verifying deployment"

    local all_ok=true

    # Check API via systemd (unit must be active) plus HTTP
    local api_active
    api_active=$(systemctl is-active --quiet "${SYSTEMD_UNIT_PREFIX}-api.service" 2>/dev/null && echo ok || echo fail)
    if [ "$api_active" = ok ] && curl -s -o /dev/null --connect-timeout 5 "http://127.0.0.1:${API_PORT}" 2>/dev/null; then
        log "API server responding on port ${API_PORT} (systemd active)"
    else
        warn "API server not responding on port ${API_PORT}"
        all_ok=false
    fi

    # Check frontend
    local frontend_active
    frontend_active=$(systemctl is-active --quiet "${SYSTEMD_UNIT_PREFIX}-frontend.service" 2>/dev/null && echo ok || echo fail)
    if [ "$frontend_active" = ok ] && curl -s -o /dev/null --connect-timeout 5 "http://127.0.0.1:${FRONTEND_PORT}" 2>/dev/null; then
        log "Frontend responding on port ${FRONTEND_PORT} (systemd active)"
    else
        warn "Frontend not responding on port ${FRONTEND_PORT}"
        all_ok=false
    fi

    # Check database
    set -a
    source "${APP_DIR}/.env.local" 2>/dev/null || true
    set +a
    if PGPASSWORD="${PG_PASSWORD}" psql -h 127.0.0.1 -U "${PG_USER}" -d "${PG_DB}" -c "SELECT 1" &>/dev/null; then
        log "PostgreSQL accepting connections"
    else
        warn "PostgreSQL connection test failed"
        all_ok=false
    fi

    # Check external connectivity
    if curl -s -o /dev/null --connect-timeout 5 "http://${PUBLIC_IP}:${FRONTEND_PORT}" 2>/dev/null; then
        log "External access verified: http://${PUBLIC_IP}:${FRONTEND_PORT}"
    else
        warn "External access not yet reachable (may be a firewall/network issue)"
    fi

    echo ""
    if [ "$all_ok" = true ]; then
        echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  Deployment successful!${NC}"
    else
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${YELLOW}  Deployment completed with warnings${NC}"
    fi
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}URL:${NC}            http://${PUBLIC_IP}:${FRONTEND_PORT}"
    echo -e "  ${CYAN}API:${NC}            http://${PUBLIC_IP}:${API_PORT}"
    echo -e "  ${CYAN}Logs (API):${NC}      journalctl -u ${SYSTEMD_UNIT_PREFIX}-api.service -f"
    echo -e "  ${CYAN}Logs (Frontend):${NC} journalctl -u ${SYSTEMD_UNIT_PREFIX}-frontend.service -f"
    echo -e "  ${CYAN}Restart app:${NC}    systemctl restart ${SYSTEMD_UNIT_PREFIX}-api.service ${SYSTEMD_UNIT_PREFIX}-frontend.service"
    echo -e "  ${CYAN}Check status:${NC}   systemctl status ${SYSTEMD_UNIT_PREFIX}-*.service"
    echo ""
}

# ============================================================================
# --update mode: pull latest, rebuild, restart, rollback if unhealthy
# ============================================================================
do_update() {
    step "Pulling latest code from GitHub (private repo)"

    local gh_pat=""
    read -rp "GitHub PAT (Personal Access Token) with repo access: " gh_pat
    if [ -z "$gh_pat" ]; then
        err "No PAT provided."
        exit 1
    fi

    local remote_url="https://x-access-token:${gh_pat}@github.com/martinjane/Eitz.git"

    cd "${APP_DIR}"

    # Verify we're on a git repo with that remote (so clone-from-scratch is separate)
    if ! git remote get-url origin &>/dev/null; then
        err "Not a git repository at ${APP_DIR}. Run the full deployment first."
        exit 1
    fi

    # If remote is not our github.com URL, reconfigure it safely
    local current_remote
    current_remote=$(git remote get-url origin 2>/dev/null || true)
    if [ -n "$current_remote" ] && echo "$current_remote" | grep -q "github.com/martinjane/Eitz"; then
        log "Remote is already the Eitz repository."
    else
        info "Configuring remote origin to Eitz repository (bare https, no credential permanent storage)..."
        git remote set-url origin "$remote_url" 2>/dev/null || {
            err "Failed to set remote. Check your PAT."
            exit 1
        }
    fi

    info "Fetching latest commits..."
    if ! git fetch origin main 2>&1 | tail -3; then
        # Retry with explicit credential header in case token embed didn't work
        info "Retrying fetch with credential header..."
        if ! git -c http.extraheader="Authorization: Basic $(echo -n "x-access-token:${gh_pat}" | base64)" fetch origin main 2>&1 | tail -3; then
            err "Git fetch failed. Check your PAT has repo scope and the repo exists."
            exit 1
        fi
    fi

    # Detect where HEAD is currently pointing (detached, main, etc.)
    local current_ref
    current_ref=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
    local current_commit
    current_commit=$(git rev-parse HEAD 2>/dev/null || true)

    info "Current ref: $current_ref (commit: ${current_commit:0:7})"

    # Check if there are new commits
    if git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
        warn "Already up to date. Nothing to do."
        return 0
    fi

    # Save current commit for possible rollback
    local rollback_commit="$current_commit"
    export ROLLBACK_COMMIT="$rollback_commit"

    info "Pulling latest..."
    if ! git pull origin main 2>&1 | tail -5; then
        err "Git pull failed."
        exit 1
    fi

    log "Code updated successfully"

    step "Installing dependencies"
    export CI=true
    if pnpm install --no-frozen-lockfile 2>&1 | tail -5; then
        log "Dependencies updated"
    elif [ -d "node_modules" ]; then
        warn "pnpm install reported errors but node_modules exists — continuing"
    else
        err "pnpm install failed — rolling back to previous commit"
        git reset --hard "$ROLLBACK_COMMIT" 2>/dev/null || true
        systemctl restart "${SYSTEMD_UNIT_PREFIX}-api.service" "${SYSTEMD_UNIT_PREFIX}-frontend.service" 2>/dev/null || true
        exit 1
    fi
    unset CI

    step "Running database migrations"
    set -a
    source "${APP_DIR}/.env.local" 2>/dev/null || true
    set +a
    if pnpm --filter @workspace/db run push 2>&1 | tail -5; then
        log "Database schema updated"
    else
        warn "Migration may have failed — check logs"
    fi

    step "Rebuilding and restarting services"

    # Restart services (systemd will rebuild on start because the launcher runs the dev scripts)
    systemctl restart "${SYSTEMD_UNIT_PREFIX}-api.service" "${SYSTEMD_UNIT_PREFIX}-frontend.service"

    # Wait for health
    local api_ok=false
    local frontend_ok=false
    for i in $(seq 1 60); do
        if curl -s -o /dev/null --connect-timeout 2 "http://127.0.0.1:${API_PORT}" 2>/dev/null; then
            api_ok=true
        fi
        if curl -s -o /dev/null --connect-timeout 2 "http://127.0.0.1:${FRONTEND_PORT}" 2>/dev/null; then
            frontend_ok=true
        fi
        if $api_ok && $frontend_ok; then
            break
        fi
        sleep 1
    done

    if $api_ok && $frontend_ok; then
        log "Update complete — both services healthy"
        return 0
    fi

    # Health check failed: rollback
    warn "Health check failed after update. Rolling back..."
    git reset --hard "$ROLLBACK_COMMIT" 2>/dev/null || true
    systemctl restart "${SYSTEMD_UNIT_PREFIX}-api.service" "${SYSTEMD_UNIT_PREFIX}-frontend.service"

    local rb_ok=false
    for i in $(seq 1 30); do
        if curl -s -o /dev/null --connect-timeout 2 "http://127.0.0.1:${FRONTEND_PORT}" 2>/dev/null; then
            rb_ok=true
            break
        fi
        sleep 1
    done

    if $rb_ok; then
        log "Rollback successful — app is back to previous version"
    else
        err "Rollback did not bring the app back up. Check logs with journalctl."
        exit 1
    fi
}

# ============================================================================
# Main: picks run mode
# ============================================================================
main() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║            Eitashot — Automated Deployment                 ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # ── Parse flags ────────────────────────────────────────────────────────
    local mode="install"
    if [ "${1:-}" = "--update" ]; then
        mode="update"
    fi

    if [ "$mode" = "update" ]; then
        info "Mode: UPDATE (existing deployment on VPS)"
        echo ""
        do_update
        return 0
    fi

    # ── Test mode prompt (full install) ─────────────────────────────────────
    echo -e "${CYAN}Test mode on or off?${NC}"
    echo ""
    echo "  ${GREEN}on${NC}  — Test mode (auto-generates all values, no questions asked)"
    echo "  ${RED}off${NC} — Production mode (asks for Eitaa token, IDPay key, domain)"
    echo ""
    read -rp "Enter choice (on/off): " TEST_MODE_INPUT

    case "${TEST_MODE_INPUT,,}" in
        on|yes|true|1)
            TEST_MODE="true"
            log "Test mode: ON — all values will be auto-generated"
            ;;
        off|no|false|0)
            TEST_MODE="false"
            log "Production mode: ON — you will be prompted for secrets"
            ;;
        *)
            warn "Invalid input. Defaulting to normal mode (test mode OFF)."
            TEST_MODE="false"
            ;;
    esac
    echo ""

    # ── Execute deployment steps ─────────────────────────────────────────────
    detect_system
    install_system_deps
    install_nodejs
    install_pnpm
    install_postgresql
    setup_database
    setup_repository
    install_dependencies
    generate_env
    run_migrations
    start_services
    verify_deployment
}

# Run main
main "$@"
