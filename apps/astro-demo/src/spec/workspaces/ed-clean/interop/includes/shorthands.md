## Shorthands Reference {#interop-shorthands}

This section mirrors the demo shorthand coverage with workspace-safe references.

### Internal Concepts and Cross-references {#interop-shorthand-concepts}

<dfn>Dispatch Algorithm</dfn> is a term defined in this document.

Now we can refer to [=Dispatch Algorithm=] elsewhere, and it links back to the definition.
You can also use an alias: [=Dispatch Algorithm|dispatch flow=].

### Algorithm Variables {#interop-shorthand-variables}

ReSpec variables like |channelId| or |pending result| are parsed as specialized `<var>` elements.

Examples:

- We take |channelId| and add |retryAfterSeconds|.
- If |pending result| is empty, return null.

### Citations {#interop-shorthand-citations}

Citations reference bibliography entries.

- Normative citation: [[!RFC2119]]
- Informative citation: [[?RFC8174]]

### WebIDL References {#interop-shorthand-webidl}

Use double braces for WebIDL interface and member references:

- The {{InteropChannel}} interface models the runtime communication channel.
- The {{InteropChannel/id}} member identifies a channel instance.
- The {{InteropChannel/active}} member indicates whether the channel accepts messages.
- Use {{InteropChannel/retryAfterSeconds}} when backoff is required.
- Invoke {{InteropChannel/close}} to terminate the channel.

### Mixed Usage {#interop-shorthand-mixed}

Shorthands can be mixed freely:

- If |active| is true and [[!RFC2119]] constraints apply, [=Dispatch Algorithm=] should run.
- See [§#interop-shorthand-webidl|the WebIDL section] for member-level references.

### Code Blocks {#interop-code-blocks}

Fenced `astro` block:

```astro
---
interface Props {
  channelId: string;
}

const { channelId } = Astro.props;
---

<section data-channel={channelId}>
  <h3>Interop Channel {channelId}</h3>
</section>
```

Fenced `ts` block:

```ts
type InteropChannelState = {
  id: number;
  active: boolean;
  retryAfterSeconds: number;
};

export function shouldDispatch(channel: InteropChannelState): boolean {
  return channel.active && channel.retryAfterSeconds < 30;
}
```

Fenced `json` block:

```json
{
  "channelId": 42,
  "active": true,
  "retryAfterSeconds": 5
}
```

### Summary Table {#interop-shorthand-summary}

| Shorthand     | Syntax            | Example                                 | AST Type    |
| ------------- | ----------------- | --------------------------------------- | ----------- |
| Citation      | `[[REF]]`         | `[[RFC2119]]`                           | `cite`      |
| Normative     | `[[!REF]]`        | `[[!RFC2119]]`                          | `cite`      |
| Informative   | `[[?REF]]`        | `[[?RFC8174]]`                          | `cite`      |
| Concept       | `[=term=]`        | `[=Dispatch Algorithm=]`                | `reference` |
| Concept Alias | `[=term|alias=]` | [=Dispatch Algorithm|dispatch flow=]    | `reference` |
| Section Alias | `[§#id|alias]`   | [§#interop-shorthands|Shorthands]       | `reference` |
| Variable      | `\|var\|`         | |channelId|                             | `variable`  |
| WebIDL        | `{{IDL}}`         | `{{InteropChannel}}`                    | `reference` |

