"""Shared utility functions used across multiple services."""


def round_to_step(value: float, step: int = 5) -> int:
    """Round a float to the nearest multiple of ``step``."""
    return int(round(value / step) * step)
