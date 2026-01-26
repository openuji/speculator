## spec B

This markdown document references [=Term A=].

This a definition: <dfn id="term-b">Term B</dfn>.

<!-- Trigger: reference/no-ambiguous-reference -->

This reference is ambiguous: <a data-link-type="dfn">Ambiguous Term</a>.

<!-- This one is fine -->

This one is fine: <a data-link-type="dfn" data-link-for="ContextX">Ambiguous Term</a>.

<!-- Trigger: reference/no-id-reference -->

These are deprecated:

- [Internal link to ID](#term-a)
- <a href="#term-b">HTML link to ID</a  >
