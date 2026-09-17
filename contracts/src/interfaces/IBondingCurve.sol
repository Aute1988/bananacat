// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IBananaCatToken.sol";

/// @title IBondingCurve - 联合曲线接口
/// @notice 负责代币的链上定价、买卖撮合
/// @dev 每个代币部署一个独立的曲线池,曲线满后调用 Migrator 迁移到 DEX
interface IBondingCurve {
    // ============================================================
    // 事件
    // ============================================================

    /// @notice 有人买入
    /// @param buyer 买家
    /// @param tokenOut 买家收到的代币数量
    /// @param currencyIn 买家花掉的平台币数量(扣除手续费后)
    /// @param fee 平台手续费
    event Buy(address indexed buyer, uint256 tokenOut, uint256 currencyIn, uint256 fee);

    /// @notice 有人卖出
    /// @param seller 卖家
    /// @param tokenIn 卖家卖出的代币数量
    /// @param currencyOut 卖家收到的平台币数量(扣除手续费后)
    /// @param fee 平台手续费
    event Sell(address indexed seller, uint256 tokenIn, uint256 currencyOut, uint256 fee);

    /// @notice 曲线已满,触发迁移到 DEX
    event Graduated(address indexed migrator, uint256 liquidityAdded);

    // ============================================================
    // 视图函数(给前端展示用)
    // ============================================================

    /// @notice 当前曲线累计收到的平台币数量(单位:wei)
    function currencyReserve() external view returns (uint256);

    /// @notice 当前曲线已卖出的代币数量
    function tokensSold() external view returns (uint256);

    /// @notice 曲线总供应量(固定 10 亿 - 留给迁移 DEX 的部分)
    function tokensForSale() external view returns (uint256);

    /// @notice 曲线达到 100% 时的目标金额(单位:wei,默认 24 ether)
    function graduationTarget() external view returns (uint256);

    /// @notice 曲线进度(0 ~ 10000,基点表示,前端除以 100 显示百分比)
    function progressBps() external view returns (uint256);

    /// @notice 是否已毕业(曲线已满,迁移完成)
    function graduated() external view returns (bool);

    /// @notice 此曲线对应的代币地址
    function token() external view returns (IBananaCatToken);

    /// @notice 平台手续费率(基点,100 = 1%)
    function feeBps() external view returns (uint256);

    // ============================================================
    // 交易函数
    // ============================================================

    /// @notice 买入代币
    /// @param minTokenOut 滑点保护:最少收到这么多代币
    /// @return tokenOut 实际收到的代币数量
    function buy(uint256 minTokenOut) external payable returns (uint256 tokenOut);

    /// @notice 卖出代币
    /// @param tokenAmount 要卖出的代币数量
    /// @param minCurrencyOut 滑点保护:最少收到这么多平台币
    /// @return currencyOut 实际收到的平台币数量
    function sell(uint256 tokenAmount, uint256 minCurrencyOut) external returns (uint256 currencyOut);

    /// @notice 用固定代币数量计算需要花多少钱(给前端预估用)
    /// @param tokenOut 想买的代币数量
    /// @return currencyIn 含手续费的平台币数量
    function getBuyPrice(uint256 tokenOut) external view returns (uint256 currencyIn);

    /// @notice 用固定平台币数量计算能买多少代币(给前端预估用)
    /// @param currencyIn 想花的平台币数量(含手续费)
    /// @return tokenOut 能买到的代币数量
    function getBuyAmount(uint256 currencyIn) external view returns (uint256 tokenOut);

    /// @notice 用固定代币数量计算能卖多少钱(给前端预估用)
    /// @param tokenIn 想卖的代币数量
    /// @return currencyOut 含手续费的平台币数量
    function getSellPrice(uint256 tokenIn) external view returns (uint256 currencyOut);

    /// @notice 初始化曲线(只能调用一次,由工厂部署后调用)
    function initialize(
        address _token,
        address _factory,
        uint256 _graduationTarget,
        uint256 _feeBps
    ) external;

    // 🆕 v4 错误事件
    // ============================================================
    error InsufficientLiquidity();
}
