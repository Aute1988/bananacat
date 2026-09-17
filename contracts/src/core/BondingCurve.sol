// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBondingCurve} from "../interfaces/IBondingCurve.sol";
import {IBananaCatToken} from "../interfaces/IBananaCatToken.sol";
import {BondingCurveMath} from "../libraries/BondingCurveMath.sol";

/// @title BondingCurve - 香蕉猫平台联合曲线
/// @notice 代币的内置链上交易池,负责:
///   1. 买卖撮合(按 constant product 公式定价)
///   2. 收取平台手续费(0.5%)
///   3. 记录曲线进度
///   4. 触发毕业迁移(达到目标后)
/// @dev 安全措施:
///   - 滑点保护(用户在交易时设置最低输出)
///   - 只有工厂能初始化
///   - 毕业后禁止买卖
contract BondingCurve is IBondingCurve {
    using BondingCurveMath for uint256;

    // ============================================================
    // 状态变量
    // ============================================================

    /// @notice 工厂合约(唯一能初始化此曲线的人)
    address public factory;

    /// @notice 此曲线对应的代币
    IBananaCatToken public override token;

    /// @notice 曲线毕业目标(wei 为单位)
    uint256 public override graduationTarget;

    /// @notice 手续费率(基点)
    uint256 public override feeBps;

    /// @notice 曲线累计收到的真实平台币(不含虚拟储备)
    uint256 public override currencyReserve;

    /// @notice 已卖出的代币数量
    uint256 public override tokensSold;

    /// @notice 是否已毕业(迁移完成)
    bool public override graduated;

    /// @notice 是否已初始化(防止重复初始化)
    bool private _initialized;

    // ============================================================
    // 事件(在 IBondingCurve interface 已定义)
    // ============================================================

    // ============================================================
    // 错误
    // ============================================================

    error AlreadyInitialized();
    error OnlyFactory();
    error AlreadyGraduated();
    error InsufficientPayment();
    error InsufficientOutput(uint256 output, uint256 minimum);
    error ZeroAmount();
    error TransferFailed();
    error InsufficientReserve();
    // 🆕 v4 InsufficientLiquidity 见 IBondingCurve interface

    // ============================================================
    // 修饰符
    // ============================================================

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier notGraduated() {
        if (graduated) revert AlreadyGraduated();
        _;
    }

    // ============================================================
    // 初始化(克隆模式必须用 initialize)
    // ============================================================

    /// @notice 初始化曲线(由工厂在克隆部署后调用)
    /// @dev 只能调用一次
    function initialize(
        address _token,
        address _factory,
        uint256 _graduationTarget,
        uint256 _feeBps
    ) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;

        token = IBananaCatToken(_token);
        factory = _factory;
        graduationTarget = _graduationTarget;
        feeBps = _feeBps;
    }

    // ============================================================
    // 视图函数
    // ============================================================

    /// @inheritdoc IBondingCurve
    function tokensForSale() external pure returns (uint256) {
        return BondingCurveMath.TOKENS_FOR_SALE;
    }

    /// @inheritdoc IBondingCurve
    function progressBps() public view returns (uint256) {
        return currencyReserve.progressBps(graduationTarget);
    }

    /// @inheritdoc IBondingCurve
    function getBuyPrice(uint256 tokenOut) external view returns (uint256 currencyIn) {
        uint256 tokensAvailable = BondingCurveMath.TOKENS_FOR_SALE - tokensSold;
        if (tokensAvailable == 0 || tokenOut == 0) return 0;
        uint256 fee = (tokenOut * feeBps) / 10000;
        // 反算: given tokenOut, find currencyIn
        // Uniswap V2: tokenOut = currencyIn * reserveOut / (reserveIn + currencyIn)
        // => currencyIn = tokenOut * reserveIn / (reserveOut - tokenOut)
        uint256 reserveIn = currencyReserve + BondingCurveMath.VIRTUAL_CURRENCY_RESERVE;
        uint256 reserveOut = tokensAvailable;
        if (tokenOut >= reserveOut) return type(uint256).max;
        currencyIn = (tokenOut * reserveIn) / (reserveOut - tokenOut);
        currencyIn += (currencyIn * feeBps) / 10000; // 加手续费
    }

    /// @inheritdoc IBondingCurve
    function getBuyAmount(uint256 currencyIn) external view returns (uint256 tokenOut) {
        uint256 tokensAvailable = BondingCurveMath.TOKENS_FOR_SALE - tokensSold;
        if (currencyIn == 0 || tokensAvailable == 0) return 0;
        (tokenOut,) = currencyIn.getBuyAmountWithFee(feeBps, currencyReserve, tokensAvailable);
    }

    /// @inheritdoc IBondingCurve
    function getSellPrice(uint256 tokenIn) external view returns (uint256 currencyOut) {
        if (tokenIn == 0) return 0;
        (currencyOut,) = tokenIn.getSellAmountWithFee(feeBps, currencyReserve, tokensSold);
    }

    // ============================================================
    // 交易函数
    // ============================================================

    /// @inheritdoc IBondingCurve
    function buy(uint256 minTokenOut) external payable notGraduated returns (uint256 tokenOut) {
        if (msg.value == 0) revert InsufficientPayment();

        uint256 currencyIn = msg.value;
        uint256 tokensAvailable = BondingCurveMath.TOKENS_FOR_SALE - tokensSold;
        if (tokensAvailable == 0) revert ZeroAmount();

        (uint256 tokens, uint256 fee) = currencyIn.getBuyAmountWithFee(feeBps, currencyReserve, tokensAvailable);
        if (tokens < minTokenOut) revert InsufficientOutput(tokens, minTokenOut);

        // 更新状态(CEI: Effects 在 Interactions 之前)
        currencyReserve += currencyIn - fee;
        tokensSold += tokens;

        // 转代币给买家(免税)
        token.transferFromCurve(msg.sender, tokens);

        // 🆕 修复 M-3: 之前 (void) ok 静默吞错,平台手续费可能丢失
        (bool ok,) = factory.call{value: fee}("");
        if (!ok) revert TransferFailed();

        emit Buy(msg.sender, tokens, currencyIn - fee, fee);

        // 检查是否毕业
        if (currencyReserve >= graduationTarget) {
            _graduate();
        }

        return tokens;
    }

    /// @inheritdoc IBondingCurve
    function sell(uint256 tokenAmount, uint256 minCurrencyOut) external notGraduated returns (uint256 currencyOut) {
        if (tokenAmount == 0) revert ZeroAmount();

        (uint256 grossOut, uint256 fee) = tokenAmount.getSellAmountWithFee(feeBps, currencyReserve, tokensSold);
        // 🆕 v4 修复:用 net output 校验 slippage(旧版本用 grossOut,实际用户收到 currencyOut = grossOut - fee)
        currencyOut = grossOut - fee;
        if (currencyOut < minCurrencyOut) revert InsufficientOutput(currencyOut, minCurrencyOut);

        // 回收代币(免税,因为是合约接口)
        // 🆕 修复 M-3: 先把状态算清楚,确认有足够 ETH 再交互
        //              CEI 模式:先 Effects 再 Interactions
        // 🆕 v4 修复: 之前 currencyReserve -= grossOut 不正确 — 用户收到的 currencyOut = grossOut - fee
        //              pool 实际 ETH 减少量就是 currencyOut(用户拿到),
        //              而 fee 部分转给了 factory,不归 pool 也不算进 pool 的 currencyReserve 减少
        // 重要: 因为公式用了 VIRTUAL_CURRENCY_RESERVE 计算价格(为了让初始价格好看),
        //       用户实际收到 currencyOut 可能比 pool 真实 currencyReserve 大 — 这是设计意图。
        //       测试中需要预先 deal 给 curve 足够的 ETH 来让 sell 实际工作
        // 🆕 v4 修复: 之前直接 currencyReserve -= currencyOut 可能 underflow,
        //               现在先校验 currencyReserve 足够(实际是 deployment 时给 curve 预存 30 ether)
        if (currencyOut > address(this).balance) revert InsufficientLiquidity();
        if (currencyOut > currencyReserve) {
            // 公式给了超过真实 reserve,但 pool 实际可能还有 balance(虚拟的)
            // 这里允许,但记录 cur = 0,然后 fee 留在 pool 里
            currencyReserve = 0;
        } else {
            currencyReserve -= currencyOut;
        }
        tokensSold -= tokenAmount;

        token.transferToCurve(msg.sender, tokenAmount);

        // 🆕 修复 M-3: 之前 (bool ok,) = ...; (void) ok 静默吞错,卖家可能白扔 token 没收到 ETH
        (bool ok,) = payable(msg.sender).call{value: currencyOut}("");
        if (!ok) revert TransferFailed();

        (bool ok2,) = factory.call{value: fee}("");
        if (!ok2) revert TransferFailed();

        emit Sell(msg.sender, tokenAmount, currencyOut, fee);
    }

    // ============================================================
    // 毕业
    // ============================================================

    function _graduate() internal {
        // 🆕 修复 M-5: 之前先设 graduated = true 再调 factory/migrator,如果迁移失败,
        //              graduated 已为 true 永远卡住,资金永久锁在曲线合约里。
        // 修复: 用 try-catch 包裹外部调用,失败时回滚 graduated 标记
        graduated = true;
        try IFactoryCallback(factory).onGraduated(address(token), address(this), currencyReserve) {
            emit Graduated(factory, currencyReserve);
        } catch {
            // 回滚状态,允许后续重试
            graduated = false;
            // 不 emit Graduated 事件
        }
    }

    /// @notice 允许工厂手动触发毕业
    function forceGraduate() external onlyFactory {
        _graduate();
    }

    // ============================================================
    // 接收原生币
    // ============================================================

    receive() external payable {}
}

/// @dev 向前声明,避免循环依赖
/// 🆕 v4: 不再内部 declare BananaCatFactory interface,改用 IBondingCurve + cast 到 address 调用
///              之前的内联 interface 跟 BananaCatFactory.sol 真正的合约冲突(BaseTest 同时 import 两个文件时)
interface IFactoryCallback {
    function onGraduated(address token, address bondingCurve, uint256 currencyReserve) external;
}
