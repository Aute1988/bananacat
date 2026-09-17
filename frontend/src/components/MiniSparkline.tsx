/**
 * MiniSparkline - 迷你走势图(SVG 绘制)
 * @param data 数组(价格数组 / 数值数组)
 * @param color 颜色(默认根据涨跌自动)
 * @param height 高度
 * @param showFill 是否填充渐变(默认 true)
 * @param width 宽度(默认 100%)
 */
interface Props {
  data: number[]
  color?: string
  height?: number
  showFill?: boolean
  strokeWidth?: number
  className?: string
}

export default function MiniSparkline({
  data,
  color,
  height = 32,
  showFill = true,
  strokeWidth = 1.5,
  className = '',
}: Props) {
  if (!data || data.length < 2) {
    return <div style={{ height }} className={`flex items-center justify-center text-gray-600 text-xs ${className}`}>—</div>
  }

  // 自动判断涨跌
  const isUp = data[data.length - 1] >= data[0]
  const strokeColor = color || (isUp ? '#22c55e' : '#ef4444')
  const fillColor = isUp ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const width = 100
  const stepX = width / (data.length - 1)
  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 2) - 1
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')

  const fillPoints = `0,${height} ${points} ${width},${height}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: '100%', height }}
    >
      {showFill && <polygon points={fillPoints} fill={fillColor} />}
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
