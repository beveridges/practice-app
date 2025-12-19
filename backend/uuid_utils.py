"""
UUID generation and validation utilities for offline-sync database
"""

import uuid
from typing import Optional


def generate_uuid() -> str:
    """
    Generate a new UUID4 (random UUID) as a string.
    Used for primary keys to enable offline-sync without ID collisions.
    """
    return str(uuid.uuid4())


def is_valid_uuid(uuid_string: str) -> bool:
    """
    Validate if a string is a valid UUID format.
    """
    try:
        uuid.UUID(uuid_string)
        return True
    except (ValueError, TypeError):
        return False


def format_uuid_display(uuid_string: str, max_length: int = 8) -> str:
    """
    Format UUID for display purposes (shortened for readability).
    Returns first N characters followed by '...'
    """
    if not uuid_string:
        return ""
    return uuid_string[:max_length] + "..." if len(uuid_string) > max_length else uuid_string

