import unittest

from absolute_privacy.mainnet_registry import (
    is_mainnet_registry_live,
    load_mainnet_registry,
    resolve_mainnet_asset,
)


class MainnetRegistryTests(unittest.TestCase):
    def test_live_registry_unlocks_clients(self) -> None:
        registry, _ = load_mainnet_registry()
        self.assertEqual(registry["chainId"], 1)
        self.assertTrue(is_mainnet_registry_live(registry))
        for asset_id in ("eth", "dai", "lusd"):
            item = resolve_mainnet_asset(asset_id)
            self.assertEqual(item["id"], asset_id)
            self.assertEqual(len(item["pool"]), 42)
            self.assertTrue(item["clientsUnlocked"])

    def test_unknown_and_weth_fail_closed(self) -> None:
        with self.assertRaisesRegex(ValueError, "unknown mainnet asset"):
            resolve_mainnet_asset("usdc")
        with self.assertRaisesRegex(ValueError, "native ETH pool is --asset eth"):
            resolve_mainnet_asset("weth")


if __name__ == "__main__":
    unittest.main()
