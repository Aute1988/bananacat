// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/BananaCatFactory.sol";
import {TokenConfig, TokenLabel, TokenMode, TaxConfig, AntiSniperConfig, LockPeriod} from "../src/interfaces/IBananaCatToken.sol";

/// @notice Mint a test BananaCat token on Sepolia
contract MintTestToken is Script {
    function run() external {
        address factory = 0x4F8FDeD0Ec90A19f6Cf1e1fAED91600Bc85f37c3;

        TokenConfig memory config = TokenConfig({
            name: "Test Banana Cat",
            symbol: "TBC",
            description: "First test token on Sepolia - Sep 2026",
            imageUrl: "https://i.imgur.com/Yh7DmN8.png",
            websiteUrl: "",
            twitterUrl: "",
            telegramUrl: "",
            label: TokenLabel.MEME,
            mode: TokenMode.NORMAL,
            taxConfig: TaxConfig({
                buyTaxBps: 0,
                sellTaxBps: 0,
                transferTaxBps: 0,
                taxRecipient: address(0)
            }),
            maxBuyPerWallet: 0,
            launchTime: 0,
            lockPeriod: LockPeriod.THIRTY_DAYS,
            antiSniper: AntiSniperConfig({
                enabled: false,
                startTaxBps: 0,
                decrementBps: 0,
                durationBlocks: 0
            })
        });

        vm.startBroadcast();

        console.log("Creating test token...");
        (address tokenAddr, address curveAddr) = BananaCatFactory(payable(factory)).createToken{value: 0.005 ether}(config);

        console.log("=== MINT_RESULT_BEGIN ===");
        console.log("Token:", tokenAddr);
        console.log("Curve:", curveAddr);
        console.log("=== MINT_RESULT_END ===");

        vm.stopBroadcast();
    }
}
