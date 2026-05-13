---
title: Gaia LKM 使用指南
created: 2026-05-13
version: main + v0.5
status: draft
tags: [gaia, lkm, knowledge-graph, bp, cli]
---

# Gaia LKM 使用指南

本文档面向需要使用 Gaia 和 LKM（Large Knowledge Model，大知识模型）的 Agent 开发者、科学研究者和系统集成者。

**版本说明**：
- 主要内容基于 Gaia **main 分支**（稳定版）和 gaia-lkm-skills v2026.05.10
- Gaia **v0.5 分支**的新功能单独在 §11 说明（尚未合并到 main）

**重要提示**：如果你需要使用 v0.5 的新功能（如 `infer` / `associate` 新 API、谓词逻辑、warrant claim 等），请先切换分支：

```bash
cd ~/Code/Gaia
git checkout v0.5
```

否则请使用 main 分支的稳定功能。

---

## 0. 环境准备

### 0.1 系统要求

- **Python**: 3.10 或更高版本
- **Git**: 用于克隆代码仓库
- **包管理器**: 推荐使用 `uv`（更快），或使用 `pip`

**检查 Python 版本**：

```bash
python3 --version
# 输出应该是 Python 3.10.x 或更高
```

### 0.2 安装 Gaia

**克隆仓库**：

```bash
cd ~/Code
git clone https://github.com/SiliconEinstein/Gaia.git
cd Gaia
```

**选择分支**：

```bash
# 使用 main 分支（稳定版）
git checkout main

# 或使用 v0.5 分支（新功能，见 §11）
git checkout v0.5
```

**安装依赖**：

```bash
# 方式 1：使用 uv（推荐）
uv sync

# 方式 2：使用 pip
pip install -e .
```

**验证安装**：

```bash
gaia --version
# 输出：gaia, version 0.x.x

# 测试编译
gaia compile --help
```

### 0.3 安装 gaia-lkm-skills

**克隆仓库**：

```bash
cd ~/Code
git clone https://github.com/SiliconEinstein/gaia-lkm-skills.git
cd gaia-lkm-skills
```

**安装依赖**：

```bash
# 使用 uv
uv sync

# 或使用 pip
pip install -r requirements.txt
```

**验证安装**：

```bash
python skills/lkm-api/scripts/lkm.py --help
# 输出：LKM API client usage...
```

### 0.4 获取 LKM accessKey

**内部用户**：

1. 联系 LKM 团队：
   - 黄远（huangyuan@dp.tech）
   - 或在飞书 Gaia-LKM 群中询问
2. 或查看内部文档：飞书知识库 > Gaia > LKM 接入指南

**外部用户**：

LKM 目前为内部服务，暂不对外开放。如有合作需求，请联系 dp.tech。

### 0.5 配置环境变量

**添加到 shell 配置文件**：

```bash
# 编辑 ~/.bashrc（bash）或 ~/.zshrc（zsh）
nano ~/.zshrc

# 添加以下内容
export LKM_ACCESS_KEY="your_access_key_here"
export GAIA_HOME="$HOME/Code/Gaia"

# 保存后重新加载
source ~/.zshrc
```

**验证配置**：

```bash
echo $LKM_ACCESS_KEY
# 输出：your_access_key_here

echo $GAIA_HOME
# 输出：/Users/your_username/Code/Gaia
```

### 0.6 验证完整环境

**测试 LKM 连接**：

```bash
cd ~/Code/gaia-lkm-skills
python skills/lkm-api/scripts/lkm.py search \
  --query "test" \
  --top-k 1

# 成功输出：
# {
#   "data": {
#     "variables": [...],
#     "papers": [...]
#   }
# }

# 失败输出：
# Error: 401 Unauthorized
# → 检查 accessKey 是否正确
```

**测试 Gaia CLI**：

```bash
cd ~/Code/Gaia
gaia --version
# 输出：gaia, version 0.x.x
```

**环境准备完成**！现在可以继续 §1 快速开始。

---

## 1. 快速开始

### 1.1 什么是 Gaia LKM

**Gaia** 是一个知识形式化工具，用于将科学论文、实验数据、推理链条转换为可计算的知识图谱。核心能力：
- 将自然语言命题（claim）转换为逻辑节点
- 通过 BP（Belief Propagation）算法计算命题的置信度
- 支持矛盾检测、支持关系推理、开放问题发现

**LKM（Large Knowledge Model）** 是 Bohrium 的大知识模型服务，提供：
- 科学文献的 claim 检索
- 证据链（evidence chain）追溯
- 跨论文的知识关联

**Gaia + LKM 的协同**：
- LKM 提供原始知识检索和证据链
- Gaia 将 LKM 返回的结果形式化为可计算的知识包
- 本地 Gaia 包可以反向推送到 LKM（`gaia render --lkm`）

### 1.2 核心概念（main 分支）

| 概念 | 说明 | 通俗理解 |
|------|------|---------|
| **claim** | 可以被验证的命题（如"温度升高导致反应速率增加"） | 类似"假设"或"陈述"，可以通过实验或推理验证真假 |
| **BP (Belief Propagation)** | 信念传播算法，计算知识图谱中每个 claim 的后验概率 | 类似"推理引擎"，根据证据链自动计算每个假设的可信度 |
| **deduction** | 严格逻辑推导（A ∧ B → C，prior 接近 1） | "如果 A 和 B 都成立，那么 C 必然成立"（数学证明式） |
| **support** | 软支持关系（A 增加 C 的可信度，但不是严格推导） | "A 的存在增加了 C 成立的可能性"（统计相关） |
| **contradiction** | 互斥约束（¬(A ∧ B)，两个 claim 不能同时为真） | "A 和 B 不能同时成立"（互斥关系） |
| **prior** | 推导前的初始置信度 | "在看到证据之前，我们认为这个假设有多可信"（0-1 之间） |
| **posterior** | BP 计算后的置信度 | "综合所有证据后，这个假设的最终可信度"（0-1 之间） |
| **Gaia package** | 符合统一规范的知识包目录（包含 DSL 代码、audit log、文档） | 类似"项目文件夹"，包含代码、数据、审计日志 |

> **注意**：v0.5 分支新增了 `infer` / `associate` / `warrant claim` / 谓词逻辑等功能，详见 §11。

### 1.3 第一个例子

> **前置条件**：
> - ✅ 已完成 §0 环境准备
> - ✅ 已获取并配置 LKM accessKey
> - ✅ 已安装 Gaia 和 gaia-lkm-skills

**场景**：从 LKM 搜索"量子纠缠"相关 claim，构建 Gaia 知识包。

#### Step 1: 搜索 LKM

```bash
cd ~/Code/gaia-lkm-skills
python skills/lkm-api/scripts/lkm.py search \
  --query "量子纠缠" \
  --top-k 10 \
  --output search_results.json

# 输出：search_results.json（包含 10 个相关 claim）
```

**输出示例**：

```json
{
  "data": {
    "variables": [
      {
        "id": "gcn_xxx",
        "content": "量子纠缠导致非局域性",
        "role": "conclusion",
        "score": 0.95
      },
      ...
    ],
    "papers": [...]
  }
}
```

#### Step 2: 构建 Gaia 包

**方式 1：使用 Claude Code / Agent（推荐）**

在 Claude Code 中输入：

```
使用 lkm-explorer skill，mode=batch，输入文件 search_results.json，
构建关于量子纠缠的 Gaia 知识包
```

Agent 会自动：
1. 读取 `search_results.json`
2. 调用 LKM evidence API 获取证据链
3. 构建 Gaia 包（`quantum-entanglement-gaia/`）
4. 运行质量门控

**方式 2：手动调用（高级用户）**

```bash
# 需要在支持 skill 的 agent 环境中运行
# 详见 §6 Workflow 编排
```

#### Step 3: 编译和检查

```bash
cd quantum-entanglement-gaia/

# 编译 Gaia 包
gaia compile
# 输出：Compiled successfully

# 检查是否有未填充的 hole
gaia check --hole
# 输出：No holes found

# 运行 BP 推理
gaia infer
# 输出：Inference completed
```

#### Step 4: 查看结果

```bash
# 生成 HTML 可视化
gaia render --html > output.html

# 打开浏览器查看
open output.html  # macOS
# 或 xdg-open output.html  # Linux
# 或 start output.html  # Windows
```

**输出文件**：
- `quantum-entanglement-gaia/` — Gaia 包目录
  - `package.py` — Gaia DSL 代码
  - `graph_growth_log.jsonl` — 审计日志（记录每个 claim 的添加过程）
  - `lkm-discovery/retrieval_log.jsonl` — LKM 检索记录
  - `README.md` — 包说明文档

**可视化示例**：

HTML 输出包含：
- 知识图谱可视化（节点 = claim，边 = 推导关系）
- 每个 claim 的 posterior 概率
- 证据链追溯
- 矛盾检测结果

---

### 1.4 Agent 使用指南

本文档面向两类用户：
1. **人类用户**：通过命令行工具手动使用 Gaia 和 LKM
2. **Agent/AI**：通过 skill 系统自动化使用

#### Agent 如何使用本文档

**Step 1: 理解 skill 系统**

gaia-lkm-skills 提供了 9 个 atomic skills，由 orchestrator 统一路由：

- **lkm-api**: 直接调用 LKM API（search/match/evidence/papers）
- **lkm-explorer**: LKM → Gaia 完整流程（5 步 SOP）
- **formalize**: Paper → Gaia 完整流程（4 阶段）
- **gaia-package**: 构建符合规范的 Gaia 包
- **gaia-cli**: 调用 Gaia CLI 工具
- **gaia-review-lite**: 轻量审计（检查 hole、循环依赖）
- **evidence-subgraph**: 提取证据子图
- **scholarly-synthesis**: 学术综述生成

**Step 2: 读取 skill 定义**

```bash
# 读取 orchestrator（路由入口）
cat ~/Code/gaia-lkm-skills/skills/orchestrator/SKILL.md

# 读取具体 skill
cat ~/Code/gaia-lkm-skills/skills/lkm-explorer/SKILL.md
```

**Step 3: 调用 skill**

在 Claude Code 或支持 skill 的 agent 环境中：

```
我需要从 LKM 搜索"量子纠缠"并构建 Gaia 包

[Agent 自动执行]
1. 读取 orchestrator/SKILL.md
2. 路由到 lkm-explorer
3. 调用 lkm-api 搜索
4. 获取证据链
5. 构建 Gaia 包
6. 运行质量门控（gaia compile/check/infer）
7. 报告结果
```

**Step 4: 验证结果**

Agent 会自动运行质量门控并报告：
- ✅ 编译成功
- ✅ 无 hole
- ✅ BP 推理完成
- ⚠️ 发现 3 个潜在矛盾（需人工审查）

#### 人类用户 vs Agent

| 操作 | 人类用户 | Agent |
|------|---------|-------|
| LKM 搜索 | 手动运行 `lkm.py search` | 自动调用 lkm-api skill |
| 获取证据链 | 手动运行 `lkm.py evidence` | 自动调用（lkm-explorer Step 2） |
| 构建 Gaia 包 | 手动编写 `package.py` | 自动生成（lkm-explorer Step 5） |
| 质量门控 | 手动运行 `gaia compile/check/infer` | 自动运行并报告 |
| 审计 | 手动阅读 `graph_growth_log.jsonl` | 自动调用 gaia-review-lite skill |
| 矛盾检测 | 手动分析 BP 结果 | 自动标注并报告 |

#### Agent 典型工作流

**场景 1：LKM 检索 → Gaia 包**

```
用户：从 LKM 搜索"量子纠缠"相关 claim，构建 Gaia 包

Agent:
1. 调用 lkm-api.search("量子纠缠", top_k=10)
2. 调用 lkm-explorer(mode=batch, input=search_results)
3. 生成 quantum-entanglement-gaia/
4. 运行 gaia compile && gaia check --hole && gaia infer
5. 报告：✅ 包构建完成，包含 25 个 claim，3 个潜在矛盾
```

**场景 2：Paper → Gaia 包**

```
用户：将论文 paper.md 形式化为 Gaia 包

Agent:
1. 读取 paper.md
2. 调用 formalize(mode=4-phase, input=paper.md)
3. Phase 1: 提取结论
4. Phase 2: 构建推理链
5. Phase 3: 审查弱点
6. Phase 4: 生成包
7. 报告：✅ 包构建完成，发现 2 个 weak premise
```

**场景 3：审计现有 Gaia 包**

```
用户：审计 my-gaia-package/ 是否有问题

Agent:
1. 调用 gaia-review-lite(package_path=my-gaia-package/)
2. 检查 hole、循环依赖、孤岛节点
3. 报告：⚠️ 发现 1 个 hole，2 个孤岛节点
```

---

## 2. LKM API 使用

### 2.1 认证与配置

LKM API 需要 `accessKey` 认证。

#### 获取 accessKey

**内部用户**：

1. 联系 LKM 团队：
   - 黄远（huangyuan@dp.tech）
   - 或在飞书 Gaia-LKM 群中询问
2. 或查看内部文档：飞书知识库 > Gaia > LKM 接入指南

**外部用户**：

LKM 目前为内部服务，暂不对外开放。如有合作需求，请联系 dp.tech。

#### 配置方式

```bash
# 方式 1：环境变量（推荐）
export LKM_ACCESS_KEY="your_access_key_here"

# 方式 2：传参
python lkm.py search --query "..." --access-key "your_key"
```

**持久化配置**（推荐）：

```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
echo 'export LKM_ACCESS_KEY="your_access_key_here"' >> ~/.zshrc
source ~/.zshrc
```

#### 验证 accessKey

**测试搜索**：

```bash
cd ~/Code/gaia-lkm-skills
python skills/lkm-api/scripts/lkm.py search \
  --query "test" \
  --top-k 1

# 成功输出：
# {
#   "data": {
#     "variables": [
#       {
#         "id": "gcn_xxx",
#         "content": "...",
#         ...
#       }
#     ],
#     "papers": [...]
#   }
# }

# 失败输出：
# Error: 401 Unauthorized
# 或
# Error: Invalid accessKey
```

**检查环境变量**：

```bash
echo $LKM_ACCESS_KEY
# 输出：your_access_key_here（不应该为空）

# 如果为空，说明环境变量未设置
# 重新执行 export 命令或检查 ~/.zshrc
```

#### 常见认证错误

| 错误信息 | 原因 | 解决方法 |
|---------|------|---------|
| `401 Unauthorized` | accessKey 无效或过期 | 重新获取 accessKey，联系 LKM 团队 |
| `403 Forbidden` | 无权限访问该资源 | 联系管理员开通权限（如私有论文访问） |
| `accessKey not found` | 环境变量未设置 | 检查 `echo $LKM_ACCESS_KEY`，重新 export |
| `Connection refused` | LKM 服务不可达 | 检查网络连接，确认 Base URL 正确 |
| `Timeout` | 请求超时 | 检查网络，或减少 `top_k` 参数 |

#### 权限说明

LKM accessKey 有不同的权限级别：

| 权限级别 | 可访问资源 | 适用场景 |
|---------|-----------|---------|
| **Public** | 公开论文的 claim | 一般用户 |
| **Internal** | 公开 + 内部论文 | 内部研究 |
| **Admin** | 所有资源 + 管理接口 | 系统管理员 |

**检查权限**：

```bash
# 尝试访问私有论文
python skills/lkm-api/scripts/lkm.py papers \
  --paper-id "paper:internal_xxx"

# 如果返回 403，说明你的 accessKey 没有 Internal 权限
```

---

### 2.2 四个核心接口

**Base URL**: `https://open.bohrium.com/openapi/v1/lkm`

所有接口都需要在 Header 中传 `accessKey: <your_key>`。

#### 2.2.1 Search（公开检索）

**用途**：根据查询词检索相关 claim。

```bash
POST /search
Content-Type: application/json
accessKey: <your_key>

{
  "query": "量子纠缠",
  "top_k": 10,
  "filters": {
    "visibility": "public"
  }
}
```

**返回字段**：
- `data.variables[]` — claim 列表，每个包含：
  - `id` — 全局 claim ID（`gcn_...`）
  - `content` — claim 文本
  - `role` — `premise` 或 `conclusion`
  - `score` — 检索排序分数（**不是科学置信度**）
  - `provenance.source_packages` — 来源论文 ID（`paper:<id>`）
- `data.papers` — 论文元数据（DOI、标题、作者、发表日期等）

**注意**：`score` 是检索引擎的排序信号，不要当作 Gaia prior 或真值概率。

#### 2.2.2 Match（Claim 匹配）

**用途**：根据自由文本匹配已有 claim（类似 BM25）。

```bash
POST /claims/match
Content-Type: application/json
accessKey: <your_key>

{
  "text": "量子纠缠导致非局域性",
  "top_k": 10,
  "filters": {
    "visibility": "public"
  }
}
```

**与 Search 的区别**：
- 字段名是 `text`（不是 `query`）
- 返回 `data.new_claim_likely` 字段（判断是否可能是新 claim）

**返回结构**：与 Search 相同（`data.variables[]` + `data.papers`）。

#### 2.2.3 Evidence（证据链）

**用途**：获取某个 claim 的推导证据链。

```bash
GET /claims/{claim_id}/evidence?max_chains=10&sort_by=comprehensive
accessKey: <your_key>
```

**返回字段**：
- `data.claim` — 目标 claim
- `data.total_chains` — 找到的证据链总数
- `data.evidence_chains[]` — 证据链列表，每条包含：
  - `source_package` — 来源论文 ID
  - `factors[]` — 推导因子（每个因子包含 `premises` → `conclusion`）
    - `factor_type` — `strategy`（软约束）或 `operator`（硬约束）
    - `subtype` — `noisy_and` / `deduction` / `support` 等
  - `motivating_questions[]` — 驱动问题

**重要**：LKM 返回的 `noisy_and` 在 Gaia 0.5 中统一映射为 `derive`（rigid）。

#### 2.2.4 Variables Batch（批量查询变量）

**用途**：批量获取 `var_*` ID 的详细信息（当证据链中引用了变量时使用）。

```bash
POST /variables/batch
Content-Type: application/json
accessKey: <your_key>

{
  "ids": ["var_id_1", "var_id_2"]
}
```

**返回**：`data.variables[]` + `data.papers` + `data.not_found[]`（未找到的 ID）。

### 2.3 常见问题

**Q: `code=290001` 错误怎么办？**  
A: 这是已知的瞬态错误（冷启动问题）。重试 1-2 次通常可以解决。

**Q: `code=290002` "Field validation for 'Text' failed"？**  
A: 你在 `/claims/match` 接口中用了 `query` 字段，应该用 `text`。

**Q: 返回的 `score` 可以直接用作 Gaia prior 吗？**  
A: **不可以**。`score` 是检索排序信号，不是科学置信度。Gaia prior 需要根据 claim 的性质和证据强度人工判断或通过 BP 计算。

---

## 3. Gaia 包构建

### 3.1 包结构规范

一个标准的 Gaia 知识包目录结构如下：

```
my-topic-gaia/
├── package.py              # Gaia DSL 代码（定义 claim、推导关系、prior）
├── paper.md                # 原始论文 Markdown（如果是 paper → Gaia）
├── graph_growth_log.jsonl  # 审计日志（每次修改记录一条）
├── lkm-discovery/          # LKM 检索记录（如果是 LKM → Gaia）
│   └── retrieval_log.jsonl
├── artifacts/              # 中间产物（formalize 流程）
│   └── paper-extract/
└── docs/                   # 文档
    ├── scientific_story.md
    └── open_questions_review.md
```

**关键文件说明**：
- `package.py` — 唯一的 truth source，所有 claim 和推导关系都在这里定义
- `graph_growth_log.jsonl` — 每次修改包时追加一条记录（时间戳 + 操作 + 理由）
- `retrieval_log.jsonl` — 记录每次 LKM API 调用（query + 返回结果 + 选择理由）

**Cleanness 纪律**（重要）：
- Paper 包的 truth source 是 `paper.md`，不要把"我们的判断"或"inspiration"混入 `package.py`
- 如果要记录自己的想法，单独建一个包（如 `my-topic-inspiration-gaia/`）

### 3.2 LKM → Gaia 映射（lkm-explorer 5 步）

**Skill**: `skills/lkm-explorer/SKILL.md`

**适用场景**：从 LKM 检索结果构建 Gaia 包。

**5 步流程**：

#### Step 1: Inputs and Scope
- 读取 LKM 检索结果（`search` 或 `match` 返回的 JSON）
- 确定根 claim（root claim）
- 定义包的范围（scope）

#### Step 2: Bootstrap and Map
- 调用 `/claims/{id}/evidence` 获取证据链
- 将 LKM 的 `factors[]` 映射为 Gaia DSL
- **映射规则**：
  - `noisy_and` → `derive`（rigid）
  - `deduction` → `deduction`
  - `support` → `support`
  - 其他 `strategy` → 根据语义选择 `infer` 或 `associate`

#### Step 3: Contradictions and Open Questions
- 搜索与根 claim 矛盾的 claim
- 记录开放问题（motivating questions）
- 用 `contradiction` 算子连接矛盾节点

#### Step 4: Supports, Priors, and Review
- 为每个 claim 分配 prior（基于证据强度）
- 添加 support 关系（软支持）
- 自我审查：检查是否有遗漏的前提或循环依赖

#### Step 5: Emit and Handoff
- 生成 `package.py`
- 写入 `graph_growth_log.jsonl` 和 `retrieval_log.jsonl`
- 运行质量门控：`gaia compile && gaia check --hole && gaia infer`

**详细 SOP**：见 `skills/orchestrator/references/lkm-explorer-sop.md`。

### 3.3 Paper → Gaia 映射（formalize 4 phase）

**Skill**: `skills/formalize/SKILL.md`

**适用场景**：从单篇论文 Markdown 构建 Gaia 包。

**4 个 Phase**：

#### Phase 1: Extract Conclusions
- 读取 `paper.md`
- 提取主要结论（main claims）
- 提取实验观测（observations）
- **Phase 1b**（可选）：调用 LKM `/search` 反向追溯，看论文是否已在 LKM 中

#### Phase 2: Build Reasoning Chain
- 重构论文的推理链条
- 识别前提（premises）和结论（conclusions）
- 标注推导类型（deduction / support / infer）

#### Phase 3: Review Weak Points
- 审查每个推导步骤的强度
- 标注 weak / boundary / surprising / negative
- 记录 caveat 和 limitation

#### Phase 4: Emit Package
- 生成 `package.py`
- 写入 `graph_growth_log.jsonl`
- 运行质量门控

**详细参考**：
- `skills/formalize/references/phase-1-extract-conclusions.md`
- `skills/formalize/references/phase-2-build-reasoning-chain.md`
- `skills/formalize/references/phase-3-review-weak-points.md`
- `skills/formalize/references/phase-4-emit-package.md`

### 3.4 Emit Mapping 纪律

**Skill**: `skills/gaia-package/references/emit-mapping.md`

**核心原则**：
1. **每个 claim 必须有唯一的 Python 变量名**（如 `main_claim_1`）
2. **Metadata 必须包含**：`content`（文本）、`role`（premise/conclusion）、`provenance`（来源）
3. **推导关系必须显式声明**：不要隐式依赖变量顺序
4. **Prior 必须有依据**：记录为什么选择这个 prior 值

**示例**：

```python
from gaia import Claim, deduction, PRIORS

# 定义 claim
premise_1 = Claim(
    content="温度升高",
    role="premise",
    provenance={"source": "paper:123", "section": "实验部分"}
)

premise_2 = Claim(
    content="催化剂存在",
    role="premise",
    provenance={"source": "paper:123", "section": "实验部分"}
)

conclusion = Claim(
    content="反应速率增加",
    role="conclusion",
    provenance={"source": "paper:123", "section": "结果"}
)

# 定义推导关系
deduction(
    premises=[premise_1, premise_2],
    conclusion=conclusion,
    prior=0.95  # 基于实验数据的强支持
)

# 定义 prior
PRIORS = {
    premise_1: 0.9,  # 实验直接观测
    premise_2: 0.85,  # 实验条件明确
    conclusion: 0.5   # 待推导
}
```

---

## 4. BP 算子选择（main 分支）

### 4.1 三个核心算子

#### deduction（严格推导）

**语义**：rigid implication，A ∧ B → C，prior 默认接近 1。

**BP 行为**：**双向流动**
- 正向：premises 成立 → conclusion 置信度升高
- 反向：conclusion 被外部证据压低 → 反向惩罚 premises

**适用场景**：
- 数学推导、物理定律
- 实验条件 → 必然结果
- Weak / Boundary caveat（作为 premise）

**示例**：

```python
deduction(
    premises=[ideal_gas_law, temperature_increase],
    conclusion=pressure_increase,
    prior=0.98
)
```

**常见错误**：把 weak/boundary 当作 `contradiction` 或 `support`。正确做法是把它们作为 `deduction` 的 premise，利用 BP 反向流动特性。

#### support（软支持）

**语义**：soft implication，A 增加 C 的可信度，但不是严格推导。

**BP 行为**：**单向流动**，不反向惩罚 premises。

**适用场景**：
- Surprising evidence（意外发现支持理论）
- Negative evidence（反例削弱理论）
- 统计相关性（非因果）

**示例**：

```python
support(
    premises=[experimental_observation],
    conclusion=theory_claim,
    prior=0.7
)
```

#### contradiction（互斥约束）

**语义**：确定性硬约束 `¬(A ∧ B)`，prior 默认接近 1。

**BP 行为**：强制两个 claim 不能同时为真。

**适用场景**：
- 两个理论真正互斥（如"光是波" vs "光是粒子"在经典物理框架下）
- 实验结果直接矛盾

**常见错误**：把"软反对"或"方法论 caveat"映射成 `contradiction`，会导致主 claim 后验概率被撕烂（从 0.99 降到 0.04）。

**正确做法**：方法论 caveat 应该作为 `deduction` 的 premise。

### 4.2 易错点总结

| 错误 | 正确做法 |
|------|----------|
| 把"软反对"映射成 `contradiction` | 用 `support` 的负 prior 或作为 `deduction` premise |
| 把 weak/boundary 当 `support` premise | 作为 `deduction` premise（利用 BP 反向流动） |
| `PRIORS` dict key 用字符串 | 必须是 Knowledge 对象 |
| 多路径饱和（4+ 条 support 汇聚） | 合成一条 `deduction` |

### 4.3 BP 概率的根本局限

**现阶段不可产品化**（2026-05-11 会议明确）：

1. **BP 算出的概率不是客观精确值**，是"给定你构建的逻辑图，唯一对应的概率"
2. **Formalization 出错 → 概率无意义**，且无法从概率本身判断是命题错了还是图构建错了
3. **正确第一步 use case**：claim 检索 + 溯源（作为 SN 召回源），不是"给可靠评分"

**需向应用层传达**：不要把 BP 概率当稳定评分系统推给客户。

> **注意**：v0.5 分支新增了 `infer` 和 `associate` 概率算子，详见 §11。

---

## 5. Gaia CLI 工具链

### 5.1 核心命令

**Skill**: `skills/gaia-cli/SKILL.md`

#### gaia init

**用途**：初始化一个新的 Gaia 包。

```bash
gaia init my-topic-gaia
cd my-topic-gaia
```

生成基础目录结构和 `package.py` 模板。

#### gaia compile

**用途**：编译 `package.py`，生成中间表示（IR）。

```bash
gaia compile
```

**输出**：`.gaia/compiled.json`（IR 文件）。

**常见错误**：
- 语法错误（Python 语法）
- 未定义的变量引用
- `PRIORS` dict key 不是 Knowledge 对象

#### gaia check

**用途**：检查包的完整性和一致性。

```bash
# 检查是否有未连接的节点（hole）
gaia check --hole

# 检查是否有循环依赖
gaia check --cycle
```

**输出**：问题列表 + 修复建议。

#### gaia infer

**用途**：运行 BP 算法，计算每个 claim 的后验概率。

```bash
gaia infer
```

**输出**：`.gaia/posteriors.json`（每个 claim 的后验概率）。

**注意**：BP 概率不是客观真值，见 §4.4。

#### gaia render

**用途**：可视化知识图谱。

```bash
# 生成 HTML
gaia render --html > output.html

# 生成 LKM 格式（用于回传 LKM）
gaia render --lkm > lkm_format.json
```

#### gaia register

**用途**：将本地包注册到 LKM（上传）。

```bash
gaia register --package my-topic-gaia
```

**前置条件**：包必须通过 `gaia compile` 和 `gaia check`。

#### gaia add

**用途**：从 LKM 拉取一个包并合并到本地。

```bash
gaia add --package lkm://quantum-entanglement
```

**行为**：
- 拉取整篇文章（不只拉 claim）
- 整篇是完整子图，connection 不能丢
- 自动合并到当前包

### 5.2 质量门控

**标准流程**（每次修改 `package.py` 后）：

```bash
gaia compile && gaia check --hole && gaia infer
```

**如果失败**：
1. 读错误信息
2. 修复 `package.py`
3. 重新运行

**常见问题**：
- `--hole` 报错 → 有未连接的 claim，需要补充推导关系
- `--cycle` 报错 → 有循环依赖，需要重构逻辑
- `infer` 报错 → BP 算法不收敛，检查是否有矛盾的约束

### 5.3 与 LKM 的双向转换

**本地 → LKM**：

```bash
gaia render --lkm > lkm_format.json
# 然后通过 LKM API 上传
```

**LKM → 本地**：

```bash
# 通过 lkm-explorer skill 自动完成
# 或手动：
gaia add --package lkm://package-name
```

---

## 6. Workflow 编排

### 6.1 Orchestrator 路由逻辑

**Skill**: `skills/orchestrator/SKILL.md`

Orchestrator 是单一入口，根据用户请求分类路由到不同的 atomic skill 或 SOP。

**路由路径**：

1. **LKM → Gaia Package** — 读 `lkm-explorer-sop.md`，然后调用 `lkm-api` + `lkm-explorer`
2. **Paper → Gaia Package** — 调用 `formalize`（4 phase）
3. **Raw LKM API Task** — 直接调用 `lkm-api`（不做形式化）
4. **Evidence Graph Only** — 调用 `evidence-subgraph`（不生成 Gaia 包）
5. **Scholarly Synthesis** — 调用 `scholarly-synthesis`（生成学术综述）
6. **Visualization** — 使用 `gaia render`（不是 skill）
7. **Lite Scientific Review** — 调用 `gaia-review-lite`（快速审计）

### 6.2 LKM → Gaia Package SOP

**完整 SOP**：`skills/orchestrator/references/lkm-explorer-sop.md`

**核心步骤**：

1. **读 API contract** — `skills/lkm-api/SKILL.md` + `references/api-contract.md`
2. **调用 LKM API** — 使用 `lkm.py` 脚本或直接 HTTP 调用
3. **选择 payloads** — 从返回结果中选择相关的 claim 和证据链
4. **调用 lkm-explorer** — 运行 5 步 workflow（见 §3.2）
5. **质量门控** — `gaia compile && gaia check --hole && gaia infer`
6. **审计** — 检查 `graph_growth_log.jsonl` 和 `retrieval_log.jsonl`

**支持的子流程**：
- Support search（搜索支持证据）
- Contradiction search（搜索矛盾）
- Duplicate cleanup（去重）
- Iterative root-claim frontier expansion（迭代扩展根 claim）

### 6.3 Paper → Gaia Package SOP

**Skill**: `skills/formalize/SKILL.md`

**核心步骤**：

1. **Phase 1: Extract Conclusions** — 提取主要结论和实验观测
2. **Phase 1b（可选）**: Cross-ground with LKM — 调用 LKM `/search` 反向追溯
3. **Phase 2: Build Reasoning Chain** — 重构推理链条
4. **Phase 3: Review Weak Points** — 审查推导强度，标注 caveat
5. **Phase 4: Emit Package** — 生成 `package.py` 和审计日志
6. **质量门控** — `gaia compile && gaia check --hole && gaia infer`

### 6.4 证据图构建（Evidence Subgraph）

**Skill**: `skills/evidence-subgraph/SKILL.md`

**用途**：从 LKM 证据链构建独立的证据图（不生成 Gaia 包）。

**适用场景**：
- 只需要可视化证据关系
- 不需要 BP 计算
- 快速探索 LKM 数据

**输出**：
- Factor diamonds（因子菱形图）
- Three-class edge taxonomy（三类边分类）
- Chain-bounded discipline（链边界约束）

---

## 7. 审计与验证

### 7.1 gaia-review-lite 快速审计

**Skill**: `skills/gaia-review-lite/SKILL.md`

**用途**：对编译后的 Gaia 包进行轻量级科学审计。

**输出**：
- `docs/scientific_story.md` — 科学故事叙述
- `docs/open_questions_review.md` — 开放问题审查

**覆盖范围**：~30-40% 的 IR primitive types（claim + contradiction 为中心）。

**何时使用**：
- 快速检查包的科学合理性
- 不需要完整 IR 审计
- 时间紧迫

**何时不用**：
- 需要完整 IR 审计 → 等待 `gaia-review-deep`（TBD）
- 包含复杂的谓词逻辑或 scaffold

### 7.2 Warrant Claim 检查

**概念**：Gaia 0.5 中，每个推导动作（`derive` / `observe` / `predict` / `compute`）自动生成一个 warrant claim，带有对应的 question。

**用途**：`gaia review` 时逐条检查每个动作是否 justified。

**示例**：

```python
derive(
    premises=[a, b],
    conclusion=c
)
# 自动生成 warrant claim:
# "为什么从 a 和 b 可以推导出 c？"
```

**审查流程**：
1. 运行 `gaia review`
2. 逐条回答 warrant question
3. 如果无法回答 → 推导不成立，需要修改

### 7.3 矛盾发现与开放问题

**矛盾发现**：
- 在 lkm-explorer Step 3 中自动搜索
- 使用 LKM `/search` 查找与根 claim 矛盾的 claim
- 用 `contradiction` 算子连接

**开放问题**：
- 从 LKM 的 `motivating_questions` 提取
- 记录在 `docs/open_questions_review.md`
- 作为未来研究方向

---

## 8. 进阶主题

### 8.1 跨 Paper Joint BP

**场景**：多个 paper 的 Gaia 包需要联合计算 BP。

**挑战**：
- 不同 paper 的 claim 可能重复（需要去重）
- 不同 paper 的 prior 可能冲突
- 跨包的推导关系需要显式声明

**解决方案**：
- 使用 `gaia add` 合并包
- 手动审查重复 claim
- 统一 prior（取平均或加权）

**参考**：跨论文连接是 v0.5 的高级功能，详见 §11。

### 8.2 谓词逻辑与 Grounding

**Gaia 0.5 新增**：支持带参数的 claim（谓词逻辑）。

**示例**：

```python
from gaia import Claim, Variable, DOMAIN

# 定义变量
X = Variable("X")
Y = Variable("Y")

# 定义 domain
DOMAIN = {
    X: ["catalyst_A", "catalyst_B", "catalyst_C"],
    Y: ["solvent_1", "solvent_2"]
}

# 定义谓词 claim
better_than = Claim(
    content=f"{X} 比 {Y} 效果更好",
    role="claim"
)

# Grounding（填入具体值）
for x in DOMAIN[X]:
    for y in DOMAIN[Y]:
        grounded_claim = better_than.ground({X: x, Y: y})
        # 每个 grounded claim 都进入 BP 图
```

**`for all` 量词**：
- 产生的所有子命题都进入概率图
- 子命题对母命题有 `support` 关系

### 8.3 Scaffold 分层形式化

**用途**：先挂 dependency 图不落 BP，分层 formalize。

**流程**：
1. **第一层**：用 scaffold 把 dependency 图挂起来（不赋概率）
2. **第二层**：把 dependency 关系连起来
3. **第三层**：真正的 formalization（赋概率、选算子）

**适用场景**：
- 复杂的多层推理
- 不确定某些推导关系是否成立
- 需要逐步细化

### 8.4 热力学框架（Beyond Genes）

**理论方向**（Gaia 0.5 之后）：

- **James 框架 + Max Entropy → 玻尔兹曼分布**
- 热力学整套可搬过来（温度 / 能量 / 自由能 / 相变）
- **重大科学发现 = 相变**：contradiction 大量积累后一笔勾销，熵骤降（牛顿 → 相对论是典型）
- 命题 = 热力学原子，逻辑关系 = 动力学演化规律

**实验方向**：用相对论诞生前的知识体系做相变验证（思寒 + 玮琦负责）。

---

## 9. 常见问题

### Q1: BP 概率不稳定怎么办？

**症状**：同一个包，多次 `gaia infer` 结果不同。

**可能原因**：
1. BP 算法未收敛（迭代次数不够）
2. 图中有循环依赖
3. 概率约束冲突（如 `contradiction` + `deduction` 同时作用）

**解决方案**：
1. 增加迭代次数（如果支持）
2. 运行 `gaia check --cycle` 检查循环
3. 审查 `contradiction` 的使用（是否误用）

### Q2: LKM 返回结果不完整

**症状**：`/claims/{id}/evidence` 返回的 `total_chains` 很少，或 `factors[]` 为空。

**可能原因**：
1. Claim 是新 claim（LKM 中没有证据链）
2. LKM 数据库尚未索引该论文
3. `max_chains` 参数太小

**解决方案**：
1. 检查 `data.new_claim_likely` 字段
2. 增加 `max_chains` 参数（如 `max_chains=50`）
3. 如果确实是新 claim，考虑用 Paper → Gaia 流程

### Q3: 包 Cleanness 纪律

**问题**：我想在 paper 包里加入自己的判断和 inspiration，可以吗？

**答案**：**不可以**。Paper 包的 truth source 是 `paper.md`，不要把"我们的判断"或"inspiration"混入 `package.py`。

**正确做法**：
- 单独建一个包（如 `my-topic-inspiration-gaia/`）
- 在新包中引用 paper 包的 claim
- 用 `infer` 或 `associate` 连接

**原因**：保持包的可追溯性和科学诚实性。

### Q4: 工具失败 Fallback

**问题**：`gaia compile` 失败，但错误信息不清楚。

**Fallback 策略**：
1. 检查 Python 语法（用 `python -m py_compile package.py`）
2. 检查 import 是否正确（`from gaia import ...`）
3. 检查 `PRIORS` dict key 是否是 Knowledge 对象（不是字符串）
4. 逐步注释代码，定位问题行
5. 查看 `.gaia/compile.log`（如果存在）

### Q5: 如何选择 deduction vs support vs infer？

**决策树**：

```
是否是严格逻辑推导（数学/物理定律）？
├─ 是 → deduction
└─ 否 → 是否需要反向惩罚 premises？
    ├─ 是 → deduction（利用 BP 双向流动）
    └─ 否 → 是否能写出明确的条件概率？
        ├─ 是 → infer 或 associate
        └─ 否 → support
```

---

## 10. 参考资源

### 10.1 代码仓库

- **gaia-lkm-skills**: https://github.com/SiliconEinstein/gaia-lkm-skills
  - 当前版本：v2026.05.10
  - 9 个 atomic skills + orchestrator
- **Gaia 核心**: https://github.com/SiliconEinstein/Gaia
  - BP 算法实现：`gaia/bp/potentials.py`
  - DSL 定义：`gaia/lang/dsl/strategies.py`

### 10.2 相关资源

**Gaia 核心文档**：
- [Gaia GitHub](https://github.com/SiliconEinstein/Gaia) — Gaia 核心仓库
- `docs/for-users/quick-start.md` — Gaia 快速开始
- `docs/for-users/language-reference.md` — Gaia DSL 语言参考
- `docs/for-users/cli-commands.md` — Gaia CLI 命令参考

**LKM 文档**：
- LKM API 文档：联系 LKM 团队获取
- Bohrium 平台：https://bohrium.dp.tech

**技术讨论记录**：
- 2026-05-11 — Gaia 0.5 技术对齐会（BP 概率局限性、CLI 设计）
- 2026-05-09 — 模型训练与评审方法讨论
- 2026-05-12 — Gaia/LKM 系统整合与组织调整

详细会议记录请联系团队成员获取。

### 10.3 Skills 详细文档

- `skills/orchestrator/SKILL.md` — 路由入口
- `skills/lkm-api/SKILL.md` + `references/api-contract.md` — LKM API
- `skills/lkm-explorer/SKILL.md` + 5 个 step references — LKM → Gaia
- `skills/formalize/SKILL.md` + 4 个 phase references — Paper → Gaia
- `skills/gaia-package/SKILL.md` + 3 个 references — 包规范
- `skills/gaia-cli/SKILL.md` — CLI 工具链
- `skills/gaia-review-lite/SKILL.md` — 轻量审计

### 10.4 联系人

- **黄远** (huangy22@gmail.com)
- **陈锟** (chenkun0228@gmail.com)

---

## 11. Gaia v0.5 新功能（开发分支）

> **重要提示**：本节描述的功能在 `v0.5` 分支中，**尚未合并到 main**。如需使用这些功能，请先切换分支：
> 
> ```bash
> cd ~/Code/Gaia
> git checkout v0.5
> ```
> 
> v0.5 分支比 main 领先约 143 个 commits，包含大量新功能和 API 变更。合并时间待定。

### 11.1 版本检查

使用 v0.5 功能前，确认你的 Gaia 版本：

```bash
cd ~/Code/Gaia
git branch --show-current
# 输出应该是 v0.5

# 如果是 main，切换到 v0.5
git checkout v0.5

# 查看版本差异
git log --oneline v0.5 ^main | wc -l
# 输出约 143（v0.5 领先 main 的 commits）
```

### 11.2 主要新增功能

#### 11.2.1 新的概率算子：`infer` 和 `associate`

**用途**：连接两个 claim 之间"有关系但无法写出 rigid 逻辑"的情况。

##### `infer` — 单向推理

**API**：

```python
from gaia import Claim, infer

infer(
    evidence,                    # 证据 claim（或字符串）
    hypothesis=hypothesis_claim, # 假设 claim
    p_e_given_h=0.9,            # P(证据|假设成立)
    p_e_given_not_h=0.1,        # P(证据|假设不成立)
    given=None,                  # 可选：条件 claim
    prior_hypothesis=None,       # 可选：假设的先验
    prior_evidence=None,         # 可选：证据的先验
    rationale="",                # 推理说明
    label=None                   # 可选：标签
)
```

**适用场景**：
- A 是理论，B 是预测
- P(B|A) 好猜（理论推预测），但 P(B|¬A) 不好猜（¬A 是茫茫多可能性）

**示例**：

```python
from gaia import Claim, infer

quantum_theory = Claim("量子理论成立")
entanglement_observed = Claim("观测到量子纠缠现象")

infer(
    entanglement_observed,
    hypothesis=quantum_theory,
    p_e_given_h=0.9,      # 量子理论成立 → 观测到纠缠的概率
    p_e_given_not_h=0.1,  # 量子理论不成立 → 观测到纠缠的概率
    rationale="量子理论预测纠缠现象"
)
```

##### `associate` — 双向关联

**API**：

```python
from gaia import Claim, associate

associate(
    a,                    # Claim A
    b,                    # Claim B
    p_a_given_b=0.8,     # P(A|B)
    p_b_given_a=0.7,     # P(B|A)
    prior_a=None,         # 可选：A 的先验
    prior_b=None,         # 可选：B 的先验
    background=None,      # 可选：背景知识
    rationale="",         # 关联说明
    label=None            # 可选：标签
)
```

**适用场景**：
- 两个方向都相对好猜
- 适合"看到现象 B，理论 A 成立的概率"

**示例**：

```python
from gaia import Claim, associate

theory_claim = Claim("新理论成立")
experimental_phenomenon = Claim("观测到特定实验现象")

associate(
    theory_claim,
    experimental_phenomenon,
    p_a_given_b=0.8,  # 看到现象 → 理论成立的概率
    p_b_given_a=0.7,  # 理论成立 → 看到现象的概率
    rationale="理论与现象的统计关联"
)
```

**概率值语义**：
- 两个概率都趋 0 → 完全无关
- 都趋 1 → 近似等价
- 一个 0 一个高 → 互补（mutually exclusive）

**重要限制**：
- `infer` 和 `associate` 只支持 2 个 claim（A 和 B）
- 多个 soft premise 时，要么保证 n-1 个是 rigid 的（用 `deduction`），要么拆成多条独立的 `infer`/`associate`
- **原因**：多个 soft premise 需要估计 2^(k+1) 个概率，大模型吃不消

#### 11.2.2 谓词逻辑（Predicate Logic）

**用途**：支持带参数的 claim，如"X 比 Y 好"。

**API**：

```python
from gaia import Claim, Variable, DOMAIN

# 定义变量
X = Variable("X")
Y = Variable("Y")

# 定义 domain
DOMAIN = {
    X: ["catalyst_A", "catalyst_B", "catalyst_C"],
    Y: ["solvent_1", "solvent_2"]
}

# 定义谓词 claim
better_than = Claim(
    content=f"{X} 比 {Y} 效果更好",
    role="claim"
)

# Grounding（填入具体值）
for x in DOMAIN[X]:
    for y in DOMAIN[Y]:
        grounded_claim = better_than.ground({X: x, Y: y})
        # 每个 grounded claim 都进入 BP 图
```

**`for all` 量词**：
- 产生的所有子命题都进入概率图
- 子命题对母命题有 `support` 关系

#### 11.2.3 推导动作（Actions）

v0.5 新增 4 个推导动作（全是 rigid）：

| 动作 | 语义 |
|------|------|
| `derive` | deduction，LKM 来的全用这个 |
| `observe` | 实验/现实观测，可以凭空产生 observation claim（premise 可为空） |
| `predict` | theory → prediction，标记 role 为 prediction，便于和 observation 区分 |
| `compute` | Python 函数加 decorator 包装，输出自动变成 hyperclaim |

**Warrant Claim**：每个 action 自动产生 **warrant claim**（带对应 question），`gaia review` 时逐条检查每个动作是否 justified。

**示例**：

```python
from gaia import Claim, derive

# derive 会自动生成 warrant claim:
# "为什么从 a 和 b 可以推导出 c？"
derive(
    premises=[a, b],
    conclusion=c,
    rationale="基于理想气体定律"
)
```

#### 11.2.4 Scaffold（脚手架）

**用途**：先挂 dependency 图不落 BP，分层 formalize。

**流程**：
1. **第一层**：用 scaffold 把 dependency 图挂起来（不赋概率）
2. **第二层**：把 dependency 关系连起来
3. **第三层**：真正的 formalization（赋概率、选算子）

**适用场景**：
- 复杂的多层推理
- 不确定某些推导关系是否成立
- 需要逐步细化

#### 11.2.5 其他新增

- **`decompose`**：自动拆非原子命题（替代手写 `A and B` 再加 claim）
- **单位制支持**：claim 里的数值可以带单位
- **`note` 类型**：无概率的 background context，什么都可以放
- **因果支持**：0.6 再支持（设计已出）
- **贝叶斯模块**：0.6 再支持（有实验数据时用）

### 11.3 v0.5 vs main 功能对比

| 功能 | main 分支 | v0.5 分支 |
|------|-----------|-----------|
| `deduction` / `support` / `contradiction` | ✅ | ✅ |
| `infer(evidence, hypothesis=..., p_e_given_h=...)` | ❌ | ✅ |
| `associate(a, b, p_a_given_b=..., p_b_given_a=...)` | ❌ | ✅ |
| 谓词逻辑（Variable + DOMAIN） | ❌ | ✅ |
| `derive` / `observe` / `predict` / `compute` | ❌ | ✅ |
| warrant claim | ❌ | ✅ |
| scaffold | ❌ | ✅ |
| `note` 类型 | ❌ | ✅ |
| `decompose` | ❌ | ✅ |

### 11.4 Breaking Changes

**旧版 `infer` API 已 deprecated**：

```python
# ❌ 旧版（v0.4，已废弃）
infer([premises], conclusion, ...)

# ✅ 新版（v0.5）
infer(evidence, hypothesis=..., p_e_given_h=..., p_e_given_not_h=...)
```

v0.5 仍支持旧版 API（会发出 DeprecationWarning），但建议迁移到新 API。

### 11.5 LKM 映射（v0.5）

LKM 返回的 `noisy-and` 在 v0.5 中统一映射为 `derive`（rigid）。

**原因**：LKM 推理链内部假设全是严格推导；跨 paper 连接才用 `infer`/`associate`。

**实现位置**：`skills/lkm-explorer/` 的 SOP 层面约定，不是 Gaia 核心代码的自动映射。

### 11.6 CLI 变化（v0.5）

v0.5 的 CLI 设计原则（2026-05-11 会议明确）：

- **模型训练需要 CLI**：trace 里每一步是 `gaia xxx` 命令 + 输入输出，小模型可训
- **参照系：Lean/Mathlib**（始终比我们快 6 个月）
- **暴露纯能力，不约束下游 SOP**

**新增命令**（如果有）：
- `gaia add <claim>` 时拉整篇文章（不只拉 claim）
- `gaia render --lkm` → 把本地 Gaia 包转成 LKM 能接的 dependency 图格式

### 11.7 理论方向（Beyond Genes，v0.5 之后）

- James 框架 + Max Entropy → **玻尔兹曼分布** → 热力学整套可搬过来（温度/能量/自由能/相变）
- **重大科学发现 = 相变**：contradiction 大量积累后一笔勾销，熵骤降（牛顿→相对论是典型）
- 命题 = 热力学原子，逻辑关系 = 动力学演化规律
- 实验方向：用相对论诞生前的知识体系做相变验证（思寒+玮琦负责）

### 11.8 何时使用 v0.5

**推荐使用 v0.5 的场景**：
1. 需要 `infer` / `associate` 概率算子
2. 需要谓词逻辑（带参数的 claim）
3. 需要 warrant claim 自动生成
4. 需要 scaffold 分层形式化
5. 参与 Gaia 核心开发或测试

**推荐使用 main 的场景**：
1. 生产环境（稳定性优先）
2. 只需要 `deduction` / `support` / `contradiction`
3. 不需要 v0.5 的新功能
4. 等待 v0.5 合并后再升级

### 11.9 v0.5 测试覆盖

v0.5 的新功能已有完整测试：
- `tests/gaia/lang/test_composition.py` (152 行新增)
- `tests/gaia/lang/test_infer.py` (44 行修改)
- `tests/gaia/lang/test_compiler_actions.py` (129 行新增)

**运行测试**：

```bash
cd ~/Code/Gaia
git checkout v0.5
pytest tests/gaia/lang/test_infer.py -v
pytest tests/gaia/lang/test_composition.py -v
```

### 11.10 v0.5 合并时间线

**当前状态**（2026-05-13）：
- v0.5 分支比 main 领先 143 commits
- 合并时间**待定**
- 建议联系黄远或陈锟确认最新进展

---

## 附录 A: 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 大知识模型 | Large Knowledge Model (LKM) | Bohrium 的知识检索服务 |
| 信念传播 | Belief Propagation (BP) | 概率图推理算法 |
| 命题 | Claim | 可以被验证的陈述 |
| 前提 | Premise | 推导的输入 |
| 结论 | Conclusion | 推导的输出 |
| 先验概率 | Prior | 推导前的初始置信度 |
| 后验概率 | Posterior | BP 计算后的置信度 |
| 证据链 | Evidence Chain | LKM 中的推导路径 |
| 因子 | Factor | 推导关系的基本单元 |
| 谓词逻辑 | Predicate Logic | 带参数的命题 |
| Grounding | Grounding | 将变量填入具体值 |
| Scaffold | Scaffold | 脚手架，分层形式化 |
| Warrant Claim | Warrant Claim | 推导合理性的元命题 |

---

## 附录 B: 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-05-13 | 初稿，基于 Gaia main 分支和 gaia-lkm-skills v2026.05.10；新增 §11 专门描述 v0.5 分支功能 |

---

**文档维护**：欢迎提 issue 或 PR 到 [gaia-lkm-skills](https://github.com/SiliconEinstein/gaia-lkm-skills)。

**最后更新**：2026-05-13
