# Foundation Protocol {#foundation-protocol data-cop-concept="protocol"}

:::include ./partials/intro.md :::

## Terms {#terms}

A <dfn id="session-token">session token</dfn> binds a client session to its request context.

## Data Model {#data-model}

The following section is auto-generated from the vocabulary defined in `foundation.ttl`.
<spec-statement data-id-pattern="session-token-stmt-{\d}">
<spec-vocab class="fnd:SessionToken"></spec-vocab>
</spec-statement>

## JSON-LD formatting {#data-serialization}

<spec-statement data-id-pattern="json-ld-stmt-{\d}">
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

## JSON-LD Term Extraction Fallback {#json-ld-term-fallback}

The following examples demonstrate the fallback to JSON-LD term extraction when a term is not found in Turtle definitions but exists in a `.jsonld` file (like `foundation.terms.jsonld`).

### Using `rdfs:comment`

<spec-statement>
<spec-vocab term="ex:ClassOne"></spec-vocab>
</spec-statement>

### Using `comment`

<spec-statement>
<spec-vocab term="ex:ClassTwo"></spec-vocab>
</spec-statement>

### Using `description`

<spec-statement>
<spec-vocab term="ex:ClassThree"></spec-vocab>
</spec-statement>

## References {#references-foundation}

The key words **MUST**, **SHOULD**, and **MAY** follow [[!RFC2119]] and [[!RFC8174]].
