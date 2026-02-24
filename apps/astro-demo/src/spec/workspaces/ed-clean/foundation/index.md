# Foundation Protocol {#foundation-protocol}

:::include ./partials/intro.md :::

## Terms {#terms}

A <dfn id="session-token">session token</dfn> binds a client session to its request context.

## Data Model {#data-model}

The following section is auto-generated from the vocabulary defined in `foundation.ttl`.
<spec-statement>
<spec-vocab class="fnd:SessionToken"></spec-vocab>
</spec-statement>

## JSON-LD formatting {#data-serialization}

<spec-statement>
<spec-vocab context></spec-vocab>
</spec-statement>

## Extended JSON-LD formatting {#extended-serialization}

<spec-statement>
<spec-vocab context="extended"></spec-vocab>
</spec-statement>

## Client Requirements {#client-requirements data-cop-concept="client-requirements"}

<spec-statement id="client-auth">A client MUST send credentials before calling protected endpoints.</spec-statement>
<spec-statement>A client SHOULD rotate a [=session token=] after privileged actions.</spec-statement>

:::include ./partials/client-flow.html :::

## References {#references-foundation}

The key words **MUST**, **SHOULD**, and **MAY** follow [[!RFC2119]] and [[!RFC8174]].
