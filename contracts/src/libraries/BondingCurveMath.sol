// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LockPeriod} from "../interfaces/ILPLocker.sol";

/// @title BondingCurveMath - 联合曲线定价数学库
/// @notice 用 constant product 公式(x * y = k)计算买卖价格
/// @dev 简化版 pump.fun 算法:
///   - 虚拟储备让前端能立刻显示一个合理的初始价格
///   - 真实储备记录已收到的平台币
///   - 价格随买入上涨、随卖出下跌
///   - 公式参考 Uniswap V2 的 getAmountOut
library BondingCurveMath {
    // ============================================================
    // 错误定义
    // ============================================================

    /// @notice 输入金额为 0
    error ZeroAmount();

    /// @notice 输出金额低于最小值(滑点超限)
    error InsufficientOutput(uint256 output, uint256 minimum);

    /// @notice 输入金额超过剩余可售代币
    error ExceedsAvailableSupply(uint256 requested, uint256 available);

    /// @notice 计算溢出
    error MathOverflow();

    // ============================================================
    // 常量(平台级默认值,可在工厂部署时覆盖)
    // ============================================================

    /// @notice 总供应量:10 亿代币
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    /// @notice 留给联合曲线出售的代币(8 亿,80%)
    uint256 public constant TOKENS_FOR_SALE = 800_000_000 * 1e18;

    /// @notice 留给迁移到 DEX 的代币(2 亿,20%)
    uint256 public constant TOKENS_FOR_LP = 200_000_000 * 1e18;

    /// @notice 曲线毕业目标:24 平台币(24 ether)
    uint256 public constant DEFAULT_GRADUATION_TARGET = 24 ether;

    /// @notice 平台手续费:基点表示,100 = 1%
    uint256 public constant DEFAULT_FEE_BPS = 100; // 1%

    /// @notice 虚拟初始平台币储备(让初始价格看起来合理,不是从 0 开始)
    uint256 public constant VIRTUAL_CURRENCY_RESERVE = 30 ether;

    // ============================================================
    // 核心定价函数(用 Uniswap V2 公式)
    // ============================================================

    /// @notice 给定平台币输入,计算能买多少代币(不含手续费)
    /// @dev 公式: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
    /// @param currencyIn 含手续费的平台币数量
    /// @param currencyReserve 当前曲线累计收到的真实平台币
    /// @param tokensAvailable 当前可售代币数量(剩余可买)
    /// @return tokensOut 能买到的代币数量
    function getBuyAmount(
        uint256 currencyIn,
        uint256 currencyReserve,
        uint256 tokensAvailable
    ) internal pure returns (uint256 tokensOut) {
        if (currencyIn == 0) revert ZeroAmount();

        // 引入虚拟储备,模拟从 VIRTUAL_CURRENCY_RESERVE 起步
        uint256 reserveIn = currencyReserve + VIRTUAL_CURRENCY_RESERVE;
        uint256 reserveOut = tokensAvailable;

        // Uniswap V2 公式
        tokensOut = (currencyIn * reserveOut) / (reserveIn + currencyIn);
    }

    /// @notice 给定平台币输入,先扣手续费再计算
    function getBuyAmountWithFee(
        uint256 currencyInWithFee,
        uint256 feeBps,
        uint256 currencyReserve,
        uint256 tokensAvailable
    ) internal pure returns (uint256 tokensOut, uint256 fee) {
        fee = (currencyInWithFee * feeBps) / 10000;
        uint256 currencyIn = currencyInWithFee - fee;
        tokensOut = getBuyAmount(currencyIn, currencyReserve, tokensAvailable);
    }

    /// @notice 给定代币输入,计算能卖多少平台币
    function getSellAmount(
        uint256 tokenIn,
        uint256 currencyReserve,
        uint256 tokensSold
    ) internal pure returns (uint256 currencyOut) {
        if (tokenIn == 0) revert ZeroAmount();

        uint256 reserveIn = currencyReserve + VIRTUAL_CURRENCY_RESERVE;
        uint256 reserveOut = tokensSold;

        currencyOut = (tokenIn * reserveIn) / (reserveOut + tokenIn);
    }

    /// @notice 给定代币输入,扣手续费后计算
    function getSellAmountWithFee(
        uint256 tokenIn,
        uint256 feeBps,
        uint256 currencyReserve,
        uint256 tokensSold
    ) internal pure returns (uint256 currencyOut, uint256 fee) {
        uint256 grossCurrencyOut = getSellAmount(tokenIn, currencyReserve, tokensSold);
        fee = (grossCurrencyOut * feeBps) / 10000;
        currencyOut = grossCurrencyOut - fee;
    }

    /// @notice 计算曲线进度(基点,0 ~ 10000)
    function progressBps(uint256 currencyReserve, uint256 graduationTarget) internal pure returns (uint256) {
        if (graduationTarget == 0) return 0;
        uint256 progress = (currencyReserve * 10000) / graduationTarget;
        return progress > 10000 ? 10000 : progress;
    }

    /// @notice 计算当前代币价格(1 个代币值多少平台币 wei)
    function getCurrentPrice(
        uint256 currencyReserve,
        uint256 tokensAvailable
    ) internal pure returns (uint256 pricePerToken) {
        uint256 reserveIn = currencyReserve + VIRTUAL_CURRENCY_RESERVE;
        uint256 reserveOut = tokensAvailable;
        if (reserveOut == 0) return 0;
        pricePerToken = (reserveIn * 1e18) / reserveOut;
    }

    // ============================================================
    // 锁仓期限 → 秒数 转换
    // ============================================================

    /// @notice 将 LockPeriod 转换为秒数
    /// @param period 锁仓期限枚举
    /// @return seconds_ 锁定的秒数(PERMANENT_BURN 返回 type(uint64).max)
    function lockPeriodToSeconds(LockPeriod period) internal pure returns (uint64 seconds_) {
        if (period == LockPeriod.ONE_DAY) return 1 days;
        if (period == LockPeriod.SEVEN_DAYS) return 7 days;
        if (period == LockPeriod.THIRTY_DAYS) return 30 days;
        if (period == LockPeriod.ONE_YEAR) return 365 days;
        if (period == LockPeriod.PERMANENT_BURN) return type(uint64).max;
        return 0; // LockPeriod.NONE
    }
}
