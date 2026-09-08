import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertDistinct,
  assertNotSepoliaAddress,
  forbiddenSepoliaAddresses,
  isMainnetRegistryLive,
  parseDotEnv,
} from "../../contracts/scripts/lib/mainnet-safety.mjs";
import { resolveMainnetAsset } from "../lib/mainnetRegistry.mjs";

test("refuses known Sepolia operator addresses", () => {
  const forbidden = forbiddenSepoliaAddresses({
    deployer: "0x0435d21D40dB54480EdCdbd58C2bd72C0d2122d1",
  });
  assert.throws(
    () =>
      assertNotSepoliaAddress(
        "0x0435d21D40dB54480EdCdbd58C2bd72C0d2122d1",
        "deployer",
        forbidden
      ),
    /Sepolia/
  );
});

test("requires distinct deployer and fee recipient", () => {
  assert.throws(
    () =>
      assertDistinct(
        [
          "0x1111111111111111111111111111111111111111",
          "0x1111111111111111111111111111111111111111",
        ],
        ["deployer", "fee recipient"]
      ),
    /distinct/
  );
});

test("mainnet clients stay locked on the prepared registry", () => {
  assert.equal(isMainnetRegistryLive({
    chainId: 1,
    clientsUnlocked: false,
    pools: {
      eth: { pool: "0x1111111111111111111111111111111111111111" },
      dai: { pool: "0x2222222222222222222222222222222222222222" },
      lusd: { pool: "0x3333333333333333333333333333333333333333" },
    },
  }), false);
  assert.equal(isMainnetRegistryLive({
    chainId: 1,
    clientsUnlocked: true,
    pools: {
      eth: { pool: "0x1111111111111111111111111111111111111111" },
      dai: { pool: "0x2222222222222222222222222222222222222222" },
      lusd: { pool: "0x3333333333333333333333333333333333333333" },
    },
  }), true);
});

test("resolveMainnetAsset refuses weth and undeployed pools", () => {
  assert.throws(() => resolveMainnetAsset("weth"), /native ETH/);
  assert.throws(() => resolveMainnetAsset("eth"), /not deployed/);
});

test("checked-in mainnet registry is deployed and unlocked", () => {
  const registry = JSON.parse(
    fs.readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../deployments/pools.mainnet.json"
      ),
      "utf8"
    )
  );
  assert.equal(registry.clientsUnlocked, true);
  assert.equal(typeof registry.pools.eth.pool, "string");
  assert.equal(registry.chainId, 1);
  assert.equal(isMainnetRegistryLive(registry), true);
});

test("parseDotEnv ignores comments", () => {
  const env = parseDotEnv("# x=1\nMAINNET_RPC=https://example\n");
  assert.equal(env.MAINNET_RPC, "https://example");
  assert.equal(env.x, undefined);
});
