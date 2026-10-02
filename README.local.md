# Local Server Hosting Guide for HITOMS

This guide outlines step-by-step instructions on how to set up, deploy, and host the **Hospital IT Operations Management System (HITOMS)** on a local server within your hospital's Local Area Network (LAN). 

Since HITOMS is built as an offline-first full-stack system with a local IndexedDB state machine and background cloud synchronization, it is perfectly suited for on-premise local server hosting.

---

## Prerequisites
To host HITOMS on a local server, ensure your hosting machine meets the following requirements:
1. **Operating System**: Linux (Ubuntu, Debian, CentOS), macOS, or Windows Server.
2. **Node.js**: Installed Version 18.0.0 or higher (LTS recommended) OR **Bun Runtime** (v1.0+).
3. **Local IP Address**: The server should be assigned a **Static Local IP Address** (e.g., `192.168.1.100` or `10.0.0.5`) in your hospital router/switch configuration so clinical clients can always find it.

---

## Step 1: Copy Source Code to the Server
Transfer the HITOMS application folder to your server directory (e.g., `/var/www/hitoms` or `C:\hitoms`).

If you are using Git, you can clone it directly:
```bash
git clone <your-repository-url> /var/www/hitoms
cd /var/www/hitoms
```

---

## Step 2: Configure Environment Variables
1. Copy the template `.env.example` file to create a `.env` file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and specify any localized system parameters:
   ```env
   PORT=3000
   VITE_LOCAL_SYSTEM_NAME="HITOMS"
   # Add your optional Firebase configurations here if you wish to use cloud sync
   ```

---

## Step 3: Install Dependencies
Install all package dependencies from `package.json` using `npm` or `bun`:

**Using npm:**
```bash
npm install
```

**Using Bun:**
```bash
bun install
```

---

## Step 4: Build for Production
To optimize the client asset bundles, run the production compiler. This bundles all React assets into highly optimized static HTML, CSS, and JS files located in the `/dist` directory.

**Using npm:**
```bash
npm run build
```

**Using Bun:**
```bash
bun run build
```

---

## Step 5: Start the Full-Stack server
Start the Node.js production server, which serves both the frontend static dashboard and mounts any necessary Express proxy backend middleware routes on port `3000`.

**Using npm:**
```bash
npm start
```

**Using Bun:**
```bash
bun start
```

---

## Step 6: Keep the Server Running (Daemon Mode)
In production, you want the local server to run continuously in the background, even if the terminal is closed, and automatically restart if the hosting machine reboots.

### Option A: Using PM2 (Recommended)
1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```
2. Start the HITOMS server:
   ```bash
   pm2 start server.ts --name "hitoms-server" --interpreter ts-node
   # If running compiled JS/dist assets
   pm2 start dist/server.js --name "hitoms-server"
   ```
3. Set PM2 to launch automatically on system boot:
   ```bash
   pm2 startup
   pm2 save
   ```

### Option B: Running as a systemd Service (Linux)
Create a file `/etc/systemd/system/hitoms.service`:
```ini
[Unit]
Description=HITOMS Hospital IT Operations Management System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/hitoms
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
Activate and start the system service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable hitoms.service
sudo systemctl start hitoms.service
```

---

## Step 7: LAN Access for Hospital Devices
To access the system from other laptops, tablets, or workstation clients connected to the same hospital Wi-Fi/Ethernet network:

1. Open a web browser on any client machine.
2. Enter the server's local IP address and port `3000`:
   ```text
   http://192.168.1.100:3000
   ```
3. Users can immediately sign in, register IT assets, scan scannable QR tags, and manage clinical help desk tickets.

### SSL / HTTPS (Optional but Highly Recommended)
Since the **Live Camera QR Code Scanner** requires camera access, some mobile browsers restrict webcam permissions on non-secured (`http://`) connections unless accessed via `localhost`. To scan QR codes on wards via mobile camera, we highly recommend:
1. Setting up an Nginx reverse proxy on the hosting server.
2. Generating a local SSL certificate using a local Certificate Authority (CA) or OpenSSL.
3. Accessing the app securely via `https://192.168.1.100:3000`.
