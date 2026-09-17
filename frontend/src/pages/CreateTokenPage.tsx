import { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { useWalletClient } from 'wagmi'
import { LOCK_PERIOD_OPTIONS, TOKEN_LABELS, CHAINS } from '../chains/config'
import { Link } from 'react-router-dom'
import LogoUpload from '../components/LogoUpload'
import { createTokenOnChain } from '../lib/contracts'
import { Section, Field, Toggle, NumberStepper, ConnectingState, InfoBadge, toast } from '../components/UI'

const CHAIN_FEES = {
  bsc: { fee: '0.005', symbol: 'BNB' },
  ethereum: { fee: '0.005', symbol: 'ETH' },
  robinhood: { fee: '0.005', symbol: 'ETH' },
  arc: { fee: '5', symbol: 'USDC' },
}

/**
 * 🆕 税率用途(资金流向)
 * - recipient   : 发送给指定钱包(团队/做市)
 * - burn        : 销毁(减少供应量,通缩)
 * - holders     : 按持仓量分配给所有持有者(分红)
 * - liquidity   : 添加到流动性池(加深深度)
 * - dividend    : 分红成其它 ERC20 代币(例如 USDT)
 */
type TaxUse = 'recipient' | 'burn' | 'holders' | 'liquidity' | 'dividend'

const TAX_USE_OPTIONS: { value: TaxUse; emoji: string; label: string; desc: string; color: string }[] = [
  { value: 'recipient', emoji: '💰', label: '接收钱包',    desc: '发给指定钱包(团队/做市)',          color: '#fcd34d' },
  { value: 'burn',      emoji: '🔥', label: '销毁代币',    desc: '买入即销毁,减少供应量(通缩)',    color: '#fb7185' },
  { value: 'holders',   emoji: '👥', label: '持有者分红',  desc: '按持仓比例分给所有持有者(本币)',  color: '#34d399' },
  { value: 'liquidity', emoji: '💧', label: '添加流动性',  desc: '自动添加进流动性池,加深深度',     color: '#67e8f9' },
  { value: 'dividend',  emoji: '🪙', label: '分红其它代币', desc: '兑换成指定 ERC20 后分发(如 USDT)', color: '#b794f6' },
]

export default function CreateTokenPage() {
  const { address, chain, chainConfig, connect } = useWallet()
  const { data: walletClient } = useWalletClient()

  // ============ 基本信息 ============
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  // ============ 分类 ============
  const [label, setLabel] = useState(0)

  // ============ Social ============
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')
  const [telegramUrl, setTelegramUrl] = useState('')

  // ============ 税率配置(单段税) ============
  const [taxRate, setTaxRate] = useState(1)  // 0-10%
  const [taxUse, setTaxUse] = useState<TaxUse>('recipient')
  const [taxRecipient, setTaxRecipient] = useState('')
  const [dividendToken, setDividendToken] = useState('')  // 分红目标代币地址

  // ============ 交易设置 ============
  const [maxBuyEnabled, setMaxBuyEnabled] = useState(false)
  const [maxBuyAmount, setMaxBuyAmount] = useState('')

  const [launchMode, setLaunchMode] = useState<'now' | 'schedule'>('now')
  const [launchTime, setLaunchTime] = useState('')

  // ============ 反狙击 ============
  const [antiSniperEnabled, setAntiSniperEnabled] = useState(false)
  const [sniperStartTax, setSniperStartTax] = useState(30)
  const [sniperBlocks, setSniperBlocks] = useState(30)

  // ============ LP 锁仓 ============
  const [lockPeriod, setLockPeriod] = useState('4')

  // ============ 状态 ============
  const [isCreating, setIsCreating] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fee = chain ? CHAIN_FEES[chain] : { fee: '0', symbol: 'BNB' }

  const isValidUrl = (url: string) => {
    if (!url) return true
    try {
      const u = new URL(url)
      return ['http:', 'https:'].includes(u.protocol)
    } catch { return false }
  }
  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr)

  const handleCreate = async () => {
    if (!address) return toast('请先连接钱包', 'error')
    if (!name || !symbol) return toast('请填写代币名称和符号', 'error')
    if (name.length > 50 || symbol.length > 10) return toast('名称不超过50字符,符号不超过10字符', 'error')
    if (description.length > 500) return toast('描述不超过500字符', 'error')
    if (!isValidUrl(imageUrl) || !isValidUrl(websiteUrl) || !isValidUrl(twitterUrl) || !isValidUrl(telegramUrl)) {
      return toast('URL 格式不正确', 'error')
    }
    // 税率校验
    if (taxRate > 10) return toast('税率不能超过 10%', 'error')
    if (taxUse === 'recipient' && taxRecipient && !isValidAddress(taxRecipient)) {
      return toast('接收钱包地址格式不正确', 'error')
    }
    if (taxUse === 'dividend' && dividendToken && !isValidAddress(dividendToken)) {
      return toast('分红代币地址格式不正确', 'error')
    }
    if (maxBuyEnabled && (!maxBuyAmount || parseFloat(maxBuyAmount) <= 0)) {
      return toast('请填写最大买入量,或关闭限制', 'error')
    }
    if (launchMode === 'schedule') {
      const t = new Date(launchTime).getTime()
      if (!launchTime || t < Date.now()) return toast('请填写未来的发币时间', 'error')
    }
    if (antiSniperEnabled && (sniperStartTax < 1 || sniperStartTax > 50)) {
      return toast('反狙击起始税必须在 1-50% 之间', 'error')
    }

    setIsCreating(true)
    setError(null)
    try {
      if (!walletClient) throw new Error('钱包未就绪,请先点击右上角连接钱包')
      const factoryAddress = chainConfig.factoryAddress as `0x${string}`
      if (!factoryAddress) throw new Error(`${chainConfig.name} 工厂地址未配置`)

      const taxMode: 'normal' | 'tax' = taxRate > 0 ? 'tax' : 'normal'

      const tx = await createTokenOnChain(
        {
          name, symbol, description, imageUrl, websiteUrl, twitterUrl, telegramUrl,
          label,
          taxMode,
          buyTaxBps: taxMode === 'tax' ? taxRate * 100 : 0,
          sellTaxBps: 0,
          transferTaxBps: 0,
          taxRecipient,
          maxBuyPerWallet: maxBuyEnabled ? BigInt(Math.floor(parseFloat(maxBuyAmount) * 1e18)) : 0n,
          launchTime: launchMode === 'now' ? 0 : Math.floor(new Date(launchTime).getTime() / 1000),
          antiSniperBlocks: antiSniperEnabled ? sniperBlocks : 0,
          antiSniperStartBps: antiSniperEnabled ? sniperStartTax * 100 : 0,
          lockPeriod: parseInt(lockPeriod),
        },
        walletClient,
        factoryAddress,
        chain ?? 'bsc'
      )
      setTxHash(tx)
      toast(`代币 "${name}" 已上链!`, 'success')
    } catch (err: any) {
      setError(err.message || err.shortMessage || '创建失败')
    } finally {
      setIsCreating(false)
    }
  }

  if (!address) {
    return (
      <ConnectingState
        emoji="🍌"
        title="连接钱包后即可发币"
        desc="香蕉猫发射台支持 LP 锁仓自选,做出最诚实的代币"
        fee={fee.fee}
        symbol={fee.symbol}
        onConnect={connect}
      />
    )
  }

  // 当前税率用途对应的字段提示
  const taxUseFieldHint: Record<TaxUse, string> = {
    recipient:  '接收钱包地址 · 留空则默认发给发币者',
    burn:       '无需填写 · 买入的代币直接发送至死亡地址',
    holders:    '无需填写 · 按持仓比例自动分配给所有持有者',
    liquidity:  '无需填写 · 自动 swap 一半添加进流动性池',
    dividend:   '分红 ERC20 代币地址 · 例如 USDT: 0x55d3...',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 顶部信息条 */}
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{chainConfig.emoji}</span>
          <div>
            <div className="text-sm font-bold">{chainConfig.nameCn}</div>
            <div className="text-xs text-muted font-mono">Chain #{chainConfig.id}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">发币费用</span>
          <span className="font-bold text-banana font-mono">{fee.fee} {fee.symbol}</span>
        </div>
      </div>

      {/* 单页竖流标题 */}
      <div className="text-center py-2 animate-fade-in">
        <div className="inline-flex items-center gap-2 text-xs font-mono text-muted mb-2 tracking-widest">
          <span className="text-banana">┌─</span>
          <span>CREATE TOKEN</span>
          <span className="text-cat">─┐</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tighter text-gradient-banana">
          🍌 一页填完,即可发币
        </h1>
        <p className="text-sm text-secondary mt-2 max-w-xl mx-auto">
          所有字段竖着排列,填完直接发币。遇到不懂的字段?展开右上角「?」获取详细说明。
        </p>
      </div>

      {/* 成功提示 */}
      {txHash && (
        <div className="glass-premium rounded-2xl p-6 animate-slide-up relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-30 blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(52, 211, 153, 0.6), transparent 70%)' }}></div>
          <div className="relative space-y-3 text-center">
            <div className="text-6xl animate-float inline-block">🎉</div>
            <h2 className="font-display text-2xl font-black text-gradient-banana">代币创建成功!</h2>
            <div className="glass rounded-xl p-3 font-mono text-xs break-all">
              <span className="text-muted">TX: </span>
              <span className="text-banana">{txHash}</span>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link to="/my-tokens" className="btn-banana text-sm">查看我的代币 →</Link>
              <Link to="/tokens" className="btn-glass text-sm">浏览代币列表</Link>
            </div>
          </div>
        </div>
      )}

      {error && <InfoBadge type="danger" icon="❌">{error}</InfoBadge>}

      {/* ========== 1. 基本信息 ========== */}
      <Section icon="📝" title="基本信息" subtitle="代币的核心标识 · 一旦上链不可修改" index={0}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="代币名称" required hint={`${name.length}/50`}>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="例如: Bitcoin Cat" maxLength={50} className="banana-input" />
          </Field>
          <Field label="代币符号" required hint={`${symbol.length}/10`}>
            <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="例如: BCAT" maxLength={10}
              className="banana-input uppercase font-mono font-bold tracking-wider" />
          </Field>
        </div>

        <Field label="Logo" optional>
          <LogoUpload value={imageUrl} onChange={(url) => setImageUrl(url)} />
          {imageUrl && isValidUrl(imageUrl) && !imageUrl.includes('blob:') && (
            <img src={imageUrl} alt="preview"
              className="mt-3 w-20 h-20 rounded-2xl object-cover border border-white/10"
              onError={e => (e.currentTarget.style.display = 'none')} />
          )}
        </Field>

        <Field label="描述" optional hint={`${description.length}/500`}>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="介绍你的代币,愿景、卖点、亮点..." rows={3} maxLength={500}
            className="banana-input resize-none leading-relaxed" />
        </Field>
      </Section>

      {/* ========== 2. 分类 ========== */}
      <Section icon="🏷️" title="代币分类" subtitle="告诉平台这是什么类型的代币" index={1}>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
          {TOKEN_LABELS.map((l, i) => {
            const active = label === l.value
            const color = (l.color || '').replace('text-', '').replace('-400', '') || '#fcd34d'
            return (
              <button
                key={i}
                onClick={() => setLabel(l.value)}
                className={`p-3 sm:p-4 rounded-xl border text-center transition-all duration-300 ease-out-expo relative overflow-hidden group ${
                  active ? 'scale-[1.04]' : 'scale-100 hover:scale-[1.02]'
                }`}
                style={
                  active
                    ? {
                        background: `linear-gradient(135deg, ${color}25, ${color}10)`,
                        borderColor: `${color}80`,
                        boxShadow: `0 0 24px ${color}30, inset 0 1px 0 rgba(255,255,255,0.08)`,
                      }
                    : {
                        background: 'rgba(255,255,255,0.02)',
                        borderColor: 'rgba(255,255,255,0.08)',
                      }
                }
              >
                {active && <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>}
                <div className="text-2xl mb-1 transition-transform group-hover:scale-110">{l.emoji}</div>
                <div className="font-bold text-xs" style={active ? { color } : { color: '#b8bdd6' }}>{l.label}</div>
              </button>
            )
          })}
        </div>
      </Section>

      {/* ========== 3. 社交链接 ========== */}
      <Section icon="🌐" title="社交链接" subtitle="全部可选,帮助交易者了解你的项目" index={2}>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="🌍 官网" optional>
            <input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
              placeholder="https://yourproject.com" className="banana-input" />
          </Field>
          <Field label="🐦 X / Twitter" optional>
            <input type="url" value={twitterUrl} onChange={e => setTwitterUrl(e.target.value)}
              placeholder="https://x.com/..." className="banana-input" />
          </Field>
          <Field label="✈️ Telegram" optional>
            <input type="url" value={telegramUrl} onChange={e => setTelegramUrl(e.target.value)}
              placeholder="https://t.me/..." className="banana-input" />
          </Field>
        </div>
      </Section>

      {/* ========== 4. 税率配置(全新:5 种使用场景) ========== */}
      <Section icon="💸" title="税率设置" subtitle="可选择零税率,或选一种税率用途让交易抽成流向指定去处" index={3}>
        <div className="space-y-5">
          {/* 税率数值 */}
          <Field label="税率" hint="0% - 10%">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTaxRate(Math.max(0, taxRate - 1))}
                  className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 hover:border-banana/40 hover:bg-banana/10 transition-all text-banana font-bold text-lg"
                >−</button>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min={0} max={10}
                    value={taxRate}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (!isNaN(v)) setTaxRate(Math.max(0, Math.min(10, v)))
                    }}
                    className="banana-input text-center font-mono font-bold text-lg"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">%</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTaxRate(Math.min(10, taxRate + 1))}
                  className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 hover:border-banana/40 hover:bg-banana/10 transition-all text-banana font-bold text-lg"
                >+</button>
              </div>
              {/* 快速选择 */}
              <div className="flex gap-2 flex-wrap">
                {[0, 1, 3, 5, 10].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTaxRate(v)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      taxRate === v
                        ? 'bg-banana text-dark-300 scale-105'
                        : 'bg-white/5 text-muted hover:bg-white/10'
                    }`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>
          </Field>

          {/* 税率使用场景 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-secondary">资金流向</label>
              <span className="text-[0.65rem] font-mono text-muted">当税率 {'>'} 0 时必选</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {TAX_USE_OPTIONS.map(opt => {
                const active = taxUse === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTaxUse(opt.value)}
                    disabled={taxRate === 0}
                    className={`p-4 rounded-xl border text-left transition-all duration-300 ease-out-expo relative overflow-hidden group ${
                      active ? 'scale-[1.02]' : 'scale-100 hover:scale-[1.01]'
                    } ${taxRate === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    style={
                      active
                        ? {
                            background: `linear-gradient(135deg, ${opt.color}25, ${opt.color}10)`,
                            borderColor: `${opt.color}80`,
                            boxShadow: `0 0 24px ${opt.color}30, inset 0 1px 0 rgba(255,255,255,0.08)`,
                          }
                        : {
                            background: 'rgba(255,255,255,0.02)',
                            borderColor: 'rgba(255,255,255,0.08)',
                          }
                    }
                  >
                    {active && <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>}
                    <div className="flex items-start gap-3">
                      <div className="text-2xl shrink-0">{opt.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm mb-1" style={active ? { color: opt.color } : { color: '#f5f6ff' }}>
                          {opt.label}
                        </div>
                        <div className="text-[0.7rem] text-muted leading-relaxed">{opt.desc}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 当前用途的额外字段 */}
          {taxRate > 0 && (
            <div className="space-y-4 p-5 rounded-2xl glass animate-slide-up" style={{ borderLeft: '3px solid #fcd34d' }}>
              <InfoBadge type="info" icon="💡">
                当前配置: 每笔交易抽 <span className="font-mono font-bold">{taxRate}%</span> 流向 <span className="font-bold">{TAX_USE_OPTIONS.find(o => o.value === taxUse)?.label}</span>
              </InfoBadge>

              {taxUse === 'recipient' && (
                <Field label="接收钱包地址" optional>
                  <input type="text" value={taxRecipient} onChange={e => setTaxRecipient(e.target.value)}
                    placeholder={taxUseFieldHint.recipient} className="banana-input font-mono text-sm" />
                </Field>
              )}

              {taxUse === 'burn' && (
                <InfoBadge type="success" icon="🔥">
                  买入即销毁,代币总供应量会持续减少。这是一个通缩机制,长期持有者会受益。
                </InfoBadge>
              )}

              {taxUse === 'holders' && (
                <InfoBadge type="success" icon="👥">
                  所有持有者按持仓比例自动获得分红。需要合约支持 reflections(标准 ERC20 扩展)。
                </InfoBadge>
              )}

              {taxUse === 'liquidity' && (
                <InfoBadge type="success" icon="💧">
                  每笔交易的一部分自动加进 PancakeSwap/Uniswap 的流动性池,深度自动增长,价格更稳定。
                </InfoBadge>
              )}

              {taxUse === 'dividend' && (
                <Field label="分红 ERC20 代币地址" required>
                  <input type="text" value={dividendToken} onChange={e => setDividendToken(e.target.value)}
                    placeholder={taxUseFieldHint.dividend} className="banana-input font-mono text-sm" />
                </Field>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* ========== 5. 交易设置 ========== */}
      <Section icon="⚙️" title="交易设置" subtitle="限制单地址最大买入量 / 延迟开盘" index={4}>
        <Field label="单地址最大买入量" optional>
          <div className="flex items-center gap-3 flex-wrap">
            <Toggle
              checked={maxBuyEnabled}
              onChange={setMaxBuyEnabled}
              label="启用单地址限制"
              desc="防止一人独大鲸吞"
            />
            {maxBuyEnabled && (
              <input type="number" value={maxBuyAmount} onChange={e => setMaxBuyAmount(e.target.value)}
                placeholder="例如: 1000000" className="banana-input flex-1 min-w-[200px]" />
            )}
          </div>
        </Field>

        <Field label="发币时间" optional>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { value: 'now', emoji: '🚀', label: '立即发币', desc: '上链后立刻可交易' },
              { value: 'schedule', emoji: '⏰', label: '定时发币', desc: '预留准备时间' },
            ].map(opt => {
              const active = launchMode === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLaunchMode(opt.value as any)}
                  className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                    active ? 'scale-[1.02]' : 'hover:scale-[1.01]'
                  }`}
                  style={active
                    ? {
                        background: 'linear-gradient(135deg, rgba(252,211,77,0.15), rgba(252,211,77,0.05))',
                        borderColor: 'rgba(252,211,77,0.5)',
                        boxShadow: '0 0 24px rgba(252,211,77,0.2)',
                      }
                    : {
                        background: 'rgba(255,255,255,0.02)',
                        borderColor: 'rgba(255,255,255,0.08)',
                      }
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{opt.emoji}</div>
                    <div>
                      <div className="font-bold text-sm" style={active ? { color: '#fcd34d' } : {}}>{opt.label}</div>
                      <div className="text-[0.7rem] text-muted">{opt.desc}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          {launchMode === 'schedule' && (
            <input type="datetime-local" value={launchTime} onChange={e => setLaunchTime(e.target.value)}
              className="banana-input mt-3" />
          )}
        </Field>
      </Section>

      {/* ========== 6. 反狙击 ========== */}
      <Section icon="🎯" title="反狙击模式" subtitle="前 N 个区块对买入收高税,吓阻机器人抢跑" index={5}>
        <Toggle
          checked={antiSniperEnabled}
          onChange={setAntiSniperEnabled}
          label="启用反狙击"
          desc="开启后,前 N 个区块买入会被收较高税,每区块递减"
        />

        {antiSniperEnabled && (
          <div className="space-y-4 p-5 rounded-2xl glass animate-slide-up" style={{ borderLeft: '3px solid #fb7185' }}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="起始买入税" hint="1-50%">
                <select value={sniperStartTax} onChange={e => setSniperStartTax(Number(e.target.value))} className="banana-input font-mono">
                  {[10, 20, 30, 40, 50].map(v => <option key={v} value={v}>{v}%</option>)}
                </select>
              </Field>
              <Field label="持续区块数" hint="1-300" mono>
                <NumberStepper value={sniperBlocks} onChange={setSniperBlocks} min={1} max={300} step={1} />
              </Field>
            </div>

            <div className="p-4 rounded-xl glass-strong">
              <p className="text-xs text-muted font-mono uppercase mb-2">📊 生效预览(假设每区块 -1%)</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="text-lg font-black text-red-400">{sniperStartTax}%</div>
                  <div className="text-[0.65rem] text-muted mt-0.5">第 1 块</div>
                </div>
                <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="text-lg font-black text-yellow-400">~1%</div>
                  <div className="text-[0.65rem] text-muted mt-0.5">第 {Math.ceil(sniperStartTax)} 块</div>
                </div>
                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="text-lg font-black text-green-400">0%</div>
                  <div className="text-[0.65rem] text-muted mt-0.5">第 {sniperBlocks} 块起</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ========== 7. LP 锁仓 ========== */}
      <Section icon="🔐" title="LP 锁仓" subtitle="差异化功能:发币者自选锁仓期限" index={6}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {LOCK_PERIOD_OPTIONS.map(opt => {
            const active = lockPeriod === opt.value
            const color = opt.color.includes('red-500') ? '#fb7185'
                       : opt.color.includes('yellow') ? '#fcd34d'
                       : opt.color.includes('green') ? '#34d399'
                       : opt.color.includes('gray') ? '#94a3b8' : '#fcd34d'
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLockPeriod(opt.value)}
                className={`p-3 rounded-xl border text-center transition-all duration-300 ${
                  active ? 'scale-[1.03]' : 'hover:scale-[1.02]'
                }`}
                style={active
                  ? {
                      background: `linear-gradient(135deg, ${color}25, ${color}10)`,
                      borderColor: `${color}80`,
                      boxShadow: `0 0 24px ${color}30, inset 0 1px 0 rgba(255,255,255,0.08)`,
                    }
                  : {
                      background: 'rgba(255,255,255,0.02)',
                      borderColor: 'rgba(255,255,255,0.08)',
                    }
                }
              >
                {active && <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>}
                <div className="text-2xl mb-1">{opt.emoji}</div>
                <div className="font-bold text-sm" style={active ? { color } : { color: '#f5f6ff' }}>{opt.label}</div>
                {opt.desc && <div className="text-[0.65rem] text-muted mt-1 leading-snug">{opt.desc}</div>}
              </button>
            )
          })}
        </div>

        <InfoBadge type="info" icon="📌">
          <div className="space-y-1">
            <p><span className="text-banana font-bold">锁仓规则:</span></p>
            <ul className="space-y-0.5 text-xs">
              <li>• 锁仓期内,发币者本人也无法提取 LP</li>
              <li>• 到期后,进入「LP 解锁面板」可三选一: 提取 / 续锁 / 销毁</li>
              <li>• 永久销毁:LP 直接烧毁,包括发币者在内谁都拿不出来</li>
            </ul>
          </div>
        </InfoBadge>
      </Section>

      {/* ========== 8. 费用预览 + 创建按钮 ========== */}
      <Section icon="🚀" title="费用预览" subtitle="确认所有设置后即可发币" index={7} variant="highlight">
        <div className="space-y-2.5 text-sm">
          <FeeRow label="发币费用" value={`${fee.fee} ${fee.symbol}`} />
          <FeeRow label="毕业后目标" value={`24 ${chainConfig.nativeCurrency.symbol}`} />
          <FeeRow
            label="税率用途"
            value={taxRate === 0 ? '零税率' : `${taxRate}% → ${TAX_USE_OPTIONS.find(o => o.value === taxUse)?.label}`}
          />
          <FeeRow label="锁仓期限" value={LOCK_PERIOD_OPTIONS.find(o => o.value === lockPeriod)?.label || '—'} />
        </div>

        <button
          onClick={handleCreate}
          disabled={isCreating || !name || !symbol}
          className="w-full btn-banana py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed mt-4"
        >
          {isCreating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">🍌</span>
              发币中...
            </span>
          ) : (
            <>🍌 创建 {name || '代币'} ({symbol || '???'})</>
          )}
        </button>

        <InfoBadge type="warning">
          测试网版本 · 代币仅供演示,请勿投入真实资产
        </InfoBadge>
      </Section>
    </div>
  )
}

function FeeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
      <span className="text-muted text-sm">{label}</span>
      <span className="text-banana font-bold font-mono">{value}</span>
    </div>
  )
}
