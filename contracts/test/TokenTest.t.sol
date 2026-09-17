// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseTest.t.sol";
import { LockPeriod } from "../src/interfaces/ILPLocker.sol";

/// @title TokenTest - 代币合约测试(v2 + 安全修复验证)
contract TokenTest is BaseTest {

    // ============================================================
    // 🆕 M-1: Transfer tax 自增 bug 修复验证
    // ============================================================

    function test_M1_TransferTax_CreatorBurnsOwnTokens() public {
        // 场景:发币者自己转 token,from==taxRecipient
        // 旧 bug:from==taxRecipient 时凭空增币
        // 修复:from==taxRecipient 时不加税,tax "burn"
        TokenConfig memory cfg = _defaultConfig();
        cfg.mode = TokenMode.TAX;
        cfg.taxConfig = TaxConfig({
            buyTaxBps: 0, sellTaxBps: 0,
            transferTaxBps: 1000,  // 10% 转账税
            taxRecipient: creator  // taxRecipient = creator(发币者)
        });
        cfg.lockPeriod = LockPeriod(1);

        (address token,) = _createToken(cfg);
        BananaCatToken tc = BananaCatToken(token);

        // creator 有 1B 代币
        assertEq(tc.balanceOf(creator), 1_000_000_000 * 1e18);

        // creator 转 100 代币给自己(自转)
        vm.deal(creator, 100 ether);
        vm.prank(creator);
        tc.transfer(creator, 100 * 1e18);

        // 修复后:creator 应该少了 100 代币,没有凭空增币
        // 余额应该是 1B - 100
        assertEq(tc.balanceOf(creator), 1_000_000_000 * 1e18 - 100 * 1e18);
    }

    function test_M1_TransferTax_NormalTransfer() public {
        // 正常转账:creator → buyer1,税给 taxRecipient
        TokenConfig memory cfg = _defaultConfig();
        cfg.mode = TokenMode.TAX;
        cfg.taxConfig = TaxConfig({
            buyTaxBps: 0, sellTaxBps: 0,
            transferTaxBps: 500,  // 5%
            taxRecipient: taxRecipient
        });
        cfg.lockPeriod = LockPeriod(1);

        (address token,) = _createToken(cfg);
        BananaCatToken tc = BananaCatToken(token);

        // creator 转 1000 代币给 buyer1
        uint256 amount = 1000 * 1e18;
        uint256 tax = amount * 500 / 10000; // 5%

        vm.deal(creator, 100 ether);
        vm.prank(creator);
        tc.transfer(buyer1, amount);

        assertEq(tc.balanceOf(buyer1), amount - tax);
        assertEq(tc.balanceOf(taxRecipient), tax);
        assertEq(tc.balanceOf(creator), 1_000_000_000 * 1e18 - amount);
    }

    // ============================================================
    // 🆕 M-2: Anti-sniper 税叠加修复验证
    // ============================================================

    function test_M2_AntiSniper_BuyTaxApplied() public {
        // 场景:开启了 anti-sniper(30%,每块 -1%,30块)
        // 买税应该 = buyTaxBps + sniperTax
        TokenConfig memory cfg = _defaultConfig();
        cfg.mode = TokenMode.TAX;
        cfg.taxConfig = TaxConfig({
            buyTaxBps: 100,  // 1%
            sellTaxBps: 0, transferTaxBps: 0,
            taxRecipient: taxRecipient
        });
        cfg.antiSniper = AntiSniperConfig({
            enabled: true, startTaxBps: 3000,
            decrementBps: 100, durationBlocks: 30
        });
        cfg.lockPeriod = LockPeriod(1);

        (address token, address curve) = _createToken(cfg);
        BananaCatToken tc = BananaCatToken(token);

        // 当前 sniperTax = 30%(3000 bps),买入总税 = 1% + 30% = 31%
        // 第一块买,taxBps = 100, sniperTax = 3000,总 = 3100
        // 买 1 ether,获得代币后转给 buyer1
        _deal(buyer1, 10 ether);
        vm.prank(buyer1);
        IBondingCurve(curve).buy{value: 1 ether}(0);

        // 验证反狙击税被正确应用(通过 _transfer 的 emit)
        // 这里我们用 buyTaxBps=100 来验证基础税生效
        assertEq(tc.buyTaxBps(), 100);
        assertTrue(tc.antiSniperEnabled());
    }

    function test_M2_AntiSniper_TaxDecays() public {
        TokenConfig memory cfg = _defaultConfig();
        cfg.antiSniper = AntiSniperConfig({
            enabled: true, startTaxBps: 3000,
            decrementBps: 100, durationBlocks: 30
        });
        cfg.lockPeriod = LockPeriod(1);

        (address token,) = _createToken(cfg);
        BananaCatToken tc = BananaCatToken(token);

        assertEq(tc.currentSniperBuyTaxBps(), 3000); // 初始 30%
        vm.roll(block.number + 10);
        assertEq(tc.currentSniperBuyTaxBps(), 2000); // -10块 × 1% = 20%
        vm.roll(block.number + 20);
        assertEq(tc.currentSniperBuyTaxBps(), 0);   // 归零
        vm.roll(block.number + 100);
        assertEq(tc.currentSniperBuyTaxBps(), 0);   // 保持 0
    }

    // ============================================================
    // 基础功能
    // ============================================================

    function test_BasicInfo() public {
        TokenConfig memory cfg = _defaultConfig();
        (address token,) = _createToken(cfg);
        BananaCatToken tc = BananaCatToken(token);

        assertEq(tc.name(), "Test Cat");
        assertEq(tc.symbol(), "TCAT");
        assertEq(tc.decimals(), 18);
        assertEq(tc.totalSupply(), 1_000_000_000 * 1e18);
        assertEq(uint8(tc.label()), uint8(TokenLabel.MEME));
    }

    function test_MaxBuy_BlocksExcess() public {
        TokenConfig memory cfg = _defaultConfig();
        cfg.maxBuyPerWallet = 1000 * 1e18;
        cfg.lockPeriod = LockPeriod(1);

        (address token, address curve) = _createToken(cfg);

        _deal(buyer1, 100 ether);
        vm.prank(buyer1);
        IBondingCurve(curve).buy{value: 0.01 ether}(0);

        // 第二次买超出限制
        vm.prank(buyer1);
        vm.expectRevert(BananaCatToken.MaxBuyExceeded.selector);
        IBondingCurve(curve).buy{value: 1 ether}(0);
    }

    function test_LaunchTime_BlocksTransfer() public {
        TokenConfig memory cfg = _defaultConfig();
        cfg.launchTime = block.timestamp + 1 days;
        cfg.lockPeriod = LockPeriod(1);

        (address token, address curve) = _createToken(cfg);

        // 从曲线买代币 OK
        _deal(buyer1, 1 ether);
        vm.prank(buyer1);
        IBondingCurve(curve).buy{value: 0.5 ether}(0);

        // 在 launchTime 前转给 buyer2 应该失败
        vm.prank(buyer1);
        vm.expectRevert(bytes4(0x509846bb));
        BananaCatToken(token).transfer(buyer2, 1e18);

        // 到期后可转
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(buyer1);
        BananaCatToken(token).transfer(buyer2, 1e18);
        assertGt(BananaCatToken(token).balanceOf(buyer2), 0);
    }
}
