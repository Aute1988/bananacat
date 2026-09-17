// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/BananaCatFactory.sol";
import "../src/core/BananaCatToken.sol";
import "../src/core/BondingCurve.sol";
import "../src/periphery/LPLocker.sol";
import "../src/periphery/MigratorArc.sol";

/// @title DeployArc - Circle Arc 测试网一键部署
/// @dev 使用方法:
///   export ARC_TESTNET_RPC=https://rpc.testnet.arc.io
///   export PRIVATE_KEY=0x...
///   forge script script/DeployArc.s.sol:DeployArc --rpc-url arc_testnet --broadcast
/// @dev Arc 用 USDC 作为 gas,发币费用也是 USDC
contract DeployArc is Script {
    // Arc 测试网 RPC: https://rpc.testnet.arc.io
    // Chain ID: 5042002
    // Currency: USDC (18 decimals display, 6 decimals actual)
    address constant FEE_RECIPIENT = 0xYourWalletAddress; // 替换

    function run() external {
        uint256 deployer = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployer);

        BananaCatToken tokenTemplate = new BananaCatToken();
        BondingCurve curveTemplate = new BondingCurve();
        console.log("Token template:", address(tokenTemplate));
        console.log("Curve template:", address(curveTemplate));

        LPLocker lPLocker = new LPLocker();
        console.log("LPLocker:", address(lPLocker));

        MigratorArc migrator = new MigratorArc(
            address(lPLocker),
            FEE_RECIPIENT
        );
        console.log("MigratorArc:", address(migrator));

        // Arc 用 USDC 作为 gas,所以 graduation target 也是 USDC 数量
        BananaCatFactory factory = new BananaCatFactory(
            address(tokenTemplate),
            address(curveTemplate),
            address(lPLocker),
            address(migrator),
            FEE_RECIPIENT,
            5e6,        // 5 USDC (USDC 6 decimals)
            24000000e6  // 24 USDC (24 * 10^6)
        );
        console.log("Factory:", address(factory));

        console.log("=== Circle Arc 测试网部署完成 ===");
        console.log("Chain ID: 5042002");
        console.log("RPC: https://rpc.testnet.arc.io");
        console.log("Gas: USDC");
        vm.stopBroadcast();
    }
}
