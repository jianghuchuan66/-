"use client"

import { useEffect, useRef } from "react"

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

    // 叶子形状
    const drawLeaf = (x: number, y: number, size: number, rotation: number, opacity: number) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      ctx.globalAlpha = opacity
      
      ctx.beginPath()
      ctx.moveTo(0, -size)
      ctx.bezierCurveTo(size * 0.5, -size * 0.5, size * 0.5, size * 0.5, 0, size)
      ctx.bezierCurveTo(-size * 0.5, size * 0.5, -size * 0.5, -size * 0.5, 0, -size)
      ctx.fillStyle = "rgba(76, 175, 120, 0.15)"
      ctx.fill()
      
      // 叶脉
      ctx.beginPath()
      ctx.moveTo(0, -size * 0.8)
      ctx.lineTo(0, size * 0.8)
      ctx.strokeStyle = "rgba(76, 175, 120, 0.2)"
      ctx.lineWidth = 1
      ctx.stroke()
      
      ctx.restore()
    }

    // 圆形装饰
    const drawCircle = (x: number, y: number, radius: number, opacity: number) => {
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(76, 175, 120, ${opacity * 0.06})`
      ctx.fill()
      ctx.strokeStyle = `rgba(76, 175, 120, ${opacity * 0.12})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // 波浪线
    const drawWave = (startY: number, amplitude: number, frequency: number, opacity: number, offset: number) => {
      ctx.beginPath()
      ctx.moveTo(0, startY)
      for (let x = 0; x <= canvas.width; x += 5) {
        const y = startY + Math.sin((x * frequency + offset) * 0.01) * amplitude
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(76, 175, 120, ${opacity})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // 漂浮的叶子
    const leaves: Array<{
      x: number
      y: number
      size: number
      rotation: number
      speed: number
      rotationSpeed: number
      opacity: number
    }> = []

    for (let i = 0; i < 18; i++) {
      leaves.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 18 + Math.random() * 30,
        rotation: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.25,
        rotationSpeed: (Math.random() - 0.5) * 0.008,
        opacity: 0.4 + Math.random() * 0.4,
      })
    }

    // 装饰圆圈
    const circles: Array<{
      x: number
      y: number
      radius: number
      opacity: number
    }> = []

    for (let i = 0; i < 10; i++) {
      circles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 50 + Math.random() * 120,
        opacity: 0.4 + Math.random() * 0.5,
      })
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      time += 0.5

      // 绘制背景渐变
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      gradient.addColorStop(0, "#f0fdf4")
      gradient.addColorStop(0.5, "#ecfdf5")
      gradient.addColorStop(1, "#f0fdfa")
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // 绘制波浪
      drawWave(canvas.height * 0.25, 35, 2.5, 0.1, time * 0.4)
      drawWave(canvas.height * 0.45, 28, 3.5, 0.08, time * 0.6 + 100)
      drawWave(canvas.height * 0.65, 40, 2, 0.06, time * 0.3 + 200)
      drawWave(canvas.height * 0.85, 30, 3, 0.05, time * 0.5 + 300)

      // 绘制圆圈
      circles.forEach((circle) => {
        drawCircle(circle.x, circle.y, circle.radius, circle.opacity)
      })

      // 绘制和更新叶子
      leaves.forEach((leaf) => {
        drawLeaf(leaf.x, leaf.y, leaf.size, leaf.rotation, leaf.opacity)
        
        leaf.y += leaf.speed
        leaf.rotation += leaf.rotationSpeed
        leaf.x += Math.sin(time * 0.015 + leaf.y * 0.008) * 0.4

        if (leaf.y > canvas.height + leaf.size) {
          leaf.y = -leaf.size
          leaf.x = Math.random() * canvas.width
        }
      })

      // 绘制网格点装饰
      const dotSpacing = 50
      for (let x = dotSpacing; x < canvas.width; x += dotSpacing) {
        for (let y = dotSpacing; y < canvas.height; y += dotSpacing) {
          ctx.beginPath()
          ctx.arc(x, y, 2, 0, Math.PI * 2)
          ctx.fillStyle = "rgba(76, 175, 120, 0.08)"
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
