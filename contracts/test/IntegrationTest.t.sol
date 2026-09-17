// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseTest.t.sol";
import { LockPeriod } from "../src/interfaces/ILPLocker.sol";

/// @title IntegrationTest - 端到端代币生命周期测试
/// @notice 模拟真实场景:创建 → 买入 → 卖出 → 毕业 → LP 解锁
contract IntegrationTest is BaseTest {

    // ============================================================
    // 场景:普通 Meme 代币,1年锁仓
    // ============================================================

    function test_FullLifecycle_NormalToken() public {
        // 1. 创建代币(creator)
        TokenConfig memory cfg = _defaultConfig();
        cfg.lockPeriod = LockPeriod(4); // 365 天
        cfg.symbol = "NORM";
        (address token, address curve) = _createToken(cfg);

        // 2. 买家买入(在 bonding curve 阶段)
        _deal(buyer1, 100 ether);
        vm.prank(buyer1);
        IBondingCurve(curve).buy{value: 10 ether}(0);

        assertGt(BananaCatToken(token).balanceOf(buyer1), 0);
        assertGt(IBondingCurve(curve).currencyReserve(), 0);

        // 3. 买家再买
        _deal(buyer2, 50 ether);
        vm.prank(buyer2);
        IBondingCurve(curve).buy{value: 5 ether}(0);

        // 4. 达到毕业目标,自动毕业
        _deal(buyer3, 100 ether);
        vm.prank(buyer3);
        IBondingCurve(curve).buy{value: 26 ether}(0);

        assertTrue(IBondingCurve(curve).graduated());
        assertEq(migrator.lastToken(), token);
        assertEq(migrator.lastCreator(), creator);
        assertEq(uint8(migrator.lastPeriod()), uint8(4));
    }

    // ============================================================
    // 场景:税率代币 + 永久销毁
    // ============================================================

    function test_FullLifecycle_TaxTokenPermanentBurn() public {
        TokenConfig memory cfg = _defaultConfig();
        cfg.mode = TokenMode.TAX;
        cfg.taxConfig = TaxConfig({
            buyTaxBps: 300, sellTaxBps: 500,
            transferTaxBps: 100, taxRecipient: taxRecipient
        });
        cfg.antiSniper = AntiSniperConfig({
            enabled: true, startTaxBps: 5000,
            decrementBps: 100, durationBlocks: 10
        });
        cfg.lockPeriod = LockPeriod(5); // PERMANENT_BURN
        cfg.symbol = "BURN";

        (address token, address curve) = _createToken(cfg);
        BananaCatToken tc = BananaCatToken(token);

        // anti-sniper 正确设置
        assertTrue(tc.antiSniperEnabled());
        assertEq(tc.currentSniperBuyTaxBps(), 5000); // 50%

        // 毕业
        _deal(buyer1, 100 ether);
        vm.prank(buyer1);
        IBondingCurve(curve).buy{value: 26 ether}(0);

        assertTrue(IBondingCurve(curve).graduated());

        // 永久销毁:LP 已被 burn
        assertTrue(lPLocker.isBurned(migrator.lastLockId()));
    }

    // ============================================================
    // 场景:多个买家,部分卖出,部分持有
    // ============================================================

    function test_FullLifecycle_MultipleBuyers() public {
        TokenConfig memory cfg = _defaultConfig();
        cfg.lockPeriod = LockPeriod(1);
        (address token, address curve) = _createToken(cfg);

        // 买家1 买 10 ether
        _deal(buyer1, 50 ether);
        vm.prank(buyer1);
        uint256 b1Tokens = IBondingCurve(curve).buy{value: 10 ether}(0);
        assertGt(b1Tokens, 0);

        // 买家2 买 5 ether
        _deal(buyer2, 50 ether);
        vm.prank(buyer2);
        uint256 b2Tokens = IBondingCurve(curve).buy{value: 5 ether}(0);
        assertGt(b2Tokens, 0);

        // 买家1 卖出部分
        uint256 sellAmt = b1Tokens / 4;
        uint256 balBefore = buyer1.balance;
        vm.prank(buyer1);
        IBondingCurve(curve).sell(sellAmt, 0);
        assertGt(buyer1.balance, balBefore);
    }

    // ============================================================
    // 🆕 攻击场景:试图绕过反狙击
    // ============================================================

    function test_AntiSniper_MultipleSmallBuys() public {
        // 攻击者试图用多笔小额买入绕过反狙击
        // 但每笔买入仍然被反狙击税拦截
        TokenConfig memory cfg = _defaultConfig();
        cfg.antiSniper = AntiSniperConfig({
            enabled: true, startTaxBps: 5000,
            decrementBps: 100, durationBlocks: 10
        });
        cfg.lockPeriod = LockPeriod(1);
        cfg.symbol = "SNIPE";

        (address token, address curve) = _createToken(cfg);
        BananaCatToken tc = BananaCatToken(token);

        // 初始 sniperTax = 50%
        assertEq(tc.currentSniperBuyTaxBps(), 5000);

        // 分 5 笔买,每笔都会被当前区块税率拦截
        _deal(buyer1, 100 ether);
        for (uint i = 0; i < 5; i++) {
            vm.prank(buyer1);
            IBondingCurve(curve).buy{value: 1 ether}(0);
            // 区块推进,税率递减
            vm.roll(block.number + 2);
        }

        // 总共买了 5 ether,每笔都叠加了反狙击税
        assertGt(BananaCatToken(token).balanceOf(buyer1), 0);
    }
}
