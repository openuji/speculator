import type { RenderUsageFlags } from '#src/render/block';

export function getRuntimeInjectionModules(usage: RenderUsageFlags): string[] {
  const modules: string[] = [];
  if (usage.mermaid) modules.push('@openuji/spec-page/runtime/mermaid');
  if (usage.likec4) modules.push('@openuji/spec-page/runtime/likec4');
  return modules;
}

export function getRuntimeInjectionScripts(usage: RenderUsageFlags): { headHtml: string; bodyHtml: string } {
  const headTags: string[] = [];
  const bodyTags: string[] = [];

  if (usage.mermaid) {
    const mermaidScript = `import '@openuji/spec-page/runtime/mermaid';`;
    bodyTags.push(`<script type="module">${mermaidScript}</script>`);
  }

  if (usage.likec4) {
    const likeC4Script = `import '@openuji/spec-page/runtime/likec4';`;
    bodyTags.push(`<script type="module">${likeC4Script}</script>`);
  }

  return {
    headHtml: headTags.join('\\n'),
    bodyHtml: bodyTags.join('\\n'),
  };
}
