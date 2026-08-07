# Global Skill Architecture
## Unified Map of All Agent Capabilities

---

## 1. Overview

This document defines the complete skill hierarchy across all Claude Code projects and agents. It serves as the single source of truth for:
- **Skill discovery** (where to find a capability)
- **Skill composition** (how skills reference each other)
- **Skill governance** (when to promote, deprecate, or consolidate)
- **Agent capability planning** (which skills each agent type needs)

### Scope: 15 Skills Across 3 Layers
- **Layer 1 (L1):** 10 Global Common Skills — all agents, all projects
- **Layer 2 (L2):** 4 Global Domain Skills — domain-specific agents
- **Layer 3 (L3):** Project Skills — single project or tightly coupled projects (1 example shown)

**Total:** 15 core skills + extensible project-level skills per project.

---

## 2. Layer 1: Global Common Skills (10)

Used by all agents across all projects. Highest reuse; most stable API.

| # | Skill | Purpose | Read Time | Priority | Location |
|---|-------|---------|-----------|----------|----------|
| 1 | **deep-research** | Multi-source web research, fact-checking, synthesis, citations | 15–30min | P0 | `~/.claude/skills/common-deep-research.md` |
| 2 | **dataviz** | Chart, graph, plot, dashboard creation (HTML/SVG/plotting, light/dark themes) | 10–15min | P0 | `~/.claude/skills/common-dataviz.md` |
| 3 | **code-review** | Code correctness bugs, reuse/simplification/efficiency cleanups | 10–20min | P0 | `~/.claude/skills/common-code-review.md` |
| 4 | **artifact-design** | HTML/artifact design principles, responsive layouts, accessibility | 5–10min | P0 | `~/.claude/skills/common-artifact-design.md` |
| 5 | **verify** | End-to-end verification of code changes; drive affected flow, observe behavior | 10–15min | P1 | `~/.claude/skills/common-verify.md` |
| 6 | **simplify** | Review changed code for reuse, simplification, efficiency; apply fixes | 10–15min | P1 | `~/.claude/skills/common-simplify.md` |
| 7 | **run** | Launch and drive app to see changes working; screenshot/confirm | 10–15min | P1 | `~/.claude/skills/common-run.md` |
| 8 | **init** | Initialize new codebase with CLAUDE.md, bootstrap structure | 5–10min | P1 | `~/.claude/skills/common-init.md` |
| 9 | **review** | Review GitHub pull request; comment/merge workflow | 10–15min | P0 | `~/.claude/skills/common-review.md` |
| 10 | **security-review** | Security vulnerabilities, compliance patterns, threat modeling | 15–30min | P0 | `~/.claude/skills/common-security-review.md` |

### Characteristics
- **Reusable across unrelated projects** (not quirk-specific)
- **Documented, stable API** (no major changes per quarter)
- **Universal trigger conditions** (applicable to any project type)
- **Cross-team adoption** (3+ teams use or could use)

### How They Reference Each Other (L1 → L1)
- `code-review` → `simplify` (when cleanup is found)
- `verify` → `run` (to observe behavior)
- `dataviz` → `artifact-design` (theme awareness)
- `deep-research` ↔ `security-review` (optional cross-ref)
- All L1 skills may reference **Skill vs Knowledge boundary** (`skill-vs-knowledge-boundary.md`)

---

## 3. Layer 2: Global Domain Skills (4)

Domain-specific agents use these in addition to L1 common skills. Narrower scope than L1.

| # | Skill | Domain | Purpose | Read Time | Location |
|---|-------|--------|---------|-----------|----------|
| 1 | **loop** | Orchestration & Automation | Recurring task automation (interval-based, self-paced) | 5–10min | `~/.claude/skills/domain-loop.md` |
| 2 | **schedule** | Cloud Operations | Scheduled cloud agents, cron jobs, one-time runs | 5–10min | `~/.claude/skills/domain-schedule.md` |
| 3 | **claude-api** | LLM Integration | Claude API reference, model IDs, pricing, streaming, caching | 10–20min | `~/.claude/skills/domain-claude-api.md` |
| 4 | **update-config** | Project Configuration | Configure Claude Code harness, permissions, env vars, hooks | 10–15min | `~/.claude/skills/domain-update-config.md` |

### Characteristics
- **Scoped to specific agent type or domain** (not universal)
- **Triggered by domain context** (scheduling needs, config changes, API integration)
- **Reuse across 2–3 related projects** (not 3+ unrelated ones)
- **May reference L1 skills** (composition)

### Domain → L1 Composition
- `schedule` → `loop` → `run` (orchestration pipeline)
- `claude-api` → `deep-research` (for Claude SDK/API research)
- `update-config` → none (self-contained)
- `loop` → `verify` (if automating code changes)

---

## 4. Layer 3: Project-Level Skills (Extensible)

Example: `project-claude-code-guide-doc-audit.md`

| Project | Skill | Purpose | Location |
|---------|-------|---------|----------|
| claude-code-guide | **project-claude-code-guide-doc-audit** | Verify document structure against code (drift detection) | `<project>/.claude/skills/project-claude-code-guide-doc-audit.md` |

### Promotion Criteria (L3 → L2)
A project skill graduates to L2 (domain) when:
1. **Reuse across 3+ unrelated projects** (demonstrated)
2. **Stable interface** (no changes in 2+ quarters)
3. **General principle** (not project-quirk-specific)
4. **Cross-team adoption** (multiple teams request it)

**Process:** File proposal in `~/.claude/knowledge/proposals/promote-<skill-name>.md`, review, merge to L2.

### Deprecation (L3)
Project skills marked `[DEPRECATED]` are maintained for 2 release cycles, then deleted. Update `<project>/.claude/skills/README.md` and notify owners.

---

## 5. Reference Architecture (DAG)

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    L1 (Global Common)                       │
│  ┌─────────────┐  ┌────────────┐  ┌────────────────────┐   │
│  │deep-research│  │  dataviz   │  │   code-review      │   │
│  └──────┬──────┘  └────┬───────┘  └────────┬───────────┘   │
│         │              │                    │               │
│  ┌──────▼──────┐  ┌────▼────┐  ┌───────────▼──────┐         │
│  │artifact-dsgn│  │  verify  │  │  simplify        │         │
│  └─────────────┘  └────┬─────┘  └──────────────────┘         │
│                        │                                    │
│  ┌──────────────┐  ┌───▼───┐  ┌────────────────────┐        │
│  │security-revw │  │  run   │  │   init  / review   │        │
│  └──────────────┘  └───────┘  └────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │ references (1-way)
                         │
┌─────────────────────────────────────────────────────────────┐
│                    L2 (Domain-Specific)                     │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐       │
│  │   loop     │  │  schedule    │  │  claude-api    │       │
│  └────┬───────┘  └──────┬───────┘  └────────────────┘       │
│       │                 │                                   │
│  ┌────▼─────────────────▼─────────┐                         │
│  │   update-config (self-contained)│                         │
│  └────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │ references (1-way)
                         │
┌─────────────────────────────────────────────────────────────┐
│                  L3 (Project-Level)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  project-claude-code-guide-doc-audit                 │   │
│  │  + other project-specific skills (per project)       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Allowed References (DAG Rules)

| From | To | Allowed | Why |
|------|----|---------|----|
| L1 skill | L1 skill | ✓ Yes | Common skills may compose |
| L2 skill | L1 skill | ✓ Yes | Domain skills build on common |
| L2 skill | L2 skill | ✓ Yes | Domain skills may compose |
| L3 skill | L1 skill | ✓ Yes | Project skills may use common |
| L3 skill | L2 skill | ✓ Yes | Project skills may use domain |
| L3 skill | L3 skill | ✓ Yes | Project skills may compose |
| L1 skill | L2 skill | ✗ No | Common must not depend on domain (breaks universality) |
| L1 skill | L3 skill | ✗ No | Common must not depend on project (breaks reusability) |
| L2 skill | L3 skill | ✗ No | Domain must not depend on project (breaks domain scope) |

### Reference Depth Constraint
- **Maximum 2 hops:** Skill A → Skill B → Skill C is allowed. Skill A → B → C → D is not.
- **Circular references:** Forbidden (enforce via doc review)
- **Cross-layer depth:** Count hops across layers the same way

**Example (Valid):**
```
code-review (L1) → simplify (L1) → run (L1) ✓
schedule (L2) → loop (L2) → run (L1) ✓
project-doc-audit (L3) → verify (L1) → run (L1) ✓
```

**Example (Invalid):**
```
code-review (L1) → simplify (L1) → run (L1) → <anything> ✗ (3 hops)
loop (L2) → run (L1) → verify (L1) → simplify (L1) ✗ (3 hops from loop)
```

---

## 6. Skill vs Knowledge Boundary

All skills reference the **boundary document** for clarity:
- **Skill:** Executable checklist, procedure, "must/must not" (3–5 min read)
- **Knowledge:** Background, reasoning, trade-offs, "why" (15–30 min read)

**File:** `~/.claude/knowledge/common/skill-vs-knowledge-boundary.md`

### How Skills Use Knowledge
Each skill **may** link to Knowledge documents (1-way only):

| Skill | Linked Knowledge | Purpose |
|-------|------------------|---------|
| `code-review` | "Why code review matters" | Teach context |
| `loop` / `schedule` | "Automation trade-offs" | Teach scheduling concepts |
| `claude-api` | "Claude model evolution" | Teach API history |
| `update-config` | "Permission policy" | Teach access control |

---

## 7. Agent Capability Mapping

### PM
- **L1 (Required):** deep-research, review, simplify, run
- **L2 (Optional):** update-config, loop, schedule
- **L3:** project-level skills for active projects

### Trainer Agent
- **L1 (Required):** deep-research, code-review, verify, artifact-design
- **L2 (Required):** claude-api, update-config
- **L3:** project-level trainer skills

### Code Reviewer
- **L1 (Required):** code-review, simplify, verify, security-review
- **L2 (Optional):** claude-api
- **L3:** none (unless specialized project)

### Automation Agent
- **L1 (Required):** verify, run, init
- **L2 (Required):** loop, schedule
- **L3:** project orchestration skills

---

## 8. Skill Discovery Workflow

When an agent needs to solve a problem:

```
┌──────────────────────────────────────────┐
│  Agent needs to solve problem X           │
└────────────────┬─────────────────────────┘
                 │
                 ▼
         ┌───────────────────┐
         │ Search Layer 1    │
         │ (~/.claude/skills │
         │   /common-*.md)   │
         └─────┬─────────────┘
               │
        ┌──────┴──────┐
        │             │
   ✓ Found?      ✗ Not found?
        │             │
        ▼             ▼
      USE        ┌──────────────────┐
       IT        │ Search Layer 2    │
                 │ (~/.claude/skills │
                 │   /domain-*.md)   │
                 └──────┬────────────┘
                        │
                   ┌────┴────┐
                   │          │
              ✓ Found?   ✗ Not found?
                   │          │
                   ▼          ▼
                 USE IT   ┌──────────────────┐
                          │ Search Layer 3    │
                          │ (<project>/.claude│
                          │   /skills/*.md)   │
                          └──────┬────────────┘
                                 │
                            ┌────┴─────┐
                            │           │
                       ✓ Found?    ✗ Not found?
                            │           │
                            ▼           ▼
                          USE IT   CREATE NEW SKILL
                                   (or solve inline)
```

### Search Tools
1. **Manual grep:**
   ```bash
   grep -r "keyword" ~/.claude/skills/common-*.md
   grep -r "keyword" ~/.claude/skills/domain-*.md
   grep -r "keyword" <project>/.claude/skills/project-*.md
   ```

2. **Skill registries:**
   - `~/.claude/skills/README.md` (global common skills index)
   - `~/.claude/skills/domain-<domain>/README.md` (domain skills index)
   - `<project>/.claude/skills/README.md` (project skills index)

3. **Agent memory (malgnai-mcp):**
   ```bash
   malgnai-mcp memory_search "skill-keyword"
   ```

---

## 9. Evolution Roadmap

### Phase 1: Stabilization (Current)
- **Status:** 15 core skills defined, stable API
- **Work:** Document each L1 skill with Skill/Knowledge separation
- **Timeline:** Ongoing, quarterly review

### Phase 2: Trainer Mode 10 (Next)
- **Goal:** Automate Skill/Knowledge separation and curriculum generation
- **Scope:** Generate 14-day onboarding for any agent
- **Input:** Agent name (e.g., `reviewer`)
- **Output:** Ranked curriculum, time estimates, knowledge map
- **File:** `~/.claude/knowledge/curriculum/onboarding-<agent>-14d.md`
- **Timeline:** Q4 2026

### Phase 3: Project-Level Skill Promotion Loop (Future)
- **Goal:** Automatically detect project skills ready for promotion
- **Trigger:** Quarterly skill audit
- **Criteria:** 3+ projects use it, stable 2+ quarters, general principle
- **Action:** Promote to L2, update references, notify teams
- **Timeline:** 2027

### Phase 4: Skill Registry & Discovery (Long-term)
- **Goal:** Centralized searchable skill database
- **Scope:** Full-text search + dependency visualization
- **Interface:** Web dashboard at `~/.claude/web/skills/`
- **Timeline:** 2027+

---

## 10. Maintenance & Audits

### Quarterly Skill Audit
```bash
# List all skills
find ~/.claude/skills -name "*.md" -type f | sort

# Check for duplicates (manual review)
# Review stale/deprecated skills
# Identify cross-project reuse (promotion candidates)
```

### Skill Registry Updates
- **Global:** `~/.claude/skills/README.md` — weekly
- **Domain:** `~/.claude/skills/domain-<domain>/README.md` — per release
- **Project:** `<project>/.claude/skills/README.md` — per sprint

### Deprecation Process
1. Mark skill with `[DEPRECATED]` tag and sunsetting date
2. Update registries to note deprecation
3. Notify affected agents/teams (via malgnai-mcp activity_log)
4. Maintain for 2 release cycles before deletion
5. Redirect references to replacement skill (if any)

---

## 11. Governance & Ownership

### New Skill Decision Tree

```
Does an existing skill (any layer) solve 80%+ of this need?
├─ YES → Use it. DONE.
└─ NO  → Continue

Will this skill be reused across 3+ distinct scenarios/projects in 12 months?
├─ YES → Create new skill (L1, L2, or L3)
│        └─ Universal? → L1 common
│        └─ Domain? → L2 domain
│        └─ Project? → L3 project
└─ NO  → Solve inline or document pattern in CLAUDE.md
```

### Skill Ownership & Review Cycle
- **L1 common:** Claude Code team, quarterly review
- **L2 domain:** Domain lead, quarterly review
- **L3 project:** Project team, per-sprint review

### Skill Composition Checklist
- [ ] Confirmed no existing skill solves 80%+ of this
- [ ] Validated reuse across 3+ scenarios (for new skill)
- [ ] Named correctly per convention
- [ ] Added to appropriate `README.md` registry
- [ ] Dependencies documented (references)
- [ ] DAG acyclicity verified
- [ ] Reference depth ≤2 hops verified
- [ ] Cross-project reuse tracked (for L3→L2 promotion)

---

## 12. Quick Reference: Skill at a Glance

| Skill | Category | Trigger | Output | Depth |
|-------|----------|---------|--------|-------|
| **deep-research** | L1 | "research X" | Cited report | 2 |
| **dataviz** | L1 | "chart Y" | HTML/SVG | 1 |
| **code-review** | L1 | "review code" | Findings + comments | 2 |
| **artifact-design** | L1 | "design artifact" | Principles + example | 1 |
| **verify** | L1 | "verify change" | Behavior observed | 2 |
| **simplify** | L1 | "simplify code" | Applied fixes | 1 |
| **run** | L1 | "run app" | Screenshot + confirmation | 2 |
| **init** | L1 | "new project" | Bootstrapped structure | 1 |
| **review** | L1 | "review PR" | Merged/commented | 2 |
| **security-review** | L1 | "security check" | Vulnerabilities + fixes | 2 |
| **loop** | L2 | "recurring task" | Scheduled loop | 1 |
| **schedule** | L2 | "cron job" | Cloud agent running | 1 |
| **claude-api** | L2 | "API reference" | Model info + examples | 1 |
| **update-config** | L2 | "configure" | Settings updated | 1 |
| **project-doc-audit** | L3 | "audit docs" | Drift report | 1 |

---

## Appendix A: File Locations

```
~/.claude/skills/
├── common-deep-research.md
├── common-dataviz.md
├── common-code-review.md
├── common-artifact-design.md
├── common-verify.md
├── common-simplify.md
├── common-run.md
├── common-init.md
├── common-review.md
├── common-security-review.md
├── domain-loop.md
├── domain-schedule.md
├── domain-claude-api.md
├── domain-update-config.md
└── README.md (master index)

<project>/.claude/skills/
├── project-<domain>-<skill-name>.md
└── README.md (project skills index)

~/.claude/knowledge/common/
├── skill-discovery-and-reuse-guide.md
├── skill-vs-knowledge-boundary.md
├── project-level-skill-definition-standard.md
└── global-skill-architecture.md (this file)

~/.claude/knowledge/curriculum/
└── onboarding-<agent>-14d.md (generated by Trainer Mode 10)

~/.claude/knowledge/proposals/
└── promote-<skill-name>.md (skill promotion proposals)
```

---

## Appendix B: Skill vs Knowledge Mapping

Each skill may link to Knowledge documents for deeper learning:

| Skill | Linked Knowledge | Read Time |
|-------|------------------|-----------|
| `deep-research` | "Multi-source research trade-offs" | 15–20min |
| `dataviz` | "Color theory & accessibility" | 10–15min |
| `code-review` | "Code review philosophy" | 15–20min |
| `artifact-design` | "Responsive design principles" | 10–15min |
| `verify` | "Testing vs verification" | 15–20min |
| `simplify` | "Technical debt trade-offs" | 15–20min |
| `run` | "Local vs CI environments" | 10–15min |
| `init` | "Project bootstrap best practices" | 10–15min |
| `review` | "Git workflow trade-offs" | 15–20min |
| `security-review` | "Threat modeling fundamentals" | 20–30min |
| `loop` | "Automation patterns & pitfalls" | 15–20min |
| `schedule` | "Cron vs event-driven orchestration" | 10–15min |
| `claude-api` | "Claude model evolution & pricing" | 15–20min |
| `update-config` | "Permission policy & access control" | 10–15min |

---

## Document Control

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-07-10 | Claude Code | Initial: 15 core skills, 3 layers, DAG rules, Trainer Mode 10 roadmap |

---

**Last Updated:** 2026-07-10  
**Next Review:** 2026-10-10 (quarterly)  
**Owner:** Claude Code Governance
