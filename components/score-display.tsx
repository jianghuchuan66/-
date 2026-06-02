"use client"

interface ScoreDisplayProps {
  score: number
  maxScore?: number
}

export function ScoreDisplay({ score, maxScore = 100 }: ScoreDisplayProps) {
  const percentage = (score / maxScore) * 100
  const getScoreLevel = () => {
    if (score >= 90) return { label: "卓越", glow: true }
    if (score >= 80) return { label: "优秀", glow: true }
    if (score >= 70) return { label: "良好", glow: false }
    if (score >= 60) return { label: "一般", glow: false }
    return { label: "待优化", glow: false }
  }

  const { label, glow } = getScoreLevel()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <span 
          className="text-5xl font-extralight tracking-tight text-white"
          style={glow ? { textShadow: "0 0 20px rgba(255,255,255,0.3)" } : {}}
        >
          {score}
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white/90">{label}</span>
          <span className="text-xs text-white/40">满分 {maxScore}</span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-white/60 to-white transition-all duration-700 ease-out rounded-full"
          style={{ 
            width: `${percentage}%`,
            boxShadow: "0 0 10px rgba(255,255,255,0.4)"
          }}
        />
      </div>
    </div>
  )
}
