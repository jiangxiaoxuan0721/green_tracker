# 地块管理界面重构设计（地图中心视图）

日期：2026-09-16
状态：已确认
范围：前端页面重构 + 后端追加 2 个只读端点（不改动任何现有接口）

---

## 1. 背景与目标

### 1.1 现状问题

`frontend/src/pages/Dashboard/Fields/Fields.jsx` 当前是 `ItemCard` 网格 + 弹窗表单的列表页：

- 地块的空间属性（PostGIS `POLYGON`）在列表视图里完全不可见，用户无法直观判断地块位置与形状
- 详情以 Modal 承载（`FieldDetail.jsx`），看详情时无法同时看到全局
- 一次 `GET /api/fields/` 拉回全量字段 + 完整 WKT，地块数量和顶点数增长后首屏与渲染都会劣化

### 1.2 目标

把地块管理改造成**地图为主视图**的工作台：顶部工具栏 + 中间地图（flex:1）+ 右侧可折叠信息侧栏（320–360px）。

### 1.3 非目标

- 不改动现有 5 个地块接口（`POST /`、`GET /`、`GET /{id}`、`PUT /{id}`、`DELETE /{id}`）的签名与行为
- 不引入地图框架封装库（如 `@amap/amap-jsapi-loader`），继续沿用现有 `window.AMap` 动态 script 加载方式
- 不做服务端聚合（聚类在前端完成）
- 不做批量操作、导入导出、地块归属/权限管理

---

## 1.4 交互工作流（核心）

整体围绕「**主地图绘制 + 侧栏承载全部表单与确认**」展开，页面上不存在任何弹窗。

### 新建

1. 顶部工具栏点「新建」→ 侧栏切换为**创建态**，地图进入**绘制模式**（光标变十字，提示「点击地图开始绘制，双击闭合」）
2. 用户在主地图上绘制多边形 → 双击闭合 → 绘制结束，主地图用临时样式（虚线 + 高亮色）预览该图斑
3. 侧栏内联表单回填：几何摘要（顶点数 / 实时面积），待用户填 `name`、`crop_type`、`soil_type`、`irrigation_type`、`description`
4. 点「保存」→ 几何经 `toStorage()`（GCJ-02 → WGS84）→ `POST /api/fields/`
5. 成功 → `setSelectedPlotId(newId)` → 侧栏转为**查看态**；刷新 catalog 与几何缓存
6. 绘制中或填写中可「取消」→ 清除临时图斑，退出绘制模式，回到原状态

### 选中

- 主地图上点击已存在的图斑 → `setSelectedPlotId(id)` → 侧栏显示该地块详情（查看态）
- 点击地图空白处 → 取消选中 → 侧栏回空态

### 编辑

- 选中地块后，点**侧栏底部**「编辑」→ 侧栏切换为**编辑态**，属性字段就地变为可输入控件
- 「保存」→ `PUT /api/fields/{id}`；「取消」→ 丢弃改动回查看态
- 编辑态额外提供「重绘边界」：复用同一套绘制能力，重绘完成后随保存一起提交

### 删除

- 选中地块后，点**侧栏底部**「删除」→ 侧栏切换为**删除确认态**（内联危险提示条，非浏览器 `confirm`、非 Modal）
- 需再点一次「确认删除」才真正调用 `DELETE /api/fields/{id}`；「取消」回到查看态
- 删除成功 → `setSelectedPlotId(null)` → 侧栏回空态；刷新 catalog 与几何缓存

> **入口归属**：工具栏**只**放「新建」（全局操作，与选中无关）；「编辑」「删除」是针对当前选中地块的操作，**只**出现在侧栏底部，且仅在 `view` 态出现。这样避免工具栏出现一堆需要判断选中态才能点亮的按钮。

## 2. 关键约束与已确认决策

| 决策点 | 结论 |
|---|---|
| LOD 取数方式 | 后端**追加** 2 个只读端点，不做前端全量裁剪 |
| CRUD 形态 | 全部保留，**取消一切弹窗**。新建在主地图绘制；编辑表单与删除确认全部内联到右侧信息面板 |
| 操作入口归属 | 工具栏**只**放「新建」；「编辑」「删除」只出现在侧栏底部（仅 `view` 态）。表单渲染与二次确认全部在侧栏 |
| 删除确认 | 侧栏内联危险确认条，需再点一次「确认删除」；不用浏览器 `confirm`、不用 Modal |
| 存量数据坐标系 | 未定。实现时加源坐标系开关 + 一次性校准诊断，人工对齐卫星底图后再固化 |
| centroid 字段形态 | 数组 `[lng, lat]`（与高德 API 一致，少一层转换） |
| 组件精简 | 删除 `FieldForm` / `FieldDetail` / `FieldMapPicker` / `MapDisplay` / `map.css` / `components/map/index.js` |
| 性能参数 | 按经验值先行（cell 44px / bbox 外扩 20% / 滞后带 12.8–13.0），实测后可调 |

### 2.1 为什么必须新增端点

需求要求「zoom < 13 拉轻量列表 id/name/centroid」与「zoom ≥ 13 按视野增量请求几何」。现有 `GET /api/fields/` 只能一次性返回全量字段 + 完整 WKT，既无 centroid 也无 bbox 过滤。若靠前端裁剪，则仍需首屏下载全部几何，与「数据量上限下缩放流畅」的验收目标直接冲突。

---

## 3. 架构

### 3.1 分层原则

**地图是命令式的，React 不通过 props 驱动 overlays。**

`Fields.jsx` 只持有状态，通过 ref 调用地图命令。这样 state 变化不会重建地图实例，也不会触发高德 overlay 的全量 diff。

```
Fields.jsx (持有 selectedPlotId + panelMode)
    │  props / ref 命令
    ├── FieldToolbar      ← 下拉 / 新建 / 折叠
    ├── FieldMapCanvas    ← ref 暴露命令式 API（渲染 + 绘制）
    └── FieldSidePanel    ← 空 / 查看 / 创建 / 编辑 / 删除确认 + 骨架屏
```

三个子组件**都不持有业务状态**：工具栏与侧栏通过回调上报意图，`Fields.jsx` 统一裁决后再下发。

### 3.2 文件结构

**新增**

```
frontend/src/
  utils/geo/
    crs.ts                  WGS84 ↔ GCJ-02 变换 + 源坐标系开关
    wkt.ts                  parseWKT / toWKT / centroidOf / boundsOf / areaOf
    index.js
  services/fieldService.ts  + getFieldsLight() / getFieldsGeometry(bbox)
  hooks/fields/
    useAMap.ts              SDK 加载（从 FieldMapPicker 抽出后复用）
    useFieldCatalog.ts      light 列表 + byId 索引（进页面请求一次）
    useFieldGeometry.ts     LOD：bbox 增量请求 + loadedGeometryIds + 几何缓存
    useFieldDraw.ts         主地图绘制态：startDraw / cancelDraw / 临时图斑预览
  components/fields/
    FieldMapCanvas.jsx      地图渲染层（聚合点 + 多边形 + 绘制）
    FieldToolbar.jsx        地块下拉 / 新建 / 折叠
    FieldSidePanel.jsx      五态合一容器（空 / 查看 / 创建 / 编辑 / 删除确认）
    FieldFormFields.jsx     属性字段组，创建态与编辑态共用
  pages/Dashboard/Fields/
    Fields.jsx              编排层，唯一状态源
    Fields.css
```

**删除**

| 路径 | 原因 |
|---|---|
| `pages/Dashboard/Fields/components/FieldForm.jsx` | Modal 表单，被侧栏内联表单取代 |
| `pages/Dashboard/Fields/components/FieldDetail.jsx` | Modal 详情，被侧栏查看态取代 |
| `components/map/FieldMapPicker.jsx` | 仅被 `FieldForm` 引用；其绘制能力迁入 `useFieldDraw` + `FieldMapCanvas` |
| `components/map/MapDisplay.jsx` | 仅被 `FieldDetail` 引用；侧栏不再内嵌小地图（主地图已展示） |
| `components/map/map.css`、`index.js` | 随上述组件一并删除 |

> 已核实引用面：`FieldMapPicker` 与 `MapDisplay` 全仓库**仅**被 `FieldForm.jsx` / `FieldDetail.jsx` 引用，无其他调用点，删除安全。删除后 `components/map/` 目录整体移除。

### 3.3 `FieldMapCanvas` ref API

```ts
interface FieldMapCanvasHandle {
  fitBounds(bounds: Bounds, padding?: number): void
  setClusters(points: ClusterPoint[]): void   // zoom < 13
  setPolygons(list: RenderPolygon[]): void    // zoom >= 13，增量 diff
  setHighlight(id: string | null): void
  setHover(id: string | null): void
  startDraw(): Promise<LngLat[] | null>       // 进入绘制模式，闭合后 resolve；取消/卸载 resolve(null)
  cancelDraw(): void
  setDraftPolygon(path: LngLat[] | null): void  // 绘制中/重绘时的临时预览
  resetView(): void                            // 全国视野
}
```

- `RenderPolygon = { id: string; path: LngLat[] }`（`path` 已由 `toDisplay()` 转换）
- `LngLat = [number, number]`
- `startDraw()` 返回 **WGS84** 坐标（R18 已把 `FieldMapCanvas` 对外边界统一为 WGS84，转换在其内部由 `toStorageRing` 完成）。调用方可直接 `toWKT` 入 WKT / 提交，**不得再套 `toStorage()`/`toStorageRing()`**，否则二次转换、偏移翻倍

---

## 4. 状态机与联动

### 4.1 单一状态源

```js
const [selectedPlotId, setSelectedPlotId] = useState(null)   // 选中哪个地块
const [panelMode, setPanelMode] = useState('empty')           // 侧栏处于哪个模式
```

`panelMode` 取值：`empty` | `view` | `create` | `edit` | `confirmDelete`。

`selectedPlotId` 决定**对象**，其余全部**派生**，因此下拉框、侧栏、图斑高亮在结构上不可能不一致：

- 下拉框 `value = selectedPlotId ?? ''`
- 侧栏内容 `selectedField = catalog.byId.get(selectedPlotId)`
- 高亮由 effect 调 `ref.setHighlight(selectedPlotId)`

### 4.2 模式约束（防非法组合）

`panelMode` 与 `selectedPlotId` 不是自由组合，合法组合如下：

| panelMode | selectedPlotId | 说明 |
|---|---|---|
| `empty` | `null` | 未选中 |
| `view` | 非 null | 查看详情 |
| `edit` | 非 null | 编辑已有地块 |
| `confirmDelete` | 非 null | 删除二次确认 |
| `create` | 保持进入前的值，不清空 | 新建；绘制完成前不改变当前选中，避免地图上高亮丢失 |

约束由 `Fields.jsx` 内的 `enterMode(next)` 单一入口强制：切到 `view/edit/confirmDelete` 前若无 `selectedPlotId` 则落到 `empty`。组件不各自判断，避免出现「编辑态但没有选中对象」的非法状态。

### 4.3 三个选中入口

下拉选择 / 点击图斑 / 点击聚合点 —— 全部只调用 `selectPlot(id)`，内部统一 `setSelectedPlotId(id)` + `setPanelMode('view')`。

### 4.4 选中副作用

`selectedPlotId` 变化时的 effect：

1. 几何已在本体缓存（`geometryCache.has(id)`）→ 直接 `fitBounds(bounds)`
2. 否则 → `geometryLoading = true`（侧栏显示骨架屏）→ 优先单拉 `GET /api/fields/{id}` → 写入缓存 → `fitBounds`
   - 该请求独立于视野批量请求，保证选中响应不被节流阻塞
3. `ref.setHighlight(id)`

### 4.5 取消选中

地图 `click` 事件未命中任何 polygon → `selectPlot(null)` → 侧栏回到「未选择地块」。

例外：`panelMode === 'create'` 且正在绘制时，地图点击属于绘制行为，**不**触发取消选中。

### 4.6 空态

`selectedPlotId === null` 且未做过任何选中时，地图保持全国视野（`zoom 4 / center [104, 37.5]`）。用户手动缩放浏览不视为空态丢失。

### 4.7 hover

`mousemove` 命中 polygon → `setHover(id)`：轻微强调（描边加粗 + 提升 zIndex）+ tooltip（名称 / 面积）。离开 → `setHover(null)`。hover 状态**不进 React state**，由 `FieldMapCanvas` 内部持有，避免高频重渲染。

---

## 5. LOD 数据层

### 5.1 后端新增端点

#### `GET /api/fields/light`

响应：

```json
[{ "id": "uuid", "name": "示范田A区", "area_m2": 1000000, "centroid": [116.15, 39.95] }]
```

SQL 要点（PostGIS 分支）：

```sql
SELECT id, name, area_m2,
       ST_X(ST_Centroid(location_geom)) AS cx,
       ST_Y(ST_Centroid(location_geom)) AS cy
FROM fields
WHERE is_active = True
```

#### `GET /api/fields/geometry?minLng=&minLat=&maxLng=&maxLat=`

响应：

```json
[{ "id": "uuid", "location_wkt": "POLYGON((...))" }]
```

SQL 要点：

```sql
SELECT id, ST_AsText(location_geom) AS location_wkt
FROM fields
WHERE is_active = True
  AND ST_Intersects(location_geom, ST_MakeEnvelope(:minLng,:minLat,:maxLng,:maxLat, 4326))
```

#### 实现约束

- 两个端点必须注册在 `/api/fields/{field_id}` **之前**，否则会被路径参数路由吞掉
- `field_service.py` 存在 `HAS_POSTGIS` 分支（GeoAlchemy2 不可用时的降级路径）。新增函数同样需要降级分支：无 PostGIS 时 `location_geom` 存的是文本，centroid 与 bbox 过滤退化为「返回全部 + 全量视为命中」，并在日志中 warn
- 参数校验：`bbox` 四个值必须齐全且 `minLng < maxLng`、`minLat < maxLat`；纬度钳制在 `[-90, 90]`；非法输入返回 400

### 5.2 前端加载策略

| 缩放级别 | 数据源 | 渲染 |
|---|---|---|
| `< 13` | `/fields/light`（进页面请求一次，全量缓存） | 屏幕空间网格聚合，cell 44px → 计数点 |
| `≥ 13` | `/fields/geometry?bbox=`（按视野增量） | POLYGON 边界 |

- `moveend` / `zoomend` 统一节流 **300ms**
- bbox 在地图视野基础上**外扩 20%**，减少小幅拖动导致的重复请求
- 请求前用 `loadedGeometryIds: Set<string>` 过滤已加载的 id；完全无缺失则**不发请求**
- 已加载几何**永久缓存**于 `Map<string, rings>`，缩放回退零请求
- 请求发出但视野已变的，用自增 `requestSeq` 丢弃过期响应

### 5.3 跨阈值切换（无闪烁）

`GEOMETRY_ZOOM_THRESHOLD = 13`，带滞后带：

- 从聚合切到多边形：`zoom >= 13.0`
- 从多边形切回聚合：`zoom < 12.8`

切换时序：新层 overlays 先 `add` → 下一帧（`requestAnimationFrame`）再 `remove` 旧层。两层数据各自缓存，回退不重新请求。

---

## 6. 坐标系

### 6.1 规则

- 库内存 **WGS84**（`location_geom` 为 `Geometry('POLYGON', srid=4326)`）
- 高德 JS API 使用 **GCJ-02**
- 渲染前 `toDisplay()`：WGS84 → GCJ-02
- 回写前 `toStorage()`：GCJ-02 → WGS84
- 不做转换会导致 **300–500m** 偏移

### 6.2 开关

新增环境变量 `VITE_FIELD_SOURCE_CRS`，取值 `wgs84`（默认）| `gcj02`。

`utils/geo/crs.ts` 导出 `toDisplay(coords)` / `toStorage(coords)`，内部依据开关决定是否变换。所有地图渲染路径**必须**经过 `toDisplay`，所有写库路径**必须**经过 `toStorage`。

### 6.3 校准诊断（一次性，用完即删）

存量数据存在风险：历史代码 `FieldMapPicker`（本次随 §3.2 一并删除）绘制时直接把高德返回的 GCJ-02 坐标写入了库，未做转换。因此存量数据实际可能是 GCJ-02 被误标为 WGS84。

诊断方式：`?crsDebug=1` 时工具栏出现诊断条，对选中图斑同时绘制两条描边——

- 实线 = 当前开关假设下的渲染结果
- 虚线（对比色） = 另一种假设

人工对比卫星底图上的实际地块边界，判定存量数据真实坐标系后：

1. 把正确值写入 `.env` 的 `VITE_FIELD_SOURCE_CRS`
2. **删除全部诊断代码**，不留在生产

> 该诊断是临时脚手架，不是产品功能。校准完成后本节的诊断分支应从代码中移除。

---

## 7. 侧栏

### 7.1 字段（取自 `backend/database/db_models/user_models.py::Field`）

| 区块 | 字段 |
|---|---|
| 标题 | `name` |
| 基本 | `area_m2`（同时显示 m² 与亩）、`crop_type`、`soil_type`、`irrigation_type` |
| 描述 | `description` |
| 元信息 | `created_at`、`updated_at`、几何顶点数 |

不展示的字段及原因：

- `is_active` —— `get_field_with_wkt()` 未 SELECT 该列，现有接口不返回；且 `/fields/light` 已按 `is_active = True` 过滤，徽章恒为「正常」，无信息量。若后续需要展示停用地块，应单独扩展接口，不在本次范围
- `owner_id` / `organization_id` —— 后端当前不返回

### 7.2 五态渲染

`FieldSidePanel` 依据 `panelMode` 渲染，同一容器、同一宽度，不做路由跳转、不弹窗：

| 模式 | 内容 |
|---|---|
| `empty` | 占位文案「未选择地块」+ 引导「点击地图上的地块，或点顶部『新建』开始绘制」 |
| `view` | 上表字段只读展示；底部操作「编辑」「删除」 |
| `create` | 绘制提示 + 几何摘要（顶点数 / 实时面积）+ `FieldFormFields` 可编辑；底部「保存」「取消」 |
| `edit` | 同 `create` 的字段组，预填当前值；额外「重绘边界」；底部「保存」「取消」 |
| `confirmDelete` | 危险提示条：地块名 + 「此操作不可恢复」；底部「确认删除」「取消」 |

「加载中」不是独立模式，而是 `view` 下的骨架屏状态：几何未命中缓存时字段区渲染骨架屏。

### 7.3 表单与校验

- `create` / `edit` 共用 `FieldFormFields.jsx`，props 为 `value` / `onChange` / `errors`
- 必填：`name`、`location_wkt`（编辑态已存在，创建态由绘制结果提供）
- `create` 未完成绘制时，「保存」按钮禁用并提示「请先在地图上绘制地块边界」
- 面积**只有后端一个权威来源**：前端计算的值仅用于绘制后的侧栏**预览**，不随创建/更新请求提交（`area_m2` 传 `null`）。保存后以后端 `calculate_and_update_area` 回写的结果为准展示；后端无值时显示「未知」。避免前端后端两套面积算法产生不一致

### 7.4 折叠

侧栏宽度 320–360px，可折叠。折叠状态存 localStorage，刷新后保留。

折叠时若 `panelMode` 为 `create` / `edit` / `confirmDelete`，**自动展开**——这三个模式需要用户看到内容，不允许在折叠态隐式进行。

---

## 8. 布局与工具栏

```
┌──────────────────────────────────────────────────────┐
│ 工具栏: [地块下拉 ▾]  [+ 新建]              [⇥ 折叠]  │
├───────────────────────────────────┬──────────────────┤
│                                   │                  │
│          地图 (flex:1)             │  侧栏 320–360px  │
│          卫星图层                  │                  │
│                                   │  查看时底部:      │
│                                   │  [编辑] [删除]    │
└───────────────────────────────────┴──────────────────┘
```

- 地图容器 `flex: 1`，侧栏固定宽度；折叠时地图占满
- 卫星图层：`AMap.TileLayer.Satellite` + `AMap.TileLayer.RoadNet` + `AMap.Scale` + `AMap.ToolBar`（沿用 `FieldMapPicker` 现有配置）
- 工具栏仅两项操作：地块下拉（选中同步）、「新建」（始终可用）。**不放**编辑/删除
- 编辑/删除只在侧栏 `view` 态底部出现，天然满足「无选中则不可操作」，无需额外的禁用态判断
- 绘制态（`panelMode === 'create'` 或编辑态重绘中）工具栏的「新建」与下拉置为不可点，避免绘制流程被中途打断

---

## 9. 验收对照

| # | 验收项 | 设计保障 |
|---|---|---|
| 1 | 进入 3s 内出图，无选中态 | 地图初始化与 `/fields/light` 请求**并行**，地图不等数据；初始 `selectedPlotId = null` |
| 2 | 选中后地图/图斑/侧栏同步更新，无状态不一致 | 单一 `selectedPlotId`，其余全部派生 |
| 3 | 点击图斑反向更新下拉框与侧栏 | 点击只 `setSelectedPlotId`，下拉与侧栏是其纯函数 |
| 4 | 缩放跨阈值时点↔多边形切换无闪烁、无重复请求 | 滞后带 12.8/13.0 + 新层先 add 后 remove + 几何永久缓存 + `loadedGeometryIds` 去重 |
| 5 | 图斑边缘与卫星底图吻合，无肉眼偏移 | 渲染前 `toDisplay()` 坐标变换 + §6.3 人工校准 |
| 6 | 数据量上限下缩放流畅，无长任务阻塞 | 300ms 节流 + bbox 增量 + 请求去重 + 聚合点代替密集多边形 |
| 7 | 新建可在主地图上绘制并落库 | `useFieldDraw` + `startDraw()`，绘制结果已是 WGS84（R18），直接 `toWKT` 提交 |
| 8 | 编辑/删除不弹窗，全部在侧栏完成 | `panelMode` 五态 + `FieldFormFields` 内联复用 |
| 9 | 删除必须二次确认 | `confirmDelete` 态内联危险确认条，需再点一次才发请求 |

---

## 10. 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 存量数据坐标系未知 | 验收 5 可能不通过 | §6.3 校准诊断；开关可一键切换 |
| 高德 Key 未配置 | 地图完全不可用 | 保留 `FieldMapPicker` 现有的 key 缺失兜底 UI（迁入 `FieldMapCanvas`） |
| `HAS_POSTGIS = False` 环境 | 新端点 centroid/bbox 失效 | 降级为全量返回 + 日志 warn，功能不崩 |
| 路由顺序问题 | `/fields/light` 被 `/fields/{id}` 吞掉 | 新路由注册在参数路由之前，并补一条冒烟验证 |
| 删除 `components/map/` 后有隐藏引用 | 编译/运行期报错 | 已全仓检索确认仅 `FieldForm` / `FieldDetail` 两个引用点，二者同步删除；删除后需跑一次 `npm run build` 验证 |
| 绘制中用户切走（折叠侧栏 / 选其他地块） | 绘制流程悬挂 | 绘制态禁用工具栏，且 `useFieldDraw` 卸载时强制 `cancelDraw()` |

---

## 11. 开放项

- 聚合点 cell 尺寸（44px）、bbox 外扩比例（20%）、滞后带（12.8/13.0）为经验值，实测后可调
- 校准诊断的结果需人工判定后回填 `.env`
