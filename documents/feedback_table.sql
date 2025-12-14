-- =========================================================
-- 【DDL-05】用户反馈信息表：feedback
-- 功能：收集用户反馈信息，用于产品改进和用户体验优化
-- =========================================================


-- =========================
-- 1. 设计目标
-- =========================
-- feedback 表用于：
--   1. 收集用户的反馈意见
--   2. 记录用户的问题和建议
--   3. 跟踪反馈处理状态
--
-- 原则：
--   ✅ 简单易用的反馈表单
--   ✅ 支持多种反馈类型
--   ✅ 便于后续统计和分析


-- =========================
-- 2. 表结构定义
-- =========================
CREATE TABLE feedback (
  -- 主键
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 用户信息（可选填写）
  name              TEXT,                 -- 用户姓名
  email             TEXT,                 -- 电子邮箱
  
  -- 反馈内容
  subject           TEXT NOT NULL,        -- 反馈主题/标题
  content           TEXT NOT NULL,        -- 反馈内容详细信息
  
  -- 反馈分类
  category          TEXT DEFAULT 'general', -- 反馈分类：bug/suggestion/question/general
  priority          TEXT DEFAULT 'normal',  -- 优先级：low/normal/high/critical
  
  -- 反馈状态
  status            TEXT DEFAULT 'pending',  -- 处理状态：pending/in_process/resolved/closed
  
  -- 处理信息
  assigned_to       UUID,                -- 分配给哪位处理人员
  response_text     TEXT,                -- 回复内容
  resolved_at       TIMESTAMPTZ,         -- 解决时间
  
  -- 系统信息
  ip_address        INET,                -- 用户IP（可选）
  user_agent        TEXT,                -- 用户浏览器信息
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- 3. 约束设计
-- =========================

-- 限制反馈分类取值
ALTER TABLE feedback ADD CONSTRAINT check_feedback_category
  CHECK (category IN ('bug', 'suggestion', 'question', 'general'));

-- 限制优先级取值
ALTER TABLE feedback ADD CONSTRAINT check_feedback_priority
  CHECK (priority IN ('low', 'normal', 'high', 'critical'));

-- 限制处理状态取值
ALTER TABLE feedback ADD CONSTRAINT check_feedback_status
  CHECK (status IN ('pending', 'in_process', 'resolved', 'closed'));

-- 邮箱格式检查（如果提供）
ALTER TABLE feedback ADD CONSTRAINT check_email_format
  CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');


-- =========================
-- 4. 索引设计
-- =========================

-- 4.1 按状态查询
CREATE INDEX idx_feedback_status
ON feedback (status);

-- 4.2 按优先级查询
CREATE INDEX idx_feedback_priority
ON feedback (priority);

-- 4.3 按分类查询
CREATE INDEX idx_feedback_category
ON feedback (category);

-- 4.4 按创建时间查询
CREATE INDEX idx_feedback_created_at
ON feedback (created_at);

-- 4.5 按邮箱查询（同一用户的历史反馈）
CREATE INDEX idx_feedback_email
ON feedback (email);


-- =========================
-- 5. 字段语义说明
-- =========================
-- id            ：反馈记录的唯一标识
-- name          ：用户姓名（可选）
-- email         ：用户邮箱（可选）
-- subject       ：反馈主题/标题
-- content       ：反馈内容详细信息
-- category      ：反馈分类（bug/建议/问题/一般）
-- priority      ：优先级（低/中/高/紧急）
-- status        ：处理状态（待处理/处理中/已解决/已关闭）
-- assigned_to   ：处理人员的ID（引用用户表）
-- response_text ：给用户的回复内容
-- resolved_at   ：反馈解决时间
-- ip_address    ：提交反馈时的IP地址
-- user_agent    ：用户的浏览器/设备信息
-- created_at    ：反馈提交时间
-- updated_at    ：记录更新时间


-- =========================
-- 6. 示例插入数据
-- =========================

INSERT INTO feedback (
  name,
  email,
  subject,
  content,
  category,
  priority
) VALUES (
  '张三',
  'zhangsan@example.com',
  '登录页面问题',
  '在移动设备上登录按钮无法点击，请修复这个问题。',
  'bug',
  'high'
);

INSERT INTO feedback (
  name,
  email,
  subject,
  content,
  category,
  priority
) VALUES (
  '李四',
  'lisi@example.com',
  '功能建议',
  '希望能增加数据导出功能，方便我们进行进一步分析。',
  'suggestion',
  'normal'
);


-- =========================
-- 7. 典型查询示例
-- =========================

-- 7.1 查询所有未处理的反馈
SELECT *
FROM feedback
WHERE status = 'pending'
ORDER BY priority DESC, created_at ASC;

-- 7.2 查询某用户的反馈历史
SELECT *
FROM feedback
WHERE email = 'zhangsan@example.com'
ORDER BY created_at DESC;

-- 7.3 按分类统计反馈数量
SELECT 
  category,
  COUNT(*) AS count
FROM feedback
GROUP BY category;

-- 7.4 查询最近一周的反馈
SELECT *
FROM feedback
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;


-- =========================
-- 8. 外键关联（可选）
-- =========================

-- 如果需要关联到用户表，可以添加以下外键（需要先有用户表）
-- ALTER TABLE feedback ADD CONSTRAINT fk_feedback_assigned_to
--   FOREIGN KEY (assigned_to) REFERENCES user(id)
--   ON DELETE SET NULL;


-- =========================================================
-- feedback 表作用总结
-- =========================================================
-- 1. 收集用户反馈，促进产品改进
-- 2. 提供问题追踪和解决方案记录
-- 3. 支持按分类、优先级和状态进行管理
-- 4. 为用户满意度分析提供数据支持
-- =========================================================