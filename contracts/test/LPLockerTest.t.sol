// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BaseTest.t.sol";
import { LockPeriod } from "../src/interfaces/ILPLocker.sol";

/// @title LPLockerTest - 锁仓合约测试(v2 + 安全修复验证)
contract LPLockerTest is BaseTest {

    address internal constant TOKEN_ORIGINAL = address(0xCA7);

    // ============================================================
    // 基础锁仓
    // ============================================================

    function test_Lock_7Days() public {
        (bytes32 lockId, address lpToken) = _lockLPForTest(TOKEN_ORIGINAL, 1 ether, LockPeriod.SEVEN_DAYS);

        (address t, , address c, uint256 amt, LockPeriod p, uint64 unlockTs, bool claimed) = lPLocker.locks(lockId);
        assertEq(t, lpToken);
        assertEq(c, creator);
        assertEq(amt, 1 ether);
        assertEq(uint8(p), uint8(LockPeriod.SEVEN_DAYS));
        assertApproxEqAbs(unlockTs, block.timestamp + 7 days, 1);
        assertFalse(claimed);
    }

    function test_Lock_1Year() public {
        (bytes32 lockId, ) = _lockLPForTest(TOKEN_ORIGINAL, 5 ether, LockPeriod.ONE_YEAR);

        (, , , , , uint64 unlockTs, bool claimed) = lPLocker.locks(lockId);
        assertFalse(claimed);
        assertGt(unlockTs, block.timestamp + 364 days);
    }

    // ============================================================
    // 🆕 H-2: PERMANENT_BURN 正确销毁
    // ============================================================

    function test_H2_PermanentBurn_ImmediatelyBurned() public {
        (bytes32 lockId, ) = _lockLPForTest(TOKEN_ORIGINAL, 2 ether, LockPeriod.PERMANENT_BURN);

        // 永久销毁后 claimed = true, LP 已从合约转出
        (, , , , , uint64 unlockTs, bool claimed) = lPLocker.locks(lockId);
        assertTrue(claimed);
        assertEq(unlockTs, 0);

        // isBurned 应为 true
        assertTrue(lPLocker.isBurned(lockId));

        // 再次尝试 claim 应该 revert — claimLP 先检查 period == PERMANENT_BURN 所以是 PermanentBurn 不是 AlreadyClaimed
        vm.prank(creator);
        vm.expectRevert(LPLocker.PermanentBurn.selector);
        lPLocker.claimLP(lockId);
    }

    // ============================================================
    // 🆕 H-2: claimLP 在 PERMANENT_BURN 时 revert
    // ============================================================

    function test_H2_ClaimRevertsOnPermanentBurn() public {
        (bytes32 lockId, ) = _lockLPForTest(TOKEN_ORIGINAL, 1 ether, LockPeriod.PERMANENT_BURN);

        vm.prank(creator);
        vm.expectRevert(LPLocker.PermanentBurn.selector);
        lPLocker.claimLP(lockId);
    }

    // ============================================================
    // claim / extend / burn(到期后)
    // ============================================================

    function test_Claim_AfterUnlock() public {
        (bytes32 lockId, ) = _lockLPForTest(TOKEN_ORIGINAL, 1 ether, LockPeriod.SEVEN_DAYS);

        // 前进 8 天
        vm.warp(block.timestamp + 8 days);

        vm.prank(creator);
        lPLocker.claimLP(lockId);

        (, , , , , , bool claimed) = lPLocker.locks(lockId);
        assertTrue(claimed);
    }

    function test_Extend_AfterUnlock() public {
        (bytes32 lockId, ) = _lockLPForTest(TOKEN_ORIGINAL, 1 ether, LockPeriod.SEVEN_DAYS);

        vm.warp(block.timestamp + 8 days);

        vm.prank(creator);
        bytes32 newLockId = lPLocker.extendLock(lockId, LockPeriod.ONE_YEAR);

        // 新锁仓生效
        (, , , , , uint64 unlockTs, bool newClaimed) = lPLocker.locks(newLockId);
        assertFalse(newClaimed);
        assertGt(unlockTs, block.timestamp + 364 days);

        // 旧锁仓标记 claimed
        (, , , , , , bool oldClaimed) = lPLocker.locks(lockId);
        assertTrue(oldClaimed);
    }

    function test_BurnByCreator_Anytime() public {
        (bytes32 lockId, ) = _lockLPForTest(TOKEN_ORIGINAL, 1 ether, LockPeriod.SEVEN_DAYS);

        // 还没到期,creator 可以主动销毁
        vm.prank(creator);
        lPLocker.burnLPByCreator(lockId);

        assertTrue(lPLocker.isBurned(lockId));
    }

    // ============================================================
    // 权限控制
    // ============================================================

    function test_Claim_OnlyCreator() public {
        (bytes32 lockId, ) = _lockLPForTest(TOKEN_ORIGINAL, 1 ether, LockPeriod.SEVEN_DAYS);

        vm.warp(block.timestamp + 8 days);

        // 非 creator 不能 claim
        vm.prank(buyer1);
        vm.expectRevert(LPLocker.NotCreator.selector);
        lPLocker.claimLP(lockId);
    }

    function test_Claim_BeforeUnlock() public {
        (bytes32 lockId, ) = _lockLPForTest(TOKEN_ORIGINAL, 1 ether, LockPeriod.SEVEN_DAYS);

        // 还没到期
        vm.prank(creator);
        vm.expectRevert(LPLocker.NotUnlocked.selector);
        lPLocker.claimLP(lockId);
    }

    function test_Extend_OnlyCreator() public {
        (bytes32 lockId, ) = _lockLPForTest(TOKEN_ORIGINAL, 1 ether, LockPeriod.SEVEN_DAYS);

        vm.warp(block.timestamp + 8 days);

        vm.prank(buyer1);
        vm.expectRevert(LPLocker.NotCreator.selector);
        lPLocker.extendLock(lockId, LockPeriod.ONE_YEAR);
    }

    function test_Extend_PermanentBurnReverts() public {
        (bytes32 lockId, ) = _lockLPForTest(TOKEN_ORIGINAL, 1 ether, LockPeriod.PERMANENT_BURN);

        vm.warp(block.timestamp + 8 days);

        vm.prank(creator);
        vm.expectRevert(LPLocker.PermanentBurn.selector);
        lPLocker.extendLock(lockId, LockPeriod.ONE_YEAR);
    }
}
