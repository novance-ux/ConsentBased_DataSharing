"""
Deploy all ConsentChain contracts to Algorand testnet.

Usage:
    cd contracts
    pip install -e ".[dev]"
    export ALGO_DEPLOYER_MNEMONIC="your 25-word mnemonic here"
    python deploy.py

Requirements:
  - AlgoKit CLI installed (https://developer.algorand.org/docs/get-details/algokit/)
  - Python packages: algokit-utils, py-algorand-sdk
  - A funded Algorand testnet account (https://bank.testnet.algorand.network/)
  - ALGO_DEPLOYER_MNEMONIC environment variable set
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from algosdk import mnemonic, account
from algosdk.v2client.algod import AlgodClient
from algosdk.transaction import (
    ApplicationCreateTxn,
    OnComplete,
    StateSchema,
    wait_for_confirmation,
)


ALGOD_ADDRESS = os.environ.get("ALGORAND_ALGOD_SERVER", "https://testnet-api.algonode.cloud")
ALGOD_TOKEN = os.environ.get("ALGORAND_ALGOD_TOKEN", "")

# Contract definitions: (name, source_path, global_ints, global_bytes, local_ints, local_bytes)
CONTRACTS = [
    ("CredentialIssuer", "smart_contracts/credential_issuer/contract.py", 1, 1, 0, 0),
    ("ConsentManager",   "smart_contracts/consent_manager/contract.py",   2, 1, 0, 0),
    ("AccessLogger",     "smart_contracts/access_logger/contract.py",     2, 1, 0, 0),
]


def get_algod() -> AlgodClient:
    return AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)


def compile_contract(source_path: str) -> tuple[bytes, bytes]:
    """Compile a Puya contract using AlgoKit CLI and return (approval, clear) programs."""
    source = Path(source_path)
    if not source.exists():
        raise FileNotFoundError(f"Contract source not found: {source_path}")

    # Use algokit compile to produce TEAL then compile to bytecode
    build_dir = Path("build") / source.stem
    build_dir.mkdir(parents=True, exist_ok=True)

    print(f"  Compiling {source_path} with AlgoKit...")
    result = subprocess.run(
        ["algokit", "compile", "py", str(source), "--out-dir", str(build_dir)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"  AlgoKit compile stderr: {result.stderr}")
        raise RuntimeError(f"AlgoKit compile failed for {source_path}")

    # Find the generated .teal files
    approval_teal = None
    clear_teal = None
    for f in build_dir.iterdir():
        if f.suffix == ".teal":
            if "approval" in f.name.lower() or "contract" in f.name.lower():
                approval_teal = f
            elif "clear" in f.name.lower():
                clear_teal = f

    # If we only got one file, look for the standard naming convention
    if not approval_teal:
        teal_files = list(build_dir.glob("*.teal"))
        if len(teal_files) >= 2:
            approval_teal = teal_files[0]
            clear_teal = teal_files[1]
        elif len(teal_files) == 1:
            approval_teal = teal_files[0]

    if not approval_teal:
        raise FileNotFoundError(f"No approval TEAL found in {build_dir}")

    # Compile TEAL to bytecode via algod
    client = get_algod()
    approval_bytes = client.compile(approval_teal.read_text())
    approval_prog = bytes.fromhex(approval_bytes["result"]) if "result" in approval_bytes else b""

    if clear_teal and clear_teal.exists():
        clear_bytes = client.compile(clear_teal.read_text())
        clear_prog = bytes.fromhex(clear_bytes["result"]) if "result" in clear_bytes else b""
    else:
        # Minimal clear state program
        clear_prog_teal = "#pragma version 10\nint 1\nreturn"
        clear_bytes = client.compile(clear_prog_teal)
        clear_prog = bytes.fromhex(clear_bytes["result"]) if "result" in clear_bytes else b""

    return approval_prog, clear_prog


def deploy_contract(
    name: str,
    source_path: str,
    global_ints: int,
    global_bytes: int,
    local_ints: int,
    local_bytes: int,
    deployer_sk: str,
    deployer_addr: str,
) -> int:
    """Deploy a single contract and return its app ID."""
    print(f"\n{'='*50}")
    print(f"Deploying {name}")
    print(f"{'='*50}")

    approval_prog, clear_prog = compile_contract(source_path)

    client = get_algod()
    sp = client.suggested_params()

    txn = ApplicationCreateTxn(
        sender=deployer_addr,
        sp=sp,
        on_complete=OnComplete.NoOpOC,
        approval_program=approval_prog,
        clear_program=clear_prog,
        global_schema=StateSchema(global_ints, global_bytes),
        local_schema=StateSchema(local_ints, local_bytes),
    )

    signed = txn.sign(deployer_sk)
    tx_id = client.send_transaction(signed)
    print(f"  Sent txn: {tx_id}")

    confirmed = wait_for_confirmation(client, tx_id, 4)
    app_id = confirmed.get("application-index", 0)
    print(f"  ✓ {name} deployed — App ID: {app_id}")
    return app_id


def main() -> None:
    deployer_mnemonic = os.environ.get("ALGO_DEPLOYER_MNEMONIC")
    if not deployer_mnemonic:
        print("Error: ALGO_DEPLOYER_MNEMONIC environment variable not set.")
        print("  export ALGO_DEPLOYER_MNEMONIC='your 25-word mnemonic here'")
        print()
        print("Get testnet ALGOs from: https://bank.testnet.algorand.network/")
        sys.exit(1)

    deployer_sk = mnemonic.to_private_key(deployer_mnemonic)
    deployer_addr = account.address_from_private_key(deployer_sk)

    client = get_algod()
    info = client.account_info(deployer_addr)
    balance_algo = info.get("amount", 0) / 1_000_000
    print(f"Deployer: {deployer_addr}")
    print(f"Balance:  {balance_algo:.4f} ALGO")

    if balance_algo < 2.0:
        print("\n⚠ Low balance. You need ~2 ALGO to deploy all contracts + box storage.")
        print("  Get testnet ALGOs: https://bank.testnet.algorand.network/")
        sys.exit(1)

    app_ids: dict[str, int] = {}
    for name, source, gi, gb, li, lb in CONTRACTS:
        app_id = deploy_contract(name, source, gi, gb, li, lb, deployer_sk, deployer_addr)
        app_ids[name] = app_id

    # Output the env variables
    env_map = {
        "CredentialIssuer": "CREDENTIAL_ISSUER_APP_ID",
        "ConsentManager": "CONSENT_MANAGER_APP_ID",
        "AccessLogger": "ACCESS_LOGGER_APP_ID",
    }

    print(f"\n{'='*50}")
    print("DEPLOYMENT COMPLETE")
    print(f"{'='*50}")
    print()
    print("Add these to your packages/backend/.env file:")
    print()
    for name, env_key in env_map.items():
        print(f"  {env_key}={app_ids.get(name, 'FAILED')}")
    print(f"  ADMIN_WALLET_ADDRESS={deployer_addr}")
    print(f"  ADMIN_WALLET_MNEMONIC={deployer_mnemonic}")
    print()

    # Also write a deployment record
    deploy_record = {
        "network": "testnet",
        "deployer": deployer_addr,
        "contracts": {name: {"app_id": aid} for name, aid in app_ids.items()},
    }
    record_path = Path("deployment.json")
    record_path.write_text(json.dumps(deploy_record, indent=2))
    print(f"Deployment record saved to {record_path}")


if __name__ == "__main__":
    main()
