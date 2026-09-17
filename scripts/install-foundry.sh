#!/bin/bash
# Foundry 测试环境安装脚本
#
# 使用方法:
#   bash scripts/install-foundry.sh
#
# 依赖:
#   - curl / bash
#   - npm (for OpenZeppelin/PancakeSwap)
#   - foundryup (自动安装)
#
# 运行测试:
#   forge test
#
# 详细测试:
#   forge test -vvv
#
# 带覆盖率:
#   forge coverage
#
# 生成 gas 报告:
#   forge test --gas-report

set -e

echo "🍌 安装 Foundry..."
if ! command -v forge &> /dev/null; then
    curl -L https://foundry.paradigm.xyz | bash
    source ~/.bashrc 2>/dev/null || true
    export PATH="$HOME/.foundry/bin:$PATH"
fi

forge --version
forgeup

echo "📦 安装 npm 依赖..."
cd ..
npm install

echo "🔗 安装 forge-std..."
cd contracts
forge install foundry-rs/forge-std --no-commit

echo "📚 安装 OpenZeppelin..."
forge install OpenZeppelin/openzeppelin-contracts@v5.0.0 --no-commit

echo "🔧 安装 PancakeSwap..."
forge install PancakeSwap/pancakeswap-contracts --no-commit

echo ""
echo "✅ Foundry 环境就绪!"
echo ""
echo "运行测试:"
echo "  forge test"
echo ""
echo "详细测试(含日志):"
echo "  forge test -vvv"
echo ""
echo "覆盖率:"
echo "  forge coverage"
