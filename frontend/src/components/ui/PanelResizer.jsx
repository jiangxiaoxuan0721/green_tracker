import { useCallback, useEffect, useRef, useState } from 'react'
import './PanelResizer.css'

/** 键盘微调步长（px） */
const KEYBOARD_STEP = 16

/**
 * 面板宽度拖拽条
 *
 * 用在「左侧内容区 / 拖拽条 / 右侧可调宽面板」这种三段式横向布局的中间那一根，
 * 右侧面板宽度拖右变小、拖左变大（键盘 ←/→ 微调，双击复位）。
 *
 * 只管交互与视觉，宽度存哪里由使用方决定（可以是 store、也可以是页面 state）。
 * 容器宽度取的是**父元素**的 rect，因此使用方不必再传容器 ref ——
 * 前提是拖拽条必须是那段横向容器的直接子元素。
 *
 * @param width            右侧面板当前宽度（受控值）
 * @param onResize         宽度变化回调，拖拽与键盘都走这里
 * @param onReset          双击复位回调
 * @param min              右侧面板最小宽度
 * @param max              右侧面板最大宽度
 * @param minLeadingWidth  拖拽条左侧内容区至少要留的宽度（防止把左边挤没）
 * @param onDragStart/onDragEnd 可选：拖拽开始/结束通知，供使用方加全局态（如整块容器禁止选中）
 */
const PanelResizer = ({
  label = '调整面板宽度',
  width,
  onResize,
  onReset,
  min,
  max,
  minLeadingWidth,
  onDragStart,
  onDragEnd,
}) => {
  const elRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  /** 结束拖拽的统一入口，组件卸载时也要能摘掉 window 监听 */
  const stopRef = useRef(null)

  const clampWidth = useCallback(
    (raw) => {
      const containerWidth = elRef.current?.parentElement?.clientWidth || max + minLeadingWidth
      const upper = Math.max(min, Math.min(max, containerWidth - minLeadingWidth))
      return Math.round(Math.min(Math.max(raw, min), upper))
    },
    [max, min, minLeadingWidth]
  )

  const handlePointerDown = useCallback(
    (e) => {
      if (e.button !== undefined && e.button !== 0) return
      e.preventDefault()
      // 拖全程用按下瞬间的容器右边界换算，避免每帧读布局
      const rect = elRef.current?.parentElement?.getBoundingClientRect()
      if (!rect) return

      const onMove = (ev) => onResize(clampWidth(rect.right - ev.clientX))
      const stop = () => {
        stopRef.current = null
        setDragging(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', stop)
        window.removeEventListener('pointercancel', stop)
        onDragEnd?.()
      }

      stopRef.current = stop
      setDragging(true)
      onDragStart?.()
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', stop)
      window.addEventListener('pointercancel', stop)
    },
    [clampWidth, onResize, onDragStart, onDragEnd]
  )

  // 兜底：拖到一半切页会留下常驻监听，指针一松就在 window 上继续跑
  useEffect(() => () => stopRef.current?.(), [])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      onResize(clampWidth(width + (e.key === 'ArrowLeft' ? KEYBOARD_STEP : -KEYBOARD_STEP)))
    },
    [clampWidth, onResize, width]
  )

  return (
    <div
      ref={elRef}
      className={`panel-resizer${dragging ? ' panel-resizer--active' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      title="拖拽调整宽度，双击复位"
      onPointerDown={handlePointerDown}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
    />
  )
}

export default PanelResizer
