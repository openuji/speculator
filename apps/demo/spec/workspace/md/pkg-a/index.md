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

## Client {data-cop="client"}

<spec-statement>
  The client MUST send a POST request to the **Endpoint URL**.
</spec-statement>
<spec-statement>
  The client SHOULD set the Content-Type header to application/json.
</spec-statement>

## Server {data-cop="server"}

<spec-statement id="server-responses-at-endpoint">
  The server MUST return an HTTP response to requests received at the Endpoint URL.
</spec-statement>
<spec-statement>
  The server SHOULD set the Content-Type header to application/json.
</spec-statement>

## Identity Provider {#idp data-cop="#IDP"}

<spec-statement>
  The IDP MUST authenticate the user before issuing a token.
</spec-statement>
some other text
<spec-statement>
  The IDP MUST NOT issue tokens for unknown clients.
</spec-statement>
