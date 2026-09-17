/**
 * 🍌 内置 Docs 中文文案 fallback
 * 即使 i18n 没加载,页面也能显示中文(避免出现 docs.sections.getStarted 这样的原始 key)
 */
export const DOCS_CN: Record<string, string> = {
  // sections
  'docs.sections.getStarted': '快速开始',
  'docs.sections.create': '创建代币',
  'docs.sections.trade': '交易',
  'docs.sections.lp': 'LP 锁仓',
  'docs.sections.leaderboard': '排行榜',
  'docs.sections.comment': '评论',
  'docs.sections.settings': '设置',
  'docs.sections.faq': '常见问题',
  'docs.sections.support': '支持',
  // hero / intro
  'docs.userGuide': '使用文档',
  'docs.intro': '欢迎来到 🍌🐱 香蕉猫发射台!本指南涵盖你需要知道的一切。',
  'docs.readTime': '5 分钟阅读',
  'docs.tableOfContents': '目录',
  'docs.needHelp': '需要帮助?',
  'docs.needHelpDesc': '找不到想要的内容?加入社区求助。',
  'docs.openDiscord': '加入 Discord',
  'docs.openTelegram': 'Telegram 群',

  // getStarted
  'docs.getStartedDesc': '3 步就能开始使用香蕉猫发射台',
  'docs.quickStart': '三步快速上手',
  'docs.step1Title': '1. 连接钱包',
  'docs.step1Body': '点击右上角「连接钱包」按钮,支持所有主流 EVM 钱包,包括 MetaMask、Coinbase Wallet、Rainbow、Rabby 等。请确保在测试网上,避免损失真实资产。',
  'docs.step2Title': '2. 获取测试代币',
  'docs.step2Body': '从水龙头(Faucet)领取免费测试代币。在 /tokens 页面可以找到各链的水龙头链接,每条链有自己对应的原生 gas 代币。',
  'docs.step3Title': '3. 发币或买入',
  'docs.step3Body': '点击「发币」创建你自己的 Meme 代币,或在 /leaderboard 浏览热门代币进行买入。整个过程只需 1-2 次点击。',

  // create
  'docs.createDesc': '4 步即可发射一个 Meme 代币',
  'docs.tokenBasics': '基本信息',
  'docs.fieldName': '名称',
  'docs.fieldNameDesc': '代币完整名称(例如: 「香蕉猫」)',
  'docs.fieldSymbol': '符号',
  'docs.fieldSymbolDesc': '代币简称(例如: BCAT),3-6 个字符',
  'docs.fieldLogo': 'Logo',
  'docs.fieldLogoDesc': '上传图片或粘贴 IPFS 地址。我们自动压缩并 pin 到 IPFS。',
  'docs.fieldDescription': '描述',
  'docs.fieldDescriptionDesc': '向世界介绍你的代币',
  'docs.chooseCategory': '选择分类',
  'docs.chooseCategoryDesc': '从 10 个分类中选择(Meme、AI、DeFi 等),不同分类在排行榜上有专属徽章。',
  'docs.curveAndLP': '联合曲线 与 LP 锁仓',
  'docs.fieldLockPeriod': '锁仓期限',
  'docs.fieldLockPeriodDesc': 'LP 在你能提取之前必须锁定的时长。永久销毁 = LP 永远烧毁(最值得信任)。',
  'docs.fieldBuyTax': '买入税',
  'docs.fieldBuyTaxDesc': '每次买入的费用百分比 (0-10%)。可用于做市、营销或防机器人。',
  'docs.fieldSellTax': '卖出税',
  'docs.fieldSellTaxDesc': '同买入税,但针对卖出。许多项目设置较高的卖出税来阻止砸盘。',
  'docs.fieldAntiSniper': '反狙击',
  'docs.fieldAntiSniperDesc': '前 ~10 个区块收取额外税来阻止机器人抢跑,税率线性递减到 0。',
  'docs.reviewLaunch': '确认并发射',
  'docs.reviewLaunchDesc': '在支付发射费(约 0.005 BNB 等价)前检查所有设置。',

  // trade
  'docs.tradeDesc': '通过联合曲线或 DEX 买卖代币',
  'docs.howToBuy': '如何买入',
  'docs.howToBuySteps': '1. 进入代币详情页\n2. 输入你想花的平台币数量(BNB/ETH)\n3. 点击「买入」\n4. 在钱包中确认交易',
  'docs.howToSell': '如何卖出',
  'docs.howToSellSteps': '1. 同买入流程,但点击「卖出」\n2. 输入要卖出的代币数量\n3. 滑点容忍度建议 1-5%',
  'docs.graduation': '毕业',
  'docs.graduationDesc': '当代币联合曲线资金池满了,会自动迁移到 DEX(Uniswap/PancakeSwap),所有 LP 自动加入 DEX,所有人都可以自由交易。',
  'docs.slippage': '滑点',
  'docs.slippageDesc': '默认 1%。对波动较大的代币,建议设为 3-5% 避免交易失败。',

  // LP
  'docs.lpDesc': '我们让你选择 LP 锁定的时长 — 还提供永久销毁的选项。',
  'docs.lockPeriods': '锁仓期限',
  'docs.permanentLock': '🔥 永久销毁(强烈推荐)',
  'docs.permanentLockDesc': 'LP 代币被发送到销毁地址。任何人 — 包括你自己 — 永远无法提取。这是给买家最强的信任信号。',
  'docs.timeLock': '⏰ 定期锁仓',
  'docs.timeLockDesc': 'LP 在我们的 LPLocker 合约中锁定期限(7/30/90/365 天)。解锁后你可以提取或续锁。',
  'docs.whyMatters': '为什么 LP 锁仓很重要?',
  'docs.whyMattersDesc': '没有锁仓,创建者可以随时撤走流动性(俗称「跑路」)。有了我们的锁仓机制,你的 LP 可验证地锁定了 — 无论是暂时还是永远。',

  // leaderboard
  'docs.leaderboardDesc': '用 7 种不同方式找到最热门的代币',
  'docs.lbTypes': '排名类型',
  'docs.lbHotDesc': '基于交易活跃度的综合热度',
  'docs.lbVolDesc': '24 小时最高交易量',
  'docs.lbGainDesc': '24 小时涨幅最高的代币',
  'docs.lbTrendDesc': '过去 7 天交易频率增长最快的代币',
  'docs.lbNewDesc': '最新创建的代币',
  'docs.lbGradDesc': '最近毕业(即将毕业)的代币',
  'docs.lbCreatorsDesc': '按创建代币数量排名的顶级发币者',

  // comment
  'docs.commentDesc': '无需离开页面与其他交易者交流',
  'docs.commentRules': '社区规则',
  'docs.rule1Title': '保持尊重',
  'docs.rule1Desc': '禁止 FUD、刷盘、刷广告。建设性批评欢迎。',
  'docs.rule2Title': '禁止刷屏',
  'docs.rule2Desc': '不要重复发布相同内容或贴无关链接。',
  'docs.rule3Title': '使用你能读懂的语言',
  'docs.rule3Desc': '我们支持 14 种语言 — 请用大家能看懂的语言发帖。',
  'docs.reportComment': '举报评论',
  'docs.reportCommentDesc': '点击任意评论上的旗帜图标即可举报,我们会在 24 小时内处理。',

  // settings
  'docs.settingsDesc': '个性化你的使用体验',
  'docs.language': '语言',
  'docs.languageDesc': '支持 14 种语言,通过右上角语言切换器切换。',
  'docs.theme': '主题',
  'docs.themeDesc': '深色或浅色模式,点击右上角月亮/太阳图标切换。',
  'docs.wallet': '钱包',
  'docs.walletDesc': '连接/断开、查看地址和余额。',
  'docs.network': '网络',
  'docs.networkDesc': '通过链选择器在 BSC / Ethereum / Robinhood / Arc 测试网之间切换。',

  // faq
  'docs.faqSubtitle': '最常被问到的问题快速解答',
  'docs.faq1Q': '什么是联合曲线?',
  'docs.faq1A': 'AMM(自动做市商)根据供需自动定价。买入的人多,价格就涨;卖出的人多,价格就跌。无需订单簿。',
  'docs.faq2Q': '发射一个代币要多少钱?',
  'docs.faq2A': '约 0.005 BNB(其他链等价)加 gas 费。平台费用于合约部署和 IPFS 上传。',
  'docs.faq3Q': '不同锁仓期限有什么区别?',
  'docs.faq3A': '锁定 = LP 在智能合约中,到期前无法提取。销毁 = LP 发送到死亡地址 — 谁都无法取回。',
  'docs.faq4Q': '为什么我的交易失败了?',
  'docs.faq4A': '常见原因:(1) Gas 不足 — 增大滑点或检查余额。(2) 网络错误 — 确认你在正确的测试网。(3) 抢跑机器人 — 用更高的 gas 重试。',
  'docs.faq5Q': '我之后能修改代币信息吗?',
  'docs.faq5A': '符号、名称、描述可通过 updateMetadata() 由创建者更新一次。但 LP 锁仓期限发射后不能改(为了信任安全)。',
  'docs.faq6Q': '这安全吗?',
  'docs.faq6A': '所有合约已验证、运行在测试网。上线主网前会做完整审计。我们不托管你的资金 — 一切都在链上。',

  // support
  'docs.supportDesc': '寻求帮助、报告 bug、提建议',
}

/**
 * 安全 t() 函数:i18next 失败时 fallback 到内置中文
 */
export function safeT(t: (k: string) => string, key: string): string {
  const i18nResult = t(key)
  if (i18nResult && i18nResult !== key) return i18nResult
  // 走 fallback
  const fallback = DOCS_CN[key]
  return fallback || key
}
