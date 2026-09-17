// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/BananaCatFactory.sol";
import "../src/core/BananaCatToken.sol";
import "../src/core/BondingCurve.sol";
import "../src/periphery/LPLocker.sol";
import "../src/periphery/MigratorBSC.sol";

/// @title DeployAll - 一键部署香蕉猫全套合约(BSC 测试网)
/// @dev 使用方法:
///   export BSC_TESTNET_RPC=https://...       # BSC 测试网 RPC
///   export PRIVATE_KEY=0x...                 # 部署私钥
///   forge script script/DeployBSC.s.sol:DeployBSC --rpc-url bsc_testnet --broadcast
contract DeployBSC is Script {
    // 🆕 v4 修复: 之前 hardcode mainnet 地址,testnet 部署后 swap 永远失败
    //              改为 BSC testnet PancakeSwap 地址
    address constant ROUTER_BSC_TESTNET = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1; // PancakeSwap Testnet Router
    address constant FACTORY_BSC_TESTNET = 0x6725F303b657a9451d8BA641348b6761A6CC7a17; // PancakeSwap Testnet Factory
    address constant WBNB_TESTNET = 0xae13d989daC2f0d6Ff83c2D6A4b2B0A2C3b8b7D2; // BSC Testnet WBNB
    address constant FEE_RECIPIENT = 0xYourWalletAddress; // 替换为你的地址

    function run() external {
        uint256 deployer = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployer);

        // 1. 部署模板合约
        BananaCatToken tokenTemplate = new BananaCatToken();
        BondingCurve curveTemplate = new BondingCurve();

        console.log("Token template deployed:", address(tokenTemplate));
        console.log("Curve template deployed:", address(curveTemplate));

        // 2. 部署 LP 锁仓合约
        LPLocker lPLocker = new LPLocker();
        console.log("LPLocker deployed:", address(lPLocker));

        // 3. 部署迁移器(BSC / PancakeSwap)
        MigratorBSC migrator = new MigratorBSC(
            address(lPLocker),
            FEE_RECIPIENT,
            ROUTER_BSC_TESTNET,
            FACTORY_BSC_TESTNET,
            WBNB_TESTNET
        );
        console.log("MigratorBSC deployed:", address(migrator));

        // 4. 部署工厂合约
        BananaCatFactory factory = new BananaCatFactory(
            address(tokenTemplate),
            address(curveTemplate),
            address(lPLocker),
            address(migrator),
            FEE_RECIPIENT,
            0.005 ether,    // 发币费用:0.005 BNB
            24 ether        // 毕业目标:24 BNB
        );
        console.log("BananaCatFactory deployed:", address(factory));

        // 5. 验证部署
        console.log("");
        console.log("=== 部署完成 ===");
        console.log("代币模板:", address(tokenTemplate));
        console.log("曲线模板:", address(curveTemplate));
        console.log("锁仓合约:", address(lPLocker));
        console.log("迁移合约:", address(migrator));
        console.log("工厂合约:", address(factory));
        console.log("费用接收:", FEE_RECIPIENT);
        console.log("");
        console.log("发币费用: 0.005 BNB");
        console.log("毕业目标: 24 BNB");
        console.log("手续费率: 1%");

        vm.stopBroadcast();
    }
}
