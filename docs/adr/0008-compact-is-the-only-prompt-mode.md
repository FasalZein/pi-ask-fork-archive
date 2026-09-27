# Compact is the only prompt mode

Compact tool text, label-derived option values, no question limit, conditional hidden configuration advice, and answer-first elaboration are the only fork behavior. `PI_ASK_PROMPT_MODE` and the full-mode branch are removed. The behavior harness compares the fork with the upstream npm package `@eko24ive/pi-ask@1.2.0`, not a frozen branch inside the fork. This decision supersedes ADRs 0005, 0006, and 0007.

The user chose compact as the standard. Full mode replaced the system prompt in `before_agent_start`; `triggerTurn` runs skip that hook, so the prompt changes between requests. In Opus 5.5 reproduction, full mode dropped thinking in 2/2 runs, versus 0/2 in compact. Removing the replacement removes that cause. The separate live three-run Opus acceptance check remains required after integration.
