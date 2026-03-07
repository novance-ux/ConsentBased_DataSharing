# ConsentChain — Complete Setup & Installation Guide

> **Last Updated:** March 8, 2026
> This guide covers everything needed to clone, configure, and run the entire ConsentChain project on a fresh machine — including all 3 Algorand smart contracts, backend API, frontend app, database, IPFS, wallet integration, and recent security fixes.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Required Software Installation](#2-required-software-installation)
3. [Clone the Repository](#3-clone-the-repository)
4. [Install All Dependencies](#4-install-all-dependencies)
5. [Database Setup (SQLite + Prisma)](#5-database-setup-sqlite--prisma)
6. [Backend Environment Variables (.env)](#6-backend-environment-variables-env)
7. [Smart Contracts — Deploying to Algorand Testnet](#7-smart-contracts--deploying-to-algorand-testnet)
8. [Running the Application](#8-running-the-application)
9. [Wallet Setup (Pera / Defly / Exodus)](#9-wallet-setup-pera--defly--exodus)
10. [Using the Application — Demo & Real Mode](#10-using-the-application--demo--real-mode)
11. [Pre-Deployed Contracts (Ready to Use)](#11-pre-deployed-contracts-ready-to-use)
12. [API Endpoints Reference](#12-api-endpoints-reference)
13. [Project Architecture & File Map](#13-project-architecture--file-map)
14. [Changes Made After Initial README](#14-changes-made-after-initial-readme)
15. [Troubleshooting](#15-troubleshooting)
16. [Environment Variable Reference (Complete)](#16-environment-variable-reference-complete)

---

## 1. System Requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| **Operating System** | Windows 10 / macOS 12 / Ubuntu 20.04 | Windows 11 / macOS 14 / Ubuntu 22.04 |
| **Node.js** | v18.0.0 | v20 LTS or v22 LTS |
| **npm** | v9.0.0 | v10+ (comes with Node.js) |
| **Git** | v2.30+ | Latest |
| **Python** (only for contract deployment) | 3.11+ | 3.12 |
| **RAM** | 4 GB | 8 GB |
| **Disk Space** | 500 MB | 1 GB |
| **Internet** | Required for Algorand Testnet | Required |

---

## 2. Required Software Installation

### A. Node.js & npm

Download and install from: https://nodejs.org/ (LTS version recommended)

Verify installation:
```bash
node --version    # Should show v18+ or v20+
npm --version     # Should show v9+
```

### B. Git

Download from: https://git-scm.com/

```bash
git --version     # Should show v2.30+
```

### C. Python 3.11+ (Only needed if you want to deploy your own contracts)

Download from: https://python.org/

```bash
python --version  # Should show 3.11+
pip --version     # Should come with Python
```

### D. AlgoKit CLI (Only needed for contract compilation & deployment)

```bash
pip install algokit
algokit --version
```

---

## 3. Clone the Repository

```bash
git clone https://github.com/<your-username>/ConsentBased_DataSharing.git
cd ConsentBased_DataSharing
```

---

## 4. Install All Dependencies

This is a **monorepo** using npm workspaces. One command installs everything:

```bash
npm install
```

This installs dependencies for:
- **Root** workspace config
- **packages/frontend** — React 19 + Vite + TailwindCSS + Algorand wallet SDKs
- **packages/backend** — Express.js + Prisma + algosdk + JWT

### What gets installed (key packages):

**Frontend dependencies:**
| Package | Version | Purpose |
|---|---|---|
| react | ^19.2.0 | UI framework |
| vite | ^7.3.1 | Dev server & build tool |
| tailwindcss | ^3.4.19 | CSS framework |
| algosdk | ^3.5.2 | Algorand JavaScript SDK |
| @txnlab/use-wallet-react | ^4.6.0 | Wallet integration (Pera/Defly/Exodus) |
| @perawallet/connect | ^1.5.1 | Pera Wallet SDK |
| @blockshake/defly-connect | ^1.2.1 | Defly Wallet SDK |
| buffer | ^6.0.3 | Buffer polyfill for WalletConnect |
| zustand | ^5.0.11 | State management |
| react-router-dom | ^6.30.3 | Client-side routing |
| framer-motion | ^12.35.1 | Animations |
| recharts | ^3.8.0 | Charts for admin dashboard |
| react-hot-toast | ^2.6.0 | Toast notifications |
| lucide-react | ^0.577.0 | Icons |

**Backend dependencies:**
| Package | Version | Purpose |
|---|---|---|
| express | ^4.21.0 | HTTP server |
| algosdk | ^3.5.2 | Algorand JavaScript SDK |
| @algorandfoundation/algokit-utils | ^9.2.0 | Algorand utilities |
| @prisma/client | ^5.20.0 | Database ORM |
| jose | ^5.9.0 | JWT signing & verification |
| zod | ^3.23.0 | Request validation |
| cors | ^2.8.5 | Cross-origin requests |
| helmet | ^8.0.0 | Security headers |
| morgan | ^1.10.0 | HTTP request logging |
| tsx | ^4.19.0 | TypeScript execution (dev) |

---

## 5. Database Setup (SQLite + Prisma)

The backend uses **SQLite** via **Prisma ORM**. No database server installation needed — SQLite is file-based.

```bash
cd packages/backend
npx prisma generate    # Generate Prisma client
npx prisma db push     # Create database & apply schema
```

This creates `packages/backend/prisma/dev.db` — the SQLite database file.

### Database Schema (auto-created):
- **User** — wallet address, role (STUDENT/REQUESTER/ADMIN), credentials
- **DataUpload** — encrypted file metadata, IPFS CID, AES key, IV
- **ConsentRequest** — who requested what, status, consent NFT ASA ID, expiry
- **AuditEntry** — every action logged with Algorand transaction IDs
- **AuthChallenge** — nonce challenges for wallet authentication

> **Note:** If you ever need to reset the database, delete `packages/backend/prisma/dev.db` and re-run `npx prisma db push`.

---

## 6. Backend Environment Variables (.env)

Create the file `packages/backend/.env`:

```env
# ─── Database ───────────────────────────────────────────────
DATABASE_URL="file:./dev.db"

# ─── JWT Authentication ─────────────────────────────────────
JWT_SECRET="your-secret-key-change-in-production"

# ─── Algorand Testnet Connection ─────────────────────────────
ALGORAND_ALGOD_SERVER="https://testnet-api.algonode.cloud"
ALGORAND_ALGOD_TOKEN=""
ALGORAND_INDEXER_SERVER="https://testnet-idx.algonode.cloud"

# ─── Smart Contract App IDs (Pre-deployed — use these or deploy your own) ──
CREDENTIAL_ISSUER_APP_ID=756729714
CONSENT_MANAGER_APP_ID=756729717
ACCESS_LOGGER_APP_ID=756729729

# ─── Platform Account (signs blockchain transactions on behalf of users) ──
# This must be a funded Algorand Testnet account
# Get test ALGOs at: https://bank.testnet.algorand.network/
ADMIN_WALLET_ADDRESS=53KINNQ6ORLKVBLW5DTLBCE6A2QRCZM3CB4VFYBXUUWCOUKVQHXFJNG7AY
ADMIN_WALLET_MNEMONIC="your 25-word algorand mnemonic here"

# ─── IPFS Storage (Optional) ────────────────────────────────
# Without this key, files are stored to disk in .ipfs-demo-store/ (demo mode)
# For production: get a key from https://nft.storage/
NFT_STORAGE_API_KEY=""
```

### Minimum Required Variables:
| Variable | Required? | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite file path |
| `JWT_SECRET` | Recommended | `dev-secret-change-me` | Any random string |
| `ALGORAND_ALGOD_SERVER` | No | `https://testnet-api.algonode.cloud` | Algorand node URL |
| `CREDENTIAL_ISSUER_APP_ID` | For blockchain features | — | Pre-deployed: `756729714` |
| `CONSENT_MANAGER_APP_ID` | For blockchain features | — | Pre-deployed: `756729717` |
| `ACCESS_LOGGER_APP_ID` | For blockchain features | — | Pre-deployed: `756729729` |
| `ADMIN_WALLET_MNEMONIC` | For blockchain features | — | 25-word Algorand testnet mnemonic |
| `ADMIN_WALLET_ADDRESS` | For blockchain features | — | Corresponding address |
| `NFT_STORAGE_API_KEY` | No | — | Without it, IPFS uses local disk storage |

> **Important:** Without `ADMIN_WALLET_MNEMONIC`, the app still works — but blockchain transactions will be skipped (local-only mode). All features work, but on-chain proof is not generated.

---

## 7. Smart Contracts — Deploying to Algorand Testnet

> **Skip this section** if you want to use the pre-deployed contracts (App IDs already in Section 6).

### The 3 Smart Contracts:

| Contract | Purpose | Language |
|---|---|---|
| **CredentialIssuer** | Mints student credential NFTs (ARC-19 ASAs) | Algorand Python (Puya) |
| **ConsentManager** | Creates consent NFTs on grant, destroys on revoke | Algorand Python (Puya) |
| **AccessLogger** | Immutable on-chain audit log (box storage) | Algorand Python (Puya) |

### Contract Source Code Location:
```
contracts/
├── smart_contracts/
│   ├── credential_issuer/contract.py
│   ├── consent_manager/contract.py
│   └── access_logger/contract.py
├── deploy.py
└── pyproject.toml
```

### Steps to Deploy Your Own Contracts:

#### Step 1: Create an Algorand Testnet Account
1. Install Pera Wallet on your phone (https://perawallet.app/)
2. Create a new wallet → switch to **Testnet** (Settings → Developer → Node → TestNet)
3. Copy your wallet address
4. Get free test ALGOs: https://bank.testnet.algorand.network/ (paste your address, you need ~2 ALGO)

#### Step 2: Install Python Dependencies
```bash
cd contracts
pip install -e ".[dev]"
```

This installs:
- `algorand-python` (Puya compiler)
- `algokit-utils`
- `py-algorand-sdk`
- `pytest`

#### Step 3: Set Deployer Mnemonic

**Linux/macOS:**
```bash
export ALGO_DEPLOYER_MNEMONIC="word1 word2 word3 ... word25"
```

**Windows PowerShell:**
```powershell
$env:ALGO_DEPLOYER_MNEMONIC="word1 word2 word3 ... word25"
```

**Windows CMD:**
```cmd
set ALGO_DEPLOYER_MNEMONIC=word1 word2 word3 ... word25
```

> You can find your mnemonic in Pera Wallet: Settings → Security → View Passphrase

#### Step 4: Deploy
```bash
cd contracts
python deploy.py
```

#### Step 5: Copy App IDs to Backend .env
The deploy script outputs something like:
```
CREDENTIAL_ISSUER_APP_ID=756729714
CONSENT_MANAGER_APP_ID=756729717
ACCESS_LOGGER_APP_ID=756729729
ADMIN_WALLET_ADDRESS=53KINNQ6ORLKVBLW5DTLBCE6A2QRCZM3CB4VFYBXUUWCOUKVQHXFJNG7AY
```
Copy these values into `packages/backend/.env`.

#### Step 6: Verify on Algorand Explorer
Visit these URLs to verify your deployed contracts:
- https://lora.algokit.io/testnet/application/YOUR_APP_ID

---

## 8. Running the Application

### Quick Start (Two Terminals)

**Terminal 1 — Backend (port 3001):**

**On Windows PowerShell (run this first to enable scripts):**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then:
```bash
cd packages/backend
npx prisma db push       # First time only — creates database
npx tsx watch src/index.ts
```

You should see:
```
ConsentChain API listening on port 3001
```

**Terminal 2 — Frontend (port 5173):**
```bash
cd packages/frontend
npx vite
```

You should see:
```
VITE v7.3.1  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### Or Use Root Scripts:
```bash
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

### Access Points:
| Service | URL |
|---|---|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:3001 |
| **Health Check** | http://localhost:3001/api/health |
| **Prisma Studio** (DB viewer) | Run `npx prisma studio` in packages/backend |

---

## 9. Wallet Setup (Pera / Defly / Exodus)

> **Skip this section** if you only want to use Demo Mode (works without any wallet).

### Option A: Pera Wallet (Mobile — Recommended)

1. Download **Pera Wallet** from App Store / Google Play
2. Create a new wallet
3. **Switch to Testnet**: Settings → Developer Settings → Node Settings → **TestNet**
4. Fund wallet: Go to https://bank.testnet.algorand.network/ → paste your address → receive test ALGOs
5. In the ConsentChain app, click **"Connect Wallet"** → **"Pera"** → scan QR with phone → approve
6. Pick your role (Student/Requester/Admin) → logged in!

### Option B: Defly Wallet (Mobile)

1. Download **Defly** from App Store / Google Play
2. Create/import wallet → switch to **Testnet** (Settings → Network)
3. Fund wallet: https://bank.testnet.algorand.network/
4. In the app, click **"Connect Wallet"** → **"Defly"** → scan QR → approve

### Option C: Exodus (Browser Extension)

1. Install **Exodus** browser extension from Chrome Web Store
2. Set up wallet
3. In the app, click **"Connect Wallet"** → **"Exodus"** → approve popup

### How Wallet Auth Works:
1. User connects wallet → wallet proves address ownership via WalletConnect handshake
2. Frontend requests a challenge nonce from backend (`GET /v1/auth/challenge?address=...`)
3. Nonce + address sent to `POST /v1/auth/wallet-login` → nonce verified, consumed, JWT issued
4. All subsequent API calls use the JWT token
5. Blockchain operations record the user's real wallet address

---

## 10. Using the Application — Demo & Real Mode

### Demo Mode (No Wallet Needed)

1. Open http://localhost:5173
2. Click **"Demo Login as Student"**, **"Demo Login as Requester"**, or **"Demo Login as Admin"**
3. These create test accounts with fake addresses — all features work including blockchain transactions

### Full Demo Flow:

**Step 1 — Issue Credential (Admin Panel)**
```
Login as Admin → Enter student wallet address + student ID → Click "Issue Credential"
→ CredentialIssuer contract mints a credential NFT (ASA) on Algorand
→ Transaction ID shown → click to verify on blockchain explorer
```

**Step 2 — Upload Data (Student Dashboard)**
```
Login as Student → Select file + category → Upload
→ File encrypted in browser with AES-256-GCM
→ Encrypted data stored to IPFS (or local disk in demo mode)
→ AccessLogger contract logs the upload on Algorand
```

**Step 3 — Request & Grant Consent**
```
Login as Requester → Search student uploads → Request access with reason + duration
Login as Student → See incoming request → Click "Approve"
→ ConsentManager contract mints a Consent NFT on Algorand
→ AccessLogger logs the consent grant
```

**Step 4 — Download & Revoke**
```
Login as Requester → Download the file (consent check passes)
→ AccessLogger logs the download

Login as Student → Click "Revoke" on active consent
→ ConsentManager contract DESTROYS the consent NFT
→ AccessLogger logs the revocation
→ Requester can no longer download
```

**Step 5 — Audit Trail**
```
Go to Audit Log page → See every action with blockchain transaction links
→ Click any TX link → Opens Algorand Explorer → Verify on-chain
```

---

## 11. Pre-Deployed Contracts (Ready to Use)

These contracts are already deployed on **Algorand Testnet** and can be used directly:

| Contract | App ID | Explorer Link |
|---|---|---|
| **CredentialIssuer** | `756729714` | https://lora.algokit.io/testnet/application/756729714 |
| **ConsentManager** | `756729717` | https://lora.algokit.io/testnet/application/756729717 |
| **AccessLogger** | `756729729` | https://lora.algokit.io/testnet/application/756729729 |

**Deployer Account:** `53KINNQ6ORLKVBLW5DTLBCE6A2QRCZM3CB4VFYBXUUWCOUKVQHXFJNG7AY`

**Network:** Algorand Testnet

> **To use these:** Copy the App IDs into your `packages/backend/.env` file. You still need your own funded `ADMIN_WALLET_MNEMONIC` to sign transactions.

---

## 12. API Endpoints Reference

Base URL: `http://localhost:3001/api`

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/auth/challenge?address=...` | Get a challenge nonce for wallet auth |
| POST | `/v1/auth/wallet-login` | Login with wallet (address + nonce + role) |
| POST | `/v1/auth/verify` | Login with full signature verification |
| POST | `/v1/auth/demo-login` | Demo login (role only, no wallet needed) |
| GET | `/v1/auth/me` | Get current user profile (requires JWT) |

### Data Management (requires JWT)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/v1/data/upload` | Upload encrypted file |
| GET | `/v1/data/my-uploads` | List user's uploads |
| GET | `/v1/data/download/:id` | Download file (checks consent + expiry) |

### Consent (requires JWT)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/v1/consent/request` | Request access (Requester role only) |
| GET | `/v1/consent/incoming` | Get received consent requests |
| GET | `/v1/consent/outgoing` | Get sent consent requests |
| POST | `/v1/consent/grant/:id` | Approve consent (Student only) |
| POST | `/v1/consent/revoke/:id` | Revoke consent (Student only) |

### Admin (requires JWT + ADMIN role)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/admin/stats` | Platform statistics (public) |
| POST | `/v1/admin/issue-credential` | Issue student credential NFT (Admin only) |

### Audit (requires JWT)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/audit/` | Query audit trail entries |

---

## 13. Project Architecture & File Map

```
ConsentBased_DataSharing/
│
├── package.json                    # Root monorepo (npm workspaces)
├── tsconfig.base.json              # Shared TypeScript config
├── deployment.json                 # Deployed contract App IDs
├── README.md                       # Project overview
├── SETUP.md                        # This file
├── .gitignore                      # Git ignore rules
│
├── contracts/                      # ─── ALGORAND SMART CONTRACTS ───
│   ├── pyproject.toml              # Python dependencies
│   ├── deploy.py                   # Contract deployment script
│   └── smart_contracts/
│       ├── credential_issuer/
│       │   └── contract.py         # Mints student credential NFTs
│       ├── consent_manager/
│       │   └── contract.py         # Consent NFT create/destroy
│       └── access_logger/
│           └── contract.py         # Immutable audit log
│
├── packages/
│   ├── backend/                    # ─── EXPRESS.JS API SERVER ───
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env                    # Environment config (create this!)
│   │   ├── prisma/
│   │   │   └── schema.prisma      # Database schema (SQLite)
│   │   └── src/
│   │       ├── index.ts            # Server entry point (port 3001)
│   │       ├── lib/
│   │       │   ├── jwt.ts          # JWT sign/verify (jose, HS256)
│   │       │   └── prisma.ts       # Prisma client instance
│   │       ├── middleware/
│   │       │   ├── auth.ts         # JWT auth middleware
│   │       │   └── errorHandler.ts # Global error handler
│   │       ├── routes/
│   │       │   ├── auth.ts         # Auth: challenge, verify, wallet-login, demo
│   │       │   ├── data.ts         # Upload, download (consent+expiry check)
│   │       │   ├── consent.ts      # Request, grant, revoke (role-protected)
│   │       │   ├── admin.ts        # Credential issue (ADMIN role required)
│   │       │   ├── audit.ts        # Audit trail queries
│   │       │   └── agent.ts        # AI requester analysis
│   │       ├── services/
│   │       │   ├── algorand.ts     # All Algorand client + contract calls
│   │       │   ├── ipfs.ts         # IPFS upload/download (disk fallback)
│   │       │   ├── agent.ts        # AI agent service
│   │       │   └── queue.ts        # Task queue
│   │       └── types/
│   │           └── index.ts
│   │
│   └── frontend/                   # ─── REACT SPA ───
│       ├── package.json
│       ├── vite.config.ts          # Vite config (polyfills, aliases)
│       ├── tailwind.config.ts      # Tailwind CSS config
│       ├── index.html              # Entry HTML (polyfills for wallets)
│       └── src/
│           ├── App.tsx             # Router + layout
│           ├── main.tsx            # Entry (Buffer polyfill)
│           ├── components/
│           │   ├── Layout.tsx      # Nav + header (wallet badge, testnet)
│           │   ├── WalletConnect.tsx  # Wallet connect + role picker
│           │   └── ui/             # Reusable UI components
│           ├── pages/
│           │   ├── Landing.tsx     # Home + demo login + live contracts
│           │   ├── StudentDashboard.tsx
│           │   ├── RequesterDashboard.tsx
│           │   ├── AdminPanel.tsx
│           │   └── AuditLog.tsx
│           ├── hooks/
│           │   └── useWalletAuth.ts  # Challenge-nonce wallet auth flow
│           ├── lib/
│           │   ├── algorand.ts     # Algorand client helpers
│           │   ├── api.ts          # HTTP client (axios-like)
│           │   └── crypto.ts       # AES-256-GCM encrypt/decrypt
│           ├── providers/
│           │   └── WalletProvider.tsx  # Pera/Defly/Exodus setup
│           ├── stores/
│           │   ├── authStore.ts    # Zustand auth state (persisted)
│           │   └── consentStore.ts # Consent state
│           └── types/
│               └── index.ts
```

---

## 14. Changes Made After Initial README

The following changes were made **after** the original README was created. These are already in the codebase but not documented in the README:

### 14.1 — Demo Login Buttons on Dashboard Pages
**Files changed:** `StudentDashboard.tsx`, `RequesterDashboard.tsx`, `AdminPanel.tsx`

Previously, if you navigated to a dashboard without being logged in, you saw a dead-end message "Please connect your wallet or use demo login" with no button. Now each page has inline **"Demo Login as Student/Requester/Admin"** buttons.

### 14.2 — Wallet Authentication with Challenge-Nonce Flow
**Files changed:** `packages/backend/src/routes/auth.ts`, `packages/frontend/src/hooks/useWalletAuth.ts`

- Added `POST /v1/auth/wallet-login` endpoint that requires a valid, unexpired challenge nonce
- Frontend hook `useWalletAuth.ts` fetches a challenge nonce from `GET /v1/auth/challenge` before calling wallet-login
- Nonces are single-use (consumed after login) and expire in 5 minutes
- This prevents anyone from impersonating a wallet address by simply sending an address in the API

### 14.3 — Browser Polyfills for Wallet SDKs
**Files changed:** `packages/frontend/index.html`, `packages/frontend/src/main.tsx`, `packages/frontend/vite.config.ts`

Pera and Defly wallets use WalletConnect internally, which depends on Node.js globals (`global`, `Buffer`, `process`). These were added:
- `index.html`: Inline script setting `globalThis.global = globalThis` and `globalThis.process = { env: {} }`
- `main.tsx`: `import { Buffer } from 'buffer'` + `window.Buffer = Buffer`
- `vite.config.ts`: `define: { 'global': 'globalThis' }` and `optimizeDeps.include` for wallet packages
- Installed `buffer` package: `npm install buffer`

### 14.4 — Testnet Badge + Live Smart Contracts Section
**Files changed:** `packages/frontend/src/components/Layout.tsx`, `packages/frontend/src/pages/Landing.tsx`

- Header shows a **"Testnet"** badge in green next to the logo
- Landing page has a **"Live Smart Contracts"** section with 3 clickable cards showing App IDs linking to Algorand Explorer

### 14.5 — Wallet Address Display
**Files changed:** `packages/frontend/src/components/Layout.tsx`

- Header shows the connected wallet address (truncated) in a green badge
- Shows "(wallet)" tag for wallet-authenticated users, "(demo)" for demo users

### 14.6 — Consent Expiry Enforcement on Download
**Files changed:** `packages/backend/src/routes/data.ts`

The download route now checks `requestedExpiry` when validating consent:
- Consent with no expiry → always valid
- Consent with expiry → only valid if `expiry > now`
- Expired consent returns `403 "No valid consent or consent has expired"`

### 14.7 — Role-Based Route Protection
**Files changed:** `packages/backend/src/routes/admin.ts`, `packages/backend/src/routes/consent.ts`

- `POST /v1/admin/issue-credential` now requires `role === 'ADMIN'` (returns 403 otherwise)
- `POST /v1/consent/request` now requires `role === 'REQUESTER'` (returns 403 otherwise)
- Consent grant/revoke already checked `studentId === userId` (ownership check)

### 14.8 — IPFS Disk-Based Demo Storage
**Files changed:** `packages/backend/src/services/ipfs.ts`

Previously, without an NFT.storage API key, files were stored in an in-memory `Map()` — lost on server restart. Now they are stored to disk:
- Files saved in `.ipfs-demo-store/` directory in the project root
- Persists across server restarts
- Falls back to real IPFS when `NFT_STORAGE_API_KEY` is configured

### 14.9 — Exodus Wallet Restored
**Files changed:** `packages/frontend/src/providers/WalletProvider.tsx`

Exodus was temporarily removed during debugging. It's been restored and works as a browser extension (no QR code — it works like MetaMask).

---

## 15. Troubleshooting

### "Running scripts is disabled on this system" (Windows PowerShell)
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
Run this in every new PowerShell terminal before using npm/npx commands.

### Port already in use (EADDRINUSE)
```bash
# Find what's using port 3001 or 5173
# Windows:
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# macOS/Linux:
lsof -i :3001
kill -9 <PID>
```

### Prisma "database does not exist"
```bash
cd packages/backend
npx prisma db push
```

### Wallet QR code appears but can't connect
- Make sure your wallet app is on **TestNet** (not MainNet)
- Make sure your phone and computer are on the **same WiFi network** (WalletConnect requires this)
- Try "Connect with Pera Web" option instead (no phone needed)

### "Cannot find module" errors
```bash
# From root directory
npm install
cd packages/backend
npx prisma generate
```

### Blockchain transactions failing
1. Check that `ADMIN_WALLET_MNEMONIC` is set in `.env`
2. Check that the wallet has test ALGOs (at least 2 ALGO)
3. Check that App IDs in `.env` match deployed contracts
4. Visit https://bank.testnet.algorand.network/ to fund the account

### Frontend wallet buttons not working
This was fixed (Section 14.3 above). If you still see issues:
1. Clear browser cache / hard refresh (Ctrl+Shift+R)
2. Check browser console for errors
3. Ensure `buffer` package is installed: `npm install buffer`

### IPFS files disappearing after restart
If not using an NFT.storage API key, files are stored in `.ipfs-demo-store/`. This directory is NOT gitignored, so files persist. If you see the old in-memory behavior, pull the latest code.

---

## 16. Environment Variable Reference (Complete)

| Variable | Where | Required | Default | Description |
|---|---|---|---|---|
| `DATABASE_URL` | Backend .env | Yes | `file:./dev.db` | SQLite database file path |
| `JWT_SECRET` | Backend .env | Recommended | `dev-secret-change-me` | Secret for JWT token signing |
| `JWT_EXPIRY` | Backend .env | No | `24h` | JWT token expiration time |
| `PORT` | Backend .env | No | `3001` | Backend API port |
| `ALGORAND_ALGOD_SERVER` | Backend .env | No | `https://testnet-api.algonode.cloud` | Algorand node URL |
| `ALGORAND_ALGOD_TOKEN` | Backend .env | No | `` (empty) | Algorand node API token |
| `ALGORAND_ALGOD_PORT` | Backend .env | No | `` (empty) | Algorand node port |
| `ALGORAND_INDEXER_SERVER` | Backend .env | No | `https://testnet-idx.algonode.cloud` | Algorand indexer URL |
| `ALGORAND_INDEXER_PORT` | Backend .env | No | `` (empty) | Algorand indexer port |
| `CREDENTIAL_ISSUER_APP_ID` | Backend .env | For blockchain | — | Deployed CredentialIssuer contract App ID |
| `CONSENT_MANAGER_APP_ID` | Backend .env | For blockchain | — | Deployed ConsentManager contract App ID |
| `ACCESS_LOGGER_APP_ID` | Backend .env | For blockchain | — | Deployed AccessLogger contract App ID |
| `ADMIN_WALLET_ADDRESS` | Backend .env | For blockchain | — | Platform account Algorand address |
| `ADMIN_WALLET_MNEMONIC` | Backend .env | For blockchain | — | Platform account 25-word mnemonic |
| `NFT_STORAGE_API_KEY` | Backend .env | No | — | IPFS API key (without it, uses local disk) |
| `ALGO_DEPLOYER_MNEMONIC` | Shell env | Contract deploy only | — | Deployer mnemonic for deploy.py |

---

## Quick Command Reference

```bash
# ─── Initial Setup ──────────────────────────────
git clone https://github.com/<your-username>/ConsentBased_DataSharing.git
cd ConsentBased_DataSharing
npm install
cd packages/backend
npx prisma generate
npx prisma db push
# Create packages/backend/.env (see Section 6)

# ─── Run Backend (Terminal 1) ────────────────────
cd packages/backend
npx tsx watch src/index.ts

# ─── Run Frontend (Terminal 2) ───────────────────
cd packages/frontend
npx vite

# ─── Open in Browser ────────────────────────────
# http://localhost:5173

# ─── Deploy Contracts (Optional) ─────────────────
cd contracts
pip install -e ".[dev]"
export ALGO_DEPLOYER_MNEMONIC="your 25-word mnemonic"   # Linux/macOS
$env:ALGO_DEPLOYER_MNEMONIC="your 25-word mnemonic"     # Windows PowerShell
python deploy.py

# ─── Database Management ─────────────────────────
cd packages/backend
npx prisma studio          # Visual database browser
npx prisma db push         # Apply schema changes
npx prisma generate        # Regenerate client

# ─── Build for Production ────────────────────────
npm run build              # Builds both frontend + backend

# ─── Windows PowerShell Fix ──────────────────────
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
