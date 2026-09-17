// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    IBananaCatToken,
    TokenLabel,
    TokenMode,
    TaxConfig,
    AntiSniperConfig,
    TokenConfig,
    LockPeriod
} from "../interfaces/IBananaCatToken.sol";
import {BananaCatToken} from "./BananaCatToken.sol";
import {IBondingCurve} from "../interfaces/IBondingCurve.sol";
import {BondingCurveMath} from "../libraries/BondingCurveMath.sol";
// 🆕 v4: 用 OZ 的 Clones 库(替代手写 inline assembly)
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IMigrator} from "../interfaces/IMigrator.sol";

/// @title BananaCatFactory - 香蕉猫工厂合约(v2 - 完整 TokenConfig)
/// @notice v2 新增支持:social 链接、分类、最大买入量、税率模式
contract BananaCatFactory {
    using BondingCurveMath for LockPeriod;

    // ============================================================
    // 不可变配置
    // ============================================================

    address public immutable tokenTemplate;
    address public immutable curveTemplate;
    address public immutable lPLocker;
    address public immutable migrator;
    address public immutable feeRecipient;
    uint256 public immutable creationFee;
    uint256 public immutable graduationTarget;
    uint256 public constant FEE_BPS = 100;

    // ============================================================
    // 状态
    // ============================================================

    uint256 public platformRevenue;
    address[] public allTokens;
    mapping(address => address) public tokenCreator;
    mapping(address => address[]) public creatorTokens;
    mapping(address => LockPeriod) public tokenLockPeriod;
    mapping(address => address) public tokenCurve;

    /// @notice 完整的代币配置(前端展示用)
    mapping(address => TokenConfig) public tokenConfigs;

    // ============================================================
    // 事件
    // ============================================================

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        TokenLabel label,
        TokenMode mode,
        LockPeriod lockPeriod,
        uint256 maxBuyPerWallet,
        uint256 launchTime,
        uint256 indexed tokenIndex
    );

    event CurveGraduated(
        address indexed token,
        address indexed migrator,
        uint256 nativeContributed,
        LockPeriod lockPeriod
    );

    /// @notice 平台提取平台收入事件
    event PlatformRevenueWithdrawn(address indexed to, uint256 amount);

    // ============================================================
    // 错误
    // ============================================================

    error InsufficientFee(uint256 required, uint256 sent);
    error InvalidLockPeriod();
    error EmptyString();
    error ZeroAddress();
    error RefundFailed();
    error StringTooLong(uint256 length, uint256 max);
    error ZeroAmount();

    // ============================================================
    // 初始化
    // ============================================================

    constructor(
        address _tokenTemplate,
        address _curveTemplate,
        address _lPLocker,
        address _migrator,
        address _feeRecipient,
        uint256 _creationFee,
        uint256 _graduationTarget
    ) {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        tokenTemplate = _tokenTemplate;
        curveTemplate = _curveTemplate;
        lPLocker = _lPLocker;
        migrator = _migrator;
        feeRecipient = _feeRecipient;
        creationFee = _creationFee;
        graduationTarget = _graduationTarget;
    }

    // ============================================================
    // 核心:创建代币(完整配置)
    // ============================================================

    /// @notice 创建新 Meme 代币(v2 完整配置版)
    /// @param config TokenConfig - 完整配置
    function createToken(TokenConfig calldata config) external payable returns (address token, address curve) {
        // 验证费用
        if (msg.value < creationFee) revert InsufficientFee(creationFee, msg.value);

        // 验证基础字段
        if (bytes(config.name).length == 0 || bytes(config.symbol).length == 0) revert EmptyString();
        if (uint8(config.lockPeriod) > 5) revert InvalidLockPeriod();
        if (bytes(config.name).length > 50) revert StringTooLong(bytes(config.name).length, 50);
        if (bytes(config.symbol).length > 10) revert StringTooLong(bytes(config.symbol).length, 10);
        // 🆕 v4 修复:限制 description/social urls 长度,避免合约 size 超 24KB
        if (bytes(config.description).length > 1000) revert StringTooLong(bytes(config.description).length, 1000);
        if (bytes(config.imageUrl).length > 500) revert StringTooLong(bytes(config.imageUrl).length, 500);
        if (bytes(config.websiteUrl).length > 200) revert StringTooLong(bytes(config.websiteUrl).length, 200);
        if (bytes(config.twitterUrl).length > 200) revert StringTooLong(bytes(config.twitterUrl).length, 200);
        if (bytes(config.telegramUrl).length > 200) revert StringTooLong(bytes(config.telegramUrl).length, 200);

        // 退款多余费用
        uint256 refund = msg.value - creationFee;
        if (refund > 0) {
            // 🆕 修复 H-1: 之前用 (void) ok 静默吞错,如果 refund 失败用户多付钱合约不报
            (bool ok,) = payable(msg.sender).call{value: refund}("");
            if (!ok) revert RefundFailed();
        }
        platformRevenue += creationFee;

        // 克隆部署
        token = Clones.clone(tokenTemplate);
        curve = Clones.clone(curveTemplate);

        // 保存映射
        tokenCreator[token] = msg.sender;
        tokenCurve[token] = curve;
        tokenLockPeriod[token] = config.lockPeriod;
        tokenConfigs[token] = config; // 保存完整配置
        allTokens.push(token);
        creatorTokens[msg.sender].push(token);

        // 初始化代币(完整 13 个参数 + 反狙击)
        BananaCatToken(token).initialize(
            config.name,
            config.symbol,
            config.description,
            config.imageUrl,
            config.websiteUrl,
            config.twitterUrl,
            config.telegramUrl,
            config.label,
            config.mode,
            config.taxConfig,
            config.maxBuyPerWallet,
            config.launchTime,
            curve,
            BondingCurveMath.TOTAL_SUPPLY,
            config.antiSniper
        );

        // 初始化曲线
        IBondingCurve(curve).initialize(
            token,
            address(this),
            graduationTarget,
            FEE_BPS
        );

        emit TokenCreated(
            token,
            msg.sender,
            config.name,
            config.symbol,
            config.label,
            config.mode,
            config.lockPeriod,
            config.maxBuyPerWallet,
            config.launchTime,
            allTokens.length - 1
        );

        return (token, curve);
    }

    // ============================================================
    // 毕业回调
    // ============================================================

    function onGraduated(
        address token,
        address bondingCurve,
        uint256 currencyReserve
    ) external {
        require(msg.sender == bondingCurve, "NOT_CURVE");
        require(tokenCurve[token] == bondingCurve, "WRONG_CURVE");

        LockPeriod lockPeriod = tokenLockPeriod[token];

        IMigrator(migrator).graduate(
            token,
            bondingCurve,
            tokenCreator[token],
            lockPeriod,
            currencyReserve
        );

        emit CurveGraduated(token, migrator, currencyReserve, lockPeriod);
    }

    // ============================================================
    // 视图
    // ============================================================

    function totalTokens() external view returns (uint256) {
        return allTokens.length;
    }

    function getCreatorTokens(address creator) external view returns (address[] memory) {
        return creatorTokens[creator];
    }

    function getTokenInfo(address token) external view returns (
        address creator,
        LockPeriod lockPeriod,
        uint256 totalSupply_
    ) {
        creator = tokenCreator[token];
        lockPeriod = tokenLockPeriod[token];
        totalSupply_ = BananaCatToken(token).totalSupply();
    }

    /// @notice 获取完整配置
    function getTokenConfig(address token) external view returns (TokenConfig memory) {
        return tokenConfigs[token];
    }

    // ============================================================
    // 平台管理
    // ============================================================

    /**
     * @notice 接收平台手续费(BondingCurve.buy/sell 会调用 factory.call{value: fee})
     * @dev 🆕 v4 修复: 之前没有 receive/fallback,所有 buy/sell 都会 revert TransferFailed
     */
    receive() external payable {
        platformRevenue += msg.value;
    }

    /**
     * @notice 提取平台累积的收入(只有 feeRecipient 可以调用)
     * @dev 🆕 v4 修复: 之前 platformRevenue 只能增不能减,资金永远锁死
     */
    function withdrawPlatformRevenue(uint256 amount) external {
        if (msg.sender != feeRecipient) revert ZeroAddress();
        if (amount == 0 || amount > platformRevenue) revert ZeroAmount();
        platformRevenue -= amount;
        (bool ok,) = payable(feeRecipient).call{value: amount}("");
        if (!ok) revert RefundFailed();
        emit PlatformRevenueWithdrawn(feeRecipient, amount);
    }

    /**
     * @notice 提取平台累积的全部收入(只有 feeRecipient 可以调用)
     */
    function withdrawAllPlatformRevenue() external {
        uint256 amount = platformRevenue;
        if (amount == 0) revert ZeroAmount();
        if (msg.sender != feeRecipient) revert ZeroAddress();
        platformRevenue = 0;
        (bool ok,) = payable(feeRecipient).call{value: amount}("");
        if (!ok) revert RefundFailed();
        emit PlatformRevenueWithdrawn(feeRecipient, amount);
    }
}
