/**
 * Vitest 全局 setup（由 vite.config.js 的 test.setupFiles 引用）。
 *
 * - jest-dom：补 toBeInTheDocument / toBeVisible 等 DOM 断言
 * - cleanup：每个用例后卸载 React 树，避免多个 render 的 DOM 互相串味
 *   （globals: true 时 RTL 也会自动 cleanup，这里显式写是为了不依赖那个隐式行为）
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
