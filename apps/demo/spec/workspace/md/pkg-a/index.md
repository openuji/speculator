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

## Client {data-cop-concept="client"}

<spec-statement>
  The client MUST send a POST request to the **Endpoint URL**.
</spec-statement>
<spec-statement>
  The client SHOULD set the Content-Type header to application/json.
</spec-statement>

## Server {data-cop-concept="server"}

<spec-statement id="server-responses-at-endpoint">
  The server MUST return an HTTP response to requests received at the Endpoint URL.
</spec-statement>
<spec-statement>
  The server SHOULD set the Content-Type header to application/json.
</spec-statement>

## Identity Provider {#idp data-cop-concept="#IDP"}

<spec-statement>
  The IDP MUST authenticate the user before issuing a token.
</spec-statement>
some other text
<spec-statement>
  The IDP MUST NOT issue tokens for unknown clients.
</spec-statement>

### Node Integrity and Uniqueness {data-cop-concept="uniqueness"}

- <spec-statement>**Identity:** Every Node in `items[]` **MUST** possess:
  - `type`: A non-empty string.
  - `id`: A non-empty string representing a valid URI/URN.
    </spec-statement>
- <spec-statement>**Uniqueness:** No two Nodes within a single document **MAY** share the same `id`.</spec-statement>
- <spec-statement>**Reserved Keys:** The keys reserved for system use `@context`, `type`, `id`, `meta`, `extensions`, `specVersion`, `items`, `imports` **MUST NOT** be used.</spec-statement>

<spec-statement>
* **Flat Binding**: 
  * A reference to another Node **MUST** be expressed as either:
    * a string equal to the target [=Node=]’s `id`, or
    * a JSON object that is a [link](http://example.com).
  * The referenced id **MUST** resolve to exactly one Node within the current resolution scope (including imports).
</spec-statement>
<spec-statement>It **MUST** satisfy the following schema:

| Field        | Requirement | Description                                  |
| ------------ | ----------- | -------------------------------------------- |
| `type`       | `required`  | The object class (e.g., `Journey`, `State`). |
| `id`         | `required`  | Unique URI/URN identifier.                   |
| `meta`       | `optional`  | Metadata object (versioning, timestamps).    |
| `extensions` | `optional`  | Use case and/or Vendor-specific data.        |

 </spec-statement>

### Document Structure {data-cop-concept="data-structure"}

<spec-statement>
* **Root Object:** The root of the file **MUST** be a valid single `UJGDocument` bundle.

- **Context**: The root **MUST** include a `@context` object defining:
  - `id` aliased to `@id`
  - `type` aliased to `@type`
  - `items` aliased to `@graph`
  - A vocabulary (via `@vocab` or prefix like `ujg:`) ensuring types are resolvable (e.g., `Journey` or `ujg:Journey`).
- **Payload:** The `items` property **MUST** contain every [=Node=] in the document.
- **Flat Binding**:
  - A reference to another Node **MUST** be expressed as either:
    - a string equal to the target [=Node=]’s `id`, or
    - a JSON object that is a [=Node Reference=].
  - The referenced id **MUST** resolve to exactly one Node within the current resolution scope (including imports).
    </spec-statement>
