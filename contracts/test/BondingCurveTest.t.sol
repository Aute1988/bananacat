// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseTest.t.sol";
import { LockPeriod } from "../src/interfaces/ILPLocker.sol";

/// @title BondingCurveTest - 联合曲线测试(v2 + 安全修复验证)
contract BondingCurveTest is BaseTest {
    address public token;
    address public curve;

    function setUp() public override {
        super.setUp();
        TokenConfig memory cfg = _defaultConfig();
        cfg.lockPeriod = LockPeriod(4);
        (token, curve) = _createToken(cfg);
    }

    // ============================================================
    // 基础功能
    // ============================================================

    function test_InitialState() public view {
        IBondingCurve c = IBondingCurve(curve);
        assertEq(c.currencyReserve(), 0);
        assertEq(c.tokensSold(), 0);
        assertFalse(c.graduated());
    }

    function test_Buy_IncreasesReserves() public {
        _deal(buyer1, 10 ether);
        vm.prank(buyer1);
        uint256 tokensOut = IBondingCurve(curve).buy{value: 1 ether}(0);

        IBondingCurve c = IBondingCurve(curve);
        assertGt(tokensOut, 0);
        assertGt(c.currencyReserve(), 0);
        assertEq(c.tokensSold(), tokensOut);
    }

    function test_Buy_RejectsZeroPayment() public {
        vm.prank(buyer1);
        vm.expectRevert(abi.encodeWithSignature("InsufficientPayment()"));
        IBondingCurve(curve).buy{value: 0}(0);
    }

    function test_Sell_DecreasesReserves() public {
        _deal(buyer1, 10 ether);
        vm.prank(buyer1);
        uint256 tokensOut = IBondingCurve(curve).buy{value: 1 ether}(0);

        uint256 balBefore = buyer1.balance;
        vm.prank(buyer1);
        IBondingCurve(curve).sell(tokensOut / 2, 0);
        assertLt(IBondingCurve(curve).tokensSold(), tokensOut);
    }

    // ============================================================
    // 🆕 M-3: Transfer failure now reverts
    // ============================================================

    function test_M3_BuyFeeTransferred() public {
        uint256 revBefore = factory.platformRevenue();
        _deal(buyer1, 10 ether);

        vm.prank(buyer1);
        IBondingCurve(curve).buy{value: 1 ether}(0);

        // 🆕 v4: 手续费累积在 factory.platformRevenue,需要 feeRecipient 主动 extract
        // 这里只验证 fee 已累计,而不是直接到达 feeRecipient
        assertGt(factory.platformRevenue(), revBefore);
    }

    // ============================================================
    // 🆕 M-5: Graduate with try-catch rollback
    // ============================================================

    function test_M5_Graduated_AtTarget() public {
        _deal(buyer1, 100 ether);

        vm.prank(buyer1);
        IBondingCurve(curve).buy{value: 26 ether}(0);  // 🆕 v4: 24 ether goal + ~2 ether fee 溢出,实际需要 26+

        assertTrue(IBondingCurve(curve).graduated());
        assertEq(migrator.lastToken(), token);
        assertEq(migrator.lastCreator(), creator);
        assertEq(uint8(migrator.lastPeriod()), uint8(4));
    }

    function test_M5_PermanentBurn() public {
        TokenConfig memory cfg = _defaultConfig();
        cfg.lockPeriod = LockPeriod(5); // PERMANENT_BURN
        (address t, address c) = _createToken(cfg);

        _deal(buyer1, 100 ether);
        vm.prank(buyer1);
        IBondingCurve(c).buy{value: 26 ether}(0);  // 🆕 v4: 加 fee 后确保 real currencyReserve >= 24 ether graduation target

        // PERMANENT_BURN 锁仓后,LP 已被销毁,claimed = true
        (, , , , , , bool claimed) = lPLocker.locks(migrator.lastLockId());
        assertTrue(claimed);
    }

    // ============================================================
    // 边界条件
    // ============================================================

    function test_Buy_MinOutputSlippage() public {
        _deal(buyer1, 10 ether);

        // 设极低的 minTokenOut,应该成功
        vm.prank(buyer1);
        uint256 tokens = IBondingCurve(curve).buy{value: 1 ether}(0);
        assertGt(tokens, 0);
    }

    function test_MultipleBuyers() public {
        _deal(buyer1, 10 ether);
        _deal(buyer2, 10 ether);

        vm.prank(buyer1);
        uint256 t1 = IBondingCurve(curve).buy{value: 1 ether}(0);

        vm.prank(buyer2);
        uint256 t2 = IBondingCurve(curve).buy{value: 2 ether}(0);

        assertGt(t2, t1); // 越多买,价格越高,同等 ETH 换到的代币越少
        assertGt(IBondingCurve(curve).tokensSold(), t1);
        assertGt(IBondingCurve(curve).tokensSold(), t1 + t2 - 1);
    }
}
