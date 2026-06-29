# Roadmap

Order is contractual: harden CLI interfaces before wrapping them, ship read-only integrations before mutation, and defer broader write surfaces until policy and evidence exist. “Write-bearing” means the pass can create project artifacts or mutate external state; it does not authorize that work now.

| Pass | Status | Goal | Why now | Risk | Prior dependency |
|---:|---|---|---|---|---|
| 1 | Complete | Close the voiceover decision and preserve the silent fallback. | Removes media ambiguity before docs name canonical artifacts. | Read-only/media | None |
| 2 | Complete | Consolidate agent-first operational documentation. | Establishes one navigation and safety contract before interface changes. | Read-only/docs | Pass 1 |
| 3 | Complete | Harden CLI JSON, errors, versions, and compatibility contracts. | Stable machine interfaces are required by every client. | Read-only contract | Pass 2 |
| 4 | Complete | Specify MCP tools, schemas, authorization, failure behavior, lifecycle, and tests in [MCP_PLAN.md](MCP_PLAN.md). | The wrapper must follow hardened CLI contracts. | Read-only/spec | Pass 3 |
| 5 | Complete | Implement the strictly read-only MCP tools, resources, and prompts specified in [MCP_PLAN.md](MCP_PLAN.md). | Validates the wrapper without mutation risk. | Read-only | Pass 4 |
| 6 | Complete | Wrap the existing guarded V1 write through MCP. | Mutation follows proven read-only transport and explicit authorization. | Write-bearing | Pass 5 |
| 7 | Complete | Polish CLI UX and define `doctor`/`status` contracts. | Improves operability after core machine contracts stabilize. | Read-only | Pass 3 |
| 8 | Complete | Research and specify Search Console readiness boundaries in [SEARCH_CONSOLE_READINESS_SPEC.md](SEARCH_CONSOLE_READINESS_SPEC.md). | Establishes claims, auth, and data limits before integration. | Read-only/spec | Pass 7 |
| 9 | Complete | Prototype mock-backed read-only Search Console status. | Tests stable CLI/MCP status contracts without OAuth, tokens, live Google calls, or third-party mutation. | Read-only | Pass 8 |
| 10 | Next | Specify DNS readiness checks and provider-neutral evidence. | Avoids provider coupling and unsafe remediation claims. | Read-only/spec | Pass 7 |
| 11 | Planned | Implement read-only DNS checks. | Adds evidence only after the check contract is reviewed. | Read-only | Pass 10 |
| 12 | Planned | Define post-write deployment handoff and live re-check workflow. | Connects local effects to verified live state without hiding boundaries. | Write-bearing | Pass 6 |
| 13 | Planned | Add a social preview simulator. | Builds on stable audit/report metadata contracts. | Read-only | Pass 3 |
| 14 | Planned | Detect generated-site implementation smells. | Adds bounded repository diagnostics after inspection contracts harden. | Read-only | Pass 3 |
| 15 | Planned | Add a bounded multi-page crawl. | Expands audit scope only after single-page contracts stabilize. | Read-only | Pass 3 |
| 16 | Planned | Revisit and polish the GUI. | Lets human UX consume proven CLI/MCP/report behavior. | Read-only | Passes 7, 13–15 |
| 17 | Planned | Export reviewed patches as explicit artifacts. | Introduces a portable write surface after preview contracts mature. | Write-bearing | Passes 6, 16 |
| 18 | Planned | Integrate GitHub PR creation with explicit authorization. | External mutation is last, after patch and policy evidence exist. | Write-bearing | Pass 17 |

Planned names are goals, not implemented commands or interfaces. Each pass must update [STATUS.md](STATUS.md), [COMMANDS.md](COMMANDS.md), [CONTRACTS.md](CONTRACTS.md), applicable policy, tests, and validation evidence when it ships.
