# @openuji/speculator-emit

Deterministic Markdown/MDX emitter for Speculator AST workspaces.

## CLI

```bash
speculator-emit --workspace workspace.json --config config.json --out ./spec
```

From bikeshed-migrate semantic IR:

```bash
speculator-emit \
  --semantic-ir ./semantic-ir.json \
  --bikeshed-config ./config.json \
  --source-path ./index.bs \
  --out ./spec
```

## API

```ts
import { emitSpecPackage } from '@openuji/speculator-emit';
```
