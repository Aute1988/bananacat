// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/BananaCatFactory.sol";
import "../src/core/BananaCatToken.sol";
import "../src/core/BondingCurve.sol";
import "../src/periphery/LPLocker.sol";
import "../src/periphery/MigratorBSC.sol";

/// @title DeployUniversal - 通用部署脚本
/// @dev 通过环境变量配置:
///   PRIVATE_KEY     - 部署私钥
///   FEE_RECIPIENT   - 平台费用接收地址
///   MIGRATOR_TYPE   - bsc | none (BSC 用 PancakeSwap Migrator,其他链用 none)
contract DeployUniversal is Script {
    function run() external {
        uint256 deployer = vm.envUint("PRIVATE_KEY");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        string memory migratorType = vm.envOr("MIGRATOR_TYPE", string("none"));

        vm.startBroadcast(deployer);

        // 1. Token + Curve 模板
        BananaCatToken tokenTemplate = new BananaCatToken();
        BondingCurve curveTemplate = new BondingCurve();
        console.log("Token Template:", address(tokenTemplate));
        console.log("Curve Template:", address(curveTemplate));

        // 2. LP Locker
        LPLocker lPLocker = new LPLocker();
        console.log("LPLocker:", address(lPLocker));

        // 3. Migrator(只 BSC 用)
        address migratorAddr = address(0);
        if (keccak256(bytes(migratorType)) == keccak256(bytes("bsc"))) {
            // BSC Testnet PancakeSwap(由调用方通过环境变量传入)
            address router = vm.envAddress("PANCAKE_ROUTER");
            address factory = vm.envAddress("PANCAKE_FACTORY");
            address wbnb = vm.envAddress("WBNB");
            MigratorBSC migrator = new MigratorBSC(
                address(lPLocker),
                feeRecipient,
                router,
                factory,
                wbnb
            );
            migratorAddr = address(migrator);
            console.log("MigratorBSC:", migratorAddr);
        }

        // 4. Factory
        BananaCatFactory factory = new BananaCatFactory(
            address(tokenTemplate),
            address(curveTemplate),
            address(lPLocker),
            migratorAddr,
            feeRecipient,
            0.005 ether,
            24 ether
        );
        console.log("Factory:", address(factory));

        // 5. 记录到环境文件(给 backend 用)
        string memory out = string.concat(
            "export FACTORY=", vm.toString(address(factory)), "\n",
            "export TOKEN_TEMPLATE=", vm.toString(address(tokenTemplate)), "\n",
            "export CURVE_TEMPLATE=", vm.toString(address(curveTemplate)), "\n",
            "export LP_LOCKER=", vm.toString(address(lPLocker)), "\n",
            "export MIGRATOR=", migratorAddr == address(0) ? "0x0" : vm.toString(migratorAddr), "\n"
        );
        // 用 console.log 输出(可被父进程捕获)
        console.log("===DEPLOY_RESULT_BEGIN===");
        console.log(out);
        console.log("===DEPLOY_RESULT_END===");

        vm.stopBroadcast();
    }
}
