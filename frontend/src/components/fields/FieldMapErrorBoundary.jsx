import { Component } from 'react'

/**
 * 地图区错误边界。
 *
 * 为什么需要它：`window.AMap` 被声明为 any（SDK 无官方类型），而 FieldMapCanvas 是
 * .jsx、不在 tsc 的编译程序内 —— 把 Marker 专有的 setzIndex / setCenter 用到
 * Polygon / Marker 上这类错误，构建期与单测都发现不了，只会在运行时抛 TypeError。
 * 没有边界时，一次 SDK 误用就会让整个地块管理页白屏（工具栏与侧栏一起死）。
 * 这里把爆炸半径限制在地图区：出错时页面其余部分仍可用，并提供重试。
 *
 * 注意：边界会吞掉错误，所以 componentDidCatch 必须打日志，否则线上问题会彻底消失。
 */
class FieldMapErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[FieldMapErrorBoundary] 地图区渲染出错:', error, info)
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            height: '100%',
            padding: 24,
            textAlign: 'center',
            color: '#b91c1c',
            background: '#fef2f2',
          }}
        >
          <strong>地图加载失败</strong>
          <span style={{ fontSize: 13, wordBreak: 'break-all' }}>
            {String(error?.message ?? error)}
          </span>
          <button
            type="button"
            className="primary-btn"
            onClick={this.handleRetry}
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default FieldMapErrorBoundary
