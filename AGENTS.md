# AGENTS.md

Agent configuration and installed skills for this project.

## Installed Skills

### `$impeccable` — [pbakaus/impeccable](https://github.com/pbakaus/impeccable)

Production-grade frontend design and iteration. Use when designing, redesigning, critiquing, auditing, polishing, or improving any frontend interface.

**Commands:**

| Command | Description |
|---|---|
| `$impeccable craft [feature]` | Shape then build a feature end-to-end |
| `$impeccable shape [feature]` | Plan UX/UI before writing code |
| `$impeccable teach` | Set up PRODUCT.md and DESIGN.md context |
| `$impeccable document` | Generate DESIGN.md from existing project code |
| `$impeccable extract [target]` | Pull reusable tokens and components into design system |
| `$impeccable critique [target]` | UX design review with heuristic scoring |
| `$impeccable audit [target]` | Technical quality checks (a11y, perf, responsive) |
| `$impeccable polish [target]` | Final quality pass before shipping |
| `$impeccable bolder [target]` | Amplify safe or bland designs |
| `$impeccable quieter [target]` | Tone down aggressive or overstimulating designs |
| `$impeccable distill [target]` | Strip to essence, remove complexity |
| `$impeccable harden [target]` | Production-ready: errors, i18n, edge cases |
| `$impeccable onboard [target]` | Design first-run flows, empty states, activation |
| `$impeccable animate [target]` | Add purposeful animations and motion |
| `$impeccable colorize [target]` | Add strategic color to monochromatic UIs |
| `$impeccable typeset [target]` | Improve typography hierarchy and fonts |
| `$impeccable layout [target]` | Fix spacing, rhythm, and visual hierarchy |
| `$impeccable delight [target]` | Add personality and memorable touches |
| `$impeccable overdrive [target]` | Push past conventional limits |
| `$impeccable clarify [target]` | Improve UX copy, labels, and error messages |
| `$impeccable adapt [target]` | Adapt for different devices and screen sizes |
| `$impeccable optimize [target]` | Diagnose and fix UI performance |
| `$impeccable live` | Visual variant mode: pick elements in browser, generate alternatives |

**Setup requirement:** Run `$impeccable teach` once to create PRODUCT.md and DESIGN.md before using design commands.

---

### `$emil-design-eng` — [emilkowalski/skill](https://github.com/emilkowalski/skill)

UI polish and animation craft based on Emil Kowalski's design engineering philosophy. Use when reviewing or writing animations, transitions, component interactions, and micro-details.

**Key principles:**
- Animation decision framework: frequency → purpose → easing → duration
- Only animate `transform` and `opacity` (GPU-accelerated)
- UI animations under 300ms; use `ease-out` custom curves, never `ease-in`
- Buttons get `scale(0.97)` on `:active`; popovers animate from trigger origin
- Springs for drag/gesture interactions; CSS transitions for interruptible UI
- Respect `prefers-reduced-motion`

**Review format:** Always outputs a `| Before | After | Why |` markdown table.

---

### `ComposioHQ/awesome-claude-skills` — [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)

832 third-party service automation connectors. Each skill is named `$<service>-automation` and provides integration workflows for that external API. Use when you need to automate actions in an external tool (e.g. send an email, update a CRM record, search an SEO tool).

**Installed at:** `.claude/skills/composio-skills/` (v2.0.0)

**Examples relevant to this project:**

| Skill | Service |
|---|---|
| `$active-campaign-automation` | Email marketing / CRM |
| `$ahrefs-automation` | SEO research |
| `$algolia-automation` | Search indexing |
| `$amazon-automation` | AWS / Amazon services |
| `$alpha-vantage-automation` | Financial data |
| `$anthropic-administrator-automation` | Anthropic API admin |

> To find any connector: `ls .claude/skills/composio-skills/ | grep <service>-automation`

---

### `ruvnet/ruflo` — [ruvnet/ruflo](https://github.com/ruvnet/ruflo)

213 skills covering the full software development lifecycle: agent coordination, swarm orchestration, SPARC methodology, TDD, GitHub automation, observability, performance, security, trading/ML, IoT, vector/embeddings, memory management, and more.

**Agent & Coordination**

| Skill | Description |
|---|---|
| `$agent-swarm` | Spawn and coordinate multi-agent swarms |
| `$agent-orchestrator-task` | Task orchestration across agents |
| `$agent-queen-coordinator` | Queen-pattern swarm coordination |
| `$agent-hierarchical-coordinator` | Hierarchical agent tree coordination |
| `$agent-mesh-coordinator` | Mesh topology agent coordination |
| `$agent-adaptive-coordinator` | Adaptive coordination strategies |
| `$agent-consensus-coordinator` | Consensus-based coordination |
| `$agent-byzantine-coordinator` | Byzantine fault-tolerant coordination |
| `$agent-gossip-coordinator` | Gossip protocol coordination |
| `$agent-collective-intelligence-coordinator` | Collective intelligence patterns |
| `$agent-coordinator-swarm-init` | Initialize a new swarm |
| `$swarm-init` / `$swarm-advanced` / `$swarm-orchestration` | Swarm lifecycle management |
| `$hive-mind` / `$hive-mind-advanced` | Hive mind agent patterns |
| `$agent-worker-specialist` | Specialist worker agents |
| `$agent-load-balancer` | Load balance tasks across agents |
| `$agent-resource-allocator` | Allocate resources across agents |
| `$agent-sync-coordinator` | Synchronize agent state |
| `$agent-crdt-synchronizer` | CRDT-based state sync |
| `$agent-raft-manager` | Raft consensus management |
| `$agent-quorum-manager` | Quorum-based decisions |
| `$agent-topology-optimizer` | Optimize agent network topology |
| `$agent-matrix-optimizer` | Matrix-based task optimization |
| `$agent-pagerank-analyzer` | PageRank for agent graph analysis |
| `$agent-memory-coordinator` | Shared memory across agents |
| `$agent-swarm-memory-manager` | Swarm-level memory management |

**Development & Code**

| Skill | Description |
|---|---|
| `$agent-coder` | Code generation agent |
| `$agent-planner` | Plan features and tasks |
| `$agent-goal-planner` / `$agent-code-goal-planner` | Goal-driven planning |
| `$agent-pseudocode` | Write pseudocode before implementation |
| `$agent-specification` | Write technical specifications |
| `$agent-architecture` / `$agent-arch-system-design` | System architecture design |
| `$agent-repo-architect` | Repository structure design |
| `$agent-refinement` | Refine and improve code |
| `$agent-reviewer` | Code review agent |
| `$agent-code-review-swarm` | Multi-agent code review swarm |
| `$agent-code-analyzer` / `$agent-analyze-code-quality` | Analyze code quality |
| `$agent-tester` | Testing agent |
| `$agent-tdd-london-swarm` | TDD London school swarm |
| `$tdd-workflow` | Test-driven development workflow |
| `$agent-test-long-runner` | Long-running test management |
| `$agent-benchmark-suite` | Benchmark test suites |
| `$sparc-methodology` / `$sparc-implement` / `$sparc-spec` / `$sparc-refine` | SPARC methodology (Spec→Pseudocode→Arch→Refine→Code) |
| `$agent-implementer-sparc-coder` | SPARC-guided implementation |
| `$agent-sparc-coordinator` | Coordinate SPARC workflow |
| `$agent-sandbox` | Sandboxed code execution |
| `$pair-programming` | Pair programming workflow |
| `$agentic-jujutsu` | Agentic problem-solving strategies |

**GitHub & DevOps**

| Skill | Description |
|---|---|
| `$agent-github-pr-manager` / `$agent-pr-manager` | PR management |
| `$agent-github-modes` | GitHub interaction modes |
| `$github-automation` / `$github-workflow-automation` | Automate GitHub workflows |
| `$github-code-review` | GitHub PR code review |
| `$github-multi-repo` | Multi-repo operations |
| `$github-project-management` | GitHub Projects board management |
| `$github-release-management` | GitHub release management |
| `$agent-release-manager` / `$agent-release-swarm` | Release management |
| `$agent-issue-tracker` / `$agent-swarm-issue` / `$agent-swarm-pr` | Issue and PR tracking |
| `$agent-project-board-sync` | Sync project boards |
| `$agent-ops-cicd-github` | CI/CD via GitHub Actions |
| `$agent-multi-repo-swarm` | Multi-repo swarm operations |
| `$git-workflow` | Git branching and workflow |
| `$hooks-automation` | Automate git hooks |
| `$agent-migration-plan` / `$migrate-create` / `$migrate-validate` | Database/code migrations |

**Performance & Observability**

| Skill | Description |
|---|---|
| `$agent-performance-analyzer` / `$agent-performance-optimizer` | Analyze and optimize performance |
| `$agent-performance-benchmarker` / `$agent-performance-monitor` | Benchmark and monitor |
| `$performance-analysis` / `$worker-benchmarks` | Performance analysis |
| `$observe-metrics` / `$observe-trace` / `$monitor-stream` | Observability: metrics, traces, streams |
| `$cost-optimize` / `$cost-report` | LLM cost optimization and reporting |

**Security**

| Skill | Description |
|---|---|
| `$agent-security-manager` | Security management |
| `$security-audit` / `$security-scan` | Security auditing and scanning |
| `$safety-scan` | Safety scanning |
| `$pii-detect` | PII detection |
| `$agent-production-validator` | Validate production readiness |
| `$verification-quality-assurance` | QA verification |

**Memory & Knowledge**

| Skill | Description |
|---|---|
| `$memory-management` / `$memory-search` / `$memory-bridge` | Agent memory operations |
| `$agentdb-query` / `$agentdb-vector-search` / `$agentdb-advanced-features` | AgentDB operations |
| `$agentdb-memory-patterns` / `$agentdb-performance-optimization` / `$agentdb-learning-plugins` | AgentDB advanced |
| `$kg-extract` / `$kg-traverse` | Knowledge graph extraction and traversal |
| `$embeddings` / `$vector-embed` / `$vector-cluster` / `$vector-search` / `$vector-hyperbolic` | Vector/embeddings operations |
| `$reasoningbank-intelligence` / `$reasoningbank-with-agentdb` | Reasoning bank patterns |
| `$session-persist` | Persist agent session state |

**AI & ML**

| Skill | Description |
|---|---|
| `$agent-neural-network` / `$neural-train` / `$neural-training` | Neural network agents |
| `$agent-safla-neural` / `$agent-sona-learning-optimizer` | Advanced learning optimizers |
| `$agent-data-ml-model` | ML model data agent |
| `$cognitive-pattern` | Cognitive reasoning patterns |
| `$intelligence-route` | Route tasks by intelligence type |
| `$deep-research` / `$research-synthesize` | Deep research and synthesis |
| `$agent-researcher` | Research agent |
| `$llm-config` | Configure LLM parameters |

**Trading & Finance**

| Skill | Description |
|---|---|
| `$trader-signal` / `$trader-backtest` / `$trader-portfolio` | Trading signals and backtesting |
| `$trader-regime` / `$trader-risk` / `$trader-train` | Market regime, risk, training |
| `$market-ingest` / `$market-pattern` | Market data ingestion and pattern recognition |
| `$agent-trading-predictor` | Trading prediction agent |

**IoT**

| Skill | Description |
|---|---|
| `$iot-register` / `$iot-fleet` / `$iot-firmware` | IoT device management |
| `$iot-anomalies` / `$iot-witness-verify` | IoT anomaly detection and verification |

**Documentation & ADR**

| Skill | Description |
|---|---|
| `$adr-create` / `$adr-review` / `$adr-index` | Architecture Decision Records |
| `$doc-gen` / `$api-docs` / `$agent-docs-api-openapi` | Documentation generation |
| `$diff-analyze` | Analyze diffs |
| `$dependency-check` | Check dependency health |

**Workflow & Automation**

| Skill | Description |
|---|---|
| `$workflow-create` / `$workflow-run` / `$workflow-automation` | Workflow management |
| `$agent-workflow` / `$agent-workflow-automation` / `$agent-automation-smart-agent` | Agent workflow automation |
| `$autopilot-loop` / `$autopilot-predict` | Autopilot execution loops |
| `$loop-worker` | Loop-based worker agents |
| `$cron-schedule` | Schedule recurring tasks |
| `$stream-chain` | Chain streaming operations |
| `$goal-plan` | Goal-based planning |
| `$horizon-track` | Track long-horizon goals |

**Plugins & Federation**

| Skill | Description |
|---|---|
| `$create-plugin` / `$validate-plugin` / `$discover-plugins` | Plugin lifecycle management |
| `$federation-init` / `$federation-audit` / `$federation-status` | Federated agent networks |
| `$agent-v3-queen-coordinator` / `$agent-v3-integration-architect` / `$agent-v3-memory-specialist` | V3 agent architecture |
| `$agent-v3-performance-engineer` / `$agent-v3-security-architect` | V3 specialists |
| `$v3-core-implementation` / `$v3-ddd-architecture` / `$v3-deep-integration` | V3 implementation |
| `$v3-cli-modernization` / `$v3-mcp-optimization` / `$v3-memory-unification` | V3 modernization |
| `$v3-performance-optimization` / `$v3-security-overhaul` / `$v3-swarm-coordination` | V3 optimization |

**Misc**

| Skill | Description |
|---|---|
| `$browser-scrape` / `$browser-test` | Browser automation |
| `$wasm-agent` / `$wasm-gallery` | WebAssembly agents |
| `$daa-agent` | Decentralized autonomous agent |
| `$flow-nexus-neural` / `$flow-nexus-platform` / `$flow-nexus-swarm` | Flow Nexus platform |
| `$ddd-aggregate` / `$ddd-context` / `$ddd-validate` | Domain-Driven Design |
| `$init-project` / `$agent-base-template-generator` | Project initialization |
| `$skill-builder` | Build new skills |
| `$ruflo-doctor` | Diagnose ruflo installation |
| `$claims` | Claims verification |
| `$chat-format` | Format chat output |
| `$rvf-manage` | RVF management |
| `$test-gaps` | Find test coverage gaps |
| `$agent-challenges` | Agent challenge benchmarks |
| `$agent-user-tools` | User-facing tool agents |
