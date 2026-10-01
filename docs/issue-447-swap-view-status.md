# Issue #447: Swap view responsiveness

The assigned `fix/issue-447` branch was inspected against the current
repository. It contains exchange-rate state and transaction-history support,
but no Swap route, page, or component. Because there is no rendered view or
layout to adjust, this branch does not introduce a speculative replacement
Swap screen.

Once the intended Swap component or its source branch is identified, the
mobile work should cover layouts below 768px, overflow behavior, focus states,
theme tokens, and accessible labels. This note is retained in the tracking PR
so the missing implementation target is visible to maintainers.
