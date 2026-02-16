# Foundation Protocol {#foundation-protocol}

:::include ./partials/intro.md :::

## Terms {#terms}

A <dfn id="session-token">session token</dfn> binds a client session to its request context.

## Client Requirements {#client-requirements}

<section data-cop-concept="client">
  <spec-statement id="client-auth">A client MUST send credentials before calling protected endpoints.</spec-statement>
  <spec-statement>A client SHOULD rotate a [=session token=] after privileged actions.</spec-statement>
</section>

:::include ./partials/client-flow.html :::

## References {#references-foundation}

The key words **MUST**, **SHOULD**, and **MAY** follow [[!RFC2119]] and [[!RFC8174]].
