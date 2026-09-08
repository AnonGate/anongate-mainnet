// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {ShieldedPool} from "../src/ShieldedPool.sol";
import {DepositCeremonyVerifier} from "../src/verifiers/ceremony/deposit_CeremonyVerifier.sol";
import {WithdrawCeremonyVerifier} from "../src/verifiers/ceremony/withdraw_CeremonyVerifier.sol";
import {Withdraw_1inCeremonyVerifier} from "../src/verifiers/ceremony/withdraw_1in_CeremonyVerifier.sol";
import {Withdraw_partialCeremonyVerifier} from
    "../src/verifiers/ceremony/withdraw_partial_CeremonyVerifier.sol";
import {
    DepositCeremonyVerifierAdapter,
    WithdrawCeremonyVerifierAdapter,
    Withdraw1inCeremonyVerifierAdapter,
    WithdrawPartialCeremonyVerifierAdapter
} from "../src/verifiers/CeremonyVerifierAdapters.sol";

/// @notice Full Ethereum mainnet ceremony deploy: Poseidon + 8 verifiers + ETH/DAI/LUSD pools.
/// @dev Official operator path is packages/contracts/scripts/deploy-mainnet-ceremony.mjs
///      (preflight by default). This script is the Foundry equivalent.
///      Env: I_UNDERSTAND_MAINNET_UNAUDITED=true, MAINNET_DEPLOYER_ADDRESS, MAINNET_FEE_RECIPIENT.
///      Do not reuse Sepolia addresses. Native ETH (asset 0) + canonical DAI/LUSD.
contract DeployMainnet is Script {
    using stdJson for string;

    uint256 internal constant MAINNET = 1;
    uint32 internal constant TREE_DEPTH = 20;
    uint32 internal constant DEPOSIT_FEE_PPM = 110;
    uint32 internal constant WITHDRAW_FEE_PPM = 400;
    address internal constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address internal constant LUSD = 0x5f98805A4E8be255a32880FDeC7F6728C6568bA0;

    function run() external {
        require(block.chainid == MAINNET, "DeployMainnet: expected Ethereum mainnet chainId 1");
        require(
            vm.envOr("I_UNDERSTAND_MAINNET_UNAUDITED", false),
            "DeployMainnet: set I_UNDERSTAND_MAINNET_UNAUDITED=true"
        );

        address deployer = vm.envAddress("MAINNET_DEPLOYER_ADDRESS");
        address feeRecipient = vm.envAddress("MAINNET_FEE_RECIPIENT");
        require(deployer != address(0), "DeployMainnet: deployer is zero");
        require(feeRecipient != address(0), "DeployMainnet: fee recipient is zero");
        require(deployer != feeRecipient, "DeployMainnet: deployer must differ from fee recipient");
        _refuseSepoliaAddress(deployer, "deployer");
        _refuseSepoliaAddress(feeRecipient, "fee recipient");
        require(DAI.code.length != 0, "DeployMainnet: DAI has no code");
        require(LUSD.code.length != 0, "DeployMainnet: LUSD has no code");

        bytes memory poseidonBytecode = _poseidonBytecode();

        vm.startBroadcast(deployer);
        address poseidon;
        assembly {
            poseidon := create(0, add(poseidonBytecode, 0x20), mload(poseidonBytecode))
        }
        require(poseidon != address(0) && poseidon.code.length != 0, "poseidon deploy failed");
        _refuseSepoliaAddress(poseidon, "poseidon");

        DepositCeremonyVerifier depositRaw = new DepositCeremonyVerifier();
        DepositCeremonyVerifierAdapter depositAdapter =
            new DepositCeremonyVerifierAdapter(address(depositRaw));
        WithdrawCeremonyVerifier withdrawRaw = new WithdrawCeremonyVerifier();
        WithdrawCeremonyVerifierAdapter withdrawAdapter =
            new WithdrawCeremonyVerifierAdapter(address(withdrawRaw));
        Withdraw_1inCeremonyVerifier withdraw1Raw = new Withdraw_1inCeremonyVerifier();
        Withdraw1inCeremonyVerifierAdapter withdraw1Adapter =
            new Withdraw1inCeremonyVerifierAdapter(address(withdraw1Raw));
        Withdraw_partialCeremonyVerifier withdrawPartialRaw = new Withdraw_partialCeremonyVerifier();
        WithdrawPartialCeremonyVerifierAdapter withdrawPartialAdapter =
            new WithdrawPartialCeremonyVerifierAdapter(address(withdrawPartialRaw));

        ShieldedPool ethPool = _pool(
            address(0),
            poseidon,
            address(depositAdapter),
            address(withdrawAdapter),
            address(withdraw1Adapter),
            address(withdrawPartialAdapter),
            feeRecipient
        );
        ShieldedPool daiPool = _pool(
            DAI,
            poseidon,
            address(depositAdapter),
            address(withdrawAdapter),
            address(withdraw1Adapter),
            address(withdrawPartialAdapter),
            feeRecipient
        );
        ShieldedPool lusdPool = _pool(
            LUSD,
            poseidon,
            address(depositAdapter),
            address(withdrawAdapter),
            address(withdraw1Adapter),
            address(withdrawPartialAdapter),
            feeRecipient
        );
        vm.stopBroadcast();

        console2.log("WARNING mainnet ceremony deploy");
        console2.log("DEPLOYER", deployer);
        console2.log("FEE_RECIPIENT", feeRecipient);
        console2.log("POSEIDON", poseidon);
        console2.log("DEPOSIT_RAW", address(depositRaw));
        console2.log("DEPOSIT_ADAPTER", address(depositAdapter));
        console2.log("WITHDRAW_RAW", address(withdrawRaw));
        console2.log("WITHDRAW_ADAPTER", address(withdrawAdapter));
        console2.log("WITHDRAW1_RAW", address(withdraw1Raw));
        console2.log("WITHDRAW1_ADAPTER", address(withdraw1Adapter));
        console2.log("WITHDRAW_PARTIAL_RAW", address(withdrawPartialRaw));
        console2.log("WITHDRAW_PARTIAL_ADAPTER", address(withdrawPartialAdapter));
        console2.log("ETH_POOL_NATIVE", address(ethPool));
        console2.log("DAI_POOL", address(daiPool));
        console2.log("LUSD_POOL", address(lusdPool));
        console2.log("Record in deployments/pools.mainnet.json; leave clientsUnlocked false");
    }

    function _pool(
        address asset,
        address poseidon,
        address depositAdapter,
        address withdrawAdapter,
        address withdraw1Adapter,
        address withdrawPartialAdapter,
        address feeRecipient
    ) internal returns (ShieldedPool) {
        return new ShieldedPool(
            asset,
            poseidon,
            depositAdapter,
            withdrawAdapter,
            withdraw1Adapter,
            withdrawPartialAdapter,
            TREE_DEPTH,
            DEPOSIT_FEE_PPM,
            WITHDRAW_FEE_PPM,
            feeRecipient,
            0,
            0
        );
    }

    function _poseidonBytecode() internal view returns (bytes memory) {
        string memory json = vm.readFile("test/fixtures/withdraw_trusted_fixture.json");
        return vm.parseBytes(json.readString(".poseidonBytecode"));
    }

    function _refuseSepoliaAddress(address account, string memory label) internal pure {
        require(
            account != 0x0435d21D40dB54480EdCdbd58C2bd72C0d2122d1
                && account != 0x98f28F2818de6A7120C6b1887611B14935d27e72
                && account != 0x21271F64C3c0Dd6D0aC842e4659B275f80156D64
                && account != 0xa1cEFcd8F0f72684c251c3f352E8D13Dd1256d03
                && account != 0x445a87927c731B741E349D917108e5f6D0B0c24B,
            string.concat("DeployMainnet: ", label, " was used on Sepolia")
        );
    }
}
