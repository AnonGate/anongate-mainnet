"""Read-only resolution of the checked-in Ethereum mainnet deployment registry."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DEFAULT_REGISTRY = (
    Path(__file__).resolve().parents[3] / "deployments" / "pools.mainnet.json"
)

MAINNET_ASSET_CHOICES = ("eth", "dai", "lusd")
ASSET_CHOICES = MAINNET_ASSET_CHOICES


def is_mainnet_registry_live(registry: dict[str, Any]) -> bool:
    if registry.get("chainId") != 1:
        return False
    if registry.get("clientsUnlocked") is not True:
        return False
    pools = registry.get("pools") or {}
    for asset_id in ("eth", "dai", "lusd"):
        entry = pools.get(asset_id) or {}
        if not entry.get("pool"):
            return False
    return True


def load_mainnet_registry(path: str | Path | None = None) -> tuple[dict[str, Any], Path]:
    resolved = Path(path).resolve() if path else DEFAULT_REGISTRY.resolve()
    registry = json.loads(resolved.read_text(encoding="utf-8"))
    if registry.get("chainId") != 1 or registry.get("network") != "ethereum-mainnet":
        raise ValueError(f"not a mainnet deployment registry: {resolved}")
    return registry, resolved


def resolve_mainnet_asset(
    asset: str, registry_path: str | Path | None = None
) -> dict[str, Any]:
    registry, resolved = load_mainnet_registry(registry_path)
    asset_id = asset.strip().lower()
    if asset_id in ("weth", "tweth"):
        raise ValueError(
            "unknown mainnet asset 'weth'; native ETH pool is --asset eth"
        )
    entry = (registry.get("pools") or {}).get(asset_id)
    if entry is None:
        choices = ", ".join((registry.get("pools") or {}).keys())
        raise ValueError(f"unknown mainnet asset '{asset}'; choose {choices}")
    if not entry.get("pool"):
        raise ValueError("mainnet pools are not deployed yet. See docs/MAINNET.md")
    return {
        "id": asset_id,
        "chainId": registry["chainId"],
        "network": registry["network"],
        "rpc": registry["rpc"],
        "status": registry["status"],
        "warning": registry["warning"],
        "pool": entry["pool"],
        "token": entry["asset"],
        "symbol": entry["assetSymbol"],
        "decimals": entry["assetDecimals"],
        "source": entry["assetSource"],
        "clientsUnlocked": is_mainnet_registry_live(registry),
        "registryPath": str(resolved),
    }
