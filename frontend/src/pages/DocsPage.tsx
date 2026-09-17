import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHero, Section, StatusPill, StatBadge, InfoBadge } from '../components/UI'

// 🍌 内置中文 fallback(避免 i18n 没加载时显示原始 key)
const DOCS_CN: Record<string, string> = {
  'docs.sections.getStarted': '快速开始',
  'docs.sections.create': '创建代币',
  'docs.sections.trade': '交易',
  'docs.sections.lp': 'LP 锁仓',
  'docs.sections.leaderboard': '排行榜',
  'docs.sections.comment': '评论',
  'docs.sections.settings': '设置',
  'docs.sections.faq': '常见问题',
  'docs.sections.support': '支持',
  'docs.userGuide': '使用文档',
  'docs.intro': '欢迎来到 🍌🐱 香蕉猫发射台!本指南涵盖你需要知道的一切。',
  'docs.readTime': '5 分钟阅读',
  'docs.tableOfContents': '目录',
  'docs.needHelp': '需要帮助?',
  'docs.needHelpDesc': '找不到想要的内容?加入社区求助。',
  'docs.openDiscord': '加入 Discord',
  'docs.openTelegram': 'Telegram 群',
  'docs.getStartedDesc': '3 步就能开始使用香蕉猫发射台',
  'docs.quickStart': '三步快速上手',
  'docs.step1Title': '1. 连接钱包',
  'docs.step1Body': '点击右上角「连接钱包」按钮,支持所有主流 EVM 钱包,包括 MetaMask、Coinbase Wallet、Rainbow、Rabby 等。请确保在测试网上,避免损失真实资产。',
  'docs.step2Title': '2. 获取测试代币',
  'docs.step2Body': '从水龙头(Faucet)领取免费测试代币。在 /tokens 页面可以找到各链的水龙头链接,每条链有自己对应的原生 gas 代币。',
  'docs.step3Title': '3. 发币或买入',
  'docs.step3Body': '点击「发币」创建你自己的 Meme 代币,或在 /leaderboard 浏览热门代币进行买入。整个过程只需 1-2 次点击。',
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
  'docs.tradeDesc': '通过联合曲线或 DEX 买卖代币',
  'docs.howToBuy': '如何买入',
  'docs.howToBuySteps': '1. 进入代币详情页\n2. 输入你想花的平台币数量(BNB/ETH)\n3. 点击「买入」\n4. 在钱包中确认交易',
  'docs.howToSell': '如何卖出',
  'docs.howToSellSteps': '1. 同买入流程,但点击「卖出」\n2. 输入要卖出的代币数量\n3. 滑点容忍度建议 1-5%',
  'docs.graduation': '毕业',
  'docs.graduationDesc': '当代币联合曲线资金池满了,会自动迁移到 DEX(Uniswap/PancakeSwap),所有 LP 自动加入 DEX,所有人都可以自由交易。',
  'docs.slippage': '滑点',
  'docs.slippageDesc': '默认 1%。对波动较大的代币,建议设为 3-5% 避免交易失败。',
  'docs.lpDesc': '我们让你选择 LP 锁定的时长 — 还提供永久销毁的选项。',
  'docs.lockPeriods': '锁仓期限',
  'docs.permanentLock': '🔥 永久销毁(强烈推荐)',
  'docs.permanentLockDesc': 'LP 代币被发送到销毁地址。任何人 — 包括你自己 — 永远无法提取。这是给买家最强的信任信号。',
  'docs.timeLock': '⏰ 定期锁仓',
  'docs.timeLockDesc': 'LP 在我们的 LPLocker 合约中锁定期限(7/30/90/365 天)。解锁后你可以提取或续锁。',
  'docs.whyMatters': '为什么 LP 锁仓很重要?',
  'docs.whyMattersDesc': '没有锁仓,创建者可以随时撤走流动性(俗称「跑路」)。有了我们的锁仓机制,你的 LP 可验证地锁定了 — 无论是暂时还是永远。',
  'docs.leaderboardDesc': '用 7 种不同方式找到最热门的代币',
  'docs.lbTypes': '排名类型',
  'docs.lbHotDesc': '基于交易活跃度的综合热度',
  'docs.lbVolDesc': '24 小时最高交易量',
  'docs.lbGainDesc': '24 小时涨幅最高的代币',
  'docs.lbTrendDesc': '过去 7 天交易频率增长最快的代币',
  'docs.lbNewDesc': '最新创建的代币',
  'docs.lbGradDesc': '最近毕业(即将毕业)的代币',
  'docs.lbCreatorsDesc': '按创建代币数量排名的顶级发币者',
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
  'docs.settingsDesc': '个性化你的使用体验',
  'docs.language': '语言',
  'docs.languageDesc': '支持 14 种语言,通过右上角语言切换器切换。',
  'docs.theme': '主题',
  'docs.themeDesc': '深色或浅色模式,点击右上角月亮/太阳图标切换。',
  'docs.wallet': '钱包',
  'docs.walletDesc': '连接/断开、查看地址和余额。',
  'docs.network': '网络',
  'docs.networkDesc': '通过链选择器在 BSC / Ethereum / Robinhood / Arc 测试网之间切换。',
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
  'docs.supportDesc': '寻求帮助、报告 bug、提建议',
}

interface Section {
  id: string
  title: string
  icon: string
  content: ReactNode
}

export default function DocsPage() {
  const { t, i18n } = useTranslation()
  // tc = translation with Chinese fallback (避免 i18n key 直接显示)
  const [, forceRerender] = useState(0)
  useEffect(() => {
    const cb = () => forceRerender(n => n + 1)
    i18n.on('languageChanged', cb)
    return () => i18n.off('languageChanged', cb)
  }, [i18n])
  const tc = (key: string): string => {
    let r = t(key)
    if (r && r !== key) return r
    if (i18n.language?.startsWith('zh')) {
      return DOCS_CN[key] || key
    }
    return r || key
  }

  const [activeSection, setActiveSection] = useState('getStarted')
  const [activeFaq, setActiveFaq] = useState<number | null>(0)

  const sections: Section[] = [
    {
      id: 'getStarted', icon: '🚀', title: tc('docs.sections.getStarted'),
      content: (
        <div className="space-y-6">
          <p className="text-base text-secondary leading-relaxed">
            {tc('docs.getStartedDesc')}
          </p>

          <div>
            <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-banana to-cat"></span>
              {tc('docs.quickStart')}
            </h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <DocCard emoji="1️⃣" title={tc('docs.step1Title')} body={tc('docs.step1Body')} />
              <DocCard emoji="2️⃣" title={tc('docs.step2Title')} body={tc('docs.step2Body')} />
              <DocCard emoji="3️⃣" title={tc('docs.step3Title')} body={tc('docs.step3Body')} />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'create', icon: '🍌', title: tc('docs.sections.create'),
      content: (
        <div className="space-y-6">
          <p className="text-base text-secondary leading-relaxed">{tc('docs.createDesc')}</p>

          <div>
            <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-banana to-cat"></span>
              📝 {tc('docs.tokenBasics')}
            </h3>
            <FieldTable
              fields={[
                { k: tc('docs.fieldName'), v: tc('docs.fieldNameDesc') },
                { k: tc('docs.fieldSymbol'), v: tc('docs.fieldSymbolDesc') },
                { k: tc('docs.fieldLogo'), v: tc('docs.fieldLogoDesc') },
                { k: tc('docs.fieldDescription'), v: tc('docs.fieldDescriptionDesc') },
              ]}
            />
          </div>

          <div>
            <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-banana to-cat"></span>
              🏷️ {tc('docs.chooseCategory')}
            </h3>
            <p className="text-secondary leading-relaxed">{tc('docs.chooseCategoryDesc')}</p>
          </div>

          <div>
            <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-banana to-cat"></span>
              🔐 {tc('docs.curveAndLP')}
            </h3>
            <FieldTable
              fields={[
                { k: tc('docs.fieldLockPeriod'), v: tc('docs.fieldLockPeriodDesc') },
                { k: tc('docs.fieldBuyTax'), v: tc('docs.fieldBuyTaxDesc') },
                { k: tc('docs.fieldSellTax'), v: tc('docs.fieldSellTaxDesc') },
                { k: tc('docs.fieldAntiSniper'), v: tc('docs.fieldAntiSniperDesc') },
              ]}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'trade', icon: '💱', title: tc('docs.sections.trade'),
      content: (
        <div className="space-y-6">
          <p className="text-base text-secondary leading-relaxed">{tc('docs.tradeDesc')}</p>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-gradient-to-b from-green-400 to-cyan-400"></span>
                🟢 {tc('docs.howToBuy')}
              </h3>
              <div className="glass-premium rounded-2xl p-5 font-mono text-sm text-secondary leading-relaxed whitespace-pre-wrap">
                {tc('docs.howToBuySteps')}
              </div>
            </div>
            <div>
              <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-gradient-to-b from-red-400 to-pink-400"></span>
                🔴 {tc('docs.howToSell')}
              </h3>
              <div className="glass-premium rounded-2xl p-5 font-mono text-sm text-secondary leading-relaxed whitespace-pre-wrap">
                {tc('docs.howToSellSteps')}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-gradient-to-b from-yellow-400 to-orange-400"></span>
                🎓 {tc('docs.graduation')}
              </h3>
              <p className="text-secondary leading-relaxed text-sm">{tc('docs.graduationDesc')}</p>
            </div>
            <div>
              <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-gradient-to-b from-cyan-400 to-blue-400"></span>
                ⚙️ {tc('docs.slippage')}
              </h3>
              <p className="text-secondary leading-relaxed text-sm">{tc('docs.slippageDesc')}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'lp', icon: '🔐', title: tc('docs.sections.lp'),
      content: (
        <div className="space-y-6">
          <p className="text-base text-secondary leading-relaxed">{tc('docs.lpDesc')}</p>

          <div>
            <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-banana to-cat"></span>
              📋 {tc('docs.lockPeriods')}
            </h3>
            <div className="space-y-3">
              <DocCard emoji="🔥" title={tc('docs.permanentLock')} body={tc('docs.permanentLockDesc')} highlight />
              <DocCard emoji="⏰" title={tc('docs.timeLock')} body={tc('docs.timeLockDesc')} />
            </div>
          </div>

          <div>
            <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-banana to-cat"></span>
              ❓ {tc('docs.whyMatters')}
            </h3>
            <p className="text-secondary leading-relaxed text-sm">{tc('docs.whyMattersDesc')}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'leaderboard', icon: '🏆', title: tc('docs.sections.leaderboard'),
      content: (
        <div className="space-y-6">
          <p className="text-base text-secondary leading-relaxed">{tc('docs.leaderboardDesc')}</p>

          <div>
            <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-banana to-cat"></span>
              📊 {tc('docs.lbTypes')}
            </h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <LbCard emoji="🔥" name="Hot" desc={tc('docs.lbHotDesc')} />
              <LbCard emoji="💰" name="24h Volume" desc={tc('docs.lbVolDesc')} />
              <LbCard emoji="📈" name="24h Gainers" desc={tc('docs.lbGainDesc')} />
              <LbCard emoji="⚡" name="7d Trend" desc={tc('docs.lbTrendDesc')} />
              <LbCard emoji="🆕" name="New" desc={tc('docs.lbNewDesc')} />
              <LbCard emoji="🚀" name="Graduating" desc={tc('docs.lbGradDesc')} />
              <LbCard emoji="🏆" name="Top Creators" desc={tc('docs.lbCreatorsDesc')} />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'comment', icon: '💬', title: tc('docs.sections.comment'),
      content: (
        <div className="space-y-6">
          <p className="text-base text-secondary leading-relaxed">{tc('docs.commentDesc')}</p>

          <div>
            <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-banana to-cat"></span>
              📜 {tc('docs.commentRules')}
            </h3>
            <div className="space-y-2">
              <DocCard emoji="🤝" title={tc('docs.rule1Title')} body={tc('docs.rule1Desc')} />
              <DocCard emoji="🚫" title={tc('docs.rule2Title')} body={tc('docs.rule2Desc')} />
              <DocCard emoji="🌍" title={tc('docs.rule3Title')} body={tc('docs.rule3Desc')} />
            </div>
          </div>

          <div>
            <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-banana to-cat"></span>
              🚩 {tc('docs.reportComment')}
            </h3>
            <p className="text-secondary leading-relaxed text-sm">{tc('docs.reportCommentDesc')}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'settings', icon: '⚙️', title: tc('docs.sections.settings'),
      content: (
        <div className="space-y-6">
          <p className="text-base text-secondary leading-relaxed">{tc('docs.settingsDesc')}</p>

          <div className="grid sm:grid-cols-2 gap-3">
            <DocCard emoji="🌍" title={tc('docs.language')} body={tc('docs.languageDesc')} />
            <DocCard emoji="🌓" title={tc('docs.theme')} body={tc('docs.themeDesc')} />
            <DocCard emoji="👛" title={tc('docs.wallet')} body={tc('docs.walletDesc')} />
            <DocCard emoji="⛓️" title={tc('docs.network')} body={tc('docs.networkDesc')} />
          </div>
        </div>
      ),
    },
    {
      id: 'faq', icon: '❓', title: tc('docs.sections.faq'),
      content: (
        <div className="space-y-6">
          <p className="text-base text-secondary leading-relaxed">{tc('docs.faqSubtitle')}</p>
          <div className="space-y-2">
            {[
              { q: tc('docs.faq1Q'), a: tc('docs.faq1A') },
              { q: tc('docs.faq2Q'), a: tc('docs.faq2A') },
              { q: tc('docs.faq3Q'), a: tc('docs.faq3A') },
              { q: tc('docs.faq4Q'), a: tc('docs.faq4A') },
              { q: tc('docs.faq5Q'), a: tc('docs.faq5A') },
              { q: tc('docs.faq6Q'), a: tc('docs.faq6A') },
            ].map((item, i) => (
              <FaqItem
                key={i}
                q={item.q}
                a={item.a}
                open={activeFaq === i}
                onToggle={() => setActiveFaq(activeFaq === i ? null : i)}
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'support', icon: '💬', title: tc('docs.sections.support'),
      content: (
        <div className="space-y-6">
          <p className="text-base text-secondary leading-relaxed">{tc('docs.supportDesc')}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <a href="https://discord.gg" target="_blank" rel="noopener noreferrer"
               className="glass-premium rounded-2xl p-6 hover:scale-[1.02] transition-all group">
              <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">💬</div>
              <h4 className="font-display font-bold text-lg group-hover:text-indigo-400 transition-colors">Discord</h4>
              <p className="text-sm text-muted mt-1 leading-relaxed">{tc('docs.openDiscord')}</p>
              <div className="mt-4 text-[0.65rem] text-muted font-mono opacity-60">2,400+ 成员在线</div>
            </a>
            <a href="https://t.me" target="_blank" rel="noopener noreferrer"
               className="glass-premium rounded-2xl p-6 hover:scale-[1.02] transition-all group">
              <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">✈️</div>
              <h4 className="font-display font-bold text-lg group-hover:text-blue-400 transition-colors">Telegram</h4>
              <p className="text-sm text-muted mt-1 leading-relaxed">{tc('docs.openTelegram')}</p>
              <div className="mt-4 text-[0.65rem] text-muted font-mono opacity-60">1,800+ 订阅者</div>
            </a>
          </div>
        </div>
      ),
    },
  ]

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        })
      },
      { rootMargin: '-30% 0px -65% 0px' }
    )
    document.querySelectorAll('section[id]').forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [sections])

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* ============================================================
          📖 HERO
          ============================================================ */}
      <PageHero
        icon="📖"
        title={tc('docs.userGuide')}
        subtitle={tc('docs.intro')}
        badge={
          <div className="flex items-center gap-2 flex-wrap">
            <StatBadge color="#b794f6">v3.0</StatBadge>
            <StatusPill variant="warning">BETA</StatusPill>
            <span className="text-xs text-muted font-mono">⏱️ {tc('docs.readTime')}</span>
          </div>
        }
        variant="gold"
      />

      {/* ============================================================
          📑 双栏布局:左侧 TOC + 右侧内容
          ============================================================ */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左侧目录 (sticky) */}
        <aside className="lg:w-60 shrink-0">
          <nav className="lg:sticky lg:top-24 glass-premium rounded-2xl p-4 animate-slide-down">
            <p className="text-xs text-muted uppercase tracking-widest mb-3 font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-banana"></span>
              {tc('docs.tableOfContents')}
            </p>
            <ul className="space-y-1 text-sm">
              {sections.map(s => {
                const active = activeSection === s.id
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={() => setActiveSection(s.id)}
                      className={`block px-3 py-2 rounded-lg transition-all duration-300 ease-out-expo flex items-center gap-2 ${
                        active
                          ? 'scale-[1.02]'
                          : 'text-muted hover:text-primary hover:bg-white/5'
                      }`}
                      style={active ? {
                        background: 'linear-gradient(135deg, rgba(252, 211, 77, 0.15), rgba(244, 114, 182, 0.05))',
                        borderLeft: '2px solid #fcd34d',
                        color: '#fcd34d',
                      } : {}}
                    >
                      <span className="text-base">{s.icon}</span>
                      <span className="font-medium">{s.title}</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* 内容 */}
        <article className="flex-1 space-y-5">
          {sections.map((s, i) => (
            <section
              id={s.id}
              key={s.id}
              className="glass-premium rounded-3xl p-6 sm:p-8 scroll-mt-24 relative overflow-hidden"
              style={{ animation: `slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms both` }}
            >
              {/* 装饰辉光 */}
              <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.6), transparent 70%)' }}></div>

              <div className="relative">
                <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3 mb-5">
                  <span className="text-3xl sm:text-4xl">{s.icon}</span>
                  <span className="text-gradient-banana">{s.title}</span>
                </h2>
                {s.content}
              </div>
            </section>
          ))}

          {/* ============================================================
              🔗 相关阅读卡片
              ============================================================ */}
          <div className="glass-premium rounded-3xl p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(183, 148, 246, 0.6), transparent 70%)' }}></div>

            <div className="relative">
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="text-xs font-mono text-muted tracking-widest">[ RELATED ]</span>
              </div>
              <h3 className="font-display text-xl font-black mb-5 flex items-center gap-2">
                <span className="text-gradient-aurora">🔗 相关阅读</span>
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Link to="/create" className="glass rounded-xl p-4 hover:scale-[1.02] transition-all group">
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🍌</div>
                  <h4 className="font-bold text-sm mb-1 group-hover:text-banana transition-colors">开始发币</h4>
                  <p className="text-xs text-muted leading-relaxed">亲手创建你的 Meme 代币</p>
                </Link>
                <Link to="/leaderboard" className="glass rounded-xl p-4 hover:scale-[1.02] transition-all group">
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🏆</div>
                  <h4 className="font-bold text-sm mb-1 group-hover:text-cat transition-colors">查看排行榜</h4>
                  <p className="text-xs text-muted leading-relaxed">发现热门 Meme 代币</p>
                </Link>
                <Link to="/tokens" className="glass rounded-xl p-4 hover:scale-[1.02] transition-all group">
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📋</div>
                  <h4 className="font-bold text-sm mb-1 group-hover:text-cyan-400 transition-colors">浏览代币</h4>
                  <p className="text-xs text-muted leading-relaxed">看所有上线代币</p>
                </Link>
                <Link to="/dashboard" className="glass rounded-xl p-4 hover:scale-[1.02] transition-all group">
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📊</div>
                  <h4 className="font-bold text-sm mb-1 group-hover:text-pink-400 transition-colors">数据分析</h4>
                  <p className="text-xs text-muted leading-relaxed">链上数据与趋势图表</p>
                </Link>
              </div>
            </div>
          </div>

          {/* ============================================================
              💬 需要帮助
              ============================================================ */}
          <div className="glass-premium rounded-3xl p-8 sm:p-10 text-center relative overflow-hidden">
            <div className="absolute -top-32 left-1/4 w-72 h-72 rounded-full opacity-25 blur-3xl pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(183, 148, 246, 0.6), transparent 70%)' }}></div>
            <div className="absolute -bottom-32 right-1/4 w-72 h-72 rounded-full opacity-25 blur-3xl pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.5), transparent 70%)' }}></div>

            <div className="relative space-y-4">
              <div className="text-5xl">💬</div>
              <h3 className="font-display text-2xl sm:text-3xl font-black">{tc('docs.needHelp')}</h3>
              <p className="text-sm text-secondary max-w-md mx-auto leading-relaxed">{tc('docs.needHelpDesc')}</p>
              <div className="flex flex-wrap justify-center gap-3 mt-6">
                <a href="https://discord.gg" target="_blank" rel="noopener noreferrer" className="btn-cat">
                  💬 {tc('docs.openDiscord')}
                </a>
                <a href="https://t.me" target="_blank" rel="noopener noreferrer" className="btn-banana">
                  ✈️ {tc('docs.openTelegram')}
                </a>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}

function DocCard({ emoji, title, body, highlight }: { emoji: string; title: string; body: string; highlight?: boolean }) {
  return (
    <div
      className={`glass-premium rounded-2xl p-4 transition-all hover:scale-[1.02] ${
        highlight ? 'tag-glow' : ''
      }`}
      style={highlight ? {
        background: 'linear-gradient(135deg, rgba(252, 211, 77, 0.08), rgba(244, 114, 182, 0.04))',
        border: '1px solid rgba(252, 211, 77, 0.4)',
        boxShadow: '0 0 32px rgba(252, 211, 77, 0.15)',
      } : {}}
    >
      <h4 className="font-display font-bold flex items-center gap-2 mb-2">
        <span className="text-xl">{emoji}</span>
        <span>{title}</span>
      </h4>
      <p className="text-sm text-secondary leading-relaxed">{body}</p>
    </div>
  )
}

function FieldTable({ fields }: { fields: { k: string; v: string }[] }) {
  return (
    <div className="glass-premium rounded-2xl overflow-hidden divide-y divide-white/5">
      {fields.map((f, i) => (
        <div key={i} className="grid sm:grid-cols-3 gap-2 sm:gap-4 p-4 hover:bg-white/[0.02] transition-colors">
          <div className="font-bold text-banana text-sm">{f.k}</div>
          <div className="sm:col-span-2 text-sm text-secondary leading-relaxed">{f.v}</div>
        </div>
      ))}
    </div>
  )
}

function LbCard({ emoji, name, desc }: { emoji: string; name: string; desc: string }) {
  return (
    <div className="glass-premium rounded-xl p-3 flex items-start gap-3 hover:scale-[1.02] transition-transform group">
      <span className="text-2xl group-hover:scale-110 transition-transform">{emoji}</span>
      <div className="flex-1 min-w-0">
        <h5 className="font-bold text-sm">{name}</h5>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="glass-premium rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors group"
      >
        <span className="font-display font-bold group-hover:text-banana transition-colors">{q}</span>
        <span className={`text-2xl transition-all duration-300 text-banana shrink-0 ml-3 ${open ? 'rotate-45' : 'rotate-0'}`}>+</span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-secondary leading-relaxed border-t border-white/5 pt-3 animate-slide-down">
          {a}
        </div>
      )}
    </div>
  )
}
