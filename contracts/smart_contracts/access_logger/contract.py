"""
ConsentChain — Access Logger Contract

Immutable, append-only audit log stored in box storage on Algorand.
Records every data access event (uploads, consent grants, revocations,
downloads, credential issuances) with timestamps and references.
"""

from algopy import (
    ARC4Contract,
    Account,
    Global,
    Txn,
    UInt64,
    arc4,
    Bytes,
    GlobalState,
    BoxMap,
    op,
)


class LogEntry(arc4.Struct):
    """Immutable audit log entry."""

    actor: arc4.Address
    action: arc4.UInt8
    target: arc4.Address
    resource_hash: arc4.StaticArray[arc4.Byte, arc4.UInt64]
    timestamp: arc4.UInt64
    consent_app_id: arc4.UInt64


class AccessLogger(ARC4Contract):
    """
    Immutable, append-only audit log stored in box storage.

    Action codes:
        0 = upload
        1 = consent_grant
        2 = consent_revoke
        3 = download
        4 = credential_issue

    Entries cannot be modified or deleted after creation.
    """

    def __init__(self) -> None:
        self.admin = GlobalState(Account, key=b"admin")
        self.consent_manager_app_id = GlobalState(UInt64, key=b"cm_app")
        self.log_count = GlobalState(UInt64, key=b"count")
        # BoxMap: key = sequence number as 8-byte big-endian
        self.logs = BoxMap(Bytes, LogEntry, key_prefix=b"log_")

    @arc4.abimethod(create="require")
    def create(self, admin: Account, consent_manager_app_id: UInt64) -> None:
        """Initialize the access logger with admin and consent manager reference."""
        self.admin.value = admin
        self.consent_manager_app_id.value = consent_manager_app_id
        self.log_count.value = UInt64(0)

    @arc4.abimethod()
    def log_action(
        self,
        action: arc4.UInt8,
        target: Account,
        resource_hash: arc4.StaticArray[arc4.Byte, arc4.UInt64],
        consent_app_id: arc4.UInt64,
    ) -> UInt64:
        """
        Append an audit log entry.

        Any authenticated user can log — the sender is recorded as actor.
        This makes the log permissionless but attributable.

        Args:
            action: Action code (0-4).
            target: The account affected by the action.
            resource_hash: SHA-256 hash of the resource identifier.
            consent_app_id: Reference to the consent manager app.

        Returns:
            The log sequence number.
        """
        seq = self.log_count.value
        key = op.itob(seq)

        entry = LogEntry(
            actor=arc4.Address(Txn.sender),
            action=action,
            target=arc4.Address(target),
            resource_hash=resource_hash,
            timestamp=arc4.UInt64(Global.round),
            consent_app_id=consent_app_id,
        )

        self.logs[key] = entry
        self.log_count.value = seq + 1
        return seq

    @arc4.abimethod(readonly=True)
    def get_log(self, seq: UInt64) -> LogEntry:
        """Retrieve a specific log entry by sequence number."""
        key = op.itob(seq)
        assert key in self.logs, "Log entry not found"
        return self.logs[key]

    @arc4.abimethod(readonly=True)
    def get_log_count(self) -> UInt64:
        """Get the total number of log entries."""
        return self.log_count.value
