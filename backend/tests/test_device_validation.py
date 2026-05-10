"""Tests for :func:`app.services.device_control.validate_manual_command`."""

from __future__ import annotations

import unittest

from app.core.exceptions import BadRequestError, BusinessRuleError
from app.schemas import DeviceCommand
from app.services.device_control import validate_manual_command
from app.store import LAYERS


def _layer_id() -> str:
    """Return a known layer id from the in-memory store."""
    return next(iter(LAYERS.keys()))


class ManualCommandValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.layer_id = _layer_id()
        # Ensure auto-mode is OFF so manual commands are allowed by default.
        LAYERS[self.layer_id].devices.auto_mode = False

    # ── Auto-mode toggle ─────────────────────────────────────────

    def test_auto_mode_must_be_boolean(self) -> None:
        cmd = DeviceCommand(layer_id=self.layer_id, device="auto_mode", value=1)
        with self.assertRaises(BadRequestError):
            validate_manual_command(cmd)

    def test_auto_mode_boolean_passes(self) -> None:
        cmd = DeviceCommand(layer_id=self.layer_id, device="auto_mode", value=True)
        validate_manual_command(cmd)  # no raise

    # ── Auto-mode blocks manual control ──────────────────────────

    def test_manual_blocked_when_auto_mode_on(self) -> None:
        LAYERS[self.layer_id].devices.auto_mode = True
        cmd = DeviceCommand(layer_id=self.layer_id, device="fan", value=True)
        with self.assertRaises(BusinessRuleError):
            validate_manual_command(cmd)

    # ── Per-device value validation ──────────────────────────────

    def test_led_intensity_rejects_out_of_range(self) -> None:
        cmd = DeviceCommand(layer_id=self.layer_id, device="led_intensity", value=150)
        with self.assertRaises(BadRequestError):
            validate_manual_command(cmd)

    def test_led_intensity_accepts_valid_range(self) -> None:
        cmd = DeviceCommand(layer_id=self.layer_id, device="led_intensity", value=70)
        validate_manual_command(cmd)

    def test_climate_heating_rejects_out_of_range(self) -> None:
        cmd = DeviceCommand(layer_id=self.layer_id, device="climate_heating", value=4)
        with self.assertRaises(BadRequestError):
            validate_manual_command(cmd)

    def test_climate_cooling_accepts_valid_level(self) -> None:
        cmd = DeviceCommand(layer_id=self.layer_id, device="climate_cooling", value=2)
        validate_manual_command(cmd)

    def test_fan_must_be_boolean(self) -> None:
        cmd = DeviceCommand(layer_id=self.layer_id, device="fan", value=1)
        with self.assertRaises(BadRequestError):
            validate_manual_command(cmd)

    def test_fan_boolean_passes(self) -> None:
        cmd = DeviceCommand(layer_id=self.layer_id, device="fan", value=True)
        validate_manual_command(cmd)


if __name__ == "__main__":
    unittest.main()
