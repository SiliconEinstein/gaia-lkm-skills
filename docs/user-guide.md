---
title: Gaia LKM 使用指南（LKM-side 配套）
created: 2026-05-13
updated: 2026-05-18
version: gaia-lkm-skills (LKM-side only)
status: draft
tags: [gaia, lkm, knowledge-graph]
---

# Gaia LKM 使用指南（LKM-side 配套）

本文档是 `gaia-lkm-skills` 仓库的 **LKM-side 配套指南**。本仓库只负责 LKM 接入与 LKM/Paper → Gaia 知识包的形式化 workflow；Gaia 本身的 DSL 语法、CLI 命令、知识包结构等 *upstream* 内容统一以 `SiliconEinstein/Gaia` 仓库 `docs/for-users/` 为准。

**读者预设**：你已经熟悉 Gaia 基本概念（`claim` / `deduction` / `support` / `contradiction` / `prior` / BP 等）。如果还不熟悉，请先阅读 upstream `SiliconEinstein/Gaia` 仓库的：

- `docs/for-users/quick-start.md` — 端到端入门（10 分钟构建第一个 Gaia 包）
- `docs/for-users/language-reference.md` — Gaia DSL 语法、包结构、metadata kwargs
- `docs/for-users/cli-commands.md` — `gaia build init/build compile/build check/run infer/run render/...` 完整命令参考
- `docs/for-users/hole-bridge-tutorial.md` — prior calibration 教程

运行时帮助优先使用 `gaia <group> <cmd> --help`。

---

## 0. 环境准备

### 0.1 系统要求

- **Python**: 3.10 或更高版本
- **Git**: 用于克隆代码仓库
- **包管理器**: 推荐使用 `uv`（更快），或使用 `pip`

### 0.2 安装 Gaia（upstream）

按照 upstream `SiliconEinstein/Gaia` 仓库 `docs/for-users/quick-start.md` 的安装指引安装 Gaia 本体，并通过 `gaia --version` / `gaia build compile --help` 验证。

### 0.3 安装 gaia-lkm-skills

```bash
cd ~/Code
git clone https://github.com/SiliconEinstein/gaia-lkm-skills.git
cd gaia-lkm-skills

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

```bash
# 编辑 ~/.bashrc 或 ~/.zshrc，加入：
export LKM_ACCESS_KEY="your_access_key_here"

# 重新加载
source ~/.zshrc
```

**验证**：

```bash
echo $LKM_ACCESS_KEY
# 输出 access key（不应该为空）
```

### 0.6 验证 LKM 连接

```bash
cd ~/Code/gaia-lkm-skills
python skills/lkm-api/scripts/lkm.py search \
  --query "test" \
  --top-k 1

# 成功输出：
# {"data": {"variables": [...], "papers": [...]}}

# 失败 → 检查 accessKey
```

---

## 1. Agent 使用指南

本仓库的 skills 由 orchestrator 统一路由。Agent 的标准入口：

```bash
# 阅读路由入口
cat skills/orchestrator/SKILL.md
```

orchestrator 根据用户请求路由到下列 skill / SOP 之一：

| 路由 | Skill | 适用场景 |
|------|-------|---------|
| **LKM → Gaia Package** | `lkm-api` + `lkm-explorer` | 从 LKM 检索结果构建 Gaia 包 |
| **Paper → Gaia Package** | `formalize` | 从单篇论文 Markdown 构建 Gaia 包 |
| **Raw LKM API Task** | `lkm-api` 直接调用 | 只需要原始 API 输出，不做形式化 |
| **Evidence Graph Only** | `evidence-subgraph` | 只需要证据子图，不需要 Gaia DSL |
| **Scholarly Synthesis** | `scholarly-synthesis` | 学术综述生成（用户显式请求时） |
| **Visualization** | upstream `gaia run render` | 包可视化（无 project-local skill） |

**典型工作流（LKM → Gaia 包）**：

```
用户：从 LKM 搜索 "量子纠缠" 相关 claim，构建 Gaia 包

Agent:
1. 读 orchestrator/SKILL.md → 路由到 LKM → Gaia Package
2. 读 orchestrator/references/lkm-explorer-sop.md → 完整 SOP
3. 读 lkm-api/SKILL.md → 调用 search/match/evidence
4. 读 lkm-explorer/SKILL.md → 五步 workflow 映射成 Gaia DSL
5. 运行 upstream 质量门控：gaia build compile && gaia build check --hole && gaia run infer
6. 报告结果
```

---

## 2. LKM API 使用

### 2.1 认证

LKM API 需要 `accessKey` 认证（见 §0.4 / §0.5）。

```bash
# 方式 1：环境变量（推荐）
export LKM_ACCESS_KEY="your_access_key_here"

# 方式 2：传参
python lkm.py search --query "..." --access-key "your_key"
```

#### 常见认证错误

| 错误信息 | 原因 | 解决方法 |
|---------|------|---------|
| `401 Unauthorized` | accessKey 无效或过期 | 重新获取 accessKey，联系 LKM 团队 |
| `403 Forbidden` | 无权限访问该资源 | 联系管理员开通权限（如私有论文访问） |
| `accessKey not found` | 环境变量未设置 | 检查 `echo $LKM_ACCESS_KEY`，重新 export |
| `Connection refused` | LKM 服务不可达 | 检查网络连接，确认 Base URL 正确 |
| `Timeout` | 请求超时 | 检查网络，或减少 `top_k` 参数 |

#### 权限级别

| 权限级别 | 可访问资源 |
|---------|-----------|
| **Public** | 公开论文的 claim |
| **Internal** | 公开 + 内部论文 |
| **Admin** | 所有资源 + 管理接口 |

### 2.2 四个核心接口

**Base URL**: `https://open.bohrium.com/openapi/v1/lkm`

所有接口都需要在 Header 中传 `accessKey: <your_key>`。

#### 2.2.1 Search（公开检索）

**用途**：根据查询词检索相关 claim。

```bash
POST /search
{
  "query": "量子纠缠",
  "top_k": 10,
  "filters": {"visibility": "public"}
}
```

**返回字段**：
- `data.variables[]` — claim 列表（`id` / `content` / `role` / `score` / `provenance.source_packages`）
- `data.papers` — 论文元数据（DOI、标题、作者、发表日期等）

**注意**：`score` 是检索引擎的排序信号，**不是** 科学置信度，不要当作 Gaia prior。

#### 2.2.2 Match（Claim 匹配）

**用途**：根据自由文本匹配已有 claim（类似 BM25）。

```bash
POST /claims/match
{
  "text": "量子纠缠导致非局域性",
  "top_k": 10,
  "filters": {"visibility": "public"}
}
```

**与 Search 的区别**：
- 字段名是 `text`（不是 `query`）
- 返回 `data.new_claim_likely` 字段

#### 2.2.3 Evidence（证据链）

**用途**：获取某个 claim 的推导证据链。

```bash
GET /claims/{claim_id}/evidence?max_chains=10&sort_by=comprehensive
```

**返回字段**：
- `data.claim` — 目标 claim
- `data.total_chains` — 找到的证据链总数
- `data.evidence_chains[]` — 证据链列表
  - `source_package` — 来源论文 ID
  - `factors[]` — 推导因子（`premises` → `conclusion`，含 `factor_type` / `subtype`）
  - `motivating_questions[]` — 驱动问题

#### 2.2.4 Variables Batch（批量查询变量）

**用途**：批量获取 `var_*` ID 的详细信息。

```bash
POST /variables/batch
{"ids": ["var_id_1", "var_id_2"]}
```

**返回**：`data.variables[]` + `data.papers` + `data.not_found[]`。

### 2.3 LKM API 常见问题

**Q: `code=290001` 错误怎么办？**
A: 已知的瞬态错误（冷启动）。重试 1-2 次通常可以解决。

**Q: `code=290002` "Field validation for 'Text' failed"？**
A: 在 `/claims/match` 接口中用了 `query` 字段，应该用 `text`。

**Q: 返回的 `score` 可以直接用作 Gaia prior 吗？**
A: **不可以**。`score` 是检索排序信号，不是科学置信度。Gaia prior 由 claim 性质 + 证据强度判断，或通过 BP 计算（参考 upstream `docs/for-users/hole-bridge-tutorial.md`）。

---

## 3. LKM → Gaia 形式化 workflow

### 3.1 SOP 入口

完整 SOP：`skills/orchestrator/references/lkm-explorer-sop.md`。

核心步骤：

1. **读 API contract** — `skills/lkm-api/SKILL.md`
2. **冷启动检索** — LKM match 查询，选择 chain-backed 根 claim（`total_chains > 0`）
3. **进入 lkm-explorer 五步 workflow** — 见 §3.2
4. **质量门控** — `gaia build compile && gaia build check --hole && gaia run infer`（见 upstream `docs/for-users/cli-commands.md`）
5. **审计** — 检查 `artifacts/lkm-discovery/graph_growth_log.jsonl` 和 `retrieval_log.jsonl`

### 3.2 lkm-explorer 五步 workflow

**Skill 入口**：`skills/lkm-explorer/SKILL.md`

| Step | Reference | 主要工作 |
|------|-----------|---------|
| Step 1 | `references/step-1-inputs-and-scope.md` | 确定 mode（batch / refresh）、输入、证据状态 |
| Step 2 | `references/step-2-bootstrap-and-map.md` | LKM `factors[]` → Gaia DSL；处理 placeholder / 空内容 premise |
| Step 3 | `references/step-3-contradictions-and-open-questions.md` | 矛盾/开放问题搜索（每 frontier claim ≥5 distinct queries） |
| Step 4 | `references/step-4-supports-priors-and-review.md` | Support 搜索（每 frontier claim ≥2 distinct queries）、shared-factor 提取、leaf priors |
| Step 5 | `references/step-5-emit-and-handoff.md` | Emit 包 + handoff（runs upstream `gaia build compile`/`build check`/`run infer`） |

### 3.3 LKM → Gaia 关键映射规则

LKM-specific 映射规则（owned by `$lkm-explorer`）：

- **LKM `noisy_and` 因子** → Gaia `derive(...)`（rigid；LKM 推理链内部假设全是严格推导）
- **LKM `deduction` 因子** → Gaia `derive(...)`
- **LKM `support` 因子** → Gaia `derive(...)` 配合 `metadata={"warrant_prior": ...}`（v0.5 canonical 形态，替代 legacy `support(...)` strategy）
- **No-chain LKM source claims**（`total_chains=0`）：冷启动后可以作为 leaf/source `claim(...)` 进入，`provenance_source="lkm_no_chain"`，**不要** 编造 premise 或 `derive`
- **Empty-content premise**（chain 内部）：可以用 placeholder string + `todo="revisit when LKM corpus populates this premise"` 保留 factor-derived `derive(...)`，记录 `content_missing=true`

完整的 LKM-specific contract：`skills/lkm-explorer/references/mapping-contract.md`。

Gaia DSL 通用语法（`claim` / `derive` / `contradict` / `equal` body discipline、metadata kwargs、label 规则等）见 upstream `SiliconEinstein/Gaia` `docs/for-users/language-reference.md`。

### 3.4 包结构与审计 dir

LKM-explorer 输出的标准 Gaia 包结构（按 upstream Gaia 知识包 spec；`artifacts/lkm-discovery/` 是 LKM-explorer 特有的 audit dir）：

```
<domain>-gaia/
├── pyproject.toml
├── references.json
├── src/<import>/
│   ├── __init__.py
│   ├── paper_<key>.py
│   ├── cross_paper.py
│   └── priors.py
├── artifacts/lkm-discovery/        # LKM-explorer audit dir
│   ├── input/                      # 原始 LKM JSON（verbatim）
│   ├── retrieval_log.jsonl         # 每次 LKM API 调用
│   ├── graph_growth_log.jsonl      # 每个 DSL 增长决策
│   ├── candidates.md / contradictions.md / equivalences.md
│   ├── mapping_audit.md            # per-claim / per-pair 转换记录
│   ├── merge_audit.md              # 去重决策
│   ├── merge_decisions.todo        # 模糊 pair 待决
│   └── dismissed/
└── .gaia/                          # gaia build compile / run infer 输出
    ├── ir.json
    ├── beliefs.json
    └── inquiry/
```

包结构由 upstream 拥有（见 `SiliconEinstein/Gaia` `docs/for-users/`）；`mapping_audit.md` 表格约定和 `graph_growth_log.jsonl` 增长日志由 `$lkm-explorer` 维护；`artifacts/lkm-discovery/` 子目录的具体文件由 `skills/lkm-explorer/references/package-skeleton.md` 规定。

---

## 4. Paper → Gaia 形式化 workflow

### 4.1 Skill 入口

**Skill**: `skills/formalize/SKILL.md`

**适用场景**：从单篇论文 Markdown 构建 Gaia 包。

### 4.2 四个 Phase

| Phase | Reference | 主要工作 |
|-------|-----------|---------|
| Phase 1 | `references/phase-1-extract-conclusions.md` | 提取 motivation / conclusions / open questions / 跨结论 logic graph |
| Phase 2 | `references/phase-2-build-reasoning-chain.md` | 重构每个结论的推理链 |
| Phase 3 | `references/phase-3-review-weak-points.md` | 审计 weak points 和 highlights；标定 `prior_probability` / `p1` / `p2` / `review_prior`。也包含 **Phase 1b** LKM 反向溯源（best-effort） |
| Phase 4 | `references/phase-4-emit-package.md` | Emit 包 + audit 文件 |

Phase 1-3 产出 working notes（不写文件），Phase 4 是唯一写文件的 phase。

### 4.3 Suitability gate

在 Phase 1 开始前先判断论文是否适合形式化：综述 / 观点 / 损坏文本会被跳过（输出 `<package_name>.skip.md` 记录原因）。

### 4.4 9 种 argument-pattern weak-point types

`measurement` / `causal` / `model` / `statistical` / `generalization` / `comparative` / `formal` / `computational` / `external`。详细分类见 Phase 3 reference。

### 4.5 audit dir

`$formalize` 的 audit dir 是 `artifacts/paper-extract/`（与 `$lkm-explorer` 的 `artifacts/lkm-discovery/` 区分；两者 `graph_growth_log.jsonl` event shape 兼容，由对应 skill 维护，transitional 等待 LKM 侧 refresh）。

---

## 5. 审计与质量门控

### 5.1 上游 Gaia 质量门控

每次修改 Gaia 包源代码后，运行：

```bash
gaia build compile .
gaia build check --brief .
gaia build check --hole .
gaia run infer .
gaia inquiry review --strict .
```

完整命令语义见 upstream `SiliconEinstein/Gaia` `docs/for-users/cli-commands.md`。

### 5.2 BP 概率局限性

**重要提示**（2026-05-11 会议明确）：

1. BP 算出的概率 **不是客观精确值**，是"给定你构建的逻辑图，唯一对应的概率"
2. Formalization 出错 → 概率无意义，且无法从概率本身判断是命题错了还是图构建错了
3. **正确第一步 use case**：claim 检索 + 溯源（作为 SN 召回源），不是"给可靠评分"

不要把 BP 概率当稳定评分系统推给客户。

### 5.3 LKM-explorer 审计文件

LKM-explorer 写入的 audit 文件（按 `skills/lkm-explorer/references/package-skeleton.md`）：

- `mapping_audit.md` — per-claim / per-pair 转换记录
- `merge_audit.md` — 去重决策
- `contradictions.md` / `equivalences.md` / `candidates.md` — discovery flag
- `retrieval_log.jsonl` — LKM API 调用 ordered index
- `graph_growth_log.jsonl` — DSL 增长决策 ordered index
- `dismissed/` — 已驳回的 false alarm

两个 JSONL 是 replay 索引；md 文件承载详细科学 rationale。

### 5.4 formalize 审计文件

`formalize` 写入的 audit 文件（在 `artifacts/paper-extract/`）：

- `mapping_audit.md` — phase summary / conclusions table / weak points table / highlights table / motivation / open questions / per-conclusion narratives / metadata gaps
- `graph_growth_log.jsonl` — emit 顺序的事件流（`package_initialized` / `accepted_claim` / `accepted_deduction` / `prior_added`）

辅助脚本：`skills/formalize/scripts/generate_audit.py`（可从 emit 后的 `paper_<key>.py` + `priors.py` 通过 AST 反生成 audit 文件）。

---

## 6. 常见问题

### Q1: LKM 返回结果不完整

**症状**：`/claims/{id}/evidence` 返回的 `total_chains` 很少，或 `factors[]` 为空。

**可能原因**：
1. Claim 是新 claim（LKM 中没有证据链）
2. LKM 数据库尚未索引该论文
3. `max_chains` 参数太小

**解决方案**：
1. 检查 `data.new_claim_likely` 字段
2. 增加 `max_chains` 参数（如 `max_chains=50`）
3. 如果确实是新 claim，考虑用 Paper → Gaia 流程（`$formalize`）

### Q2: 包 Cleanness 纪律

**问题**：我想在 paper 包里加入自己的判断和 inspiration，可以吗？

**答案**：**不可以**。Paper 包的 truth source 是 `paper.md`，不要把"我们的判断"或"inspiration"混入 `package.py`。

**正确做法**：
- 单独建一个包（如 `my-topic-inspiration-gaia/`）
- 在新包中引用 paper 包的 claim
- 用 upstream Gaia 提供的算子连接（具体算子见 `docs/for-users/language-reference.md`）

**原因**：保持包的可追溯性和科学诚实性。

### Q3: 上游 Gaia CLI / DSL 问题

任何关于 Gaia 本体（`gaia` CLI 命令、DSL 语法、知识包结构、`infer`/`associate`/谓词逻辑/warrant claim 等）的问题，统一查 upstream `SiliconEinstein/Gaia` 仓库：

- `docs/for-users/quick-start.md`
- `docs/for-users/language-reference.md`
- `docs/for-users/cli-commands.md`
- `docs/for-users/hole-bridge-tutorial.md`
- 运行时：`gaia <group> <cmd> --help`

本仓库不重复 upstream 教学内容；遇到 upstream 未涵盖的 emission 纪律，我们也不本地补；如果 upstream 缺失，gap 在 upstream 暴露。

---

## 7. 参考资源

### 7.1 仓库

- **gaia-lkm-skills**: https://github.com/SiliconEinstein/gaia-lkm-skills（本仓库；LKM-side 配套）
- **Gaia 核心（upstream）**: https://github.com/SiliconEinstein/Gaia（DSL / CLI / 包规范）

### 7.2 Upstream 文档（pointer targets）

| 文档 | 主题 |
|------|------|
| `docs/for-users/quick-start.md` | 端到端 Gaia 知识包 workflow |
| `docs/for-users/language-reference.md` | DSL primitives + 包结构 |
| `docs/for-users/cli-commands.md` | 完整 CLI 参考 |
| `docs/for-users/hole-bridge-tutorial.md` | Prior calibration 教程 |

### 7.3 本仓库 Skills

| Skill | SKILL.md | 主要 references |
|-------|----------|----------------|
| orchestrator | `skills/orchestrator/SKILL.md` | `lkm-explorer-sop.md` / `audited-delegation.md` |
| lkm-api | `skills/lkm-api/SKILL.md` | — |
| lkm-explorer | `skills/lkm-explorer/SKILL.md` | 5 个 step + `mapping-contract.md` + `package-skeleton.md` + `timeline-log-contract.md` |
| formalize | `skills/formalize/SKILL.md` | 4 个 phase |
| evidence-subgraph | `skills/evidence-subgraph/SKILL.md` | — |
| scholarly-synthesis | `skills/scholarly-synthesis/SKILL.md` | — |

### 7.4 联系人

- **黄远** (huangy22@gmail.com)
- **陈锟** (chenkun0228@gmail.com)

---

## 附录 A: 术语表（LKM-side）

| 术语 | 英文 | 说明 |
|------|------|------|
| 大知识模型 | Large Knowledge Model (LKM) | Bohrium 的知识检索 / 证据链服务 |
| 证据链 | Evidence Chain | LKM 中的推导路径 |
| 因子 | Factor | 推导关系的基本单元（LKM `gfac_*`） |
| 冷启动 | Cold Start | 第一次构建 Gaia 包；需要选择 chain-backed root claim |
| Frontier | Frontier | LKM-explorer 中正在扩展的 claim 集合（后续展开的起点） |
| Support channel | Support Channel | 每个 frontier claim 至少 2 distinct match queries 找 support |
| Open-question / conflict channel | — | 每个 frontier claim 至少 5 distinct match queries 找矛盾 / 开放问题 |
| chain-backed | — | LKM `total_chains > 0` 的 claim；冷启动 root 必须 chain-backed |
| no-chain source claim | — | `total_chains = 0` 的 LKM source claim；冷启动后可以作为 leaf 进入 |

Gaia 本体术语（claim / deduction / support / contradiction / BP / prior / posterior / warrant claim 等）见 upstream `SiliconEinstein/Gaia` `docs/for-users/language-reference.md` 与 `docs/for-users/quick-start.md`。

---

**文档维护**：欢迎提 issue 或 PR 到 [gaia-lkm-skills](https://github.com/SiliconEinstein/gaia-lkm-skills)。
