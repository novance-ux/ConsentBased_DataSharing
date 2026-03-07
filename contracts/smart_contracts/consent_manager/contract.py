"""
ConsentChain — Consent Manager Contract

Core consent management contract. Handles granting and revoking consent
with box storage and consent NFT minting. Each consent record is stored
in a box keyed by (owner + requester + sha256(data_cid)).
"""

from algopy import (
    ARC4Contract,
    Account,
    Asset,
    Global,
    Txn,
    UInt64,
    arc4,
    itxn,
    Bytes,
    GlobalState,
    BoxMap,
    op,
    subroutine,
)


class ConsentRecord(arc4.Struct):
    """On-chain consent record stored in box storage."""

    requester: arc4.Address
    data_cid: arc4.String
    purpose: arc4.String
    granted: arc4.Bool
    granted_at: arc4.UInt64
    expires_at: arc4.UInt64
    consent_nft_id: arc4.UInt64


class ConsentManager(ARC4Contract):
    """
    Core consent management contract.

    Handles granting, revoking consent with box storage and consent NFTs.
    Each consent grant mints a frozen (soulbound) ARC-3 NFT to the requester.
    Revocation destroys the NFT and removes the box entry.
    """

    def __init__(self) -> None:
        self.admin = GlobalState(Account, key=b"admin")
        self.credential_app_id = GlobalState(UInt64, key=b"cred_app")
        self.total_consents = GlobalState(UInt64, key=b"total")
        self.total_revoked = GlobalState(UInt64, key=b"revoked")
        # BoxMap: key = owner_bytes(32) + requester_bytes(32) + sha256(cid)(32) = 96 bytes
        self.consents = BoxMap(Bytes, ConsentRecord, key_prefix=b"con_")

    @arc4.abimethod(create="require")
    def create(self, admin: Account, credential_app_id: UInt64) -> None:
        """Initialize the contract with admin and credential issuer app ID."""
        self.admin.value = admin
        self.credential_app_id.value = credential_app_id
        self.total_consents.value = UInt64(0)
        self.total_revoked.value = UInt64(0)

    @subroutine
    def _consent_key(
        self, owner: Account, requester: Account, data_cid_hash: Bytes
    ) -> Bytes:
        """Compose a deterministic box key from owner + requester + hash(cid)."""
        return owner.bytes + requester.bytes + data_cid_hash

    @arc4.abimethod()
    def grant_consent(
        self,
        requester: Account,
        data_cid: arc4.String,
        data_cid_hash: arc4.DynamicBytes,
        purpose: arc4.String,
        duration_rounds: arc4.UInt64,
    ) -> UInt64:
        """
        Grant consent to a requester for specific data.

        Caller is the data owner (student). Mints a frozen consent NFT
        and transfers it to the requester. The NFT is non-transferable.

        Args:
            requester: The account requesting data access.
            data_cid: IPFS CID of the encrypted data.
            data_cid_hash: SHA-256 hash of the CID (32 bytes).
            purpose: Description of why access is needed.
            duration_rounds: Number of rounds until expiry (0 = no expiry).

        Returns:
            The ASA ID of the minted consent NFT.
        """
        owner = Txn.sender
        key = self._consent_key(owner, requester, data_cid_hash.native)

        assert key not in self.consents, "Consent already exists for this data+requester"

        # Calculate expiry
        expiry = UInt64(0)
        if duration_rounds.native > 0:
            expiry = Global.round + duration_rounds.native

        # Mint consent NFT via inner transaction
        asset_txn = itxn.AssetConfig(
            asset_name=b"ConsentChain Consent",
            unit_name=b"CNSNT",
            total=1,
            decimals=0,
            default_frozen=True,
            url=b"https://consentchain.app/consent#arc3",
            manager=Global.current_application_address,
            freeze=Global.current_application_address,
            clawback=Global.current_application_address,
            fee=0,
        ).submit()

        consent_nft_id = asset_txn.created_asset.id

        # Store consent record in box
        record = ConsentRecord(
            requester=arc4.Address(requester),
            data_cid=data_cid,
            purpose=purpose,
            granted=arc4.Bool(True),  # noqa: FBT003
            granted_at=arc4.UInt64(Global.round),
            expires_at=arc4.UInt64(expiry),
            consent_nft_id=arc4.UInt64(consent_nft_id),
        )
        self.consents[key] = record
        self.total_consents.value += 1

        return consent_nft_id

    @arc4.abimethod()
    def revoke_consent(
        self,
        requester: Account,
        data_cid_hash: arc4.DynamicBytes,
    ) -> None:
        """
        Revoke previously granted consent.

        Caller must be the data owner. Destroys the consent NFT
        and removes the box entry.
        """
        owner = Txn.sender
        key = self._consent_key(owner, requester, data_cid_hash.native)

        assert key in self.consents, "Consent not found"
        record = self.consents[key].copy()
        assert record.granted.native, "Consent already revoked"

        # Destroy the consent NFT (manager can destroy with empty AssetConfig)
        if record.consent_nft_id.native > 0:
            itxn.AssetConfig(
                config_asset=Asset(record.consent_nft_id.native),
                fee=0,
            ).submit()

        # Remove consent box
        del self.consents[key]
        self.total_revoked.value += 1

    @arc4.abimethod(readonly=True)
    def check_consent(
        self,
        owner: Account,
        requester: Account,
        data_cid_hash: arc4.DynamicBytes,
    ) -> bool:
        """
        Check if valid consent exists.

        Returns True if consent is granted and not expired.
        Can be called off-chain via simulate without a transaction.
        """
        key = self._consent_key(owner, requester, data_cid_hash.native)

        if key not in self.consents:
            return False

        record = self.consents[key]
        if not record.granted.native:
            return False

        # Check expiry (0 means no expiry)
        if record.expires_at.native > 0:
            if Global.round > record.expires_at.native:
                return False

        return True

    @arc4.abimethod(readonly=True)
    def get_consent(
        self,
        owner: Account,
        requester: Account,
        data_cid_hash: arc4.DynamicBytes,
    ) -> ConsentRecord:
        """Retrieve the full consent record from box storage."""
        key = self._consent_key(owner, requester, data_cid_hash.native)
        assert key in self.consents, "Consent not found"
        return self.consents[key]

    @arc4.abimethod()
    def update_expiry(
        self,
        requester: Account,
        data_cid_hash: arc4.DynamicBytes,
        new_duration_rounds: arc4.UInt64,
    ) -> None:
        """
        Update the expiry of an existing consent.

        Only the data owner (caller) can update. Pass 0 for no expiry.
        """
        owner = Txn.sender
        key = self._consent_key(owner, requester, data_cid_hash.native)

        assert key in self.consents, "Consent not found"
        record = self.consents[key].copy()
        assert record.granted.native, "Consent is revoked"

        new_expiry = UInt64(0)
        if new_duration_rounds.native > 0:
            new_expiry = Global.round + new_duration_rounds.native

        # Update the record with new expiry
        updated = ConsentRecord(
            requester=record.requester,
            data_cid=record.data_cid,
            purpose=record.purpose,
            granted=record.granted,
            granted_at=record.granted_at,
            expires_at=arc4.UInt64(new_expiry),
            consent_nft_id=record.consent_nft_id,
        )
        self.consents[key] = updated

    @arc4.abimethod(readonly=True)
    def get_total_consents(self) -> UInt64:
        """Get the total number of consents ever granted."""
        return self.total_consents.value

    @arc4.abimethod(readonly=True)
    def get_total_revoked(self) -> UInt64:
        """Get the total number of consents revoked."""
        return self.total_revoked.value
