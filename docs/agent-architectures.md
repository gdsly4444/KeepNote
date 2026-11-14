# Agent 架构笔记

日期：2026-11-15  
用途：给 KeepNote 对照 Claude Code、Pi、Codex 的实现方法。正文是结构笔记，不收录泄露源码。

## 1. 材料从哪来

| 对象 | 仓库 | 许可证 | 这次实际读到的 |
| --- | --- | --- | --- |
| Claude Code 公开仓库 | [anthropics/claude-code](https://github.com/anthropics/claude-code) | 仓库页面未标 SPDX | 根目录。里面是插件、示例、更新日志，没有 Agent 循环的 TypeScript 实现 |
| Claude Code 泄露副本 | 曾以 `nirholas/claude-code` 广泛被 fork | Anthropic 专有，已发 DMCA | 未克隆、未摘录。只记录下架事实和公开分析里的结构 |
| Pi | [earendil-works/pi](https://github.com/earendil-works/pi) | MIT | 包划分、`packages/agent/src/agent-loop.ts`、编码 Agent 的会话与压缩文档 |
| Codex | [openai/codex](https://github.com/openai/codex) | Apache-2.0 | `codex-rs` 的模块划分、OpenAI 对 App Server 的说明、沙箱文档的入口 |

2026-03-31，Claude Code v2.1.88 的 npm 包带出一份 sourcemap，指向一份约 1900 个 TypeScript 文件的压缩包。`nirholas/claude-code` 成为被 fork 最多的副本。Anthropic 在同一天对这个仓库和 70 多个 fork 提交了 [DMCA](https://github.com/github/dmca/blob/master/2026/03/2026-03-31-anthropic.md)。该仓库后来改名为 [nirholas/fresh-start](https://github.com/nirholas/fresh-start)，源码已移除。维护者同时说明：泄露树依赖的内部包名被人抢注，安装依赖可能执行恶意代码；另有伪装成泄露仓库的木马。不要运行任何 Claude Code 泄露副本。

下面关于 Claude Code 内部文件名的描述，来自公开论文 [Dive into Claude Code](https://arxiv.org/html/2604.14228v3) 和官方沙箱文档，不是从泄露树抄出的实现。

## 2. Claude Code

### 2.1 进程和界面

同一个循环服务多种界面：交互式 CLI、无头 CLI、Agent SDK、IDE、桌面和浏览器。界面负责把用户的话送进循环，再把事件画出来。循环、权限、工具和会话记录不跟着某一种界面重写。

执行默认在用户本机。模型请求发往 Anthropic 的 API。官方把隔离分成几档：只沙箱 Bash / PowerShell；把整个 Claude Code 进程放进沙箱；开发容器；虚拟机；以及 Anthropic 托管的云端会话。默认的 Bash 沙箱不包住文件工具、MCP 和 hooks，这些仍在宿主机上，靠路径和域名的权限规则约束。

会话主要是追加写的 JSONL。退出进程不会把未完成的工具调用留在一个独立后台里；云端会话是单独的一档，本机 CLI 并不默认变成常驻服务。

### 2.2 循环

公开分析把一次运行拆成七段：用户、界面、Agent 循环、权限、工具、状态、执行环境。

循环在 `queryLoop()`。一轮是：调用模型，模型返回文本或工具调用，权限系统决定能不能执行，工具在执行环境里跑，结果作为 `tool_result` 追加回对话，再进入下一轮。没有工具调用、用户中止或出错时停止。

工具由 `assembleToolPool()` 组装。基础工具大约二十个始终存在，其余随功能和用户类型打开，再并入 MCP 提供的工具。插件不直接成为工具，而是通过 MCP、技能和命令登记进来。读文件、搜索、shell、子 Agent 都是工具，不是启动时塞进提示词的仓库快照。

### 2.3 长上下文

Claude Code 不把仓库一次发出去。模型先看到系统说明、`CLAUDE.md` 这类短的项目说明、当前对话，以及工具定义。需要正文时调用读取或搜索。读取可以带行偏移和长度，搜索返回命中的行。

对话变长后用压缩，而不是重新上传全部文件。产品里有手动的 `/compact`，接近窗口上限时也会自动压缩：旧轮次收成摘要，最近的对话留下。子 Agent 使用自己的窗口，只把结论交还父对话，避免搜索过程占满主会话。稳定的系统提示和工具定义走前缀缓存。

权限是拒绝优先的规则，另有自动模式的分类器和 hook。工具想跑 shell 或改文件时，循环先问权限层，通过才执行。

## 3. Pi

仓库是 [earendil-works/pi](https://github.com/earendil-works/pi)，MIT。Cindy 桌面端依赖的 `@earendil-works/pi-ai` 来自这里。Pi 不是 Claude Code 的改写，它自己实现了一套可以嵌进别的程序的循环。

### 3.1 包

`packages/` 里和运行相关的是：

| 目录 | 作用 |
| --- | --- |
| `ai` | 多家模型的统一 API |
| `agent` | 工具调用循环和事件 |
| `coding-agent` | 终端里的编码 Agent、会话、压缩、技能、扩展 |
| `tui` | 终端界面 |
| `durable` | 可恢复的对话和任务运行时 |
| `mcp` | MCP |
| `codemode` | 把一批工具收成按需暴露的代码接口 |

编码 Agent 默认不带子 Agent 和计划模式。这些做成扩展或包，而不是写死在循环里。交互、打印、JSON、RPC 和 TypeScript SDK 共用同一套会话和循环。

### 3.2 循环

低层循环在 `packages/agent/src/agent-loop.ts`。`agentLoop` 把新的用户消息加进上下文再跑；`agentLoopContinue` 从已有上下文继续，最后一条不能是 assistant，否则提供者会拒绝。

`runLoop` 有两层：

- 内层处理这一轮的工具调用，以及用户在模型工作时插进来的 steering 消息。
- 外层在模型本来要停的时候，看有没有 follow-up。有就再开一轮。

每一轮在请求模型之前可以经过 `prepareNextTurn` 和 `prepareRequest`。压缩就挂在 `prepareNextTurn` 上，所以压缩发生在下一轮请求之前，而不是发生在界面里。

发给模型的不是内部消息原样。`transformContext` 可以先改写消息列表，`convertToLlm` 再转成提供者接受的 user / assistant / toolResult。工具集合如果变了，循环会插入一条系统消息，声明新增和移除的工具，而不是静默换掉定义。

流式事件包括 `agent_start`、`turn_start`、`message_update`、`tool_execution_start`、`turn_end`、`agent_end`。界面订阅这些事件。`message_end` 才是这条消息的最终内容。输出因为 token 上限被截断时，这条消息里的工具调用全部不执行，改为一条错误结果，让模型重新发出完整参数。

工具可以并行。任何一个工具标成 `sequential`，或者配置要求顺序执行，这一批就改成顺序。`AbortSignal` 贯穿循环，用户退出或取消时请求和工具一起停。

### 3.3 会话和长上下文

编码 Agent 把会话存成 JSONL 树。每条记录有 id 和 parent。当前叶子决定活跃分支。模型只看到活跃分支，看不到文件里的其他分支。`/tree` 在同一文件里换分支，`/fork` 和 `/clone` 把一段历史抄成新会话。离开一条分支时，可以先把那条分支摘要后挂到新分支上。

一次模型请求由这几样拼成：基础系统提示、项目里的上下文文件、活跃分支、工具定义、已加载技能的简短说明。技能的全文在被用到时才加载。`@path`、粘贴和命令输出变成消息内容，而不是预先把整个目录读入。

压缩有两种：

| 机制 | 何时 | 做什么 |
| --- | --- | --- |
| Compaction | 上下文超过阈值，或用户执行 `/compact` | 把旧消息收成摘要，最近一段原样保留 |
| Branch summarization | 在 `/tree` 里换分支 | 把离开的那条分支收成摘要带过去 |

自动压缩的条件是 `contextTokens > contextWindow - reserveTokens`。默认 `reserveTokens` 是 16384。保留最近约 20000 token（`keepRecentTokens`）。切分点从后往前走，停在用户消息、助手消息或自定义消息上，不停在孤立的工具结果上，避免工具调用和结果拆散。

摘要写成一条 `CompactionEntry`，记下 `summary`、`firstKeptEntryId`、压缩前的 token 数，以及读过和改过的文件。原始记录仍留在会话文件里。下一次请求是：系统提示、这份摘要、从 `firstKeptEntryId` 起的消息。再次压缩时，摘要范围从上一次保留边界开始，这样被留下的消息还会进入下一份摘要。

压缩在工具结果追加之后、下一次助手回复之前检查。提供者报上下文溢出，或回复因为长度被截断时，可以做一次压缩再重试。摘要请求本身不写提示缓存，因为这种一次性请求不会复用。

会话默认在 `~/.pi/agent/sessions/`，按工作目录分组。`--no-session` 的运行不落盘，退出后不能继续。SDK 里 `SessionManager` 是最终上下文的权威；直接改内存里的消息列表不会替换已经持久化的上下文。`session.dispose()` 会中止正在进行的工作。

### 3.4 进程

Pi 的编码 Agent 就是用户启动的那个进程。工具使用这个进程的操作系统权限，扩展也跑在同一进程里。项目级资源和设置要等用户确认信任之后才加载。RPC 用 stdin / stdout 的 JSONL，给别的语言当子进程用。SDK 则是嵌进宿主进程。没有一个脱离界面、自己常驻的后台服务；界面退出，这次运行就停。

## 4. Codex

仓库是 [openai/codex](https://github.com/openai/codex)，Apache-2.0。实现在 `codex-rs/`。和 KeepNote 直接相关的模块有：

| 模块 | 能看出的职责 |
| --- | --- |
| `core` | Agent 循环和线程运行时 |
| `app-server`、`app-server-protocol`、`app-server-daemon` | 给多种界面用的长生命周期协议进程 |
| `thread-store`、`rollout`、`history` | 线程和事件历史 |
| `context-fragments` | 上下文按片段组装，而不是一整块工作区 |
| `tools`、`exec`、`shell-command`、`apply-patch` | 读文件、跑命令、打补丁 |
| `sandboxing`、`linux-sandbox`、`windows-sandbox-rs`、`execpolicy`、`network-proxy` | 操作系统级沙箱和网络限制 |
| `tui`、`cli` | 终端界面 |
| `cloud-tasks` | 可选的云端任务，和本机循环分开 |

OpenAI 对 [App Server](https://openai.com/index/unlocking-the-codex-harness/) 的说明是：CLI、IDE、Mac 应用和网页背后是同一个 harness。App Server 是一个长期进程，用双向 JSON-RPC over stdio。它管线程的创建、恢复、分叉和归档，加载配置和登录，并在沙箱里执行 shell 和文件工具。一个请求可以引出许多事件，界面用这些事件画时间线。需要用户批准时，服务端反过来发请求，这一轮停住，直到界面回答。

本地客户端把对应平台的 App Server 二进制一起发布，拉起为子进程，并钉住测试过的版本。协议在 Go、Python、TypeScript、Swift、Kotlin 里都有客户端。核心循环仍在本机的 Codex core 里。模型请求发往 OpenAI。沙箱在 macOS 上用 Seatbelt，在 Linux 上用 bubblewrap，网络经代理解域名允许列表。这和 Claude Code 默认只在软件层限制 Bash 不同：Codex 把「模型可能越权」交给操作系统。

`app-server-daemon` 这个名字说明他们允许协议进程活得比单个短命令长，以便多个界面连接同一条线程。那仍然是用户启动的本机进程，不是一台脱离这台电脑的云执行器。`cloud-tasks` 是另一条路径。

仓库里的 `docs/sandbox.md` 现在指向官方的安全文档，沙箱细则以 [Codex 的审批与安全说明](https://developers.openai.com/codex/agent-approvals-security) 为准。这次没有逐行阅读 `context-fragments` 的源码，只确认了这个模块存在，并和 App Server 的「线程事件、按需工具」对得上。

## 5. 三家对照

| | Claude Code | Pi | Codex |
| --- | --- | --- | --- |
| 循环在哪 | 本机 `queryLoop` | 本机 `runLoop`，可被 SDK 嵌进宿主 | 本机 Codex core，由 App Server 对外 |
| 模型在哪 | Anthropic API | 用户选的提供者 | OpenAI API |
| 第一次请求里有什么 | 系统说明、项目短说明、对话、工具定义 | 系统提示、上下文文件、活跃分支、工具和技能摘要 | 线程历史的活跃部分、工具定义 |
| 文件怎么进上下文 | 模型调用读取和搜索，读取可限行 | 工具和 `@path`，技能全文按需加载 | 沙箱里的文件工具和补丁 |
| 对话太长 | 压缩旧轮次，保留最近对话；子 Agent 用单独窗口 | 摘要旧条目，保留最近约 2 万 token；原 JSONL 不删 | 线程持久化；上下文以片段组装 |
| 改文件之前 | 软件权限、hook、可选的 Bash 沙箱 | 工具跑在 Pi 进程的权限里，项目资源要先信任 | 操作系统沙箱，批准模式由界面回答 |
| 界面和逻辑 | 多种界面进同一个循环 | TUI、RPC、SDK 共用会话 | 多种界面进同一个 App Server |
| 退出 | 本机进程结束则循环结束；云端会话另算 | `dispose` / 中止信号停掉当前运行 | 子进程由客户端拉起；无线程、无界面时不应继续改文件 |

Cindy 没有再写第三套循环。它的 Electron 主进程拉起 Claude Code 和 Codex（以及可选的 Pi），渲染进程只通过 IPC 看事件和批准工具。长上下文的策略因此就是那两个 harness 自己的策略。

## 6. 对 KeepNote 有用的部分

KeepNote 的笔记库比一个代码仓库更不该整包上传。三家的共同点可以直接用：

1. 循环留在 Electron 主进程，和窗口同生同灭。模型只在云端做推理。
2. 第一轮只放用户这句话、当前文档的路径、类型、大纲和选区。正文和库内其他笔记通过工具按节读取、按标题检索。
3. 会话记在 SQLite 或 JSONL，原始记录保留。超过预算时插入一条摘要，请求里只带摘要加最近几轮。切分时不把「一次工具调用」和「它的结果」拆开。
4. 会改 Markdown 的工具不直接写盘。它返回差异事件，渲染进程画出来，用户接受之后主进程才写入。这比 Claude Code 的软件权限和 Codex 的沙箱更窄，因为第一版没有 shell。
5. 界面只订阅事件：`turn_start`、文本增量、工具开始和结束、一份待确认的差异、`turn_end`。压缩发生在主进程准备下一次请求时，不发生在 TipTap 里。
6. 不嵌入 Claude Code 或 Codex 的子进程。它们的工具集是代码仓库和 shell。Pi 的循环形状可以参考，尤其是 `prepareNextTurn` 里做压缩、截断的工具调用不许执行、取消信号贯穿整轮。
