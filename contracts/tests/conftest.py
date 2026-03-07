"""
Test fixtures for ConsentChain contract tests.
"""

import pytest


@pytest.fixture(scope="session")
def admin_address() -> str:
    """Mock admin address for testing."""
    return "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"


@pytest.fixture(scope="session")
def student_address() -> str:
    """Mock student address for testing."""
    return "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBCI"
