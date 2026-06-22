/**
 * 3D 粒子背景 — 白色渲染
 * - 漂浮白色叶片 + 光晕圆圈 + 波浪线 + 网格光点
 * - 默认透出页面深色背景，有自定义色时透出自定义色
 * - 所有粒子使用白色，对比度明显
 */
"use client"

import { useEffect, useRef } from "react"

interface ParticleBackgroundProps {
  /** 自定义背景色，不为 null 时跳过默认暗色渐变 */
  customBgColor?: { r: number; g: number; b: number } | null
}

export function ParticleBackground({ customBgColor = null }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgColorRef = useRef(customBgColor)
  bgColorRef.current = customBgColor

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    let time = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    // ============ 白色叶片 ============
    const drawLeaf = (
      x: number, y: number, size: number,
      rotation: number, opacity: number,
    ) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      ctx.globalAlpha = opacity

      // 叶片主体
      ctx.beginPath()
      ctx.moveTo(0, -size)
      ctx.bezierCurveTo(size * 0.5, -size * 0.5, size * 0.5, size * 0.5, 0, size)
      ctx.bezierCurveTo(-size * 0.5, size * 0.5, -size * 0.5, -size * 0.5, 0, -size)
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)"
      ctx.fill()

      // 叶脉
      ctx.beginPath()
      ctx.moveTo(0, -size * 0.8)
      ctx.lineTo(0, size * 0.8)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)"
      ctx.lineWidth = 1.2
      ctx.stroke()

      // 外发光
      ctx.shadowColor = "rgba(255, 255, 255, 0.3)"
      ctx.shadowBlur = 6

      ctx.restore()
    }

    // ============ 光晕圆圈 ============
    const drawCircle = (x: number, y: number, radius: number, opacity: number) => {
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.1})`
      ctx.fill()
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.25})`
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    // ============ 波浪线 ============
    const drawWave = (
      startY: number, amplitude: number, frequency: number,
      opacity: number, offset: number,
    ) => {
      ctx.beginPath()
      ctx.moveTo(0, startY)
      for (let x = 0; x <= canvas.width; x += 5) {
        const y = startY + Math.sin((x * frequency + offset) * 0.01) * amplitude
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    // ============ 粒子数据 ============

    // 漂浮叶片（25 片，比原来多）
    const leaves: Array<{
      x: number; y: number; size: number
      rotation: number; speed: number
      rotationSpeed: number; opacity: number
    }> = []
    for (let i = 0; i < 25; i++) {
      leaves.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 25 + Math.random() * 40,   // 25-65px（更大）
        rotation: Math.random() * Math.PI * 2,
        speed: 0.12 + Math.random() * 0.3,
        rotationSpeed: (Math.random() - 0.5) * 0.01,
        opacity: 0.5 + Math.random() * 0.45, // 0.5-0.95（更不透明）
      })
    }

    // 光晕圆圈（15 个）
    const circles: Array<{
      x: number; y: number; radius: number; opacity: number
    }> = []
    for (let i = 0; i < 15; i++) {
      circles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 60 + Math.random() * 150,
        opacity: 0.5 + Math.random() * 0.45,
      })
    }

    // ============ 动画循环 ============
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      time += 0.5

      // 背景：无自定义色时绘制暗色渐变（衬托白色粒子）
      if (!bgColorRef.current) {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
        gradient.addColorStop(0, "#0a0a0a")
        gradient.addColorStop(0.5, "#0d0d0d")
        gradient.addColorStop(1, "#080808")
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      // 有自定义色时 canvas 透明，让下层背景色透出

      // 波浪
      drawWave(canvas.height * 0.22, 40, 2.5, 0.15, time * 0.4)
      drawWave(canvas.height * 0.42, 32, 3.5, 0.12, time * 0.6 + 100)
      drawWave(canvas.height * 0.62, 45, 2,  0.09, time * 0.3 + 200)
      drawWave(canvas.height * 0.82, 35, 3,  0.07, time * 0.5 + 300)

      // 光晕圆圈
      circles.forEach((circle) => {
        drawCircle(circle.x, circle.y, circle.radius, circle.opacity)
      })

      // 漂浮叶片
      leaves.forEach((leaf) => {
        drawLeaf(leaf.x, leaf.y, leaf.size, leaf.rotation, leaf.opacity)
        leaf.y += leaf.speed
        leaf.rotation += leaf.rotationSpeed
        leaf.x += Math.sin(time * 0.015 + leaf.y * 0.008) * 0.5

        if (leaf.y > canvas.height + leaf.size) {
          leaf.y = -leaf.size
          leaf.x = Math.random() * canvas.width
        }
      })

      // 网格光点
      const dotSpacing = 55
      for (let x = dotSpacing; x < canvas.width; x += dotSpacing) {
        for (let y = dotSpacing; y < canvas.height; y += dotSpacing) {
          // 光点呼吸效果
          const pulse = 0.6 + 0.4 * Math.sin(time * 0.03 + x * 0.01 + y * 0.01)
          ctx.beginPath()
          ctx.arc(x, y, 2.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * pulse})`
          ctx.fill()
        }
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
    />
  )
}
