# ConsentChain — Decentralized Consent-Based Data Sharing Platform

A full-stack decentralized platform built on **Algorand** that gives students full ownership over their personal data. Recruiters, researchers, and other third parties must request **explicit on-chain consent** before accessing any data. Every consent grant, revocation, and data access event is recorded immutably on the Algorand blockchain.

Built for the **Algorand Bounty — Project 14: Consent-Based Data Sharing Platform**.

---

## Table of Contents

- [What Does This Project Do?](#what-does-this-project-do)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Running the Application](#running-the-application)
- [How It Works — User Flow](#how-it-works--user-flow)
- [Smart Contracts](#smart-contracts)
- [API Endpoints](#api-endpoints)
- [Demo Mode](#demo-mode)
- [Screenshots](#screenshots)
- [DPDP Act Compliance](#dpdp-act-compliance)
- [Learning Outcomes](#learning-outcomes)

---

## What Does This Project Do?

ConsentChain solves the problem of **unauthorized data sharing** in educational institutions. Today, student data (academic records, resumes, contact info) is often shared with recruiters and researchers without explicit student consent.

### The Problem
- Students have no control over who accesses their personal data
- There is no transparent audit trail of who accessed what and when
- Consent is often implied, not explicit — violating DPDP Act principles

### The Solution
ConsentChain provides:

1. **Student Data Vault** — Students upload their data (academic records, resumes, portfolios, contact info, certifications) encrypted with AES-256-GCM. Only the encrypted ciphertext is stored on IPFS; no plaintext ever reaches the server.

2. **Consent Request System** — Third parties (recruiters, researchers) must submit a formal access request stating *what* data they want, *why* they need it, and *how long* they need access. Students see every request and can approve or decline.

3. **On-Chain Consent NFTs** — When a student approves a request, the Algorand smart contract mints a **soulbound consent NFT** (ARC-3 compliant) to the requester. This NFT serves as a verifiable, tamper-proof proof of consent.

4. **Revocation** — Students can revoke consent at any time. Revocation **destroys** the consent NFT on-chain and immediately cuts off access. No grace periods, no delays.

5. **Immutable Audit Trail** — Every action (upload, download, consent grant, consent revoke, credential issuance) is logged in an append-only audit log stored in Algorand box storage. Anyone can verify the history.

6. **Credential Gating** — An admin (university/college) issues **credential NFTs** (ARC-19 compliant) to verified students. Only credentialed students can use the platform, preventing unauthorized accounts.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  Landing Page │ Student Dashboard │ Requester │ Admin │ Audit│
│  Zustand Store │ TanStack Query │ Framer Motion │ Tailwind  │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API (JSON)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express.js)                       │
│  Auth │ Data Upload/Download │ Consent │ Admin │ Audit Routes│
│  Prisma ORM │ JWT (jose) │ Zod Validation │ AES Encryption  │
└──────┬──────────────┬───────────────────┬───────────────────┘
       │              │                   │
       ▼              ▼                   ▼
┌────────────┐ ┌─────────────┐  ┌──────────────────────────┐
│  SQLite DB │ │   IPFS      │  │  Algorand Testnet        │
│  (Prisma)  │ │ (NFT.storage│  │  ┌────────────────────┐  │
│            │ │  or local)  │  │  │ ConsentManager     │  │
│  Users     │ │             │  │  │ CredentialIssuer   │  │
│  Uploads   │ │  Encrypted  │  │  │ AccessLogger       │  │
│  Consents  │ │  Files      │  │  └────────────────────┘  │
│  Audit Log │ │             │  │  Box Storage + NFTs      │
└────────────┘ └─────────────┘  └──────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.2 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7.3 | Build tool & dev server |
| TailwindCSS | 3.4 | Styling |
| Framer Motion | 12.35 | Animations |
| TanStack Query | 5.90 | Server state management |
| Zustand | 5.0 | Client state management |
| algosdk | 3.5.2 | Algorand SDK |
| @txnlab/use-wallet-react | 4.6 | Algorand wallet integration (Pera, Defly, Exodus) |
| react-router-dom | 6.30 | Routing |
| react-hot-toast | 2.6 | Toast notifications |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Express.js | 4.21 | HTTP server |
| TypeScript | 5.6 | Type safety |
| Prisma | 5.20 | ORM (SQLite) |
| jose | 5.9 | JWT authentication |
| Zod | 3.23 | Request validation |
| algosdk | 3.5.2 | Algorand SDK |
| @algorandfoundation/algokit-utils | 9.2 | Algorand utilities |
| Helmet | 8.0 | Security headers |

### Smart Contracts
| Technology | Purpose |
|---|---|
| Algorand Python (Puya) | Smart contract language |
| ARC4Contract | ABI-compliant contract base |
| Box Storage | On-chain data storage |
| Inner Transactions | NFT minting/destruction |

### Infrastructure
| Component | Purpose |
|---|---|
| SQLite | Local database (via Prisma) |
| IPFS (NFT.storage) | Encrypted file storage |
| Algorand Testnet | Blockchain layer |

---

## Prerequisites

Before running, ensure you have the following installed:

### Required
- **Node.js** v18+ (LTS recommended) — [Download](https://nodejs.org/)
- **npm** v9+ (comes with Node.js)
- **Git** — [Download](https://git-scm.com/)

### Optional (for smart contract development)
- **Python** 3.11+ — [Download](https://python.org/)
- **AlgoKit CLI** — `pip install algokit`
- **Algorand Sandbox** or **LocalNet** (for local testing)

### Optional (for production IPFS)
- **NFT.storage API Key** — [Get one free](https://nft.storage/) (without this, files are stored in-memory for demo purposes)

### Algorand Wallet (for production use)
- **Pera Wallet** — [perawallet.app](https://perawallet.app/)
- **Defly Wallet** — [defly.app](https://defly.app/)
- **Exodus Wallet** — [exodus.com](https://www.exodus.com/)

> **Note:** The application includes a **Demo Mode** that bypasses wallet requirements, so you can demonstrate the full flow without installing any wallet.

---

## Project Structure

```
ConsentBased_DataSharing/
├── package.json                    # Root workspace config
├── tsconfig.base.json              # Shared TypeScript config
├── README.md                       # This file
│
├── contracts/                      # Algorand Smart Contracts
│   ├── pyproject.toml              # Python dependencies
│   ├── deploy.py                   # Deployment script
│   └── smart_contracts/
│       ├── consent_manager/        # Consent grant/revoke + NFT minting
│       │   └── contract.py
│       ├── credential_issuer/      # Student credential NFT issuance
│       │   └── contract.py
│       └── access_logger/          # Immutable on-chain audit log
│           └── contract.py
│
├── packages/
│   ├── backend/                    # Express.js API Server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma      # Database schema (SQLite)
│   │   └── src/
│   │       ├── index.ts            # Server entry point
│   │       ├── lib/
│   │       │   ├── jwt.ts          # JWT signing/verification
│   │       │   └── prisma.ts       # Database client
│   │       ├── middleware/
│   │       │   ├── auth.ts         # JWT auth middleware
│   │       │   └── errorHandler.ts # Global error handler
│   │       ├── routes/
│   │       │   ├── auth.ts         # Authentication (wallet + demo)
│   │       │   ├── data.ts         # Data upload/download
│   │       │   ├── consent.ts      # Consent request/grant/revoke
│   │       │   ├── admin.ts        # Credential issuance + stats
│   │       │   ├── audit.ts        # Audit trail queries
│   │       │   └── agent.ts        # AI requester analysis
│   │       ├── services/
│   │       │   ├── algorand.ts     # Algorand client setup
│   │       │   ├── ipfs.ts         # IPFS upload/download
│   │       │   ├── agent.ts        # AI agent service
│   │       │   └── queue.ts        # Task queue
│   │       └── types/
│   │           └── index.ts        # Shared TypeScript types
│   │
│   └── frontend/                   # React SPA
│       ├── package.json
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── index.html
│       └── src/
│           ├── App.tsx             # Root component + router
│           ├── main.tsx            # Entry point
│           ├── components/
│           │   ├── Layout.tsx      # App shell + navigation
│           │   └── WalletConnect.tsx
│           ├── pages/
│           │   ├── Landing.tsx     # Home page with demo login
│           │   ├── StudentDashboard.tsx    # Student data & consent mgmt
│           │   ├── RequesterDashboard.tsx  # Request access & download
│           │   ├── AdminPanel.tsx          # Credential issuance + stats
│           │   └── AuditLog.tsx            # Public audit trail search
│           ├── lib/
│           │   ├── algorand.ts     # Algorand client helpers
│           │   ├── api.ts          # HTTP client
│           │   └── crypto.ts       # AES-256-GCM encryption
│           ├── stores/
│           │   ├── authStore.ts    # Auth state (Zustand + persist)
│           │   └── consentStore.ts # Consent state
│           ├── providers/
│           │   └── WalletProvider.tsx  # Algorand wallet provider
│           └── types/
│               └── index.ts        # Shared types
```

---

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/ConsentBased_DataSharing.git
cd ConsentBased_DataSharing
```

### 2. Install Dependencies

```bash
npm install
```

This installs dependencies for both `packages/frontend` and `packages/backend` via npm workspaces.

### 3. Set Up the Database

```bash
cd packages/backend
npx prisma db push
```

This creates the SQLite database file (`dev.db`) and applies the schema.

### 4. Environment Variables (Optional)

Create `packages/backend/.env`:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key-change-in-production"
NFT_STORAGE_API_KEY=""
ALGORAND_TOKEN=""
ALGORAND_SERVER="https://testnet-api.4160.nodely.dev"
ALGORAND_INDEXER_SERVER="https://testnet-idx.4160.nodely.dev"
```

> **Note:** All environment variables have sensible defaults. The app runs without any `.env` file in demo mode.

### 5. (Optional) Smart Contract Setup

If you want to work with the Algorand smart contracts:

```bash
cd contracts
pip install -e ".[dev]"
```

---

## Running the Application

### Start Both Servers

Open **two terminals**:

**Terminal 1 — Backend (port 3001):**
```bash
cd packages/backend
npx prisma db push       # First time only
npx tsx watch src/index.ts
```

**Terminal 2 — Frontend (port 5173):**
```bash
cd packages/frontend
npx vite
```

### Or From the Root:

```bash
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

### Access the App

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Health Check:** http://localhost:3001/api/health

> **Windows Users:** If you encounter an ExecutionPolicy error, run this first in PowerShell:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

---

## How It Works — User Flow

### Step 1: Admin Issues Credential
1. Login as **Admin** (demo mode or wallet)
2. Go to **Admin Panel**
3. Enter a student's wallet address and student ID
4. Click **Issue Credential** — this mints a credential NFT on Algorand

### Step 2: Student Uploads Data
1. Login as **Student**
2. Go to **Student Dashboard** → **My Data** tab
3. Select a category (Academic Records, Resume, Portfolio, etc.)
4. Upload a file — it is **encrypted client-side** with AES-256-GCM before leaving the browser
5. The encrypted file is stored on IPFS, the encryption key is stored in the database

### Step 3: Requester Requests Access
1. Login as **Requester** (e.g., "TechCorp Recruiter")
2. Go to **Requester Dashboard** → **Request Access** tab
3. Search for the student by wallet address
4. Select which data category to access
5. Write a reason (minimum 10 characters) and choose an access duration
6. Click **Submit Access Request**

### Step 4: Student Reviews & Approves
1. Login as **Student**
2. Go to **Student Dashboard** → **Consent Requests** tab
3. See the pending request with requester name, organization, reason, and expiry
4. Click **Approve** or **Decline**
5. On approval, a **consent NFT** is minted on-chain

### Step 5: Requester Downloads Data
1. Login as **Requester**
2. Go to **My Requests** tab
3. See the approved request with a **Download Data** button
4. Click to download — the encrypted file is fetched from IPFS, decrypted in-browser, and downloaded

### Step 6: Student Revokes Access (Optional)
1. Login as **Student**
2. Go to **Active Consents** tab
3. Click **Revoke** on any active consent
4. The consent NFT is **destroyed on-chain** and the requester loses access immediately

### Step 7: Audit Trail
1. Go to **Audit Log** (accessible by anyone)
2. Search by wallet address
3. See every action: uploads, downloads, consent grants, revocations, credential issuances
4. Each entry links to the Algorand blockchain explorer

---

## Smart Contracts

### 1. ConsentManager (`consent_manager/contract.py`)

**Purpose:** Manages consent grants and revocations on-chain.

| Method | Description |
|---|---|
| `grant_consent()` | Mints a soulbound consent NFT (ARC-3), stores consent record in box storage |
| `revoke_consent()` | Destroys the consent NFT via inner transaction, deletes box entry |
| `check_consent()` | Read-only — verifies if valid consent exists (checks expiry) |
| `update_expiry()` | Updates consent duration without re-issuing NFT |

**Box Storage Key:** `consent_ + SHA256(owner_address + requester_address + data_cid)`

### 2. CredentialIssuer (`credential_issuer/contract.py`)

**Purpose:** Issues and revokes student credential NFTs.

| Method | Description |
|---|---|
| `issue_credential()` | Mints an ARC-19 credential NFT and transfers to the student |
| `revoke_credential()` | Claws back and destroys the credential NFT |
| `check_credential()` | Read-only — checks if a student holds a valid credential |

### 3. AccessLogger (`access_logger/contract.py`)

**Purpose:** Append-only audit log on Algorand.

| Method | Description |
|---|---|
| `log_action()` | Appends an immutable log entry to box storage |
| `get_log_entry()` | Retrieves a specific log entry by sequence number |
| `get_log_count()` | Returns total number of log entries |

**Action Codes:** 0=upload, 1=consent_grant, 2=consent_revoke, 3=download, 4=credential_issue, 5=credential_revoke

---

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/auth/challenge?address=` | No | Get a nonce for wallet signature |
| POST | `/api/v1/auth/verify` | No | Verify wallet signature, get JWT |
| POST | `/api/v1/auth/demo-login` | No | Demo login (bypasses wallet) |
| GET | `/api/v1/auth/me` | Yes | Get current user profile |

### Data Management
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/data/upload` | Yes | Upload encrypted data |
| GET | `/api/v1/data/my-uploads` | Yes | List user's uploads |
| GET | `/api/v1/data/download/:id` | Yes | Download (requires consent) |

### Consent
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/consent/request` | Yes | Submit access request |
| GET | `/api/v1/consent/incoming` | Yes | Requests received (student) |
| GET | `/api/v1/consent/outgoing` | Yes | Requests sent (requester) |
| POST | `/api/v1/consent/grant/:id` | Yes | Approve a request |
| POST | `/api/v1/consent/revoke/:id` | Yes | Revoke consent |
| GET | `/api/v1/consent/active` | Yes | Active consents (student) |
| GET | `/api/v1/consent/search-student?address=` | Yes | Find student uploads |

### Admin
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/admin/stats` | No | Platform statistics |
| POST | `/api/v1/admin/issue-credential` | Yes | Issue credential NFT |

### Audit
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/audit/by-address/:address` | No | Audit trail for address |

---

## Demo Mode

The application includes a full **Demo Mode** for easy testing without Algorand wallets:

1. Open http://localhost:5173
2. Click one of the three demo login buttons:
   - **Login as Student** — "Alice (Student)" with pre-issued credential
   - **Login as Requester** — "TechCorp Recruiter" from TechCorp Inc.
   - **Login as Admin** — "College Admin" from Demo University

Demo mode:
- Bypasses wallet signature authentication
- Uses pre-assigned demo wallet addresses
- IPFS stores files in-memory (no external API needed)
- All features are fully functional

### Demo Wallet Addresses
| Role | Address |
|---|---|
| Student | `DEMO_STUDENT_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` |
| Requester | `DEMO_REQUESTER_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` |
| Admin | `DEMO_ADMIN_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` |

---

## DPDP Act Compliance

This project demonstrates compliance with the **Digital Personal Data Protection (DPDP) Act** principles:

| DPDP Principle | Implementation |
|---|---|
| **Explicit Consent** | Every data access requires student approval via Approve/Decline UI |
| **Purpose Limitation** | Requesters must state reason for access (10-500 chars) |
| **Time Limitation** | Access has configurable expiry (7-365 days) |
| **Right to Revocation** | One-click revoke destroys consent NFT on-chain |
| **Data Minimization** | Only encrypted data stored; no plaintext on servers |
| **Transparency** | Full audit trail searchable by anyone |
| **Accountability** | All actions recorded immutably on Algorand blockchain |

---

## Learning Outcomes

By building/studying this project, you will understand:

1. **Data Privacy & Consent Management** — How to implement granular, explicit consent flows
2. **DPDP Act Compliance** — Practical implementation of regulatory principles
3. **Blockchain for Trust** — Using Algorand for immutable audit trails and NFT-based consent proofs
4. **Client-Side Encryption** — AES-256-GCM encryption so the server never sees plaintext
5. **Smart Contract Development** — Writing Algorand Python (Puya) contracts with box storage and inner transactions
6. **Full-Stack Architecture** — React + Express + Prisma + IPFS monorepo setup
7. **NFT Standards** — ARC-3 (consent NFTs) and ARC-19 (credential NFTs) on Algorand

---

## License

This project was built for the Algorand Bounty Program — Project 14: Consent-Based Data Sharing Platform.
