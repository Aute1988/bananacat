// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title 锁仓期限(用在发币时指定,以及 LP 解锁时使用)
/// @notice Factory 和 Locker 都用到这个 enum,所以放共享接口里
enum LockPeriod {
    NONE,
    ONE_DAY,
    SEVEN_DAYS,
    THIRTY_DAYS,
    ONE_YEAR,
    PERMANENT_BURN
}

/// @title 代币分类(参考 four.meme)
/// @notice 发币者必须选一个分类,便于前端筛选
enum TokenLabel {
    MEME,
    AI,
    DEFI,
    GAMES,
    INFRA,
    DE_SCI,    // Decentralized Science
    SOCIAL,
    DEPIN,     // Decentralized Physical Infrastructure
    CHARITY,
    OTHERS
}

/// @title 税率模式
enum TokenMode {
    /// @notice 普通模式 - 无任何税率(适合纯 Meme)
    NORMAL,
    /// @notice 税率模式 - 买入/卖出/转账各设一个税率
    TAX
}

/// @title 税率配置(只在 TokenMode.TAX 时使用)
/// @dev 限制(参考 four.meme):
///   - buyTaxBps + sellTaxBps + transferTaxBps 总和 ≤ 3000 (30%)
///   - buyTaxBps / sellTaxBps / transferTaxBps 各自 ≤ 1000 (10%)
struct TaxConfig {
    uint16 buyTaxBps;       // 买入税率(基点,100 = 1%)
    uint16 sellTaxBps;      // 卖出税率
    uint16 transferTaxBps;  // 转账税率
    address taxRecipient;   // 税率接收地址(创作者)
}

/// @title 发币配置(用户在创建时填写)
struct TokenConfig {
    string name;
    string symbol;
    string description;       // 代币描述
    string imageUrl;          // Logo URL
    string websiteUrl;        // 官网(可选)
    string twitterUrl;        // X / Twitter(可选)
    string telegramUrl;       // Telegram(可选)
    TokenLabel label;         // 分类
    TokenMode mode;           // 税率模式
    TaxConfig taxConfig;      // 税率配置(mode = TAX 时必填)
    uint256 maxBuyPerWallet;  // 单地址最大买入(0 = 不限)
    uint256 launchTime;       // 发币时间(unix timestamp,0 = 立即)
    LockPeriod lockPeriod;    // LP 锁仓期限(见 LockPeriod enum)

    /// @notice 🆕 反狙击配置
    AntiSniperConfig antiSniper;  // 是否启用反狙击模式
}

/// @title 反狙击(Anti-Sniper)配置
/// @notice 发币者可选启用,前 30 个区块对买入收取递增的额外税
/// @dev 机制:
///   - 区块 1: 30% 买入税(吓阻机器人)
///   - 区块 2: 29%
///   - 区块 3: 28%
///   - ...
///   - 区块 30 及之后: 0%
/// @dev 30 个区块约等于 1 分钟(BSC ~3 秒/区块),对真人无感
struct AntiSniperConfig {
    bool enabled;
    uint16 startTaxBps;     // 起始税(基点),如 3000 = 30%
    uint16 decrementBps;    // 每区块递减,如 100 = 1%
    uint16 durationBlocks;  // 持续区块数,如 30
}

/// @title IBananaCatToken - 香蕉猫平台代币的最小接口
interface IBananaCatToken {
    // 标准 ERC-20
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);

    // 香蕉猫扩展
    function factory() external view returns (address);
    function bondingCurve() external view returns (address);

    // 元数据(前端展示用)
    function description() external view returns (string memory);
    function imageUrl() external view returns (string memory);
    function websiteUrl() external view returns (string memory);
    function twitterUrl() external view returns (string memory);
    function telegramUrl() external view returns (string memory);
    function label() external view returns (TokenLabel);
    function mode() external view returns (TokenMode);
    function maxBuyPerWallet() external view returns (uint256);
    function launchTime() external view returns (uint256);

    // 🆕 v4: BondingCurve 调用接口(免税)
    function transferFromCurve(address to, uint256 amount) external;
    function transferToCurve(address from, uint256 amount) external;
}
