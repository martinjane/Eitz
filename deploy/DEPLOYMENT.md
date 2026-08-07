# راهنمای کامل استقرار ایتاشات روی سرور مجازی
# Eitashot — Complete Beginner's Deployment Guide

> **Who is this guide for?**
> Someone who has never used Docker, Linux servers, or environment variables before.
> Every single step is explained. Every command is shown in full with an explanation
> of what it does before you run it. Do not skip any step.

---

## Table of Contents

1. [What You Will Need](#1-what-you-will-need)
2. [Understanding the Architecture](#2-understanding-the-architecture)
3. [Rent and Access a VPS](#3-rent-and-access-a-vps)
4. [Connect to Your VPS](#4-connect-to-your-vps)
5. [Prepare the VPS — Install Required Software](#5-prepare-the-vps--install-required-software)
6. [Transfer the Project Files](#6-transfer-the-project-files)
7. [Configure Environment Variables](#7-configure-environment-variables)
8. [Point Your Domain to the VPS](#8-point-your-domain-to-the-vps)
9. [Build and Start the Application](#9-build-and-start-the-application)
10. [Verify the Deployment](#10-verify-the-deployment)
11. [Create the Administrator Account](#11-create-the-administrator-account)
12. [Daily Operations](#12-daily-operations)
    - [Viewing Logs](#viewing-logs)
    - [Stopping the Application Safely](#stopping-the-application-safely)
    - [Restarting the Application](#restarting-the-application)
    - [Updating After a New Release](#updating-after-a-new-release)
13. [Database Backups and Restore](#13-database-backups-and-restore)
14. [Troubleshooting Common Problems](#14-troubleshooting-common-problems)
15. [Pre-Launch Checklist](#15-pre-launch-checklist)

---

## 1. What You Will Need

Before you begin, make sure you have all of the following:

| Item | What it is | Where to get it |
|------|-----------|-----------------|
| A VPS (Virtual Private Server) | A rented Linux computer on the internet | Arvan Cloud, IDC Host, Linode, DigitalOcean, Hetzner |
| A domain name | e.g. `eitashot.example.com` | Any domain registrar |
| An Eitaa bot token | Proves that login requests come from your bot | Your Eitaa channel bot settings |
| An IDPay API key | Processes payments (donations + ads) | [idpay.ir](https://idpay.ir) merchant dashboard |
| The project source code | The files in this repository | This Git repository |

**Minimum VPS requirements:**

- Operating system: **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS** (these instructions assume Ubuntu)
- RAM: at least **2 GB**
- Disk: at least **20 GB**
- CPU: at least **1 core** (2 recommended)
- A public IP address

---

## 2. Understanding the Architecture

When running in production, the application consists of four containers (isolated programs) that talk to each other:

```
Internet
    │
    ▼
┌─────────────────────────────────────┐
│  Caddy (ports 80 and 443)           │  ← HTTPS termination, automatic certificates
│  Routes traffic based on URL path   │
└────────────┬────────────────────────┘
             │
    ┌────────┴─────────┐
    ▼                  ▼
┌──────────┐    ┌────────────┐
│ Frontend │    │ API server │  ← Express + Node.js
│  (nginx) │    │  port 3001 │
└──────────┘    └─────┬──────┘
                      │
               ┌──────▼──────┐
               │  PostgreSQL │  ← Database (data lives forever in a Docker volume)
               └─────────────┘
```

- **Caddy** is the only container exposed to the internet (ports 80 and 443).
  It automatically gets a free HTTPS certificate from Let's Encrypt.
- **Frontend** serves the React app as static HTML/CSS/JS files.
- **API server** handles all `/api/*` requests.
- **PostgreSQL** stores all data. Its files are in a Docker volume, so data
  survives even if the containers are deleted and rebuilt.

---

## 3. Rent and Access a VPS

### 3a. Choose a provider

Any Linux VPS provider works. For Iranian deployments, **Arvan Cloud** or
**IDC Host** are popular. For international hosting, **Hetzner** offers
excellent value. Choose a plan with at least 2 GB RAM.

### 3b. Select Ubuntu 22.04 or 24.04

During VPS setup, you will be asked to choose an operating system.
Select **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS**.

### 3c. Note your VPS IP address

After the VPS is created, the provider gives you:
- A public **IP address** (looks like `1.2.3.4`)
- A **root password** or the option to add your SSH key

Write down the IP address — you will need it in every step.

---

## 4. Connect to Your VPS

You connect to the VPS using a program called **SSH** (Secure Shell).
SSH gives you a terminal window that runs commands on the remote server.

### On Windows

Install **Windows Terminal** from the Microsoft Store, or use **PuTTY**.
Windows 10 and 11 include SSH built in.

### On macOS or Linux

SSH is already installed. Open the **Terminal** application.

### Connect

Replace `YOUR_VPS_IP` with the IP address from step 3c:

```bash
ssh root@YOUR_VPS_IP
```

The first time you connect, you will see a message like:

```
The authenticity of host '1.2.3.4 (1.2.3.4)' can't be established.
Are you sure you want to continue connecting (yes/no)?
```

Type `yes` and press Enter. Then enter your root password when prompted.

You are now logged in to your VPS. Every command from here runs **on the VPS**,
not on your own computer — unless the instruction says otherwise.

---

## 5. Prepare the VPS — Install Required Software

The VPS comes with a minimal Ubuntu installation. You need to install two
programs: **Docker** and **Docker Compose**. Docker runs the application
containers; Docker Compose manages multiple containers at once.

### Step 1: Update the system package list

```bash
apt-get update
```

This downloads the latest list of available software. It does not install
anything yet.

### Step 2: Install prerequisite packages

```bash
apt-get install -y ca-certificates curl gnupg
```

These packages let Ubuntu verify and download software securely.

### Step 3: Add Docker's official package source

Docker is not in Ubuntu's default package list. Run these commands one at a
time, pressing Enter after each:

```bash
install -m 0755 -d /etc/apt/keyrings
```

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

```bash
chmod a+r /etc/apt/keyrings/docker.gpg
```

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### Step 4: Install Docker and Docker Compose

```bash
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

This installs Docker and Docker Compose. It will take a minute or two.

### Step 5: Verify the installation

```bash
docker --version
docker compose version
```

You should see output like:

```
Docker version 26.0.0, build abc123
Docker Compose version v2.27.0
```

The exact version numbers do not matter — as long as both commands produce
output without errors, Docker is installed correctly.

### Step 6: Make Docker start automatically on server reboot

```bash
systemctl enable docker
systemctl start docker
```

From now on, Docker (and therefore your application) will restart
automatically if the VPS reboots.

---

## 6. Transfer the Project Files

You need to copy the project source code from your computer to the VPS.

### Option A: Using Git (recommended if the code is in a Git repository)

On the VPS, run:

```bash
apt-get install -y git
```

```bash
cd /opt
git clone https://YOUR_REPOSITORY_URL.git eitashot
cd eitashot
```

Replace `https://YOUR_REPOSITORY_URL.git` with the actual URL of your
Git repository.

### Option B: Using SCP (copy files from your computer to the VPS)

Run this **on your own computer** (not the VPS), replacing `YOUR_VPS_IP`:

```bash
scp -r /path/to/your/eitashot root@YOUR_VPS_IP:/opt/eitashot
```

Replace `/path/to/your/eitashot` with the path to the project folder on
your computer.

Then, on the VPS:

```bash
cd /opt/eitashot
```

### Verify the files are there

```bash
ls
```

You should see files including `package.json`, `deploy/`, `artifacts/`, `lib/`, etc.

---

## 7. Configure Environment Variables

Environment variables are settings that tell the application how to behave
in production — things like database passwords, secret keys, and API keys.
They are stored in a file called `.env` that lives inside the `deploy/` folder.

### Step 1: Navigate to the deploy directory

```bash
cd /opt/eitashot/deploy
```

### Step 2: Create your .env file from the template

```bash
cp .env.example .env
```

This copies the template file. Now you need to edit it:

```bash
nano .env
```

`nano` is a simple text editor. Use the arrow keys to move around.
When you are done, press `Ctrl+X`, then `Y`, then `Enter` to save.

### Step 3: Fill in every value

Below is a description of every variable. **Replace every placeholder**
with a real value.

---

#### `DOMAIN`

**What it does:** The domain name where your application will be accessible.
Caddy uses this to automatically obtain a free HTTPS certificate.

**Example:** `DOMAIN=eitashot.example.com`

**Important:** This must be a real domain that you own and have pointed to
your VPS (see step 8). Caddy cannot get a certificate for an IP address.

---

#### `POSTGRES_USER`

**What it does:** The username for the PostgreSQL database.
The database uses this to create the database user.

**Example:** `POSTGRES_USER=eitashot`

**Important:** Change this from the default. Use only letters, numbers,
and underscores.

---

#### `POSTGRES_PASSWORD`

**What it does:** The password for the PostgreSQL database user.

**Example:** `POSTGRES_PASSWORD=MyV3ryStr0ngPassw0rd!`

**Important:** Use a long, random password. Never use simple passwords
for a production database. Generate a strong one with:

```bash
openssl rand -base64 32
```

---

#### `POSTGRES_DB`

**What it does:** The name of the database to create.

**Example:** `POSTGRES_DB=eitashot`

---

#### `DATABASE_URL`

**What it does:** The full connection string that the API server uses
to connect to the database. It must match `POSTGRES_USER`, `POSTGRES_PASSWORD`,
and `POSTGRES_DB` exactly.

**Format:** `postgresql://USER:PASSWORD@postgres:5432/DATABASE`

**Example:**
```
DATABASE_URL=postgresql://eitashot:MyV3ryStr0ngPassw0rd!@postgres:5432/eitashot
```

The word `postgres` in the URL refers to the database container's name
inside Docker. Do not replace it with an IP address.

---

#### `SESSION_SECRET`

**What it does:** A secret key used to sign login tokens (JWTs).
Anyone who knows this value can forge authentication tokens.

**Example:** Generate a strong value with:

```bash
openssl rand -hex 64
```

Copy the output into your `.env` file:

```
SESSION_SECRET=a1b2c3d4e5f6...  (your generated value)
```

**Important:** This must be a long random string, at least 64 characters.
Never share it or commit it to version control.

---

#### `EITAA_BOT_TOKEN`

**What it does:** Your Eitaa bot's secret token. The server uses this to
verify that login requests genuinely come from users inside your Eitaa
mini-app. Without this, anyone could fake a login.

**How to get it:** Obtain it from your Eitaa bot's settings panel.

**Example:** `EITAA_BOT_TOKEN=123456:ABCdefGHIjklMNOpqrsTUVwxyz`

---

#### `ADMIN_USERNAME`

**What it does:** The username of the account that has administrator
access (can review ads, verify channels, and change pricing).

This account does **not** exist yet — you will register it normally
through the app after deployment (see step 11).

**Example:** `ADMIN_USERNAME=myadminname`

**Important:** Choose your admin username now and remember it. It must
be 3–16 lowercase letters, digits, or underscores.

---

#### `IDPAY_API_KEY`

**What it does:** Your IDPay merchant API key. The application uses IDPay
to process payments for donations and advertisement slots.

**How to get it:** Log in to your IDPay merchant dashboard at
[idpay.ir](https://idpay.ir) → Settings → API keys.

**Example:** `IDPAY_API_KEY=a1b2c3d4-e5f6-...`

---

#### `APP_BASE_URL`

**What it does:** The full public URL of your server. IDPay sends payment
completion notifications (callbacks) to this URL.

**Example:** `APP_BASE_URL=https://eitashot.example.com`

Use the same domain as `DOMAIN`, with `https://` in front.

---

#### `FRONTEND_URL`

**What it does:** The URL that payment pages redirect users back to after
a successful or failed payment.

**Example:** `FRONTEND_URL=https://eitashot.example.com`

Usually the same as `APP_BASE_URL`.

---

### Step 4: Verify no placeholders remain

```bash
grep "your_\|change_this\|yourdomain\|replace_with" .env
```

If this command produces any output, you missed filling in those values.
Edit the file again with `nano .env` and fix them.

---

## 8. Point Your Domain to the VPS

Before HTTPS will work, your domain's DNS records must point to your VPS.

### Step 1: Log in to your domain registrar

This is the website where you bought your domain name (e.g. Namecheap,
GoDaddy, Arvan Cloud DNS, etc.).

### Step 2: Add an A record

Find the DNS management section. Add a new record:

| Field | Value |
|-------|-------|
| Type  | A |
| Name  | `@` (or the subdomain, e.g. `eitashot`) |
| Value | Your VPS IP address (e.g. `1.2.3.4`) |
| TTL   | 3600 (or "Automatic") |

If you want to use a subdomain like `eitashot.example.com`, set Name to
`eitashot` and make sure `DOMAIN=eitashot.example.com` in your `.env`.

### Step 3: Wait for DNS propagation

DNS changes can take anywhere from 5 minutes to 48 hours to take effect
worldwide. You can check if propagation has reached your VPS with:

```bash
dig +short YOUR_DOMAIN
```

When the output shows your VPS IP address, DNS is ready.

---

## 9. Build and Start the Application

Now you will build the Docker images and start all containers.

### Step 1: Make sure you are in the deploy directory

```bash
cd /opt/eitashot/deploy
```

### Step 2: Build the Docker images

This compiles the frontend and backend from source. It will take several
minutes the first time (it downloads Node.js and installs all packages):

```bash
docker compose --env-file .env build
```

You will see a lot of output. This is normal. Wait until it finishes
and returns you to the command prompt. If you see any `ERROR:` lines,
see the [Troubleshooting](#14-troubleshooting-common-problems) section.

### Step 3: Start all services

```bash
docker compose --env-file .env up -d
```

The `-d` flag means "detached" — the containers run in the background.

### Step 4: Watch the startup logs

```bash
docker compose --env-file .env logs -f --tail=50
```

Press `Ctrl+C` to stop watching logs (this does not stop the application).

You should see:
- `postgres` container starting and becoming healthy
- `db-migrate` running and printing migration output, then exiting
- `api` starting and printing `Server listening`
- `frontend` starting
- `caddy` starting and obtaining an HTTPS certificate

The first time Caddy runs, it contacts Let's Encrypt to get a certificate.
This takes 30–60 seconds. You will see a message like:

```
caddy  | {"level":"info","msg":"certificate obtained successfully"}
```

---

## 10. Verify the Deployment

### Test 1: Is the application accessible?

Open a web browser and navigate to `https://YOUR_DOMAIN`.

You should see the Eitashot home page with the Eitaa logo.

### Test 2: Is the API responding?

```bash
curl https://YOUR_DOMAIN/api/health
```

You should see: `{"ok":true}` (or similar).

### Test 3: Is HTTPS working?

Your browser's address bar should show a padlock icon next to the URL.
Click it to confirm the certificate is valid and issued by Let's Encrypt.

### Test 4: Check all containers are running

```bash
docker compose --env-file .env ps
```

All services except `db-migrate` should show `running`. `db-migrate` will
show `Exited (0)` which is correct — it ran once and finished.

---

## 11. Create the Administrator Account

The application starts with no user accounts at all. The admin account
must be created through the normal registration flow.

1. Open the Eitashot app in your Eitaa application.
2. Log in with Eitaa (this creates a new account).
3. When prompted to choose a username, enter **exactly** the username
   you set as `ADMIN_USERNAME` in your `.env` file.
4. Accept the terms of service.

After completing registration, this account will have full access to
the `/admin` panel.

**Important:** No one else should register with the admin username.
If someone registers with that username before you, they will have
admin access. Register your admin account immediately after deployment.

---

## 12. Daily Operations

All commands below should be run from `/opt/eitashot/deploy` on the VPS.

### Viewing Logs

View logs from all containers at once:

```bash
docker compose --env-file .env logs -f
```

View logs from a specific container only:

```bash
docker compose --env-file .env logs -f api
docker compose --env-file .env logs -f frontend
docker compose --env-file .env logs -f postgres
docker compose --env-file .env logs -f caddy
```

Press `Ctrl+C` to stop watching logs. The application keeps running.

View the last 100 lines of logs without following:

```bash
docker compose --env-file .env logs --tail=100 api
```

### Stopping the Application Safely

This stops all containers without deleting any data:

```bash
docker compose --env-file .env down
```

The database and all user data are safe — they live in Docker volumes,
not inside the containers themselves.

### Restarting the Application

Restart all containers:

```bash
docker compose --env-file .env restart
```

Restart a single container (e.g. just the API):

```bash
docker compose --env-file .env restart api
```

### Updating After a New Release

When a new version of the code is released, follow these steps to update:

**Step 1: Pull the latest code** (if using Git):

```bash
cd /opt/eitashot
git pull origin main
```

Or copy the new files manually via SCP.

**Step 2: Navigate to the deploy directory:**

```bash
cd /opt/eitashot/deploy
```

**Step 3: Rebuild the images:**

```bash
docker compose --env-file .env build
```

**Step 4: Stop the current containers:**

```bash
docker compose --env-file .env down
```

**Step 5: Start with the new images:**

```bash
docker compose --env-file .env up -d
```

The `db-migrate` service will run automatically and apply any new
database schema changes. Your data is preserved.

**Step 6: Verify everything is running:**

```bash
docker compose --env-file .env ps
docker compose --env-file .env logs -f --tail=30
```

---

## 13. Database Backups and Restore

**Always take a backup before updating the application.**

### Create a manual backup

This command dumps the entire database to a file on the VPS:

```bash
docker compose --env-file .env exec postgres \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB \
  > /opt/backups/eitashot-$(date +%Y%m%d-%H%M%S).sql
```

Before running this for the first time, create the backup directory:

```bash
mkdir -p /opt/backups
```

Check that the backup file was created:

```bash
ls -lh /opt/backups/
```

You should see a `.sql` file with today's date.

### Copy a backup to your computer

Run this **on your own computer** (not the VPS):

```bash
scp root@YOUR_VPS_IP:/opt/backups/eitashot-YYYYMMDD-HHMMSS.sql ./
```

Replace `YYYYMMDD-HHMMSS` with the actual filename from the `ls` output.

### Restore a backup

**Warning:** Restoring overwrites all current data. Only do this if you
are certain you want to revert to the backup.

**Step 1:** Copy the backup file to the VPS if it is on your computer:

```bash
scp ./eitashot-backup.sql root@YOUR_VPS_IP:/opt/backups/
```

**Step 2:** On the VPS, stop the API and migration services (so nothing
is writing to the DB while you restore):

```bash
cd /opt/eitashot/deploy
docker compose --env-file .env stop api db-migrate
```

**Step 3:** Restore the database:

```bash
docker compose --env-file .env exec -T postgres \
  psql -U $POSTGRES_USER $POSTGRES_DB \
  < /opt/backups/eitashot-backup.sql
```

**Step 4:** Restart everything:

```bash
docker compose --env-file .env start api
```

### Automated daily backups (optional but recommended)

Create a cron job that runs a backup every night at 2 AM:

```bash
crontab -e
```

Add this line at the bottom:

```
0 2 * * * cd /opt/eitashot/deploy && docker compose --env-file .env exec -T postgres pg_dump -U eitashot eitashot > /opt/backups/eitashot-$(date +\%Y\%m\%d).sql 2>&1
```

Press `Ctrl+X`, `Y`, `Enter` to save.

---

## 14. Troubleshooting Common Problems

### Problem: `docker compose build` fails with "module not found" or similar

**Cause:** A file is missing or the build context is wrong.

**Solution:** Make sure you ran the build from inside the `deploy/` directory:

```bash
cd /opt/eitashot/deploy
docker compose --env-file .env build
```

---

### Problem: Caddy says "no DNS record found" or certificate fails

**Cause:** Your domain's DNS has not propagated yet, or the A record
points to the wrong IP.

**Solution:**

```bash
dig +short YOUR_DOMAIN
```

The output must show your VPS IP address. If it shows nothing or a
different IP, fix the DNS record at your registrar and wait.

---

### Problem: `db-migrate` exits with an error

**Cause:** The database connection failed, or the DATABASE_URL is wrong.

**Solution:**

Check the migrate logs:

```bash
docker compose --env-file .env logs db-migrate
```

Verify the DATABASE_URL in your `.env` file matches POSTGRES_USER,
POSTGRES_PASSWORD, and POSTGRES_DB exactly.

Verify the postgres container is healthy:

```bash
docker compose --env-file .env ps postgres
```

It should show `(healthy)`. If it shows `(unhealthy)` or `starting`,
wait 30 seconds and try again.

---

### Problem: API container keeps restarting (crash loop)

**Cause:** Usually a missing or wrong environment variable.

**Solution:**

```bash
docker compose --env-file .env logs api
```

Look for error messages near the top. Common causes:
- `SESSION_SECRET environment variable is required in production` → Set SESSION_SECRET in .env
- `EITAA_BOT_TOKEN is required in production` → Set EITAA_BOT_TOKEN in .env
- `ADMIN_USERNAME environment variable is required in production` → Set ADMIN_USERNAME in .env
- `DATABASE_URL must be set` → Set DATABASE_URL in .env

---

### Problem: The app loads but shows an error when trying to log in

**Cause:** EITAA_BOT_TOKEN is wrong or the Eitaa bot is not configured
to allow your domain.

**Solution:** Verify the bot token. Check that the Eitaa bot is configured
with your domain's URL as the mini-app address.

---

### Problem: Payments fail (sandbox mode still active)

**Cause:** `NODE_ENV` is not set to `production` in docker-compose.yml,
which means IDPay sandbox mode is active.

**Solution:** The `docker-compose.yml` file in this repository already
sets `NODE_ENV: production`. Verify you are using the provided
`docker-compose.yml` and that no environment variable is overriding it.

---

### Problem: "permission denied" when running Docker commands

**Cause:** You are not logged in as root.

**Solution:** Run `sudo` before each command, or switch to root:

```bash
sudo su -
```

---

### Problem: Not enough disk space

Check available disk space:

```bash
df -h /
```

If the disk is nearly full, remove old Docker images that are no longer
used:

```bash
docker image prune -f
docker system prune -f
```

---

### Problem: Not enough memory (out of memory errors)

Check current memory usage:

```bash
free -h
```

If memory is consistently at 90%+ usage, upgrade your VPS to a plan with
more RAM.

---

## 15. Pre-Launch Checklist

Go through every item on this list before making the application
publicly accessible.

### Secrets and configuration

- [ ] `DOMAIN` is set to your actual production domain
- [ ] `POSTGRES_PASSWORD` is a strong random password (not the example value)
- [ ] `SESSION_SECRET` is a long random string generated with `openssl rand -hex 64`
- [ ] `EITAA_BOT_TOKEN` is set to your real bot token
- [ ] `ADMIN_USERNAME` is set to the username you will use for the admin account
- [ ] `IDPAY_API_KEY` is set to your real IDPay production API key
- [ ] `APP_BASE_URL` and `FRONTEND_URL` both start with `https://` and use your real domain
- [ ] `DATABASE_URL` matches POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB exactly
- [ ] No placeholder values remain: `grep "your_\|change_this\|yourdomain\|replace_with" /opt/eitashot/deploy/.env` produces no output

### Security

- [ ] The `.env` file is not readable by others: `chmod 600 /opt/eitashot/deploy/.env`
- [ ] The `.env` file is not committed to your Git repository
- [ ] `docker compose ps` shows no unexpected open ports (only 80 and 443 should be public)

### HTTPS

- [ ] Navigating to `https://YOUR_DOMAIN` shows the application
- [ ] The browser shows a padlock icon (valid certificate)
- [ ] Navigating to `http://YOUR_DOMAIN` automatically redirects to `https://`

### Payments

- [ ] IDPay sandbox mode is disabled: `NODE_ENV=production` is set in docker-compose.yml
- [ ] A test payment flow completes successfully (you can test with IDPay's test mode)
- [ ] The IDPay dashboard shows your real merchant API key is active

### Database and persistence

- [ ] `docker compose ps` shows the `postgres` container as `(healthy)`
- [ ] Take a backup and verify the file is not empty: `ls -lh /opt/backups/`
- [ ] Stop and restart all containers, then confirm data is still present:
  ```bash
  docker compose --env-file .env down
  docker compose --env-file .env up -d
  ```

### Auto-restart on reboot

- [ ] Docker is set to start on boot: `systemctl is-enabled docker` outputs `enabled`
- [ ] Test by rebooting the VPS and checking the app comes back:
  ```bash
  reboot
  # Wait 60 seconds, then reconnect and check:
  docker compose --env-file /opt/eitashot/deploy/.env -f /opt/eitashot/deploy/docker-compose.yml ps
  ```

### Administrator account

- [ ] You have registered through the app using the username set in `ADMIN_USERNAME`
- [ ] You can access the `/admin` page without a "forbidden" error
- [ ] You can approve and reject advertisements and channel verifications

### Uploads and user files

- [ ] Uploaded images (advertisement images) appear correctly after a container restart
  > Note: all files are stored in the database, not on disk. As long as the
  > `postgres_data` volume is intact, all files are safe.

### Backups

- [ ] A manual backup has been created and verified: `ls -lh /opt/backups/`
- [ ] The backup file has been downloaded to your computer
- [ ] Automated backup cron job is configured: `crontab -l` shows the backup entry

---

**Congratulations — your application is ready for production.**

If you encounter any issue not covered in the troubleshooting section,
check the container logs first:

```bash
docker compose --env-file .env logs -f
```

The logs show exactly what each service is doing and will usually
identify the problem clearly.
