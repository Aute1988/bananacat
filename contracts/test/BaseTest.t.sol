// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/core/BananaCatFactory.sol";
import "../src/core/BananaCatToken.sol";
import "../src/core/BondingCurve.sol";
import "../src/periphery/LPLocker.sol";
import {
    TokenLabel,
    TokenMode,
    TaxConfig,
    AntiSniperConfig,
    TokenConfig
} from "../src/interfaces/IBananaCatToken.sol";

/// @title MockERC20 - 测试用 ERC20(模拟 LP token)
contract MockERC20 {
    string public name = "MockLP";
    string public symbol = "MLP";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        return _transfer(from, to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @title MockMigrator - 测试用迁移器
contract MockMigrator {
    LPLocker public immutable lPLocker;
    address public lastToken;
    address public lastCreator;
    LockPeriod public lastPeriod;
    uint256 public lastNative;
    bytes32 public lastLockId;
    bool public shouldFail;

    constructor(address _lPLocker) {
        lPLocker = LPLocker(_lPLocker);
    }

    function setShouldFail(bool v) external {
        shouldFail = v;
    }

    function graduate(
        address token,
        address,
        address creator,
        LockPeriod lockPeriod,
        uint256 nativeAmount
    ) external returns (bytes32 lockId) {
        lastToken = token;
        lastCreator = creator;
        lastPeriod = lockPeriod;
        lastNative = nativeAmount;
        uint256 mockLPAmount = 1 ether;
        // 🆕 v4 修复: 不要用 banana cat token 当 LP(它不是 ERC20 LP),部署专属 mock LP
        MockERC20 mockLP = new MockERC20();
        // 给 mock migrator 发 LP
        mockLP.mint(address(this), mockLPAmount);
        // 给 LPLocker approve LP(让 LPLocker.lockLP 的 safeTransferFrom 通过)
        mockLP.approve(address(lPLocker), mockLPAmount);
        // 调用 lockLP(5 参数: lpToken, token(原代币), creator, lpAmount, period)
        lockId = lPLocker.lockLP(address(mockLP), token, creator, mockLPAmount, lockPeriod);
        lastLockId = lockId;
        return lockId;
    }

    receive() external payable {}
}

/// @title BaseTest - 基础测试环境(v2)
contract BaseTest is Test {
    BananaCatFactory public factory;
    BananaCatToken public tokenTemplate;
    BondingCurve public curveTemplate;
    LPLocker public lPLocker;
    MockMigrator public migrator;

    address public creator = makeAddr("creator");
    address public buyer1 = makeAddr("buyer1");
    address public buyer2 = makeAddr("buyer2");
    address public buyer3 = makeAddr("buyer3");
    address public feeRecipient = makeAddr("feeRecipient");
    address public taxRecipient = makeAddr("taxRecipient");

    function setUp() public virtual {
        tokenTemplate = new BananaCatToken();
        curveTemplate = new BondingCurve();
        lPLocker = new LPLocker();
        migrator = new MockMigrator(address(lPLocker));
        // 🆕 v4-fix: LPLocker.factory 初始 = test contract,需要 transfer 给 mock migrator 才能 lockLP pass
        lPLocker.transferFactory(address(migrator));

        factory = new BananaCatFactory(
            address(tokenTemplate),
            address(curveTemplate),
            address(lPLocker),
            address(migrator),
            feeRecipient,
            0.005 ether,
            24 ether
        );
    }

    function _defaultConfig() internal view returns (TokenConfig memory) {
        return TokenConfig({
            name: "Test Cat",
            symbol: "TCAT",
            description: "A test cat",
            imageUrl: "https://example.com/logo.png",
            websiteUrl: "https://example.com",
            twitterUrl: "https://x.com/test",
            telegramUrl: "https://t.me/test",
            label: TokenLabel.MEME,
            mode: TokenMode.NORMAL,
            taxConfig: TaxConfig({
                buyTaxBps: 0, sellTaxBps: 0, transferTaxBps: 0, taxRecipient: address(0)
            }),
            maxBuyPerWallet: 0,
            launchTime: 0,
            lockPeriod: LockPeriod.NONE,
            antiSniper: AntiSniperConfig({
                enabled: false, startTaxBps: 0, decrementBps: 0, durationBlocks: 0
            })
        });
    }

    function _createToken(TokenConfig memory cfg) internal returns (address token, address curve) {
        vm.deal(creator, 1 ether);  // 确保 creator 有 ETH
        vm.prank(creator);
        (token, curve) = factory.createToken{value: 0.005 ether}(cfg);
        // 🆕 v4: 给 curve 预存 VIRTUAL_CURRENCY_RESERVE 让 sell 工作
        //        (BondingCurveMath 用虚拟储备做定价,需要合约真有 ETH 否则 sell underflow)
        vm.deal(curve, 30 ether);
    }

    function _deal(address who, uint256 amount) internal {
        vm.deal(who, amount);
    }

    /// @notice 🆕 v4-fix: 在 LPLockerTest 中创建 mock LP token + 让 migrator 持币
    /// @dev 之前的 test 用 address(0x1) 当 mock LP,SafeERC20 会 revert 因为它不是真实 ERC20
    function _lockLPForTest(
        address tokenOriginal,
        uint256 amount,
        LockPeriod period
    ) internal returns (bytes32 lockId, address lpToken) {
        // 部署一个 MockERC20 当作 LP token
        MockERC20 mockLP = new MockERC20();
        lpToken = address(mockLP);
        // 给 migrator 发 LP
        mockLP.mint(address(migrator), amount);
        // 🆕 v4-fix: SafeERC20.safeTransferFrom 需要先 approve,这里我们用支持 infinite allowance 的 mint 到 locker
        // 直接 mint 到 lPLocker 地址(等价于 LockLP,直接拿到 LP)
        // 但 LPLocker 的 lockLP 内部用 transferFrom(migrator -> lPLocker),所以需要无限授权
        vm.prank(address(migrator));
        mockLP.approve(address(lPLocker), amount);
        // 由 migrator 调用 lPLocker.lockLP
        vm.prank(address(migrator));
        lockId = lPLocker.lockLP(lpToken, tokenOriginal, creator, amount, period);
    }
}
