// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/BananaCatFactory.sol";
import "../src/core/BananaCatToken.sol";
import "../src/core/BondingCurve.sol";
import "../src/periphery/LPLocker.sol";
import "../src/periphery/MigratorETH.sol";

/// @title DeployETH - 一键部署香蕉猫全套合约(Ethereum 测试网 Sepolia)
/// @dev 使用方法:
///   export SEPOLIA_RPC=https://...              # Sepolia RPC
///   export PRIVATE_KEY=0x...                   # 部署私钥
///   forge script script/DeployETH.s.sol:DeployETH --rpc-url sepolia --broadcast
contract DeployETH is Script {
    // Sepolia 配置(部署前需更新)
    // Uniswap V3 Testnet Router: 需查官方文档
    address constant SWAP_ROUTER = 0xYourUniswapRouterAddress; // TODO: 替换为 Sepolia 上的 Router
    address constant WETH_SEPOLIA = 0xYourWETHAddress;         // TODO: 替换为 Sepolia WETH
    address constant FEE_RECIPIENT = 0xYourWalletAddress;     // 替换为你的地址

    function run() external {
        uint256 deployer = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployer);

        // 1. 部署模板合约
        BananaCatToken tokenTemplate = new BananaCatToken();
        BondingCurve curveTemplate = new BondingCurve();
        console.log("Token template:", address(tokenTemplate));
        console.log("Curve template:", address(curveTemplate));

        // 2. 部署 LP 锁仓合约
        LPLocker lPLocker = new LPLocker();
        console.log("LPLocker:", address(lPLocker));

        // 3. 部署迁移器(Ethereum / Uniswap)
        MigratorETH migrator = new MigratorETH(
            address(lPLocker),
            SWAP_ROUTER,
            WETH_SEPOLIA,
            FEE_RECIPIENT
        );
        console.log("MigratorETH:", address(migrator));

        // 4. 部署工厂合约
        BananaCatFactory factory = new BananaCatFactory(
            address(tokenTemplate),
            address(curveTemplate),
            address(lPLocker),
            address(migrator),
            FEE_RECIPIENT,
            0.005 ether,    // 发币费用:0.005 ETH
            24 ether        // 毕业目标:24 ETH
        );
        console.log("Factory:", address(factory));

        console.log("=== 部署完成 ===");
        console.log("RPC: Sepolia testnet");
        console.log("Factory:", address(factory));

        vm.stopBroadcast();
    }
}
