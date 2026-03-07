"""
ConsentChain — Credential Issuer Contract

Issues and revokes student credential NFTs (ARC-19 compliant).
The admin (college) can mint unique credential tokens for verified students.
These credentials gate access to the ConsentChain platform.
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
    GlobalState,
    BoxMap,
)


class CredentialIssuer(ARC4Contract):
    """Issues and revokes student credential NFTs (ARC-19 compliant)."""

    def __init__(self) -> None:
        # Admin who can issue/revoke credentials
        self.admin = GlobalState(Account, key=b"admin")
        # Track total credentials issued
        self.total_issued = GlobalState(UInt64, key=b"total")
        # Map student address -> credential ASA ID
        self.credentials = BoxMap(Account, UInt64, key_prefix=b"cred_")

    @arc4.abimethod(create="require")
    def create(self, admin: Account) -> None:
        """Initialize the contract with the admin address."""
        self.admin.value = admin
        self.total_issued.value = UInt64(0)

    @arc4.abimethod()
    def issue_credential(
        self,
        student: Account,
        metadata_url: arc4.String,
        reserve_address: Account,
    ) -> UInt64:
        """
        Mint a credential NFT for the student.

        The reserve_address encodes the IPFS CID per ARC-19 standard.
        The metadata_url should be 'template-ipfs://{ipfscid:1:raw:reserve:sha2-256}'.
        Student must opt-in to receive the ASA before this call.

        Returns the ASA ID of the newly minted credential.
        """
        assert Txn.sender == self.admin.value, "Only admin can issue credentials"
        assert student not in self.credentials, "Student already has a credential"

        # Mint ARC-19 NFT via inner transaction
        asset_txn = itxn.AssetConfig(
            asset_name=b"ConsentChain Credential",
            unit_name=b"CRED",
            total=1,
            decimals=0,
            default_frozen=False,
            url=metadata_url.native.bytes,
            reserve=reserve_address,
            manager=Global.current_application_address,
            clawback=Global.current_application_address,
            fee=0,
        ).submit()

        credential_asa_id = asset_txn.created_asset.id

        # Transfer NFT to student
        itxn.AssetTransfer(
            xfer_asset=asset_txn.created_asset,
            asset_amount=1,
            asset_receiver=student,
            fee=0,
        ).submit()

        # Record in box storage
        self.credentials[student] = credential_asa_id
        self.total_issued.value += 1

        return credential_asa_id

    @arc4.abimethod()
    def revoke_credential(self, student: Account) -> None:
        """
        Clawback and destroy the student's credential NFT.

        Only the admin can revoke. This removes the student's platform access.
        """
        assert Txn.sender == self.admin.value, "Only admin can revoke credentials"
        assert student in self.credentials, "No credential found for student"

        asa_id = self.credentials[student]
        asset = Asset(asa_id)

        # Clawback the NFT from the student
        itxn.AssetTransfer(
            xfer_asset=asset,
            asset_amount=1,
            asset_sender=student,
            asset_receiver=Global.current_application_address,
            fee=0,
        ).submit()

        # Destroy the ASA
        itxn.AssetConfig(
            config_asset=asset,
            fee=0,
        ).submit()

        # Remove from box storage
        del self.credentials[student]

    @arc4.abimethod(readonly=True)
    def has_credential(self, student: Account) -> bool:
        """Check if a student has a valid credential."""
        return student in self.credentials

    @arc4.abimethod(readonly=True)
    def get_credential_asa(self, student: Account) -> UInt64:
        """Get the ASA ID of a student's credential."""
        assert student in self.credentials, "No credential found for student"
        return self.credentials[student]

    @arc4.abimethod(readonly=True)
    def get_total_issued(self) -> UInt64:
        """Get the total number of credentials ever issued."""
        return self.total_issued.value
