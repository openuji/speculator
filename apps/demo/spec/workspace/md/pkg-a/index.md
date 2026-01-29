## spec A

This markdown document defines <dfn id="term-a">Term A</dfn>.

<!-- Trigger: document/no-duplicate-definition -->

It also incorrectly defines <dfn>Term A</dfn> again.

<!-- Prepare for: reference/no-ambiguous-reference -->

## Ambiguous Terms

It defines <dfn data-dfn-for="ContextX">Ambiguous Term</dfn> and
<dfn data-dfn-for="ContextY">Ambiguous Term</dfn>.

<!-- Trigger: reference/no-unresolved-reference -->

Unresolved cross-spec reference: [=MissingTermInA=].
look at [§#spec-a|spec A] or this way [spec A](#spec-a)
