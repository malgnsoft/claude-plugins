# Project-Level Skill Definition Standard

## Overview
Project-level skills are domain-specific competencies defined and used within a single project or closely related projects. They encapsulate reusable workflows, patterns, or knowledge unique to that project's problem space—distinct from global skills that apply across all projects.

## Scope & Boundary
**Project Skills** solve problems **only that project faces**:
- Agent orchestration patterns specific to one product's own multi-agent system
- CRM-domain operations specific to one product's sales workflow
- Documentation authoring templates specific to one product's doc site
- Custom database schema mapping for a specific product team

**Global Skills** solve problems **all projects might face**:
- `deep-research`: universal web research, fact-checking, citation
- `dataviz`: any project that needs charts, graphs, dashboards
- `code-review`: any project with code changes to evaluate
- `artifact-design`: any project creating visual outputs

**Test:** Ask "Would agent X in project Y benefit from this skill?" If yes only when X works on project Y, it's project-level. If yes across many unrelated projects, escalate to global.

## Naming & Location Convention

```
<project-root>/.claude/skills/project-<domain>-<skill-name>.md
```

### Naming Examples
- `project-crm-lead-scoring.md` — CRM-specific lead scoring workflow
- `project-ecommerce-checkout-flow.md` — Checkout flow patterns for a specific storefront
- `project-docsite-style-guide.md` — Documentation site authoring/review conventions
- `project-dataeng-warehouse-schema-design.md` — Data warehouse design (if project-specific)

### Domain Prefix
The domain prefix ties the skill to its home project:
- `<project-name>` — the project's own short identifier (e.g. `crm`, `ecommerce`, `docsite`)
- Use kebab-case, lowercase

## Skill Definition Template

Each project skill must include:

```markdown
# Project: <Domain> — <Skill Name>

## Purpose
One sentence: what problem does this skill solve, for whom, in this project?

## When to Use
Conditions under which an agent should invoke this skill:
- Trigger phrase or scenario
- State prerequisite(s)
- Who is the intended user (which agent role/team)

## Boundaries
What this skill does NOT do (prevent scope creep):
- List non-goals
- Reference related global skills if applicable

## Workflow / Steps
1. Step 1
2. Step 2
3. Step 3

## Output Format
What the agent can expect from the skill (structure, guarantees):
- Return type (artifact, JSON, text report)
- Quality assurance criteria

## Examples
Concrete scenario: input → expected output
```

## Ownership & Maintenance
- **Owner:** A named engineer or team lead for the project
- **Review cycle:** Reviewed quarterly or when project scope shifts
- **Deprecation:** Mark obsolete skills with `[DEPRECATED]` tag; maintain for 2 release cycles before deletion
- **Sync with project docs:** If skill behavior changes, update both skill MD and related project documentation (e.g., CLAUDE.md, agent handbook)

## Visibility & Documentation
- **Discovery:** List all active project skills in `<project>/.claude/skills/README.md`
- **Linkage:** In project `CLAUDE.md`, reference project skills under "Agent Capabilities"
- **Cross-project reference:** Only mention a project skill from another project if that skill is marked for escalation to global scope (see Skill Promotion Criteria below)

## Skill Promotion Criteria (to Global)
A project skill graduates to global scope when:
1. **Reuse across 3+ unrelated projects** — demonstrated actual usage
2. **Stable API** — skill interface hasn't changed in 2+ quarters
3. **General principle** — the solution solves a universal pattern, not just that project's quirk
4. **Cross-team adoption** — multiple teams request or reference it

**Action:** File a proposal in `~/.claude/knowledge/proposals/promote-<skill-name>.md`, include evidence, then merge as `common-<skill-name>.md` in global `~/.claude/skills/`.

## Checklist for New Project Skills
- [ ] Skill name follows `project-<domain>-<skill-name>` convention
- [ ] Located in `<project>/.claude/skills/`
- [ ] Purpose is specific to this project (not universal)
- [ ] Scope is bounded (clear non-goals)
- [ ] Workflow is reproducible and documented
- [ ] Added to `<project>/.claude/skills/README.md`
- [ ] Referenced in project `CLAUDE.md` if agent-facing
- [ ] No duplicate of existing global skill
- [ ] Owner assigned; review cycle defined
