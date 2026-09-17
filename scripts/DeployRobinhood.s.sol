// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/BananaCatFactory.sol";
import "../src/core/BananaCatToken.sol";
import "../src/core/BondingCurve.sol";
import "../src/periphery/LPLocker.sol";
import "../src/periphery/MigratorRobinhood.sol";

/// @title DeployRobinhood - 一键部署( Robinhood Chain 测试网)
/// @dev 使用方法:
///   export ROBINHOOD_TESTNET_RPC=https://rpc.testnet.chain.robinhood.com
///   export PRIVATE_KEY=0x...
///   forge script script/DeployRobinhood.s.sol:DeployRobinhood --rpc-url robinhood_testnet --broadcast
contract DeployRobinhood is Script {
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

        MigratorRobinhood migrator = new MigratorRobinhood(
            address(lPLocker),
            FEE_RECIPIENT
        );
        console.log("Migrator:", address(migrator));

        BananaCatFactory factory = new BananaCatFactory(
            address(tokenTemplate),
            address(curveTemplate),
            address(lPLocker),
            address(migrator),
            FEE_RECIPIENT,
            0.005 ether,    // 0.005 ETH
            24 ether        // 24 ETH 毕业
        );
        console.log("Factory:", address(factory));

        console.log("=== Robinhood Chain 部署完成 ===");
        vm.stopBroadcast();
    }
}
