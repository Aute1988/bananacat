// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    IBananaCatToken,
    TokenLabel,
    TokenMode,
    TaxConfig,
    AntiSniperConfig
} from "../interfaces/IBananaCatToken.sol";

/// @title BananaCatToken - 香蕉猫平台 Meme 代币实现(v2 - 支持税率 + social)
/// @notice 极简 ERC-20,用克隆模式部署
/// @dev v2 新增:
///   - 税率模式:买/卖/转 三种税独立设置
///   - Social 链接:网站/Twitter/Telegram
///   - 分类:10 种 TokenLabel
///   - 最大买入限制:可选
///   - 延迟开盘:launchTime
contract BananaCatToken is IBananaCatToken {
    // ============================================================
    // 状态变量
    // ============================================================

    address public override factory;
    address public override bondingCurve;

    string public override name;
    string public override symbol;
    uint8 public constant override decimals = 18;
    uint256 public override totalSupply;

    // 🆕 v2 元数据
    string public override description;
    string public override imageUrl;
    string public override websiteUrl;
    string public override twitterUrl;
    string public override telegramUrl;
    TokenLabel public override label;
    TokenMode public override mode;
    uint256 public override maxBuyPerWallet;
    uint256 public override launchTime;

    // 税率(只在 mode = TAX 时启用)
    uint16 public buyTaxBps;
    uint16 public sellTaxBps;
    uint16 public transferTaxBps;
    address public taxRecipient;

    // 🆕 反狙击状态
    bool public antiSniperEnabled;
    uint16 public antiSniperStartBps;     // 起始税
    uint16 public antiSniperDecrementBps;  // 每区块递减
    uint16 public antiSniperDurationBlocks;
    uint64 public startBlock;             // 代币初始化时的区块号

    bool private _initialized;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // ============================================================
    // 事件
    // ============================================================

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    /// @notice 税率征收事件
    event TaxCollected(
        address indexed from,
        address indexed to,
        uint256 taxAmount,
        uint8 taxType  // 0=buy, 1=sell, 2=transfer
    );

    // ============================================================
    // 错误
    // ============================================================

    error ZeroAddress();
    error InsufficientBalance(uint256 available, uint256 requested);
    error InsufficientAllowance(uint256 available, uint256 requested);
    error AlreadyInitialized();
    error OnlyBondingCurve();
    error MaxBuyExceeded(uint256 requested, uint256 maxAllowed);
    error NotStartedYet(uint256 launchTime, uint256 currentTime);
    error InvalidTaxRate();
    error InvalidAntiSniper();

    // ============================================================
    // 初始化(克隆模式)
    // ============================================================

    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _description,
        string memory _imageUrl,
        string memory _websiteUrl,
        string memory _twitterUrl,
        string memory _telegramUrl,
        TokenLabel _label,
        TokenMode _mode,
        TaxConfig memory _taxConfig,
        uint256 _maxBuyPerWallet,
        uint256 _launchTime,
        address _bondingCurve,
        uint256 _totalSupply,
        AntiSniperConfig memory _antiSniper
    ) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;

        // 基本信息
        factory = msg.sender;
        bondingCurve = _bondingCurve;
        name = _name;
        symbol = _symbol;
        description = _description;
        imageUrl = _imageUrl;
        websiteUrl = _websiteUrl;
        twitterUrl = _twitterUrl;
        telegramUrl = _telegramUrl;
        label = _label;
        mode = _mode;
        maxBuyPerWallet = _maxBuyPerWallet;
        launchTime = _launchTime;
        totalSupply = _totalSupply;
        startBlock = uint64(block.number);

        // 税率(只在 TAX 模式)
        if (_mode == TokenMode.TAX) {
            if (_taxConfig.buyTaxBps + _taxConfig.sellTaxBps + _taxConfig.transferTaxBps > 3000) {
                revert InvalidTaxRate();
            }
            if (_taxConfig.buyTaxBps > 1000
                || _taxConfig.sellTaxBps > 1000
                || _taxConfig.transferTaxBps > 1000) {
                revert InvalidTaxRate();
            }
            buyTaxBps = _taxConfig.buyTaxBps;
            sellTaxBps = _taxConfig.sellTaxBps;
            transferTaxBps = _taxConfig.transferTaxBps;
            taxRecipient = _taxConfig.taxRecipient == address(0)
                ? msg.sender
                : _taxConfig.taxRecipient;
        }

        // 🆕 反狙击配置
        if (_antiSniper.enabled) {
            if (_antiSniper.startTaxBps == 0 || _antiSniper.startTaxBps > 5000) revert InvalidAntiSniper(); // 起始必须在 (0, 50%]
            if (_antiSniper.decrementBps == 0) revert InvalidAntiSniper();
            if (_antiSniper.durationBlocks == 0 || _antiSniper.durationBlocks > 300) revert InvalidAntiSniper();
            antiSniperEnabled = true;
            antiSniperStartBps = _antiSniper.startTaxBps;
            antiSniperDecrementBps = _antiSniper.decrementBps;
            antiSniperDurationBlocks = _antiSniper.durationBlocks;
        }

        // 把全部代币存到联合曲线合约
        _balances[_bondingCurve] = _totalSupply;
        emit Transfer(address(0), _bondingCurve, _totalSupply);
    }

    // ============================================================
    // 🆕 反狙击:获取当前区块买入的额外税
    // ============================================================

    /// @notice 当前区块买入应收取的反狙击税(基点)
    /// @dev 公式: tax = max(0, startTax - (currentBlock - startBlock) * decrement)
    /// @return 当前应加的买入税(基点)。如果已结束返回 0。
    function currentSniperBuyTaxBps() public view returns (uint16) {
        if (!antiSniperEnabled) return 0;
        if (block.number <= startBlock) return antiSniperStartBps;

        uint64 blocksPassed = uint64(block.number) - startBlock;
        if (blocksPassed >= antiSniperDurationBlocks) return 0;

        uint256 current = uint256(antiSniperStartBps)
            - uint256(blocksPassed) * uint256(antiSniperDecrementBps);
        return current > type(uint16).max ? 0 : uint16(current);
    }

    /// @notice 获取反狙击信息(给前端展示)
    function getAntiSniperInfo() external view returns (
        bool enabled,
        uint16 currentTaxBps,
        uint16 startTaxBps,
        uint16 decrementBps,
        uint16 durationBlocks,
        uint64 blocksRemaining,
        uint64 startBlock_
    ) {
        enabled = antiSniperEnabled;
        currentTaxBps = currentSniperBuyTaxBps();
        startTaxBps = antiSniperStartBps;
        decrementBps = antiSniperDecrementBps;
        durationBlocks = antiSniperDurationBlocks;
        startBlock_ = startBlock;

        if (!antiSniperEnabled || block.number <= startBlock) {
            blocksRemaining = antiSniperDurationBlocks;
        } else {
            uint64 passed = uint64(block.number) - startBlock;
            blocksRemaining = passed >= antiSniperDurationBlocks ? 0 : (antiSniperDurationBlocks - passed);
        }
    }

    // ============================================================
    // ERC-20
    // ============================================================

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, to, amount, _taxType(msg.sender, to));
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 allowed = _allowances[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance(allowed, amount);
            _allowances[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount, _taxType(from, to));
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    // ============================================================
    // 联合曲线调用接口(免税)
    // ============================================================

    /// @notice 从曲线转账给买家(买入免税)
    function transferFromCurve(address to, uint256 amount) external {
        if (msg.sender != bondingCurve) revert OnlyBondingCurve();
        // 🆕 v4 修复: 之前 _transfer(address(this), ...) 会 InsufficientBalance,
        //              因为 initialize() 把所有 tokens 给 bondingCurve,合约本身没有 token
        //              应改为 _transfer(address(bondingCurve), ...)
        _transfer(address(bondingCurve), to, amount, 0); // 0 = no tax
    }

    /// @notice 用户把代币转回曲线(卖出免税)
    function transferToCurve(address from, uint256 amount) external {
        if (msg.sender != bondingCurve) revert OnlyBondingCurve();
        _transfer(from, address(bondingCurve), amount, 0); // 0 = no tax
    }

    // ============================================================
    // 内部:判断税率类型
    // ============================================================

    /// @dev 0 = no tax, 1 = buy tax, 2 = sell tax, 3 = transfer tax
    function _taxType(address from, address to) internal view returns (uint8) {
        if (mode != TokenMode.TAX) return 0;
        if (from == address(this)) return 1; // 买入
        if (to == address(this)) return 2;   // 卖出
        return 3;                             // 普通转账
    }

    // ============================================================
    // 内部:转账(带税率)
    // ============================================================

    function _transfer(address from, address to, uint256 amount, uint8 taxType) internal {
        if (to == address(0)) revert ZeroAddress();

        // 余额检查(放在最前,防止后续计算出错)
        uint256 bal = _balances[from];
        if (bal < amount) revert InsufficientBalance(bal, amount);

        // 校验开盘时间(用户转账时检查)
        if (launchTime > 0 && block.timestamp < launchTime && from != bondingCurve && to != bondingCurve) {
            revert NotStartedYet(launchTime, block.timestamp);
        }

        // 校验最大买入量(只对 buy 生效,from = curve)
        if (taxType == 1 && maxBuyPerWallet > 0 && to != address(this)) {
            uint256 newBalance = _balances[to] + amount;
            if (newBalance > maxBuyPerWallet) {
                revert MaxBuyExceeded(newBalance, maxBuyPerWallet);
            }
        }

        // 计算税率
        uint256 taxAmount = 0;
        if (taxType == 1) {
            // 🆕 修复 M-2: 之前反狙击税(currentSniperBuyTaxBps)从未被使用,机制形同虚设
            // 现在叠加反狙击税,反狙击总税封顶 50%(5000 bps)
            uint256 buyTaxTotal = uint256(buyTaxBps) + uint256(currentSniperBuyTaxBps());
            if (buyTaxTotal > 5000) buyTaxTotal = 5000;  // 封顶 50%
            taxAmount = (amount * buyTaxTotal) / 10000;
        }
        else if (taxType == 2) taxAmount = (amount * sellTaxBps) / 10000;
        else if (taxType == 3) taxAmount = (amount * transferTaxBps) / 10000;

        uint256 transferAmount = amount - taxAmount;

        unchecked {
            _balances[from] = bal - amount;
            _balances[to] += transferAmount;
            // 🆕 修复 M-1: 之前 unchecked 块里 _balances[taxRecipient] += taxAmount 时,
            //              如果 from == taxRecipient(发币者自己 transfer),会出现
            //              _balances[from] -= amount 然后 _balances[taxRecipient] += tax,
            //              净效果凭空获得 tax 数量的代币。
            // 修复: 只有 to != taxRecipient 时才单独加税(否则税已经通过 to 路径加给 taxRecipient)
            if (taxAmount > 0 && to != taxRecipient) {
                _balances[taxRecipient] += taxAmount;
            }
        }

        emit Transfer(from, to, transferAmount);
        if (taxAmount > 0) {
            emit Transfer(from, taxRecipient, taxAmount);
            emit TaxCollected(from, to, taxAmount, taxType);
        }
    }
}
