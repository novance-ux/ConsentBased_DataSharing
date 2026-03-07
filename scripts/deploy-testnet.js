/**
 * Deploy ConsentChain smart contracts to Algorand Testnet.
 *
 * Usage:  node scripts/deploy-testnet.js
 *
 * Requires: funded testnet account mnemonic in packages/backend/.env
 */

const algosdk = require('algosdk');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────
const ALGOD_URL = 'https://testnet-api.algonode.cloud';
const MNEMONIC =
  'evoke fringe riot tomorrow girl include mesh base coach junk list pear feature expire real cage forum decline attend aspect legend bundle story absent avocado';

const algod = new algosdk.Algodv2('', ALGOD_URL, '');
const deployer = algosdk.mnemonicToSecretKey(MNEMONIC);

// ── TEAL Source Programs ────────────────────────────────────

// Minimal clear-state program (approves all)
const CLEAR_TEAL = `#pragma version 10
int 1
return`;

// ────────────────────────────────────────────────────────────
//  1. CredentialIssuer
// ────────────────────────────────────────────────────────────
const CREDENTIAL_ISSUER_TEAL = `#pragma version 10

// === Creation ===
txn ApplicationID
int 0
==
bnz on_create

// === Delete / Update — admin only ===
txn OnCompletion
int DeleteApplication
==
txn OnCompletion
int UpdateApplication
==
||
bnz on_admin_only

// === OptIn — always approve ===
txn OnCompletion
int OptIn
==
bnz on_approve

// === Must be NoOp ===
txn OnCompletion
int NoOp
==
assert

// ── ABI Method Routing ──
txna ApplicationArgs 0
method "issue_credential(account,string,account)uint64"
==
bnz m_issue

txna ApplicationArgs 0
method "has_credential(account)bool"
==
bnz m_has

txna ApplicationArgs 0
method "get_total_issued()uint64"
==
bnz m_get_total

err

// ═══════════════════════════════════════════════

on_create:
  byte "admin"
  txn Sender
  app_global_put
  byte "total"
  int 0
  app_global_put
  int 1
  return

on_admin_only:
  byte "admin"
  app_global_get
  txn Sender
  ==
  return

on_approve:
  int 1
  return

// ── issue_credential ────────────────────────
m_issue:
  // Only admin
  byte "admin"
  app_global_get
  txn Sender
  ==
  assert

  // Create ASA via inner transaction
  itxn_begin
    int acfg
    itxn_field TypeEnum
    byte "CC Credential"
    itxn_field ConfigAssetName
    byte "CRED"
    itxn_field ConfigAssetUnitName
    int 1
    itxn_field ConfigAssetTotal
    int 0
    itxn_field ConfigAssetDecimals
    global CurrentApplicationAddress
    itxn_field ConfigAssetManager
    global CurrentApplicationAddress
    itxn_field ConfigAssetClawback
    global CurrentApplicationAddress
    itxn_field ConfigAssetReserve
    int 0
    itxn_field Fee
  itxn_submit

  // Get ASA ID
  itxn CreatedAssetID
  store 0

  // Increment total
  byte "total"
  byte "total"
  app_global_get
  int 1
  +
  app_global_put

  // ABI return uint64
  byte 0x151f7c75
  load 0
  itob
  concat
  log

  int 1
  return

// ── has_credential (stub — returns true) ────
m_has:
  byte 0x151f7c75
  byte 0x80
  concat
  log
  int 1
  return

// ── get_total_issued ────────────────────────
m_get_total:
  byte 0x151f7c75
  byte "total"
  app_global_get
  itob
  concat
  log
  int 1
  return
`;

// ────────────────────────────────────────────────────────────
//  2. ConsentManager
// ────────────────────────────────────────────────────────────
const CONSENT_MANAGER_TEAL = `#pragma version 10

txn ApplicationID
int 0
==
bnz on_create

txn OnCompletion
int DeleteApplication
==
txn OnCompletion
int UpdateApplication
==
||
bnz on_admin_only

txn OnCompletion
int OptIn
==
bnz on_approve

txn OnCompletion
int NoOp
==
assert

// ── ABI routing ──
txna ApplicationArgs 0
method "grant_consent(account,string,byte[],string,uint64)uint64"
==
bnz m_grant

txna ApplicationArgs 0
method "revoke_consent(account,byte[])void"
==
bnz m_revoke

err

on_create:
  byte "admin"
  txn Sender
  app_global_put
  byte "grants"
  int 0
  app_global_put
  byte "revokes"
  int 0
  app_global_put
  int 1
  return

on_admin_only:
  byte "admin"
  app_global_get
  txn Sender
  ==
  return

on_approve:
  int 1
  return

// ── grant_consent — create consent ASA ──────
m_grant:
  byte "admin"
  app_global_get
  txn Sender
  ==
  assert

  // Create soulbound consent NFT
  itxn_begin
    int acfg
    itxn_field TypeEnum
    byte "CC Consent"
    itxn_field ConfigAssetName
    byte "CONS"
    itxn_field ConfigAssetUnitName
    int 1
    itxn_field ConfigAssetTotal
    int 0
    itxn_field ConfigAssetDecimals
    global CurrentApplicationAddress
    itxn_field ConfigAssetManager
    global CurrentApplicationAddress
    itxn_field ConfigAssetClawback
    int 0
    itxn_field Fee
  itxn_submit

  itxn CreatedAssetID
  store 0

  // Increment grants counter
  byte "grants"
  byte "grants"
  app_global_get
  int 1
  +
  app_global_put

  // ABI return uint64
  byte 0x151f7c75
  load 0
  itob
  concat
  log

  int 1
  return

// ── revoke_consent ──────────────────────────
m_revoke:
  byte "admin"
  app_global_get
  txn Sender
  ==
  assert

  // Increment revokes counter
  byte "revokes"
  byte "revokes"
  app_global_get
  int 1
  +
  app_global_put

  int 1
  return
`;

// ────────────────────────────────────────────────────────────
//  3. AccessLogger
// ────────────────────────────────────────────────────────────
const ACCESS_LOGGER_TEAL = `#pragma version 10

txn ApplicationID
int 0
==
bnz on_create

txn OnCompletion
int DeleteApplication
==
txn OnCompletion
int UpdateApplication
==
||
bnz on_admin_only

txn OnCompletion
int NoOp
==
assert

// ── ABI routing ──
txna ApplicationArgs 0
method "log_action(uint8,account,byte[8],uint64)uint64"
==
bnz m_log

txna ApplicationArgs 0
method "get_log_count()uint64"
==
bnz m_count

err

on_create:
  byte "admin"
  txn Sender
  app_global_put
  byte "count"
  int 0
  app_global_put
  int 1
  return

on_admin_only:
  byte "admin"
  app_global_get
  txn Sender
  ==
  return

// ── log_action — increment counter, return seq ──
m_log:
  byte "admin"
  app_global_get
  txn Sender
  ==
  assert

  // Current count = sequence number for this entry
  byte "count"
  app_global_get
  store 0

  // Increment counter
  byte "count"
  load 0
  int 1
  +
  app_global_put

  // ABI return uint64 (the sequence number)
  byte 0x151f7c75
  load 0
  itob
  concat
  log

  int 1
  return

// ── get_log_count ───────────────────────────
m_count:
  byte 0x151f7c75
  byte "count"
  app_global_get
  itob
  concat
  log
  int 1
  return
`;

// ── Helpers ─────────────────────────────────────────────────

async function compileTeal(source) {
  const result = await algod.compile(Buffer.from(source)).do();
  return new Uint8Array(Buffer.from(result.result, 'base64'));
}

async function deployApp(name, approvalSrc, clearSrc, globalInts, globalBytes) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Deploying ${name}...`);
  console.log('='.repeat(50));

  const approvalProg = await compileTeal(approvalSrc);
  const clearProg = await compileTeal(clearSrc);
  console.log(`  Compiled: approval=${approvalProg.length}B, clear=${clearProg.length}B`);

  const sp = await algod.getTransactionParams().do();

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: deployer.addr.toString(),
    suggestedParams: sp,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: approvalProg,
    clearProgram: clearProg,
    numGlobalInts: globalInts,
    numGlobalByteSlices: globalBytes,
    numLocalInts: 0,
    numLocalByteSlices: 0,
  });

  const signed = txn.signTxn(deployer.sk);
  const txId = txn.txID();
  await algod.sendRawTransaction(signed).do();
  console.log(`  Sent txn: ${txId}`);

  const confirmed = await algosdk.waitForConfirmation(algod, txId, 4);
  const appId = Number(confirmed.applicationIndex || confirmed['application-index']);
  const appAddr = algosdk.getApplicationAddress(appId);
  console.log(`  ✓ App ID:  ${appId}`);
  console.log(`  ✓ App Addr: ${appAddr}`);

  return { appId, appAddr, txId };
}

async function fundApp(appAddr, amount) {
  const sp = await algod.getTransactionParams().do();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: deployer.addr.toString(),
    receiver: appAddr,
    amount: amount,
    suggestedParams: sp,
  });
  const signed = txn.signTxn(deployer.sk);
  const txId = txn.txID();
  await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txId, 4);
  console.log(`  Funded app with ${amount / 1e6} ALGO (txn: ${txId})`);
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log('ConsentChain — Testnet Deployment');
  console.log('Deployer:', deployer.addr.toString());

  const info = await algod.accountInformation(deployer.addr.toString()).do();
  const balance = Number(info.amount) / 1e6;
  console.log(`Balance:  ${balance.toFixed(4)} ALGO`);

  if (balance < 3) {
    console.error('\n✗ Need at least 3 ALGO. Fund at https://bank.testnet.algorand.network/');
    process.exit(1);
  }

  // Deploy CredentialIssuer (2 global ints: total; 1 global byte: admin)
  const cred = await deployApp('CredentialIssuer', CREDENTIAL_ISSUER_TEAL, CLEAR_TEAL, 2, 1);
  await fundApp(cred.appAddr, 2_000_000); // 2 ALGO for ASA MBR overhead

  // Deploy ConsentManager (2 global ints: grants,revokes; 1 global byte: admin)
  const consent = await deployApp('ConsentManager', CONSENT_MANAGER_TEAL, CLEAR_TEAL, 3, 1);
  await fundApp(consent.appAddr, 2_000_000);

  // Deploy AccessLogger (2 global ints: count; 1 global byte: admin)
  const logger = await deployApp('AccessLogger', ACCESS_LOGGER_TEAL, CLEAR_TEAL, 2, 1);
  // Logger doesn't create ASAs, minimal funding
  await fundApp(logger.appAddr, 200_000);

  // ── Summary ──
  console.log(`\n${'='.repeat(50)}`);
  console.log('DEPLOYMENT COMPLETE');
  console.log('='.repeat(50));
  console.log();
  console.log('App IDs:');
  console.log(`  CREDENTIAL_ISSUER_APP_ID=${cred.appId}`);
  console.log(`  CONSENT_MANAGER_APP_ID=${consent.appId}`);
  console.log(`  ACCESS_LOGGER_APP_ID=${logger.appId}`);
  console.log();

  // ── Update .env file ──
  const envPath = path.join(__dirname, '..', 'packages', 'backend', '.env');
  if (fs.existsSync(envPath)) {
    let env = fs.readFileSync(envPath, 'utf-8');
    env = env.replace(/CREDENTIAL_ISSUER_APP_ID=.*/, `CREDENTIAL_ISSUER_APP_ID=${cred.appId}`);
    env = env.replace(/CONSENT_MANAGER_APP_ID=.*/, `CONSENT_MANAGER_APP_ID=${consent.appId}`);
    env = env.replace(/ACCESS_LOGGER_APP_ID=.*/, `ACCESS_LOGGER_APP_ID=${logger.appId}`);
    fs.writeFileSync(envPath, env);
    console.log('✓ Updated packages/backend/.env with App IDs');
  }

  // ── Save deployment record ──
  const record = {
    network: 'testnet',
    deployer: deployer.addr.toString(),
    timestamp: new Date().toISOString(),
    contracts: {
      CredentialIssuer: { appId: cred.appId, appAddr: cred.appAddr, txId: cred.txId },
      ConsentManager: { appId: consent.appId, appAddr: consent.appAddr, txId: consent.txId },
      AccessLogger: { appId: logger.appId, appAddr: logger.appAddr, txId: logger.txId },
    },
  };
  const recordPath = path.join(__dirname, '..', 'deployment.json');
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
  console.log(`✓ Saved deployment record to deployment.json`);

  console.log();
  console.log('Restart your backend to activate on-chain mode.');
}

main().catch((err) => {
  console.error('Deployment failed:', err.message || err);
  process.exit(1);
});
