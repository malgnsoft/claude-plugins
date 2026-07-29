# Skill Discovery & Reuse Guide

## Principle
Before creating a new skill, always search for existing skills. Maximize reuse across projects and teams. New skills are costly (maintenance, documentation, training); reuse and composition are cheaper.

## Skill Hierarchy & Discovery Path
Skills exist in three layers; search in order:

### Layer 1: Global Common Skills
**Location:** `~/.claude/skills/common-*.md`  
**Scope:** All agents, all projects  
**Examples:**
- `common-deep-research.md` — Multi-source web research, fact-checking, citation
- `common-dataviz.md` — Chart, graph, dashboard creation (HTML/SVG/plotting)
- `common-code-review.md` — Code correctness & refactoring review
- `common-artifact-design.md` — Artifact design principles

**When to search:** Before any new skill request, start here. These are your go-to tools for universal problems.

### Layer 2: Global Domain Skills
**Location:** `~/.claude/skills/domain-*.md`  
**Scope:** All projects in a domain  
**Examples:**
- `domain-github-pr-workflow.md` — Standard PR creation, CI checks, merge
- `domain-security-review.md` — Security vulnerabilities, compliance patterns
- `domain-lm-api-integration.md` — LLM provider APIs (Claude, OpenAI, etc.)

**When to search:** If Layer 1 doesn't cover your need, check domain-specific global skills that many projects share.

### Layer 3: Project-Level Skills
**Location:** `<project-root>/.claude/skills/project-*.md`  
**Scope:** Single project or tightly coupled projects  
**Examples:**
- `project-malgnai-agent-skill-eval.md` — Malgnai agent capability review
- `project-malgnsales-crm-pattern.md` — Malgnsales CRM operations
- `project-claude-code-guide-doc-audit.md` — Guide document compliance

**When to search:** Only after confirming Layers 1–2 don't apply. Project skills are last resort; they add cognitive load and don't transfer across teams.

## Discovery Workflow

```
User/Agent needs to solve problem X
  ↓
1. Search ~/.claude/skills/common-*.md (keywords)
  ├─ Found match? → Use it. DONE.
  └─ No match? → Continue to Layer 2
  ↓
2. Search ~/.claude/skills/domain-*.md (domain keywords + project type)
  ├─ Found match? → Use it. Evaluate promotion to Layer 1.
  └─ No match? → Continue to Layer 3
  ↓
3. Search <project>/.claude/skills/project-*.md (project-specific)
  ├─ Found match? → Use it. Track for potential promotion.
  └─ No match? → Create new skill (see "New Skill Decision" below)
```

### Search Tools
1. **Manual grep:**
   ```bash
   grep -r "keyword" ~/.claude/skills/common-*.md
   grep -r "keyword" ~/.claude/skills/domain-*.md
   grep -r "keyword" <project>/.claude/skills/project-*.md
   ```

2. **Skill registry (if available):**
   - Check `~/.claude/skills/README.md` (catalog of all global skills)
   - Check `<project>/.claude/skills/README.md` (catalog of project skills)

3. **Agent memory:**
   - Query malgnai-mcp `memory_search` with skill keywords
   - Reference prior decision logs for skill reuse patterns

## New Skill Decision Tree

**Question 1: Is there an existing skill (any layer) that solves 80%+ of this need?**
- **YES** → Use it. Don't create a new skill.
- **NO** → Continue to Question 2.

**Question 2: Will this skill be reused across 3+ distinct scenarios/projects within 12 months?**
- **YES** → Create a new skill (Layer 1 or 2, depending on scope).
- **NO** → Don't create a skill; solve the problem inline or document the pattern in project docs (e.g., CLAUDE.md).

**Question 3: Is this solution universal (applies to all agents) or domain-specific (applies to some projects)?**
- **Universal** → Create `common-<skill-name>.md` in `~/.claude/skills/`
- **Domain-specific** → Create `domain-<domain>-<skill-name>.md` in `~/.claude/skills/`
- **Project-specific** → Create `project-<domain>-<skill-name>.md` in `<project>/.claude/skills/`

## Skill Composition
Reuse skills by **composing** them:
- A new skill may call out to existing skills as prerequisites or sub-steps
- Document dependencies clearly (e.g., "uses common-deep-research")
- Avoid circular dependencies (skill A → skill B → skill A)

**Example:**
```
project-malgnai-agent-eval.md
  │
  └─→ common-code-review.md (for code quality check)
  └─→ domain-github-pr-workflow.md (for PR validation)
  └─→ project-malgnai-agent-skill-eval.md (custom eval steps)
```

## Cross-Project Skill Sharing & Promotion

### Scenario: Project Skill Used by Another Project
If a `project-X-skill-Y.md` proves useful to project Z:

1. **Track usage:** Add a comment in the skill file:
   ```markdown
   <!-- Usage: malgnai-project, malgnsales-ops-team, 2 external inquiries -->
   ```

2. **Collect evidence:** Document actual use cases from both projects

3. **Evaluate promotion:** Does this meet Layer 1/2 criteria?
   - General principle (not quirk-specific)?
   - Stable interface?
   - 3+ reuse instances?

4. **If YES, promote:**
   - Rename `project-X-skill-Y.md` → `domain-X-skill-Y.md` or `common-skill-Y.md`
   - Move to `~/.claude/skills/`
   - Update all project references
   - Add to global skill registry

5. **If NO, isolate:** Update skill file to clarify project boundary; leave in project scope

### Scenario: Two Projects Invent Similar Skills
Discovered via audit (`~/.claude/hooks/skill-audit.mjs`):
- Merge into single domain or global skill
- Choose the better implementation as baseline
- Migrate both projects to use merged skill
- Deprecate redundant skills (2-quarter grace period)

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Fix |
|--------------|-------------|-----|
| **Skill bloat** — Skill does 10 things | Unmaintainable, unclear when to use | Split into smaller, focused skills |
| **Duplicate skills** — common-X and domain-Y do the same thing | Inconsistent behavior, wasted maintenance | Merge, deprecate one |
| **Project skill as global** — `project-generic-pattern.md` used everywhere | Defeats project isolation, creates hidden dependency | Promote to domain/common layer |
| **No discovery mechanism** — Skills exist but no catalog/registry | Agents don't know what's available | Maintain `*.../README.md` catalogs |
| **Stale skill** — Undocumented, unmaintained, unsafe for reuse | Risk of wrong behavior; agents avoid it | Mark `[DEPRECATED]`, sunsetting date |

## Auditing & Maintenance

### Quarterly Skill Audit
```bash
# Count and list all active skills
find ~/.claude/skills -name "*.md" -type f | sort
find <project>/.claude/skills -name "*.md" -type f | sort

# Check for duplicates (manual review of tool/purpose)
# Check for stale/deprecated skills (notify owners for sunsetting)
# Check for cross-project reuse (candidates for promotion)
```

### Updating Skill Registry
- **Global registry:** `~/.claude/skills/README.md` — Update weekly
- **Project registry:** `<project>/.claude/skills/README.md` — Update per project sprint

## Checklist for Reusing a Skill

- [ ] Confirmed no Layer 1 (common) skill solves this
- [ ] Confirmed no Layer 2 (domain) skill solves this
- [ ] Found a Layer 3 (project) skill OR decided to create new one
- [ ] If creating new, validated reuse across 3+ scenarios
- [ ] If creating new, named it correctly per convention
- [ ] Added to appropriate `README.md` registry
- [ ] If cross-project reuse detected, tracked for promotion
- [ ] Documented composition dependencies (if skill calls other skills)

## Quick Reference: When to Invoke Each Skill Layer

| Scenario | Search Layer | Example |
|----------|--------------|---------|
| Need charts for any project | common-dataviz | `@skill dataviz` |
| Need code review for any project | common-code-review | `@skill code-review` |
| Need PR workflow guidance | domain-github | `@skill domain-github-pr-workflow` |
| Need Malgnai agent eval (Malgnai only) | project-malgnai-* | `@skill project-malgnai-agent-skill-eval` |
| Need unknown solution | Start Layer 1 search | grep + reasoning |
