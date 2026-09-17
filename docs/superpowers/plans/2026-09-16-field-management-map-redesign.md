# 地块管理界面重构（地图中心视图）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把地块管理页改造为「顶部工具栏 + 高德地图主视图 + 右侧信息侧栏」的地图工作台，支持 LOD 图层加载、地图绘制新建、侧栏内联编辑与二次确认删除，并新增 2 个只读后端端点支撑 LOD 取数。

**Architecture:** React 侧只保留两个状态源 `selectedPlotId` 与 `panelMode`，其余全部派生；地图封装为命令式组件 `FieldMapCanvas`（`forwardRef` + `useImperativeHandle`），React 不通过 props 驱动 overlays，避免 state 变化重建地图实例。坐标统一经 `utils/geo/crs.ts` 的 `toDisplay()` / `toStorage()` 出入，杜绝 WGS84/GCJ-02 混用。后端追加 `GET /api/fields/light` 与 `GET /api/fields/geometry?bbox=`，不改变任何现有接口。

**Tech Stack:** React 18 + Vite 5 + 高德地图 JS API 2.0（`window.AMap` 动态 script 加载）+ Axios；FastAPI + SQLAlchemy + GeoAlchemy2/PostGIS；vitest（新增）+ pytest。

**Spec:** `docs/superpowers/specs/2026-09-16-field-management-map-redesign.md`

---

## Global Constraints

- 库内几何存储 **WGS84**（`Geometry('POLYGON', srid=4326)`）；高德使用 **GCJ-02**；渲染前必须 `toDisplay()`，写库前必须 `toStorage()`
- 坐标一律使用 **`[lng, lat]` 数组**形态，不用 `{lng, lat}` 对象
- 所有 `import.meta.env` 读取必须经过 `frontend/src/config/env.ts`，业务代码禁止直接读取
- 后端新端点 `GET /api/fields/light` 与 `GET /api/fields/geometry` **必须注册在 `/{field_id}` 路由之前**
- 后端新增函数必须同时提供 `HAS_POSTGIS` 为真/假两条分支（参照现有 `get_field_with_wkt` 写法）
- 面积**后端唯一权威**：前端提交 `area_m2: null`，由后端 `calculate_and_update_area` 计算回写
- 页面上**不存在任何弹窗**：新建/编辑/删除的表单与确认全部内联在右侧信息面板
- LOD 阈值：`zoom >= 13.0` 切多边形，`zoom < 12.8` 切回聚合点；`moveend`/`zoomend` 节流 300ms；bbox 外扩 20%
- 提交信息使用 Conventional Commits（如 `feat:` / `fix:` / `refactor:`），中文正文

---

## 文件结构总览

**新增（前端）**

```
frontend/src/utils/geo/
  crs.ts                 WGS84 ↔ GCJ-02 + 源坐标系开关
  wkt.ts                 parseWKT / toWKT / centroidOf / boundsOf / areaOf
  cluster.ts             clusterInScreenSpace / expandBbox / boundsToBbox / isBboxValid
  index.ts               统一出口
frontend/src/hooks/fields/
  useAMap.ts             高德 SDK 单例加载
  useFieldCatalog.ts     light 列表 + byId 索引
  useFieldGeometry.ts    LOD 取数 + 几何缓存
  useFieldDraw.ts        绘制态编排
frontend/src/components/fields/
  FieldMapCanvas.jsx     地图渲染 + 绘制，ref 命令式 API
  FieldMapCanvas.css
  FieldToolbar.jsx       下拉 / 新建 / 折叠
  FieldToolbar.css
  FieldSidePanel.jsx     五态容器
  FieldSidePanel.css
  FieldFormFields.jsx    属性字段组（create/edit 共用）
frontend/src/pages/Dashboard/Fields/
  Fields.jsx             编排层（整体重写）
  Fields.css
```

**删除（前端）**

- `frontend/src/pages/Dashboard/Fields/components/FieldForm.jsx`
- `frontend/src/pages/Dashboard/Fields/components/FieldDetail.jsx`
- `frontend/src/components/map/`（整个目录：`FieldMapPicker.jsx` / `MapDisplay.jsx` / `map.css` / `index.js`）

**修改（后端）**

- `backend/database/db_services/field_service.py`（追加 4 个函数 + `import re`）
- `backend/api/schemas/field.py`（追加 2 个 schema）
- `backend/api/routes/field.py`（追加 2 个路由 + 1 个校验函数，插在 `/{field_id}` 之前）

**修改（前端）**

- `frontend/src/services/fieldService.ts`（追加 3 个类型 + 2 个方法）
- `frontend/src/config/env.ts`（追加 `FIELD_SOURCE_CRS`）
- `frontend/package.json` + `frontend/vite.config.js`（vitest）

---

## Task 1: 搭建前端单元测试环境（vitest）

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.js`
- Modify: `frontend/src/utils/ndjsonStream.test.ts`（移除临时注释）
- Verify: `frontend/src/store/useDeployTasksStore.test.ts`、`frontend/src/components/deploy/DeployTasksFab.test.tsx`

**背景：** 仓库已有 3 个用 vitest 语法写的测试文件，但 `package.json` 没有 test script、没装 vitest。`ndjsonStream.test.ts` 第 1–3 行注释写着「需要 vitest 跑（frontend/package.json 暂无 test script）」并带 `@ts-nocheck`。本任务装上 vitest 并解锁它们。

**Interfaces:**
- Produces: `npm run test`（`vitest run`）、`npm run test:watch`（`vitest`）两个 script

- [ ] **Step 1: 安装 vitest**

```bash
cd frontend && npm i -D vitest@^2.1.9
```

- [ ] **Step 2: 在 package.json 增加 test script**

在 `scripts` 对象的 `"preview": "vite preview"` 之后追加（现有 script 为 `dev`/`build`/`typecheck`/`lint`/`preview`）：

```json
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: 在 vite.config.js 追加 test 配置**

`vite.config.js` 的默认导出是 `defineConfig(({ mode }) => { ... return { ... } })`。在 `return {` 之后、`envDir: projectRoot,` 之前插入：

```js
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}'],
      globals: true,
    },
```

- [ ] **Step 4: 移除 ndjsonStream.test.ts 的临时注释**

删除 `frontend/src/utils/ndjsonStream.test.ts` 第 1–3 行：

```ts
// NDJSON 解析器测试 —— 需要 vitest 跑（frontend/package.json 暂无 test script）
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- vitest 未安装；待 npm i -D vitest 后移除
```

- [ ] **Step 5: 运行测试确认既有 3 个测试通过**

```bash
cd frontend && npm run test 2>&1 | tail -30
```

预期：3 个测试文件全部 PASS。若 `DeployTasksFab.test.tsx` 报 `document is not defined`，把 Step 3 的 `environment` 改为 `'jsdom'` 并追加 `npm i -D jsdom`。

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/src/utils/ndjsonStream.test.ts
git commit -m "test: 安装 vitest 并解锁既有单元测试"
```

---

## Task 2: 坐标变换工具 `utils/geo/crs.ts`

**Files:**
- Create: `frontend/src/utils/geo/types.ts`
- Create: `frontend/src/utils/geo/crs.ts`
- Create: `frontend/src/utils/geo/crs.test.ts`
- Modify: `frontend/src/config/env.ts`

**Interfaces:**
- Consumes: `env`（来自 `@/config/env`）
- Produces: 类型 `LngLat` / `Bounds`（`types.ts`）；`wgs84ToGcj02` / `gcj02ToWgs84` / `toDisplay` / `toDisplayRing` / `toStorage` / `toStorageRing` / `SOURCE_CRS`

> **为什么类型单独放 `types.ts`**：`crs` / `wkt` / `cluster` 三个模块都要用 `LngLat`、`Bounds`。若把类型放在 `wkt.ts`（Task 3 才创建），本任务的 `crs.ts` 就会 import 一个尚不存在的模块，Task 2 的测试与 typecheck 必然失败。独立成无依赖的 `types.ts` 让依赖方向变得干净：`types.ts` ← `crs.ts` / `wkt.ts` / `cluster.ts`。

- [ ] **Step 1: 在 env.ts 追加 FIELD_SOURCE_CRS**

在 `env` 对象的 `AMAP_SECURITY_CODE` 一行之后插入：

```ts
  AMAP_SECURITY_CODE: readString(import.meta.env.VITE_AMAP_SECURITY_CODE, ''),

  /**
   * 库内地块几何的坐标系假设。
   * wgs84 = 库内存标准 WGS84，渲染需转 GCJ-02；
   * gcj02 = 存量数据直接存的是 GCJ-02，渲染不做变换。
   * 校准方法见 spec §6.3。
   */
  FIELD_SOURCE_CRS: readString(import.meta.env.VITE_FIELD_SOURCE_CRS, 'wgs84') as 'wgs84' | 'gcj02',
```

- [ ] **Step 2: 写失败测试**

`frontend/src/utils/geo/crs.test.ts`：

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { LngLat } from './wkt'

const BEIJING: LngLat = [116.397428, 39.90923]
const TOKYO: LngLat = [139.7003, 35.6595]

const loadCrs = async (crs: 'wgs84' | 'gcj02') => {
  vi.resetModules()
  vi.stubEnv('VITE_FIELD_SOURCE_CRS', crs)
  return import('./crs')
}

/** 两点球面距离（米），用于断言偏移量级 */
const distanceM = (a: LngLat, b: LngLat): number => {
  const R = 6378137
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLng = (b[0] - a[0]) * rad
  const lat = ((a[1] + b[1]) / 2) * rad
  return Math.hypot(dLng * Math.cos(lat), dLat) * R
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('wgs84ToGcj02', () => {
  it('round-trips wgs84 -> gcj02 -> wgs84 within 1e-6 deg', async () => {
    const { wgs84ToGcj02, gcj02ToWgs84 } = await loadCrs('wgs84')
    const back = gcj02ToWgs84(wgs84ToGcj02(BEIJING))
    expect(back[0]).toBeCloseTo(BEIJING[0], 6)
    expect(back[1]).toBeCloseTo(BEIJING[1], 6)
  })

  it('shifts a Beijing coordinate by 100m~1000m', async () => {
    const { wgs84ToGcj02 } = await loadCrs('wgs84')
    const d = distanceM(BEIJING, wgs84ToGcj02(BEIJING))
    expect(d).toBeGreaterThan(100)
    expect(d).toBeLessThan(1000)
  })

  it('leaves coordinates outside China untouched', async () => {
    const { wgs84ToGcj02, gcj02ToWgs84 } = await loadCrs('wgs84')
    expect(gcj02ToWgs84(wgs84ToGcj02(TOKYO))).toEqual(TOKYO)
  })
})

describe('toDisplay / toStorage', () => {
  it('toDisplay applies the transform when source is wgs84', async () => {
    const { toDisplay } = await loadCrs('wgs84')
    expect(toDisplay(BEIJING)).not.toEqual(BEIJING)
  })

  it('toDisplay is identity when source is gcj02', async () => {
    const { toDisplay } = await loadCrs('gcj02')
    expect(toDisplay(BEIJING)).toEqual(BEIJING)
  })

  it('toStorage reverses toDisplay', async () => {
    const { toDisplay, toStorage } = await loadCrs('wgs84')
    const shown = toDisplay(BEIJING)
    expect(toStorage(shown)[0]).toBeCloseTo(BEIJING[0], 6)
    expect(toStorage(shown)[1]).toBeCloseTo(BEIJING[1], 6)
  })

  it('toDisplayRing / toStorageRing map over every vertex', async () => {
    const { toDisplayRing, toStorageRing } = await loadCrs('wgs84')
    const ring: LngLat[] = [BEIJING, [116.4, 39.91], [116.39, 39.9]]
    const shown = toDisplayRing(ring)
    expect(shown).toHaveLength(3)
    const back = toStorageRing(shown)
    back.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(ring[i][0], 6)
      expect(p[1]).toBeCloseTo(ring[i][1], 6)
    })
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

```bash
cd frontend && npx vitest run src/utils/geo/crs.test.ts 2>&1 | tail -20
```

预期：FAIL，报 `Cannot find module './crs'`。

- [ ] **Step 4: 实现 types.ts**

`frontend/src/utils/geo/types.ts`：

```ts
/** 经纬度点，恒为 [经度, 纬度] */
export type LngLat = [number, number]

/** [[minLng, minLat], [maxLng, maxLat]] */
export type Bounds = [LngLat, LngLat]
```

- [ ] **Step 5: 实现 crs.ts**

`frontend/src/utils/geo/crs.ts`：

```ts
/**
 * WGS84 <-> GCJ-02 坐标变换。
 *
 * 背景：库内地块几何按 WGS84 存储（srid=4326），高德 JS API 使用 GCJ-02。
 * 不做变换会导致图斑与卫星底图偏移 300~500m。
 *
 * 所有渲染路径必须经 toDisplay()/toDisplayRing()；
 * 所有写库路径必须经 toStorage()/toStorageRing()。
 */
import { env } from '@/config/env'
import type { LngLat } from './types'

const PI = Math.PI
/** 克拉索夫斯基椭球长半轴 */
const A = 6378245.0
/** 偏心率平方 */
const EE = 0.00669342162296594323

const outOfChina = (lng: number, lat: number): boolean =>
  lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271

const transformLat = (x: number, y: number): number => {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0
  return ret
}

const transformLng = (x: number, y: number): number => {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0
  return ret
}

/** 返回 GCJ-02 相对 WGS84 的偏移量 [dLng, dLat] */
const delta = (lng: number, lat: number): LngLat => {
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = (lat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)
  return [dLng, dLat]
}

export const wgs84ToGcj02 = ([lng, lat]: LngLat): LngLat => {
  if (outOfChina(lng, lat)) return [lng, lat]
  const [dLng, dLat] = delta(lng, lat)
  return [lng + dLng, lat + dLat]
}

export const gcj02ToWgs84 = ([lng, lat]: LngLat): LngLat => {
  if (outOfChina(lng, lat)) return [lng, lat]
  const [dLng, dLat] = delta(lng, lat)
  return [lng - dLng, lat - dLat]
}

/** 库内地块几何的坐标系假设，由 VITE_FIELD_SOURCE_CRS 控制 */
export const SOURCE_CRS: 'wgs84' | 'gcj02' = env.FIELD_SOURCE_CRS

/** 库内坐标 -> 高德显示坐标 */
export const toDisplay = (p: LngLat): LngLat => (SOURCE_CRS === 'wgs84' ? wgs84ToGcj02(p) : p)

/** 高德显示坐标 -> 库内坐标 */
export const toStorage = (p: LngLat): LngLat => (SOURCE_CRS === 'wgs84' ? gcj02ToWgs84(p) : p)

export const toDisplayRing = (ring: LngLat[]): LngLat[] => ring.map(toDisplay)
export const toStorageRing = (ring: LngLat[]): LngLat[] => ring.map(toStorage)
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd frontend && npx vitest run src/utils/geo/crs.test.ts 2>&1 | tail -20
```

预期：6 个测试全部 PASS。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/geo/types.ts frontend/src/utils/geo/crs.ts frontend/src/utils/geo/crs.test.ts frontend/src/config/env.ts
git commit -m "feat: 新增 WGS84/GCJ-02 坐标变换工具"
```

---

## Task 3: WKT 工具 `utils/geo/wkt.ts`

**Files:**
- Create: `frontend/src/utils/geo/wkt.ts`
- Create: `frontend/src/utils/geo/wkt.test.ts`
- Create: `frontend/src/utils/geo/index.ts`

**Interfaces:**
- Produces: 类型 `LngLat` / `Bounds`；函数 `parseWKT` / `toWKT` / `centroidOf` / `boundsOf` / `areaOf`

- [ ] **Step 1: 写失败测试**

`frontend/src/utils/geo/wkt.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { parseWKT, toWKT, centroidOf, boundsOf, areaOf } from './wkt'
import type { LngLat } from './types'

const SQUARE_WKT =
  'POLYGON((116.0000 39.9000, 116.0010 39.9000, 116.0010 39.9010, 116.0000 39.9010, 116.0000 39.9000))'

describe('parseWKT', () => {
  it('parses an explicit POLYGON ring', () => {
    const ring = parseWKT(SQUARE_WKT)
    expect(ring).not.toBeNull()
    expect(ring![0]).toEqual([116.0, 39.9])
    expect(ring![2]).toEqual([116.001, 39.901])
  })

  it('drops the duplicated closing vertex', () => {
    expect(parseWKT(SQUARE_WKT)).toHaveLength(4)
  })

  it('is case-insensitive and tolerates extra whitespace', () => {
    expect(parseWKT('polygon( ( 116.0 39.9 , 116.1 39.9 , 116.1 40.0 ) )')).toHaveLength(3)
  })

  it('returns null for empty or malformed input', () => {
    expect(parseWKT('')).toBeNull()
    expect(parseWKT('POINT(116 39)')).toBeNull()
    expect(parseWKT('POLYGON((1 2))')).toBeNull()
  })
})

describe('toWKT', () => {
  it('round-trips through parseWKT', () => {
    const ring: LngLat[] = [
      [116.0, 39.9],
      [116.001, 39.9],
      [116.001, 39.901],
    ]
    expect(parseWKT(toWKT(ring))).toEqual(ring)
  })

  it('closes the ring by repeating the first vertex', () => {
    const wkt = toWKT([
      [116.0, 39.9],
      [116.1, 39.9],
      [116.1, 40.0],
    ])
    expect(wkt.endsWith('116 39.9))')).toBe(true)
  })
})

describe('centroidOf', () => {
  it('returns the center of a symmetric square', () => {
    const ring: LngLat[] = [
      [116.0, 39.9],
      [116.001, 39.9],
      [116.001, 39.901],
      [116.0, 39.901],
    ]
    const c = centroidOf(ring)
    expect(c[0]).toBeCloseTo(116.0005, 6)
    expect(c[1]).toBeCloseTo(39.9005, 6)
  })

  it('falls back to the vertex mean for a degenerate ring', () => {
    const ring: LngLat[] = [
      [116.0, 39.9],
      [116.001, 39.9],
    ]
    expect(centroidOf(ring)[0]).toBeCloseTo(116.0005, 6)
  })
})

describe('boundsOf', () => {
  it('returns [[minLng,minLat],[maxLng,maxLat]]', () => {
    const ring: LngLat[] = [
      [116.5, 40.2],
      [116.1, 39.9],
      [116.9, 40.0],
    ]
    expect(boundsOf(ring)).toEqual([
      [116.1, 39.9],
      [116.9, 40.2],
    ])
  })
})

describe('areaOf', () => {
  it('approximates a ~85m x ~111m square at lat 39.9 as ~9500 m2', () => {
    const ring: LngLat[] = [
      [116.0, 39.9],
      [116.001, 39.9],
      [116.001, 39.901],
      [116.0, 39.901],
    ]
    expect(areaOf(ring)).toBeGreaterThan(9300)
    expect(areaOf(ring)).toBeLessThan(9700)
  })

  it('is orientation independent', () => {
    const ring: LngLat[] = [
      [116.0, 39.9],
      [116.001, 39.9],
      [116.001, 39.901],
      [116.0, 39.901],
    ]
    expect(areaOf(ring)).toBeCloseTo(areaOf([...ring].reverse()), 3)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd frontend && npx vitest run src/utils/geo/wkt.test.ts 2>&1 | tail -20
```

预期：FAIL，`Cannot find module './wkt'`。

- [ ] **Step 3: 实现 wkt.ts**

`frontend/src/utils/geo/wkt.ts`：

```ts
// LngLat / Bounds 定义于 types.ts（Task 2），此处只导入、不再重复声明，
// 避免 index.ts 的 `export *` 产生同名重复导出。
import type { Bounds, LngLat } from './types'

const RAD = Math.PI / 180
/** WGS84 长半轴，用于面积近似 */
const EARTH_R = 6378137

/**
 * 解析 'POLYGON((lng lat, ...))'，只取外环。
 * 自动去掉与首点重复的闭合点；非法输入返回 null。
 */
export const parseWKT = (wkt: string): LngLat[] | null => {
  if (!wkt) return null
  const match = /POLYGON\s*\(\s*\(([^)]*)\)/i.exec(wkt)
  if (!match) return null

  const ring = match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [lng, lat] = s.split(/\s+/).map(Number)
      return [lng, lat] as LngLat
    })
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))

  if (ring.length < 3) return null

  const [firstLng, firstLat] = ring[0]
  const [lastLng, lastLat] = ring[ring.length - 1]
  if (firstLng === lastLng && firstLat === lastLat) ring.pop()

  return ring.length >= 3 ? ring : null
}

/** 序列化为闭合的 POLYGON WKT（自动补回首点） */
export const toWKT = (ring: LngLat[]): string => {
  if (ring.length === 0) return ''
  const pts = [...ring]
  const [fl, fa] = pts[0]
  const [ll, la] = pts[pts.length - 1]
  if (fl !== ll || fa !== la) pts.push([fl, fa])
  return `POLYGON((${pts.map(([lng, lat]) => `${lng} ${lat}`).join(', ')}))`
}

/** 面积加权多边形质心；退化（面积为 0）时退化为顶点均值 */
export const centroidOf = (ring: LngLat[]): LngLat => {
  if (ring.length === 0) return [0, 0]
  if (ring.length < 3) {
    const [sl, sa] = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
    return [sl / ring.length, sa / ring.length]
  }

  let twiceArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length; i += 1) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[(i + 1) % ring.length]
    const cross = x0 * y1 - x1 * y0
    twiceArea += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }

  if (Math.abs(twiceArea) < 1e-12) {
    const [sl, sa] = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
    return [sl / ring.length, sa / ring.length]
  }

  const f = twiceArea * 3
  return [cx / f, cy / f]
}

export const boundsOf = (ring: LngLat[]): Bounds => {
  if (ring.length === 0)
    return [
      [0, 0],
      [0, 0],
    ]
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

/**
 * 球面近似面积（平方米）。仅用于侧栏绘制后的**预览**展示，
 * 权威面积由后端 calculate_and_update_area 计算，前端不提交该值。
 */
export const areaOf = (ring: LngLat[]): number => {
  if (ring.length < 3) return 0
  let total = 0
  for (let i = 0; i < ring.length; i += 1) {
    const [lng1, lat1] = ring[i]
    const [lng2, lat2] = ring[(i + 1) % ring.length]
    total += (lng2 - lng1) * RAD * (2 + Math.sin(lat1 * RAD) + Math.sin(lat2 * RAD))
  }
  return Math.abs((total * EARTH_R * EARTH_R) / 2)
}
```

- [ ] **Step 4: 创建 index.ts**

`frontend/src/utils/geo/index.ts`：

```ts
export * from './types'
export * from './wkt'
export * from './crs'
```

> **不要写 `export * from './cluster'`**——`cluster.ts` 由 Task 4 创建，现在写上会让 index.ts 指向不存在的模块。
> Task 4 会补上这一行。

- [ ] **Step 5: 运行测试确认通过**

```bash
cd frontend && npx vitest run src/utils/geo/wkt.test.ts 2>&1 | tail -20
```

预期：11 个测试全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/geo/wkt.ts frontend/src/utils/geo/wkt.test.ts frontend/src/utils/geo/index.ts
git commit -m "feat: 新增 WKT 解析与几何计算工具"
```

---

## Task 4: 聚合与 bbox 工具 `utils/geo/cluster.ts`

**Files:**
- Create: `frontend/src/utils/geo/cluster.ts`
- Create: `frontend/src/utils/geo/cluster.test.ts`

**Interfaces:**
- Consumes: `LngLat` / `Bounds`（来自 `./types`）
- Produces: `Cluster` / `Bbox` 类型；`clusterInScreenSpace` / `boundsToBbox` / `expandBbox` / `isBboxValid`

- [ ] **Step 1: 写失败测试**

`frontend/src/utils/geo/cluster.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { clusterInScreenSpace, boundsToBbox, expandBbox, isBboxValid, type Bbox } from './cluster'
import type { LngLat } from './types'

/** 恒等投影：把经纬度当作像素坐标使用，便于断言 */
const identity = (p: LngLat): [number, number] => [p[0], p[1]]

describe('clusterInScreenSpace', () => {
  it('merges items falling in the same grid cell', () => {
    const items = [
      { id: 'a', centroid: [0, 0] as LngLat },
      { id: 'b', centroid: [2, 2] as LngLat },
      { id: 'c', centroid: [100, 100] as LngLat },
    ]
    const clusters = clusterInScreenSpace(items, identity, 44)
    expect(clusters).toHaveLength(2)
    expect(clusters[0]).toMatchObject({ count: 2 })
    expect(clusters[0].ids.sort()).toEqual(['a', 'b'])
    expect(clusters[1]).toMatchObject({ count: 1 })
  })

  it('places the cluster at the mean of its members', () => {
    const items = [
      { id: 'a', centroid: [0, 0] as LngLat },
      { id: 'b', centroid: [10, 10] as LngLat },
    ]
    const [c] = clusterInScreenSpace(items, identity, 44)
    expect(c.lng).toBeCloseTo(5, 6)
    expect(c.lat).toBeCloseTo(5, 6)
  })

  it('returns an empty array for no items', () => {
    expect(clusterInScreenSpace([], identity, 44)).toEqual([])
  })
})

describe('boundsToBbox', () => {
  it('converts [[minLng,minLat],[maxLng,maxLat]] to a Bbox', () => {
    expect(boundsToBbox([[1, 2], [3, 4]])).toEqual({ minLng: 1, minLat: 2, maxLng: 3, maxLat: 4 })
  })
})

describe('expandBbox', () => {
  it('grows the box by the ratio, split across both sides', () => {
    const b: Bbox = { minLng: 0, minLat: 0, maxLng: 10, maxLat: 10 }
    expect(expandBbox(b, 0.2)).toEqual({ minLng: -1, minLat: -1, maxLng: 11, maxLat: 11 })
  })

  it('clamps latitude to [-90, 90]', () => {
    const b: Bbox = { minLng: 0, minLat: 85, maxLng: 10, maxLat: 90 }
    expect(expandBbox(b, 0.2).maxLat).toBe(90)
  })

  it('is a no-op when ratio is 0', () => {
    const b: Bbox = { minLng: 0, minLat: 0, maxLng: 10, maxLat: 10 }
    expect(expandBbox(b, 0)).toEqual(b)
  })
})

describe('isBboxValid', () => {
  it('accepts a well-formed box', () => {
    expect(isBboxValid({ minLng: 1, minLat: 2, maxLng: 3, maxLat: 4 })).toBe(true)
  })

  it('rejects inverted or out-of-range boxes', () => {
    expect(isBboxValid({ minLng: 5, minLat: 2, maxLng: 3, maxLat: 4 })).toBe(false)
    expect(isBboxValid({ minLng: 1, minLat: 4, maxLng: 3, maxLat: 2 })).toBe(false)
    expect(isBboxValid({ minLng: 1, minLat: 91, maxLng: 3, maxLat: 92 })).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd frontend && npx vitest run src/utils/geo/cluster.test.ts 2>&1 | tail -20
```

预期：FAIL，`Cannot find module './cluster'`。

- [ ] **Step 3: 实现 cluster.ts**

`frontend/src/utils/geo/cluster.ts`：

```ts
import type { Bounds, LngLat } from './types'

export interface Bbox {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

export interface ClusterItem {
  id: string
  centroid: LngLat
}

export interface Cluster {
  /** 网格键，稳定且可用于 React key / 增量 diff */
  key: string
  lng: number
  lat: number
  count: number
  ids: string[]
}

/**
 * 屏幕空间网格聚合：按 cellPx 把投影后的点分桶。
 * 不依赖任何地图库，project 由调用方注入（高德的 map.lngLatToContainer）。
 */
export const clusterInScreenSpace = (
  items: ClusterItem[],
  project: (p: LngLat) => [number, number],
  cellPx: number
): Cluster[] => {
  const buckets = new Map<string, { sx: number; sy: number; count: number; ids: string[] }>()

  for (const item of items) {
    if (!item.centroid || item.centroid.length !== 2) continue
    const [px, py] = project(item.centroid)
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue
    const key = `${Math.floor(px / cellPx)}:${Math.floor(py / cellPx)}`
    const bucket = buckets.get(key) ?? { sx: 0, sy: 0, count: 0, ids: [] }
    bucket.sx += item.centroid[0]
    bucket.sy += item.centroid[1]
    bucket.count += 1
    bucket.ids.push(item.id)
    buckets.set(key, bucket)
  }

  return Array.from(buckets.entries()).map(([key, b]) => ({
    key,
    lng: b.sx / b.count,
    lat: b.sy / b.count,
    count: b.count,
    ids: b.ids,
  }))
}

export const boundsToBbox = ([[minLng, minLat], [maxLng, maxLat]]: Bounds): Bbox => ({
  minLng,
  minLat,
  maxLng,
  maxLat,
})

/**
 * 按 ratio 外扩：结果尺寸 = 原尺寸 * (1 + ratio)，即每侧各 pad = 尺寸 * ratio / 2。
 * 纬度钳制在 [-90, 90]，经度钳制在 [-180, 180]。
 */
export const expandBbox = (b: Bbox, ratio: number): Bbox => {
  const padLng = ((b.maxLng - b.minLng) * ratio) / 2
  const padLat = ((b.maxLat - b.minLat) * ratio) / 2
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  return {
    minLng: clamp(b.minLng - padLng, -180, 180),
    minLat: clamp(b.minLat - padLat, -90, 90),
    maxLng: clamp(b.maxLng + padLng, -180, 180),
    maxLat: clamp(b.maxLat + padLat, -90, 90),
  }
}

export const isBboxValid = (b: Bbox): boolean =>
  [b.minLng, b.minLat, b.maxLng, b.maxLat].every((v) => Number.isFinite(v)) &&
  b.minLng < b.maxLng &&
  b.minLat < b.maxLat &&
  b.minLat >= -90 &&
  b.maxLat <= 90 &&
  b.minLng >= -180 &&
  b.maxLng <= 180
```

- [ ] **Step 4: 运行全部 geo 测试**

```bash
cd frontend && npx vitest run src/utils/geo 2>&1 | tail -20
```

预期：crs / wkt / cluster 三个文件全部 PASS。

- [ ] **Step 5: 把 cluster 挂进 index.ts**

在 `frontend/src/utils/geo/index.ts` 末尾追加一行 `export * from './cluster'`，使最终内容为：

```ts
export * from './types'
export * from './wkt'
export * from './crs'
export * from './cluster'
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/geo/cluster.ts frontend/src/utils/geo/cluster.test.ts frontend/src/utils/geo/index.ts
git commit -m "feat: 新增屏幕空间聚合与 bbox 工具"
```

---

## Task 5: 后端 LOD 端点

**Files:**
- Modify: `backend/database/db_services/field_service.py`（追加 4 个函数 + `import re`）
- Modify: `backend/api/schemas/field.py`（追加 2 个 schema）
- Modify: `backend/api/routes/field.py`（追加 2 个路由 + 1 个校验函数，插在第 128 行 `@router.get("/{field_id}")` 之前）
- Create: `backend/tests/api/test_field_lod.py`

**Interfaces:**
- Produces（HTTP）：`GET /api/fields/light` → `[{id, name, area_m2, centroid:[lng,lat]}]`；`GET /api/fields/geometry?minLng=&minLat=&maxLng=&maxLat=` → `[{id, location_wkt}]`
- Produces（供测试与后续任务）：`_parse_wkt_ring(wkt)`、`_ring_bbox(ring)`、`get_all_fields_light(db, active_only)`、`get_fields_geometry_in_bbox(db, min_lng, min_lat, max_lng, max_lat, active_only)`、`validate_bbox(...)`

- [ ] **Step 1: 写失败测试**

`backend/tests/api/test_field_lod.py`：

```python
import pytest
from fastapi import HTTPException

# 注意：routes/field.py 中的变量名是 `router`，不是 `field_router`
from api.routes.field import validate_bbox, router
from database.db_services.field_service import _parse_wkt_ring


def test_parse_wkt_ring_reads_the_outer_ring():
    ring = _parse_wkt_ring(
        "POLYGON((116.0 39.9, 116.1 39.9, 116.1 40.0, 116.0 39.9))"
    )
    assert ring == [(116.0, 39.9), (116.1, 39.9), (116.1, 40.0), (116.0, 39.9)]


def test_parse_wkt_ring_returns_empty_for_junk():
    assert _parse_wkt_ring("") == []
    assert _parse_wkt_ring("POINT(116 39)") == []
    assert _parse_wkt_ring(None) == []


def test_validate_bbox_accepts_a_normal_box():
    validate_bbox(116.0, 39.9, 116.5, 40.2)  # 不抛异常


def test_validate_bbox_rejects_inverted_bounds():
    with pytest.raises(HTTPException) as exc:
        validate_bbox(116.5, 39.9, 116.0, 40.2)
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        validate_bbox(116.0, 40.2, 116.5, 39.9)
    assert exc.value.status_code == 400


def test_validate_bbox_rejects_out_of_range_coordinates():
    with pytest.raises(HTTPException) as exc:
        validate_bbox(116.0, 91.0, 116.5, 92.0)
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        validate_bbox(-181.0, 39.9, 116.5, 40.2)
    assert exc.value.status_code == 400


def test_light_and_geometry_are_registered_before_the_path_param_route():
    """
    回归保护：/fields/light 与 /fields/geometry 若注册在 /fields/{field_id} 之后，
    会被路径参数路由吞掉而永远命中不到。
    """
    # APIRouter(prefix="/fields") 会把前缀写进 route.path，故这里是 "/fields/light" 全路径
    paths = [r.path for r in router.routes]
    assert "/fields/light" in paths
    assert "/fields/geometry" in paths
    assert paths.index("/fields/light") < paths.index("/fields/{field_id}")
    assert paths.index("/fields/geometry") < paths.index("/fields/{field_id}")
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd backend && python -m pytest tests/api/test_field_lod.py -v 2>&1 | tail -25
```

预期：FAIL（ImportError：`cannot import name 'validate_bbox'`）。

- [ ] **Step 3: 在 field_service.py 追加 import re**

当前第 1 行是 `import uuid`。改为：

```python
import uuid
import re
```

- [ ] **Step 4: 在 field_service.py 末尾追加 4 个函数**

```python
def _parse_wkt_ring(wkt) -> List[tuple]:
    """
    解析 'POLYGON((lng lat, ...))' 的外环，返回 [(lng, lat), ...]。
    仅供无 PostGIS 环境降级使用；解析失败返回空列表。
    """
    if not wkt or not isinstance(wkt, str):
        return []
    match = re.match(r"POLYGON\s*\(\s*\(([^)]*)\)", wkt.strip(), re.IGNORECASE)
    if not match:
        return []
    ring = []
    for part in match.group(1).split(","):
        nums = part.split()
        if len(nums) < 2:
            continue
        try:
            ring.append((float(nums[0]), float(nums[1])))
        except ValueError:
            continue
    return ring


def _ring_bbox(ring: List[tuple]):
    """返回 (min_lng, min_lat, max_lng, max_lat)；空环返回 None"""
    if not ring:
        return None
    lngs = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return min(lngs), min(lats), max(lngs), max(lats)


def get_all_fields_light(db: Session, active_only: bool = True) -> List[dict[str, Any]]:
    """
    获取地块轻量列表：仅 id / name / area_m2 / centroid（WGS84 [lng, lat]）。

    用于 zoom < 13 的聚合展示，避免一次拉回全部 WKT。
    """
    if HAS_POSTGIS:
        where = " WHERE is_active = true" if active_only else ""
        rows = db.execute(
            text(f"""
                SELECT id, name, area_m2,
                       ST_X(ST_Centroid(location_geom)) AS cx,
                       ST_Y(ST_Centroid(location_geom)) AS cy
                FROM fields{where}
            """)
        ).fetchall()
        result = []
        for r in rows:
            centroid = (
                [float(r.cx), float(r.cy)] if r.cx is not None and r.cy is not None else None
            )
            result.append({
                'id': str(r.id),
                'name': r.name,
                'area_m2': r.area_m2,
                'centroid': centroid,
            })
        return result

    # 无 PostGIS：location_geom 是 WKT 文本，退化到 Python 侧解析
    print("[后端FieldService] PostGIS 不可用，地块质心改为 Python 侧解析")
    query = db.query(Field.id, Field.name, Field.area_m2, Field.location_geom)
    if active_only:
        query = query.filter(Field.is_active == True)
    result = []
    for r in query.all():
        ring = _parse_wkt_ring(r.location_geom)
        centroid = None
        if ring:
            centroid = [
                sum(p[0] for p in ring) / len(ring),
                sum(p[1] for p in ring) / len(ring),
            ]
        result.append({
            'id': str(r.id),
            'name': r.name,
            'area_m2': r.area_m2,
            'centroid': centroid,
        })
    return result


def get_fields_geometry_in_bbox(
    db: Session,
    min_lng: float,
    min_lat: float,
    max_lng: float,
    max_lat: float,
    active_only: bool = True,
) -> List[dict[str, Any]]:
    """
    获取与给定 bbox 相交的地块几何（WKT）。

    用于 zoom >= 13 时按视野增量请求，避免全量下载。
    """
    if HAS_POSTGIS:
        where = " AND is_active = true" if active_only else ""
        rows = db.execute(
            text(f"""
                SELECT id, ST_AsText(location_geom) AS location_wkt
                FROM fields
                WHERE ST_Intersects(
                    location_geom,
                    ST_MakeEnvelope(:min_lng, :min_lat, :max_lng, :max_lat, 4326)
                ){where}
            """),
            {
                "min_lng": min_lng,
                "min_lat": min_lat,
                "max_lng": max_lng,
                "max_lat": max_lat,
            },
        ).fetchall()
        return [
            {'id': str(r.id), 'location_wkt': str(r.location_wkt) if r.location_wkt else None}
            for r in rows
        ]

    # 无 PostGIS：全量取出后在 Python 侧按 bbox 过滤
    print("[后端FieldService] PostGIS 不可用，bbox 过滤退化为 Python 侧计算")
    query = db.query(Field.id, Field.location_geom)
    if active_only:
        query = query.filter(Field.is_active == True)
    result = []
    for r in query.all():
        ring = _parse_wkt_ring(r.location_geom)
        box = _ring_bbox(ring)
        if not box:
            continue
        lng0, lat0, lng1, lat1 = box
        if lng1 < min_lng or lng0 > max_lng or lat1 < min_lat or lat0 > max_lat:
            continue
        result.append({'id': str(r.id), 'location_wkt': r.location_geom})
    return result
```

- [ ] **Step 5: 在 schemas/field.py 末尾追加 2 个响应模型**

```python
class FieldLight(BaseModel):
    """地块轻量信息，用于聚合展示（zoom < 13）"""
    id: str
    name: str
    area_m2: Optional[float] = None
    centroid: Optional[List[float]] = None


class FieldGeometry(BaseModel):
    """地块几何，用于按视野增量请求（zoom >= 13）"""
    id: str
    location_wkt: Optional[str] = None
```

- [ ] **Step 6: 在 routes/field.py 更新 import 并插入校验函数与 2 个路由**

6a. 替换第 5–10 行的 service import：

```python
from database.db_services.field_service import (
    create_field, get_field_by_id, get_all_fields,
    search_fields, update_field, delete_field,
    get_field_with_wkt, get_all_fields_with_wkt,
    search_fields_with_wkt,
    get_all_fields_light, get_fields_geometry_in_bbox
)
```

6b. 替换第 12–14 行的 schema import：

```python
from api.schemas.field import (
    FieldCreate, FieldUpdate, FieldResponse, FieldListParams,
    FieldLight, FieldGeometry
)
```

6c. 在第 20 行 `router = APIRouter(prefix="/fields", tags=["fields"])` 之后插入：

```python
def validate_bbox(min_lng: float, min_lat: float, max_lng: float, max_lat: float) -> None:
    """校验 bbox 参数，非法时抛出 400。"""
    for name, value, low, high in (
        ("minLng", min_lng, -180, 180),
        ("maxLng", max_lng, -180, 180),
        ("minLat", min_lat, -90, 90),
        ("maxLat", max_lat, -90, 90),
    ):
        if value is None or not (low <= value <= high):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"bbox 参数非法：{name}={value} 超出 [{low}, {high}]"
            )
    if min_lng >= max_lng or min_lat >= max_lat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="bbox 参数非法：min 必须小于 max"
        )
```

6d. 在第 128 行 `@router.get("/{field_id}", response_model=FieldResponse)` **之前**插入：

```python
@router.get("/light", response_model=List[FieldLight])
async def get_fields_light(
    current_user: User = Depends(get_current_user)
):
    """
    获取地块轻量列表（id / name / area_m2 / centroid）

    只返回聚合展示所需的最小字段，不含 WKT，供 zoom < 13 使用。
    """
    db = None
    try:
        db = get_user_db(str(current_user.userid))
        return get_all_fields_light(db, active_only=True)
    except Exception as e:
        print(f"[API] 获取地块轻量列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取地块轻量列表失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


@router.get("/geometry", response_model=List[FieldGeometry])
async def get_fields_geometry(
    minLng: float = Query(..., description="视野最小经度"),
    minLat: float = Query(..., description="视野最小纬度"),
    maxLng: float = Query(..., description="视野最大经度"),
    maxLat: float = Query(..., description="视野最大纬度"),
    current_user: User = Depends(get_current_user)
):
    """
    按视野 bbox 增量获取地块几何（WKT）

    只返回与 bbox 相交的地块，供 zoom >= 13 使用。
    """
    validate_bbox(minLng, minLat, maxLng, maxLat)

    db = None
    try:
        db = get_user_db(str(current_user.userid))
        return get_fields_geometry_in_bbox(
            db,
            min_lng=minLng,
            min_lat=minLat,
            max_lng=maxLng,
            max_lat=maxLat,
            active_only=True,
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] 获取地块几何失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取地块几何失败: {str(e)}"
        )
    finally:
        if db:
            db.close()
```

- [ ] **Step 7: 运行测试确认通过**

```bash
cd backend && python -m pytest tests/api/test_field_lod.py -v 2>&1 | tail -25
```

预期：6 个测试全部 PASS。

- [ ] **Step 8: 冒烟验证新端点未被参数路由吞掉**

启动后端后执行：

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer <token>" \
  "http://localhost:6130/api/fields/light"
```

预期 `200`（未登录则 `401`），**不应**是 `404` 或 `422`。若返回 `422`，说明 `/light` 被 `/{field_id}` 当成 UUID 解析失败——回查 Step 6d 的插入位置。

- [ ] **Step 9: Commit**

```bash
git add backend/database/db_services/field_service.py backend/api/schemas/field.py backend/api/routes/field.py backend/tests/api/test_field_lod.py
git commit -m "feat: 新增地块轻量列表与视野内几何查询端点"
```

---

## Task 6: 前端 service 扩展

**Files:**
- Modify: `frontend/src/services/fieldService.ts`

**Interfaces:**
- Produces: `FieldLight` / `FieldGeometry` / `Bbox` 类型；`fieldService.getFieldsLight()` / `fieldService.getFieldsGeometry(bbox)`

- [ ] **Step 1: 追加 3 个类型**

在 `frontend/src/services/fieldService.ts` 的 `PointQuery` 接口（第 42 行）之前插入：

```ts
export interface FieldLight {
  id: string;
  name: string;
  area_m2?: number;
  /** [lng, lat]，WGS84 */
  centroid?: [number, number];
}

export interface FieldGeometry {
  id: string;
  location_wkt?: string;
}

/** 视野包围盒，与后端 /api/fields/geometry 的查询参数一致 */
export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}
```

- [ ] **Step 2: 追加 2 个方法**

在 `fieldService` 对象的 `findFieldsByPoint` 方法之后（文件末尾 `};` 之前）追加：

```ts
  // 获取地块轻量列表（仅 id / name / area_m2 / centroid），用于聚合展示
  async getFieldsLight(): Promise<FieldLight[]> {
    console.log('[前端FieldService] 发送获取地块轻量列表请求');

    const response = await api.get<FieldLight[]>('/api/fields/light');

    console.log('[前端FieldService] 获取地块轻量列表成功:', response.data.length);
    return response.data;
  },

  // 按视野 bbox 增量获取地块几何
  async getFieldsGeometry(bbox: Bbox): Promise<FieldGeometry[]> {
    console.log('[前端FieldService] 发送获取地块几何请求:', bbox);

    const response = await api.get<FieldGeometry[]>('/api/fields/geometry', {
      params: {
        minLng: bbox.minLng,
        minLat: bbox.minLat,
        maxLng: bbox.maxLng,
        maxLat: bbox.maxLat,
      },
    });

    console.log('[前端FieldService] 获取地块几何成功:', response.data.length);
    return response.data;
  },
```

- [ ] **Step 3: 类型检查**

```bash
cd frontend && npm run typecheck 2>&1 | tail -20
```

预期：无新增错误。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/fieldService.ts
git commit -m "feat: 前端地块服务新增轻量列表与视野几何方法"
```

---

## Task 7: 高德 SDK 加载 `hooks/fields/useAMap.ts`

**Files:**
- Create: `frontend/src/hooks/fields/useAMap.ts`

**Interfaces:**
- Consumes: `env`（`@/config/env`）
- Produces: `useAMap(): { ready: boolean; error: string | null }`；副作用：挂载 `window.AMap`

**说明：** 加载逻辑从现有 `components/map/FieldMapPicker.jsx`（第 52–63 行）迁移而来，改为模块级单例 Promise，避免多个组件重复注入 script。

- [ ] **Step 1: 实现 useAMap.ts**

`frontend/src/hooks/fields/useAMap.ts`：

```ts
import { useEffect, useState } from 'react'
import { env } from '@/config/env'

declare global {
  interface Window {
    AMap?: any
    _AMapSecurityConfig?: { securityJsCode: string }
  }
}

const AMapKey = env.AMAP_KEY
const AMapSecurityCode = env.AMAP_SECURITY_CODE

/** 与高德 SDK 约定：必须在加载 maps 脚本之前挂上 */
const configureSecurity = () => {
  if (!window._AMapSecurityConfig && AMapSecurityCode && !AMapSecurityCode.includes('your_')) {
    window._AMapSecurityConfig = { securityJsCode: AMapSecurityCode }
  }
}

let loaderPromise: Promise<void> | null = null

const loadAMap = (): Promise<void> => {
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<void>((resolve, reject) => {
    if (window.AMap) {
      resolve()
      return
    }
    if (!AMapKey || AMapKey.includes('your_')) {
      reject(new Error('未配置 VITE_AMAP_KEY'))
      return
    }
    configureSecurity()
    const script = document.createElement('script')
    // MouseTool 供地图绘制使用；ToolBar/Scale 为底图控件
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMapKey}&plugin=AMap.ToolBar,AMap.Scale,AMap.MouseTool`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('高德地图 SDK 加载失败'))
    document.head.appendChild(script)
  })

  return loaderPromise
}

/** 加载高德 SDK（单例）。ready 为 true 时 window.AMap 已可用。 */
export const useAMap = (): { ready: boolean; error: string | null } => {
  const [ready, setReady] = useState(() => Boolean(window.AMap))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadAMap()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { ready, error }
}
```

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npm run typecheck 2>&1 | tail -20
```

预期：无新增错误。若 `window.AMap` 已在别处声明过且类型冲突，移除本文件的 `declare global` 块。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/fields/useAMap.ts
git commit -m "feat: 抽取高德 SDK 单例加载 hook"
```

---

## Task 8: 地图渲染组件 `FieldMapCanvas`

**Files:**
- Create: `frontend/src/components/fields/FieldMapCanvas.jsx`
- Create: `frontend/src/components/fields/FieldMapCanvas.css`

**Interfaces:**
- Consumes: `useAMap()`、`toDisplayRing`（`@/utils/geo`）、`LngLat` / `Bounds`
- Produces（ref API，供 Task 9–12 调用）：

```ts
interface FieldMapCanvasHandle {
  getViewport(): { zoom: number; bounds: Bounds } | null
  fitBounds(bounds: Bounds, padding?: number): void
  setClusters(clusters: Cluster[]): void
  setPolygons(list: { id: string; ring: LngLat[] }[]): void
  setHighlight(id: string | null): void
  setDraftPolygon(ring: LngLat[] | null): void
  startDraw(): Promise<LngLat[] | null>   // 返回 GCJ-02 顶点
  cancelDraw(): void
  resetView(): void
}
```

Props：

```ts
{
  onViewportChange: (zoom: number, bounds: Bounds) => void
  onBlankClick: () => void
  onPolygonClick: (id: string) => void
}
```

**关键实现约定：**
- 地图实例与 overlays 全部存在 `useRef`，不进 state → React 重渲染不会重建地图
- hover 状态由组件内部持有（`hoverIdRef`），不触发 React 重渲染
- `moveend` / `zoomend` 都转发到 `onViewportChange`（节流由 Task 12 负责）
- `setPolygons` 做增量 diff：按 id 复用已存在的 `AMap.Polygon`，只新增/删除差异部分
- 绘制中不把地图点击当作「空白点击」（`mouseToolRef.current` 非空时直接 return）

- [ ] **Step 1: 实现 FieldMapCanvas.jsx**

```jsx
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useAMap } from '@/hooks/fields/useAMap'
import { toDisplayRing } from '@/utils/geo'
import './FieldMapCanvas.css'

/** 全国视野：未选中任何地块时的默认视角 */
const DEFAULT_CENTER = [104, 37.5]
const DEFAULT_ZOOM = 4

const FieldMapCanvas = forwardRef(function FieldMapCanvas(
  { onViewportChange, onBlankClick, onPolygonClick },
  ref
) {
  const { ready, error } = useAMap()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const mouseToolRef = useRef(null)

  /** id -> AMap.Polygon */
  const polygonMapRef = useRef(new Map())
  /** key -> AMap.Marker（聚合点） */
  const clusterMapRef = useRef(new Map())
  const draftRef = useRef(null)
  const hoverIdRef = useRef(null)
  /** startDraw 的 pending resolve，cancelDraw 时必须 resolve(null) */
  const drawResolveRef = useRef(null)

  // 用 ref 承载回调，避免因父组件重渲染而反复解绑/重绑地图事件
  const handlersRef = useRef({ onViewportChange, onBlankClick, onPolygonClick })
  handlersRef.current = { onViewportChange, onBlankClick, onPolygonClick }

  const emitViewport = () => {
    const map = mapRef.current
    if (!map) return
    const b = map.getBounds()
    const sw = b.getSouthWest()
    const ne = b.getNorthEast()
    handlersRef.current.onViewportChange?.(map.getZoom(), [
      [sw.getLng(), sw.getLat()],
      [ne.getLng(), ne.getLat()],
    ])
  }

  // 初始化地图（只跑一次）
  useEffect(() => {
    if (!ready || mapRef.current || !containerRef.current) return
    const AMap = window.AMap

    const map = new AMap.Map(containerRef.current, {
      zoom: DEFAULT_ZOOM,
      center: DEFAULT_CENTER,
      viewMode: '2D',
      layers: [new AMap.TileLayer.Satellite(), new AMap.TileLayer.RoadNet()],
    })
    map.addControl(new AMap.Scale())
    map.addControl(new AMap.ToolBar({ position: { right: '16px', bottom: '48px' } }))
    mapRef.current = map

    map.on('moveend', emitViewport)
    map.on('zoomend', emitViewport)
    map.on('complete', emitViewport)
    map.on('click', () => {
      // 绘制中：点击属于绘制行为，不触发取消选中
      if (mouseToolRef.current) return
      handlersRef.current.onBlankClick?.()
    })
  }, [ready])

  useImperativeHandle(ref, () => ({
    getViewport: () => {
      const map = mapRef.current
      if (!map) return null
      const b = map.getBounds()
      const sw = b.getSouthWest()
      const ne = b.getNorthEast()
      return {
        zoom: map.getZoom(),
        bounds: [
          [sw.getLng(), sw.getLat()],
          [ne.getLng(), ne.getLat()],
        ],
      }
    },

    fitBounds: (bounds, padding = 80) => {
      const map = mapRef.current
      if (!map || !bounds) return
      const AMap = window.AMap
      map.setBounds(
        new AMap.Bounds(
          new AMap.LngLat(bounds[0][0], bounds[0][1]),
          new AMap.LngLat(bounds[1][0], bounds[1][1])
        ),
        false,
        [padding, padding, padding, padding]
      )
    },

    /** 增量 diff：复用已存在 Polygon，只增删差异 */
    setPolygons: (list) => {
      const map = mapRef.current
      if (!map) return
      const AMap = window.AMap
      const next = new Set(list.map((p) => p.id))

      polygonMapRef.current.forEach((poly, id) => {
        if (!next.has(id)) {
          map.remove(poly)
          polygonMapRef.current.delete(id)
        }
      })

      list.forEach(({ id, ring }) => {
        if (!ring || ring.length < 3) return
        const path = toDisplayRing(ring)
        const existing = polygonMapRef.current.get(id)
        if (existing) {
          existing.setPath(path)
          return
        }
        const poly = new AMap.Polygon({
          path,
          strokeColor: '#22c55e',
          strokeWeight: 2,
          strokeOpacity: 0.9,
          fillColor: '#22c55e',
          fillOpacity: 0.18,
          bubble: false,
          cursor: 'pointer',
          extData: { id },
        })
        poly.on('click', () => handlersRef.current.onPolygonClick?.(id))
        poly.on('mouseover', () => {
          if (hoverIdRef.current === id) return
          hoverIdRef.current = id
          poly.setOptions({ strokeWeight: 4, fillOpacity: 0.35 })
        })
        poly.on('mouseout', () => {
          if (hoverIdRef.current !== id) return
          hoverIdRef.current = null
          poly.setOptions({ strokeWeight: 2, fillOpacity: 0.18 })
        })
        map.add(poly)
        polygonMapRef.current.set(id, poly)
      })
    },

    setClusters: (clusters) => {
      const map = mapRef.current
      if (!map) return
      const AMap = window.AMap
      const next = new Set(clusters.map((c) => c.key))

      clusterMapRef.current.forEach((marker, key) => {
        if (!next.has(key)) {
          map.remove(marker)
          clusterMapRef.current.delete(key)
        }
      })

      clusters.forEach((c) => {
        const content = `<div class="field-cluster" data-count="${c.count}">${c.count}</div>`
        const existing = clusterMapRef.current.get(c.key)
        if (existing) {
          existing.setCenter(new AMap.LngLat(c.lng, c.lat))
          existing.setContent(content)
          return
        }
        const marker = new AMap.Marker({
          position: new AMap.LngLat(c.lng, c.lat),
          content,
          offset: new AMap.Pixel(-14, -14),
          bubble: false,
          cursor: 'pointer',
        })
        map.add(marker)
        clusterMapRef.current.set(c.key, marker)
      })
    },

    setHighlight: (id) => {
      polygonMapRef.current.forEach((poly, pid) => {
        const selected = pid === id
        poly.setOptions({
          strokeColor: selected ? '#f59e0b' : '#22c55e',
          strokeWeight: selected ? 4 : 2,
          fillColor: selected ? '#f59e0b' : '#22c55e',
          fillOpacity: selected ? 0.35 : 0.18,
        })
        if (selected) poly.setzIndex(200)
      })
    },

    /** 绘制中 / 重绘时的临时预览（虚线） */
    setDraftPolygon: (ring) => {
      const map = mapRef.current
      if (!map) return
      const AMap = window.AMap
      if (draftRef.current) {
        map.remove(draftRef.current)
        draftRef.current = null
      }
      if (!ring || ring.length < 3) return
      const poly = new AMap.Polygon({
        path: ring,
        strokeColor: '#f59e0b',
        strokeWeight: 3,
        strokeStyle: 'dashed',
        fillColor: '#f59e0b',
        fillOpacity: 0.2,
        bubble: true,
      })
      map.add(poly)
      draftRef.current = poly
    },

    /** 进入绘制模式；返回 GCJ-02 顶点（调用方需 toStorageRing 后入库） */
    startDraw: () =>
      new Promise((resolve) => {
        const map = mapRef.current
        if (!map) {
          resolve(null)
          return
        }
        const AMap = window.AMap
        AMap.plugin(['AMap.MouseTool'], () => {
          const tool = new AMap.MouseTool(map)
          mouseToolRef.current = tool
          drawResolveRef.current = resolve
          tool.polygon({
            strokeColor: '#f59e0b',
            strokeWeight: 3,
            fillColor: '#f59e0b',
            fillOpacity: 0.2,
          })
          tool.on('draw', (e) => {
            const path = e.obj?.getPath?.() ?? []
            const ring = path.map((p) => [p.getLng(), p.getLat()])
            if (mouseToolRef.current) {
              mouseToolRef.current.close(true)
              mouseToolRef.current = null
            }
            drawResolveRef.current = null
            resolve(ring.length >= 3 ? ring : null)
          })
        })
      }),

    /**
     * 取消绘制。必须 resolve(null)，否则 await startDraw() 永远挂起，
     * 导致侧栏 create 态无法退出。
     */
    cancelDraw: () => {
      if (mouseToolRef.current) {
        mouseToolRef.current.close(true)
        mouseToolRef.current = null
      }
      if (drawResolveRef.current) {
        const resolve = drawResolveRef.current
        drawResolveRef.current = null
        resolve(null)
      }
    },

    resetView: () => {
      mapRef.current?.setZoomAndCenter(DEFAULT_ZOOM, DEFAULT_CENTER)
    },
  }))

  // 卸载时清理绘制态与地图，避免流程悬挂 / 内存泄漏
  useEffect(
    () => () => {
      if (mouseToolRef.current) {
        mouseToolRef.current.close(true)
        mouseToolRef.current = null
      }
      if (drawResolveRef.current) {
        const resolve = drawResolveRef.current
        drawResolveRef.current = null
        resolve(null)
      }
      mapRef.current?.destroy?.()
      mapRef.current = null
      polygonMapRef.current.clear()
      clusterMapRef.current.clear()
    },
    []
  )

  if (error) {
    return (
      <div className="field-map-canvas field-map-canvas--error">
        <span className="placeholder-icon">🗺️</span>
        <p className="placeholder-title">地图功能需要配置 API Key</p>
        <p className="placeholder-hint">
          请在 <code>.env</code> 文件中配置 <code>VITE_AMAP_KEY</code>（{error}）
        </p>
      </div>
    )
  }

  return <div ref={containerRef} className="field-map-canvas" />
})

export default FieldMapCanvas
```

- [ ] **Step 2: 实现 FieldMapCanvas.css**

```css
.field-map-canvas {
  width: 100%;
  height: 100%;
  background: #0f172a;
}

.field-map-canvas--error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #94a3b8;
  text-align: center;
}

.field-map-canvas--error .placeholder-icon {
  font-size: 40px;
}

.field-map-canvas--error .placeholder-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #e2e8f0;
}

.field-map-canvas--error .placeholder-hint {
  margin: 0;
  font-size: 13px;
}

.field-map-canvas--error code {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.16);
  color: #fbbf24;
}

/* 聚合计数点 */
.field-cluster {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.9);
  border: 2px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.field-cluster[data-count='1'] {
  width: 18px;
  height: 18px;
  font-size: 10px;
}
```

- [ ] **Step 3: lint**

```bash
cd frontend && npm run lint 2>&1 | tail -20
```

预期：无 error。若 `react-hooks/exhaustive-deps` 对 `emitViewport` 告警，在该 `useEffect` 上方加 `// eslint-disable-next-line react-hooks/exhaustive-deps`。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/fields/FieldMapCanvas.jsx frontend/src/components/fields/FieldMapCanvas.css
git commit -m "feat: 新增地图渲染组件 FieldMapCanvas（命令式 ref API）"
```

---

## Task 9: LOD 数据 hooks

**Files:**
- Create: `frontend/src/hooks/fields/useFieldCatalog.ts`
- Create: `frontend/src/hooks/fields/useFieldGeometry.ts`
- Create: `frontend/src/hooks/fields/useFieldGeometry.test.ts`

**Interfaces:**
- Consumes: `fieldService.getFieldsLight` / `getFieldsGeometry` / `getFieldById`；`parseWKT` / `boundsOf`
- Produces:
  - `useFieldCatalog() → { light, byId, loading, error, reload(), remove(id), upsertDetail(field) }`
  - `useFieldGeometry() → { ringsOf(id), has(id), fetchVisible(bbox), ensureGeometry(id), invalidate(id?), loading, version }`
  - 纯函数 `diffMissingIds(ids, cache)`（供测试）

**约定：**
- 几何缓存存在 `useRef(new Map())`，**永久保留**，缩放回退零请求
- `loadedGeometryIds` 由缓存的 key 集合推导，不额外维护 Set
- `fetchVisible` 用自增 `requestSeq` 丢弃过期响应
- `version` 用于缓存变更后触发父组件重渲染（ref 变化本身不触发渲染）

- [ ] **Step 1: 实现 useFieldCatalog.ts**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { fieldService, type Field, type FieldLight } from '@/services/fieldService'

export interface CatalogEntry extends FieldLight {
  /** 完整字段（含 description / crop_type 等），按需懒加载后填充 */
  detail?: Field
}

export interface FieldCatalog {
  light: FieldLight[]
  byId: Map<string, CatalogEntry>
  loading: boolean
  error: string | null
  reload: () => void
  remove: (id: string) => void
  upsertDetail: (field: Field) => void
}

/** 进页面拉一次轻量列表，维护 id -> 条目 索引 */
export const useFieldCatalog = (): FieldCatalog => {
  const [light, setLight] = useState<FieldLight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const byIdRef = useRef<Map<string, CatalogEntry>>(new Map())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fieldService
      .getFieldsLight()
      .then((rows) => {
        if (cancelled) return
        const next = new Map<string, CatalogEntry>()
        rows.forEach((r) => next.set(r.id, { ...r }))
        byIdRef.current = next
        setLight(rows)
        setError(null)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e?.message ?? '加载地块列表失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const reload = useCallback(() => setReloadToken((t) => t + 1), [])

  const remove = useCallback((id: string) => {
    byIdRef.current.delete(id)
    setLight((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const upsertDetail = useCallback((field: Field) => {
    const existing = byIdRef.current.get(field.id)
    byIdRef.current.set(field.id, {
      id: field.id,
      name: field.name,
      area_m2: field.area_m2,
      centroid: existing?.centroid,
      detail: field,
    })
    setLight((prev) => {
      const idx = prev.findIndex((f) => f.id === field.id)
      if (idx === -1) {
        return [
          ...prev,
          {
            id: field.id,
            name: field.name,
            area_m2: field.area_m2,
            centroid: existing?.centroid ?? null,
          } as FieldLight,
        ]
      }
      const next = [...prev]
      next[idx] = { ...next[idx], name: field.name, area_m2: field.area_m2 }
      return next
    })
  }, [])

  return { light, byId: byIdRef.current, loading, error, reload, remove, upsertDetail }
}
```

- [ ] **Step 2: 写失败测试（几何缓存的纯逻辑）**

`frontend/src/hooks/fields/useFieldGeometry.test.ts` 只测导出的纯函数 `diffMissingIds`，避免引入 React 测试环境：

```ts
import { describe, it, expect } from 'vitest'
import { diffMissingIds, type RingCache } from './useFieldGeometry'
import type { LngLat } from '@/utils/geo'

describe('diffMissingIds', () => {
  it('returns only ids not already cached', () => {
    const cached: RingCache = new Map([['a', [[0, 0]] as LngLat[]]])
    expect(diffMissingIds(['a', 'b', 'c'], cached)).toEqual(['b', 'c'])
  })

  it('returns an empty array when everything is cached', () => {
    const cached: RingCache = new Map([['a', [[0, 0]] as LngLat[]]])
    expect(diffMissingIds(['a'], cached)).toEqual([])
  })

  it('treats a missing cache entry as needing a fetch', () => {
    const cached: RingCache = new Map<string, LngLat[]>()
    expect(diffMissingIds(['a'], cached)).toEqual(['a'])
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

```bash
cd frontend && npx vitest run src/hooks/fields/useFieldGeometry.test.ts 2>&1 | tail -20
```

预期：FAIL，`Cannot find module './useFieldGeometry'`。

- [ ] **Step 4: 实现 useFieldGeometry.ts**

```ts
import { useCallback, useRef, useState } from 'react'
import { fieldService } from '@/services/fieldService'
import { boundsOf, parseWKT, type LngLat } from '@/utils/geo'
import type { Bbox } from '@/utils/geo/cluster'

export type RingCache = Map<string, LngLat[]>

/** 求出尚未缓存的 id，供增量请求使用 */
export const diffMissingIds = (ids: string[], cache: RingCache): string[] =>
  ids.filter((id) => !cache.has(id))

export interface FieldGeometryStore {
  /** 同步读取缓存；未命中返回 undefined */
  ringsOf: (id: string) => LngLat[] | undefined
  has: (id: string) => boolean
  /** 按视野增量拉取几何；始终返回本次响应的全部 id（调用方需自行丢弃过期响应） */
  fetchVisible: (bbox: Bbox) => Promise<string[]>
  /** 选中单个地块时优先拉取，不被节流阻塞 */
  ensureGeometry: (id: string) => Promise<LngLat[] | null>
  /** 让缓存失效（新增/编辑/删除后调用） */
  invalidate: (id?: string) => void
  loading: boolean
  /** 缓存变更后自增，父组件据此重渲染 */
  version: number
}

export const useFieldGeometry = (): FieldGeometryStore => {
  const cacheRef = useRef<RingCache>(new Map())
  const seqRef = useRef(0)
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState(0)

  const put = useCallback((id: string, wkt?: string | null) => {
    if (!wkt) return
    const ring = parseWKT(wkt)
    if (!ring) return
    cacheRef.current.set(id, ring)
  }, [])

  const fetchVisible = useCallback(
    async (bbox: Bbox): Promise<string[]> => {
      const seq = (seqRef.current += 1)
      setLoading(true)
      try {
        const rows = await fieldService.getFieldsGeometry(bbox)
        // 即使视野已变也写入缓存：数据可复用，不浪费
        rows.forEach((r) => put(r.id, r.location_wkt))
        // 只有最新一次请求才触发重渲染；返回值仍给调用方，由其按 seq 决定是否采用
        if (seq === seqRef.current) setVersion((v) => v + 1)
        return rows.map((r) => r.id)
      } catch (e) {
        console.error('[useFieldGeometry] 获取视野内几何失败:', e)
        return []
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    },
    [put]
  )

  const ensureGeometry = useCallback(
    async (id: string): Promise<LngLat[] | null> => {
      const cached = cacheRef.current.get(id)
      if (cached) return cached
      try {
        const field = await fieldService.getFieldById(id)
        put(id, field.location_wkt)
        setVersion((v) => v + 1)
        return cacheRef.current.get(id) ?? null
      } catch (e) {
        console.error('[useFieldGeometry] 获取地块几何失败:', e)
        return null
      }
    },
    [put]
  )

  const invalidate = useCallback((id?: string) => {
    if (id) cacheRef.current.delete(id)
    else cacheRef.current.clear()
    setVersion((v) => v + 1)
  }, [])

  const ringsOf = useCallback((id: string) => cacheRef.current.get(id), [])
  const has = useCallback((id: string) => cacheRef.current.has(id), [])

  return { ringsOf, has, fetchVisible, ensureGeometry, invalidate, loading, version }
}

/** 由顶点数组求包围盒，供 fitBounds 使用 */
export const ringBounds = (ring: LngLat[]) => boundsOf(ring)
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd frontend && npx vitest run src/hooks/fields/useFieldGeometry.test.ts 2>&1 | tail -20
```

预期：3 个测试全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/fields/useFieldCatalog.ts frontend/src/hooks/fields/useFieldGeometry.ts frontend/src/hooks/fields/useFieldGeometry.test.ts
git commit -m "feat: 新增地块目录与 LOD 几何缓存 hooks"
```

---

## Task 10: 绘制编排 `hooks/fields/useFieldDraw.ts`

**Files:**
- Create: `frontend/src/hooks/fields/useFieldDraw.ts`

**Interfaces:**
- Consumes: `FieldMapCanvasHandle` 的 `startDraw` / `cancelDraw` / `setDraftPolygon`
- Produces: `useFieldDraw(canvasRef) → { drawing, draftRing, start, cancel, clear, setDraftRing }`

**约定：** `start()` 返回 **GCJ-02** 顶点；调用方（Task 12）负责 `toStorageRing()` 后入库。卸载时强制 `cancelDraw()`，避免 `MouseTool` 悬挂。

- [ ] **Step 1: 实现 useFieldDraw.ts**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LngLat } from '@/utils/geo'

interface MapCanvasLike {
  startDraw: () => Promise<LngLat[] | null>
  cancelDraw: () => void
  setDraftPolygon: (ring: LngLat[] | null) => void
}

export interface FieldDraw {
  drawing: boolean
  /** 已绘制但尚未保存的顶点（GCJ-02） */
  draftRing: LngLat[] | null
  /** 进入绘制模式；返回 GCJ-02 顶点，取消绘制返回 null */
  start: () => Promise<LngLat[] | null>
  cancel: () => void
  clear: () => void
  setDraftRing: (ring: LngLat[] | null) => void
}

/**
 * canvasRef 只按结构约束，避免 useRef(null) 推导出的 MutableRefObject<null>
 * 与 MutableRefObject<MapCanvasLike | null> 不兼容导致的类型错误。
 */
export const useFieldDraw = (canvasRef: { current: MapCanvasLike | null }): FieldDraw => {
  const [drawing, setDrawing] = useState(false)
  const [draftRing, setDraftRing] = useState<LngLat[] | null>(null)
  const activeRef = useRef(false)

  const start = useCallback(async (): Promise<LngLat[] | null> => {
    const canvas = canvasRef.current
    if (!canvas) return null
    activeRef.current = true
    setDrawing(true)
    try {
      const ring = await canvas.startDraw()
      setDraftRing(ring)
      canvas.setDraftPolygon(ring)
      return ring
    } finally {
      activeRef.current = false
      setDrawing(false)
    }
  }, [canvasRef])

  const cancel = useCallback(() => {
    canvasRef.current?.cancelDraw()
    activeRef.current = false
    setDrawing(false)
    setDraftRing(null)
    canvasRef.current?.setDraftPolygon(null)
  }, [canvasRef])

  const clear = useCallback(() => {
    setDraftRing(null)
    canvasRef.current?.setDraftPolygon(null)
  }, [canvasRef])

  // 卸载时强制结束绘制，避免 MouseTool 悬挂
  useEffect(
    () => () => {
      if (activeRef.current) canvasRef.current?.cancelDraw()
    },
    [canvasRef]
  )

  return { drawing, draftRing, start, cancel, clear, setDraftRing }
}
```

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npm run typecheck 2>&1 | tail -20
```

预期：无新增错误。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/fields/useFieldDraw.ts
git commit -m "feat: 新增地块绘制编排 hook"
```

---

## Task 11: 侧栏与工具栏组件

**Files:**
- Create: `frontend/src/components/fields/FieldFormFields.jsx`
- Create: `frontend/src/components/fields/FieldSidePanel.jsx`
- Create: `frontend/src/components/fields/FieldSidePanel.css`
- Create: `frontend/src/components/fields/FieldToolbar.jsx`
- Create: `frontend/src/components/fields/FieldToolbar.css`

**Interfaces:**
- Consumes: `panelMode`（`'empty' | 'view' | 'create' | 'edit' | 'confirmDelete'`）、`CatalogEntry`、`LngLat`

`FieldFormFields` props：

```ts
{
  value: { name?, description?, crop_type?, soil_type?, irrigation_type? }
  onChange: (patch: Partial<FormValue>) => void
  errors?: { name?: string }
  disabled?: boolean
}
```

`FieldSidePanel` props：

```ts
{
  mode, field, geometryLoading,
  draftAreaM2, draftVertexCount,      // 仅 create / 重绘时展示
  form, errors, submitting,
  onFormChange, onStartEdit, onStartDelete, onConfirmDelete,
  onCancel, onSubmit, onStartRedraw, onCollapse
}
```

`FieldToolbar` props：

```ts
{
  options: { value: string; label: string }[]
  value: string
  onSelect: (id: string) => void
  onCreate: () => void
  disabled: boolean          // 绘制中禁用下拉与新建
  collapsed: boolean
  onToggleCollapse: () => void
}
```

- [ ] **Step 1: 实现 FieldFormFields.jsx**

```jsx
const FieldFormFields = ({ value, onChange, errors = {}, disabled = false }) => {
  const set = (key) => (e) => onChange({ [key]: e.target.value })

  return (
    <div className="field-form-fields">
      <div className="field-form-row">
        <label htmlFor="field-name">
          名称<span className="required">*</span>
        </label>
        <input
          id="field-name"
          type="text"
          value={value.name ?? ''}
          onChange={set('name')}
          disabled={disabled}
          placeholder="例如：示范田 A 区"
          className={errors.name ? 'input-error' : ''}
        />
        {errors.name && <span className="error-text">{errors.name}</span>}
      </div>

      <div className="field-form-row">
        <label htmlFor="field-crop">作物类型</label>
        <input
          id="field-crop"
          type="text"
          value={value.crop_type ?? ''}
          onChange={set('crop_type')}
          disabled={disabled}
          placeholder="例如：玉米"
        />
      </div>

      <div className="field-form-row">
        <label htmlFor="field-soil">土壤类型</label>
        <input
          id="field-soil"
          type="text"
          value={value.soil_type ?? ''}
          onChange={set('soil_type')}
          disabled={disabled}
          placeholder="例如：壤土"
        />
      </div>

      <div className="field-form-row">
        <label htmlFor="field-irrigation">灌溉方式</label>
        <input
          id="field-irrigation"
          type="text"
          value={value.irrigation_type ?? ''}
          onChange={set('irrigation_type')}
          disabled={disabled}
          placeholder="例如：滴灌"
        />
      </div>

      <div className="field-form-row">
        <label htmlFor="field-desc">描述</label>
        <textarea
          id="field-desc"
          rows={3}
          value={value.description ?? ''}
          onChange={set('description')}
          disabled={disabled}
          placeholder="补充说明（可选）"
        />
      </div>
    </div>
  )
}

export default FieldFormFields
```

- [ ] **Step 2: 实现 FieldSidePanel.jsx**

```jsx
import FieldFormFields from './FieldFormFields'
import './FieldSidePanel.css'

const formatDate = (v) => (v ? new Date(v).toLocaleString() : '—')

const formatArea = (m2) => {
  if (m2 === null || m2 === undefined) return '未知'
  return `${m2.toFixed(0)} m²（${(m2 / 666.6667).toFixed(2)} 亩）`
}

const FieldSidePanel = ({
  mode,
  field,
  geometryLoading,
  draftAreaM2,
  draftVertexCount,
  form,
  errors,
  submitting,
  onFormChange,
  onStartEdit,
  onStartDelete,
  onConfirmDelete,
  onCancel,
  onSubmit,
  onStartRedraw,
  onCollapse,
}) => {
  const detail = field?.detail
  const isDetailMode = mode === 'view' || mode === 'edit' || mode === 'confirmDelete'
  const name = isDetailMode ? field?.name ?? '' : ''

  return (
    <aside className="field-side-panel">
      <header className="panel-header">
        <h2 className="panel-title">{mode === 'create' ? '新建地块' : name || '地块信息'}</h2>
        <button className="icon-btn" onClick={onCollapse} title="收起侧栏" aria-label="收起侧栏">
          ›
        </button>
      </header>

      <div className="panel-body">
        {mode === 'empty' && (
          <div className="panel-empty">
            <p className="empty-title">未选择地块</p>
            <p className="empty-hint">点击地图上的地块查看详情，或点顶部「新建」开始绘制。</p>
          </div>
        )}

        {mode === 'view' && (
          <>
            {geometryLoading && !detail ? (
              <div className="panel-skeleton">
                <span className="skeleton-line" />
                <span className="skeleton-line short" />
                <span className="skeleton-line" />
              </div>
            ) : (
              <dl className="panel-grid">
                <div className="panel-item">
                  <dt>面积</dt>
                  <dd>{formatArea(field?.area_m2)}</dd>
                </div>
                <div className="panel-item">
                  <dt>作物类型</dt>
                  <dd>{detail?.crop_type || '未设置'}</dd>
                </div>
                <div className="panel-item">
                  <dt>土壤类型</dt>
                  <dd>{detail?.soil_type || '未设置'}</dd>
                </div>
                <div className="panel-item">
                  <dt>灌溉方式</dt>
                  <dd>{detail?.irrigation_type || '未设置'}</dd>
                </div>
                <div className="panel-item full">
                  <dt>描述</dt>
                  <dd>{detail?.description || '无'}</dd>
                </div>
                <div className="panel-item">
                  <dt>创建时间</dt>
                  <dd>{formatDate(detail?.created_at)}</dd>
                </div>
                <div className="panel-item">
                  <dt>更新时间</dt>
                  <dd>{formatDate(detail?.updated_at)}</dd>
                </div>
              </dl>
            )}
          </>
        )}

        {(mode === 'create' || mode === 'edit') && (
          <>
            {mode === 'create' && (
              <p className="panel-hint">
                {draftVertexCount
                  ? `已绘制 ${draftVertexCount} 个顶点，预览面积约 ${formatArea(draftAreaM2)}`
                  : '请在地图上绘制地块边界（点击落点，双击闭合）'}
              </p>
            )}
            <FieldFormFields
              value={form}
              onChange={onFormChange}
              errors={errors}
              disabled={submitting}
            />
            {mode === 'edit' && (
              <button className="ghost-btn" onClick={onStartRedraw} disabled={submitting}>
                重绘边界
              </button>
            )}
          </>
        )}

        {mode === 'confirmDelete' && (
          <div className="panel-danger">
            <p className="danger-title">删除地块「{name}」？</p>
            <p className="danger-hint">此操作不可恢复，地块的几何与全部属性将被永久删除。</p>
          </div>
        )}
      </div>

      <footer className="panel-footer">
        {mode === 'view' && (
          <>
            <button className="primary-btn" onClick={onStartEdit}>
              编辑
            </button>
            <button className="danger-btn" onClick={onStartDelete}>
              删除
            </button>
          </>
        )}

        {(mode === 'create' || mode === 'edit') && (
          <>
            <button
              className="primary-btn"
              onClick={onSubmit}
              disabled={submitting || (mode === 'create' && !draftVertexCount)}
            >
              {submitting ? '保存中…' : '保存'}
            </button>
            <button className="secondary-btn" onClick={onCancel} disabled={submitting}>
              取消
            </button>
          </>
        )}

        {mode === 'confirmDelete' && (
          <>
            <button className="danger-btn" onClick={onConfirmDelete} disabled={submitting}>
              {submitting ? '删除中…' : '确认删除'}
            </button>
            <button className="secondary-btn" onClick={onCancel} disabled={submitting}>
              取消
            </button>
          </>
        )}
      </footer>
    </aside>
  )
}

export default FieldSidePanel
```

- [ ] **Step 3: 实现 FieldSidePanel.css**

```css
.field-side-panel {
  display: flex;
  flex-direction: column;
  width: 340px;
  min-width: 320px;
  max-width: 360px;
  height: 100%;
  border-left: 1px solid rgba(148, 163, 184, 0.2);
  background: #ffffff;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.panel-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.panel-footer button {
  flex: 1;
}

.panel-empty {
  padding-top: 48px;
  text-align: center;
  color: #94a3b8;
}

.empty-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
}

.empty-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.panel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0;
}

.panel-item {
  margin: 0;
}

.panel-item.full {
  grid-column: 1 / -1;
}

.panel-item dt {
  margin-bottom: 4px;
  font-size: 12px;
  color: #94a3b8;
}

.panel-item dd {
  margin: 0;
  font-size: 13px;
  color: #0f172a;
  word-break: break-word;
}

.panel-hint {
  margin: 0 0 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(245, 158, 11, 0.1);
  color: #b45309;
  font-size: 12px;
  line-height: 1.6;
}

.panel-danger {
  padding: 12px;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.06);
}

.danger-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: #b91c1c;
}

.danger-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #7f1d1d;
}

.panel-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-line {
  display: block;
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s infinite;
}

.skeleton-line.short {
  width: 60%;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.field-form-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-form-row label {
  font-size: 12px;
  color: #64748b;
}

.field-form-row .required {
  margin-left: 2px;
  color: #ef4444;
}

.field-form-row input,
.field-form-row textarea {
  padding: 7px 10px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  color: #0f172a;
}

.field-form-row input:focus,
.field-form-row textarea:focus {
  outline: none;
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}

.field-form-row .input-error {
  border-color: #ef4444;
}

.field-form-row .error-text {
  font-size: 12px;
  color: #ef4444;
}

.ghost-btn {
  margin-top: 12px;
  padding: 7px 10px;
  border: 1px dashed rgba(148, 163, 184, 0.8);
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
}

.ghost-btn:hover:not(:disabled) {
  border-color: #22c55e;
  color: #16a34a;
}
```

- [ ] **Step 4: 实现 FieldToolbar.jsx**

```jsx
import './FieldToolbar.css'

const FieldToolbar = ({
  options,
  value,
  onSelect,
  onCreate,
  disabled,
  collapsed,
  onToggleCollapse,
}) => (
  <div className="field-toolbar">
    <select
      className="toolbar-select"
      value={value}
      onChange={(e) => onSelect(e.target.value)}
      disabled={disabled}
      aria-label="选择地块"
    >
      <option value="">— 选择地块 —</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>

    <button className="primary-btn" onClick={onCreate} disabled={disabled}>
      + 新建
    </button>

    <div className="toolbar-spacer" />

    <button
      className="icon-btn"
      onClick={onToggleCollapse}
      title={collapsed ? '展开侧栏' : '收起侧栏'}
      aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
    >
      {collapsed ? '‹' : '›'}
    </button>
  </div>
)

export default FieldToolbar
```

- [ ] **Step 5: 实现 FieldToolbar.css**

```css
.field-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: #ffffff;
}

.toolbar-select {
  min-width: 220px;
  padding: 7px 10px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 6px;
  font-size: 13px;
  color: #0f172a;
  background: #ffffff;
}

.toolbar-select:focus {
  outline: none;
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}

.toolbar-spacer {
  flex: 1;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 6px;
  background: #ffffff;
  color: #64748b;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.icon-btn:hover {
  border-color: #22c55e;
  color: #16a34a;
}

.primary-btn,
.secondary-btn,
.danger-btn {
  padding: 7px 14px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.primary-btn {
  background: #22c55e;
  color: #ffffff;
}

.primary-btn:hover:not(:disabled) {
  background: #16a34a;
}

.secondary-btn {
  background: #ffffff;
  border-color: rgba(148, 163, 184, 0.6);
  color: #475569;
}

.danger-btn {
  background: #ef4444;
  color: #ffffff;
}

.danger-btn:hover:not(:disabled) {
  background: #dc2626;
}

.primary-btn:disabled,
.secondary-btn:disabled,
.danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 6: lint**

```bash
cd frontend && npm run lint 2>&1 | tail -20
```

预期：无 error。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/fields/FieldFormFields.jsx frontend/src/components/fields/FieldSidePanel.jsx frontend/src/components/fields/FieldSidePanel.css frontend/src/components/fields/FieldToolbar.jsx frontend/src/components/fields/FieldToolbar.css
git commit -m "feat: 新增侧栏（五态）与工具栏组件"
```

---

## Task 12: 编排 `Fields.jsx` + 清理旧组件 + 端到端验证

**Files:**
- Modify: `frontend/src/pages/Dashboard/Fields/Fields.jsx`（整体重写）
- Create: `frontend/src/pages/Dashboard/Fields/Fields.css`
- Delete: `frontend/src/pages/Dashboard/Fields/components/FieldForm.jsx`
- Delete: `frontend/src/pages/Dashboard/Fields/components/FieldDetail.jsx`
- Delete: `frontend/src/components/map/`（整个目录）

**Interfaces:**
- Consumes: Task 1–11 全部产物
- Produces: 完整页面

- [ ] **Step 1: 重写 Fields.jsx**

```jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FieldToolbar from '@/components/fields/FieldToolbar'
import FieldSidePanel from '@/components/fields/FieldSidePanel'
import FieldMapCanvas from '@/components/fields/FieldMapCanvas'
import { useFieldCatalog } from '@/hooks/fields/useFieldCatalog'
import { useFieldGeometry } from '@/hooks/fields/useFieldGeometry'
import { useFieldDraw } from '@/hooks/fields/useFieldDraw'
import { fieldService } from '@/services/fieldService'
import {
  areaOf, boundsOf, toStorageRing, toWKT,
  boundsToBbox, expandBbox, clusterInScreenSpace, isBboxValid,
} from '@/utils/geo'
import './Fields.css'

const GEOMETRY_ZOOM_IN = 13.0
const GEOMETRY_ZOOM_OUT = 12.8
const VIEWPORT_THROTTLE_MS = 300
const BBOX_EXPAND_RATIO = 0.2
const CLUSTER_CELL_PX = 44
const COLLAPSE_STORAGE_KEY = 'fields:sidepanel:collapsed'
const TILE_SIZE = 256

const EMPTY_FORM = {
  name: '',
  description: '',
  crop_type: '',
  soil_type: '',
  irrigation_type: '',
}

/**
 * Web Mercator 像素投影（给定 zoom）。
 * 不依赖地图实例，聚合计算因此是纯函数、可测试。
 */
const makeProjector = (zoom) => ([lng, lat]) => {
  const scale = TILE_SIZE * Math.pow(2, zoom)
  const x = ((lng + 180) / 360) * scale
  const s = Math.sin((lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale
  return [x, y]
}

const Fields = () => {
  const canvasRef = useRef(null)
  const catalog = useFieldCatalog()
  const geometry = useFieldGeometry()
  const draw = useFieldDraw(canvasRef)

  const [selectedPlotId, setSelectedPlotId] = useState(null)
  const [panelMode, setPanelMode] = useState('empty')
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1'
  )
  const [layer, setLayer] = useState('cluster')
  const [zoom, setZoom] = useState(4)
  const [visibleIds, setVisibleIds] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [geometryLoading, setGeometryLoading] = useState(false)

  const viewportRef = useRef({ zoom: 4, bounds: null })
  const throttleRef = useRef(null)
  /** 视野请求序号：只采用最后一次请求的结果，避免先发后到覆盖新数据 */
  const fetchSeqRef = useRef(0)
  // 供依赖 [selectedPlotId] 的 effect 读取最新值，避免把整个 hook 放进依赖数组
  const geometryRef = useRef(geometry)
  geometryRef.current = geometry
  const catalogRef = useRef(catalog)
  catalogRef.current = catalog

  /** 模式切换的唯一入口，强制 panelMode / selectedPlotId 的合法组合 */
  const enterMode = useCallback(
    (next) => {
      if (next === 'view' || next === 'edit' || next === 'confirmDelete') {
        if (!selectedPlotId) {
          setPanelMode('empty')
          return
        }
      }
      setPanelMode(next)
    },
    [selectedPlotId]
  )

  /** 三个选中入口（下拉 / 点击图斑 / 点击聚合点）统一走这里 */
  const selectPlot = useCallback((id) => {
    setSelectedPlotId(id || null)
    setPanelMode(id ? 'view' : 'empty')
    setErrors({})
  }, [])

  const handleViewportChange = useCallback(
    (z, bounds) => {
      viewportRef.current = { zoom: z, bounds }
      setZoom(z)
      if (throttleRef.current) clearTimeout(throttleRef.current)
      throttleRef.current = setTimeout(() => {
        throttleRef.current = null
        const b = viewportRef.current.bounds
        if (!b) return
        const bbox = expandBbox(boundsToBbox(b), BBOX_EXPAND_RATIO)
        if (!isBboxValid(bbox)) return
        const seq = (fetchSeqRef.current += 1)
        geometryRef.current.fetchVisible(bbox).then((ids) => {
          // 覆盖而非累加：累加会让视野外的图斑无限堆积在渲染列表里
          if (seq === fetchSeqRef.current) setVisibleIds(ids)
        })
      }, VIEWPORT_THROTTLE_MS)
    },
    []
  )

  // 滞后带：13.0 进多边形，12.8 退回聚合点，避免阈值边界抖动
  useEffect(() => {
    setLayer((prev) => {
      if (prev === 'cluster' && zoom >= GEOMETRY_ZOOM_IN) return 'polygon'
      if (prev === 'polygon' && zoom < GEOMETRY_ZOOM_OUT) return 'cluster'
      return prev
    })
  }, [zoom])

  // 进入多边形层时立即补一次视野请求
  useEffect(() => {
    if (layer !== 'polygon') return
    const b = viewportRef.current.bounds
    if (!b) return
    const bbox = expandBbox(boundsToBbox(b), BBOX_EXPAND_RATIO)
    if (!isBboxValid(bbox)) return
    const seq = (fetchSeqRef.current += 1)
    geometryRef.current.fetchVisible(bbox).then((ids) => {
      if (seq === fetchSeqRef.current) setVisibleIds(ids)
    })
  }, [layer])

  // 渲染：cluster 层用聚合点，polygon 层用已缓存几何
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (layer === 'cluster') {
      const project = makeProjector(viewportRef.current.zoom)
      const items = catalog.light
        .filter((f) => f.centroid && f.centroid.length === 2)
        .map((f) => ({ id: f.id, centroid: f.centroid }))
      canvas.setPolygons([])
      canvas.setClusters(clusterInScreenSpace(items, project, CLUSTER_CELL_PX))
      return
    }

    const list = visibleIds
      .map((id) => ({ id, ring: geometry.ringsOf(id) }))
      .filter((p) => p.ring && p.ring.length >= 3)
    canvas.setClusters([])
    canvas.setPolygons(list)
  }, [layer, visibleIds, geometry.version, catalog.light])

  // 选中副作用：优先拉几何 -> fitBounds -> 补详情
  useEffect(() => {
    const canvas = canvasRef.current
    if (!selectedPlotId) {
      canvas?.setHighlight(null)
      return
    }
    let cancelled = false
    const run = async () => {
      canvas?.setHighlight(selectedPlotId)
      if (!geometryRef.current.has(selectedPlotId)) {
        setGeometryLoading(true)
        await geometryRef.current.ensureGeometry(selectedPlotId)
        if (cancelled) {
          setGeometryLoading(false)
          return
        }
        setGeometryLoading(false)
      }
      const ring = geometryRef.current.ringsOf(selectedPlotId)
      if (ring && ring.length >= 3) canvas?.fitBounds(boundsOf(ring))

      const entry = catalogRef.current.byId.get(selectedPlotId)
      if (!entry?.detail) {
        try {
          const field = await fieldService.getFieldById(selectedPlotId)
          if (!cancelled) catalogRef.current.upsertDetail(field)
        } catch (e) {
          console.error('[Fields] 获取地块详情失败:', e)
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [selectedPlotId])

  // 折叠状态持久化；create/edit/confirmDelete 时强制展开
  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    if (collapsed && (panelMode === 'create' || panelMode === 'edit' || panelMode === 'confirmDelete')) {
      setCollapsed(false)
    }
  }, [panelMode, collapsed])

  useEffect(() => () => { if (throttleRef.current) clearTimeout(throttleRef.current) }, [])

  const draft = draw.draftRing
  const draftAreaM2 = draft ? areaOf(draft) : null
  const draftVertexCount = draft ? draft.length : null

  const handleCreate = useCallback(async () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setPanelMode('create')
    const ring = await draw.start() // GCJ-02
    if (!ring) {
      // 用户取消绘制
      draw.clear()
      setPanelMode(selectedPlotId ? 'view' : 'empty')
    }
  }, [draw, selectedPlotId])

  const handleStartEdit = useCallback(() => {
    const entry = catalogRef.current.byId.get(selectedPlotId)
    const d = entry?.detail
    setForm({
      name: d?.name ?? entry?.name ?? '',
      description: d?.description ?? '',
      crop_type: d?.crop_type ?? '',
      soil_type: d?.soil_type ?? '',
      irrigation_type: d?.irrigation_type ?? '',
    })
    enterMode('edit')
  }, [selectedPlotId, enterMode])

  const handleStartRedraw = useCallback(async () => {
    const ring = await draw.start()
    if (ring) draw.setDraftRing(ring)
  }, [draw])

  const handleCancel = useCallback(() => {
    if (panelMode === 'create') draw.cancel()
    draw.clear()
    setErrors({})
    setPanelMode(selectedPlotId ? 'view' : 'empty')
  }, [panelMode, draw, selectedPlotId])

  const handleSubmit = useCallback(async () => {
    if (!form.name?.trim()) {
      setErrors({ name: '请输入地块名称' })
      return
    }
    setSubmitting(true)
    try {
      if (panelMode === 'create') {
        const ring = draw.draftRing
        if (!ring) {
          setErrors({ name: '请先在地图上绘制地块边界' })
          setSubmitting(false)
          return
        }
        const payload = {
          name: form.name.trim(),
          description: form.description,
          crop_type: form.crop_type || undefined,
          soil_type: form.soil_type || undefined,
          irrigation_type: form.irrigation_type || undefined,
          // 面积后端权威：不提交 area_m2
          location_wkt: toWKT(toStorageRing(ring)),
        }
        const created = await fieldService.createField(payload)
        geometryRef.current.invalidate(created.id)
        catalogRef.current.upsertDetail(created)
        draw.clear()
        await geometryRef.current.ensureGeometry(created.id)
        selectPlot(created.id)
        const r = geometryRef.current.ringsOf(created.id)
        if (r) canvasRef.current?.fitBounds(boundsOf(r))
      } else {
        const ring = draw.draftRing
        const payload = {
          name: form.name.trim(),
          description: form.description,
          crop_type: form.crop_type || undefined,
          soil_type: form.soil_type || undefined,
          irrigation_type: form.irrigation_type || undefined,
          ...(ring ? { location_wkt: toWKT(toStorageRing(ring)) } : {}),
        }
        const updated = await fieldService.updateField(selectedPlotId, payload)
        geometryRef.current.invalidate(selectedPlotId)
        catalogRef.current.upsertDetail(updated)
        draw.clear()
        setPanelMode('view')
      }
      catalogRef.current.reload()
    } catch (e) {
      setErrors({ name: e?.response?.data?.detail ?? '保存失败，请重试' })
    } finally {
      setSubmitting(false)
    }
  }, [form, panelMode, draw, selectedPlotId, selectPlot])

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedPlotId) return
    setSubmitting(true)
    try {
      await fieldService.deleteField(selectedPlotId)
      geometryRef.current.invalidate(selectedPlotId)
      catalogRef.current.remove(selectedPlotId)
      selectPlot(null)
      canvasRef.current?.resetView()
    } catch (e) {
      setErrors({ name: e?.response?.data?.detail ?? '删除失败，请重试' })
    } finally {
      setSubmitting(false)
    }
  }, [selectedPlotId, selectPlot])

  const options = useMemo(
    () => catalog.light.map((f) => ({ value: f.id, label: f.name })),
    [catalog.light]
  )

  return (
    <div className="fields-page">
      <FieldToolbar
        options={options}
        value={selectedPlotId ?? ''}
        onSelect={selectPlot}
        onCreate={handleCreate}
        disabled={draw.drawing}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      <div className="fields-body">
        <div className="fields-map">
          <FieldMapCanvas
            ref={canvasRef}
            onViewportChange={handleViewportChange}
            onBlankClick={() => selectPlot(null)}
            onPolygonClick={selectPlot}
          />
        </div>

        {!collapsed && (
          <FieldSidePanel
            mode={panelMode}
            field={selectedPlotId ? catalog.byId.get(selectedPlotId) ?? null : null}
            geometryLoading={geometryLoading}
            draftAreaM2={draftAreaM2}
            draftVertexCount={draftVertexCount}
            form={form}
            errors={errors}
            submitting={submitting}
            onFormChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            onStartEdit={handleStartEdit}
            onStartDelete={() => enterMode('confirmDelete')}
            onConfirmDelete={handleConfirmDelete}
            onCancel={handleCancel}
            onSubmit={handleSubmit}
            onStartRedraw={handleStartRedraw}
            onCollapse={() => setCollapsed(true)}
          />
        )}
      </div>
    </div>
  )
}

export default Fields
```

- [ ] **Step 2: 创建 Fields.css**

```css
.fields-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #ffffff;
}

.fields-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.fields-map {
  position: relative;
  flex: 1;
  min-width: 0;
}
```

- [ ] **Step 3: 删除旧组件**

```bash
cd frontend && git rm src/pages/Dashboard/Fields/components/FieldForm.jsx src/pages/Dashboard/Fields/components/FieldDetail.jsx && git rm -r src/components/map
```

- [ ] **Step 4: 确认无残留引用**

```bash
cd frontend && grep -rn "FieldForm\|FieldDetail\|components/map\|FieldMapPicker\|MapDisplay" src/ || echo "无残留引用"
```

预期输出「无残留引用」。若 `pages/Dashboard/Fields/components/index.js`（若存在）仍导出这两个组件，同步删除对应导出行。

- [ ] **Step 5: 类型检查 + lint + 测试**

```bash
cd frontend && npm run typecheck 2>&1 | tail -20 && npm run lint 2>&1 | tail -20
```

```bash
cd frontend && npx vitest run src/utils/geo src/hooks/fields 2>&1 | tail -30
```

预期：三项均无 error，本计划新增的测试全部 PASS。

> **不要跑 `npm run test`（全量）作为验收**：仓库里 `src/store/useDeployTasksStore.test.ts` 与
> `src/components/deploy/DeployTasksFab.test.tsx` 两个既有测试文件在这套 vitest 装好之前**从未被执行过**，
> 装上后暴露出 9 个失败（缺分号导致的 ASI 解析错误、mock 不完整、缺 `@testing-library/react`）。
> 它们是 deploy 模块的测试，与本计划无关，修复需要重写他人测试并新增 3 个依赖——属独立工作。
> 验收只针对本计划新增的 `src/utils/geo` 与 `src/hooks/fields`。

- [ ] **Step 6: 构建验证**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

预期：构建成功，无 unresolved import。

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src
git commit -m "refactor: 地块管理页改为地图中心视图，删除旧弹窗组件"
```

---

## 手动端到端验证清单

启动前后端后在浏览器逐条确认（对应 spec §9 的 9 条验收）：

| # | 验收项 | 操作 | 期望 |
|---|---|---|---|
| 1 | 3s 内出图、无选中态 | 打开地块管理页 | 地图（卫星底图）先出，侧栏显示「未选择地块」，无高亮 |
| 2 | 选中后三者同步 | 下拉选一个地块 | 地图 fitBounds 定位 + 图斑变橙色高亮 + 侧栏显示详情 + 下拉保持该值 |
| 3 | 点击图斑反向同步 | 放大到 zoom≥13，点某个图斑 | 下拉框自动切到该地块，侧栏同步 |
| 4 | 跨阈值无闪烁、无重复请求 | 在 13 附近来回缩放 | 层切换平滑；Network 面板中 `/api/fields/geometry` 不对同一区域重复请求 |
| 5 | 图斑与卫星底图吻合 | 放大到 zoom≥17 对比 | 无肉眼偏移。**若整体偏移 300–500m**，改 `.env` 的 `VITE_FIELD_SOURCE_CRS=gcj02` 后重试 |
| 6 | 缩放流畅 | 连续拖动/缩放 | 无明显卡顿；请求被 300ms 节流 |
| 7 | 地图绘制新建 | 点「新建」→ 在地图上点若干点并双击闭合 | 出现虚线预览，侧栏显示顶点数与预览面积；填名称保存后出现在下拉列表 |
| 8 | 侧栏内联编辑 | 选中地块 → 侧栏「编辑」 | 字段就地变输入框，保存后详情更新，**无弹窗** |
| 9 | 删除二次确认 | 选中地块 → 侧栏「删除」 | 侧栏出现危险提示条，点「确认删除」才真正删除；「取消」可回退 |

**坐标系校准（一次性，完成后删除诊断代码，见 spec §6.3）：**

1. 先按默认 `VITE_FIELD_SOURCE_CRS=wgs84` 观察验收项 5
2. 若整体偏移，改为 `gcj02` 后重启前端再观察
3. 确定后把结论写回 `.env`，并在代码注释中记录存量数据的真实坐标系

---

## 实施顺序依赖

```
Task 1 (vitest)
   ↓
Task 2 (crs) ─┐
Task 3 (wkt) ─┼→ Task 4 (cluster) ─→ Task 6 (service) ─┐
              ┘                                         │
Task 5 (后端端点，可与 Task 2-4 并行) ─────────────────┤
                                                        ↓
                                    Task 7 (useAMap) → Task 8 (FieldMapCanvas)
                                                        ↓
                              Task 9 (LOD hooks) + Task 10 (useFieldDraw)
                                                        ↓
                                            Task 11 (侧栏/工具栏)
                                                        ↓
                                            Task 12 (编排 + 清理 + 验证)
```

Task 5（后端）与 Task 2–4（前端纯工具）无依赖，可并行。
