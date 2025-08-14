import * as WebIDL2 from 'webidl2';
import type { PostprocessOptions, PipelinePass } from '@/types';

type IdlTarget = { id: string; key: string; text: string };

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function slug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function uniqueId(doc: Document, base: string): string {
  let id = base;
  let i = 2;
  while (doc.getElementById(id)) {
    id = `${base}-${i++}`;
  }
  return id;
}

function collectTargetsFromAst(ast: WebIDL2.IDLRootType[]): { defs: IdlTarget[] } {
  const defs: IdlTarget[] = [];

  const addTop = (name: string) => {
    const key = norm(name);
    defs.push({ id: `idl-${slug(name)}`, key, text: name });
  };

  const addMember = (ifc: string, mem: string) => {
    const key = `${norm(ifc)}.${norm(mem)}`;
    defs.push({ id: `idl-${slug(ifc)}-${slug(mem)}`, key, text: `${ifc}.${mem}` });
  };

  for (const d of ast) {
    switch (d.type) {
      case 'interface':
      case 'interface mixin':
      case 'namespace':
      case 'dictionary':
      case 'callback interface':
      case 'callback':
      case 'typedef':
      case 'enum': {
        if (!('name' in d) || !d.name) break;
        addTop(d.name);

        // members where applicable
        if ('members' in d && Array.isArray(d.members)) {
          for (const m of d.members as any[]) {
            if (m.type === 'attribute' && m.name) addMember(d.name, m.name);
            else if (m.type === 'operation' && m.name) addMember(d.name, m.name);
            else if (m.type === 'const' && m.name) addMember(d.name, m.name);
            else if (m.type === 'field' && m.name) addMember(d.name, m.name);
          }
        }
        break;
      }
      // 'includes' doesn’t add new top-level names — skip
    }
  }

  return { defs };
}

/** Insert hidden anchors for each target before the given <pre>. */
function insertAnchorsBefore(pre: HTMLElement, targets: IdlTarget[]): void {
  if (!targets.length) return;
  const doc = pre.ownerDocument!;
  const wrapper = doc.createElement('div');
  wrapper.className = 'idl-anchors';
  (wrapper as any).hidden = true; // JS property for broader envs

  for (const t of targets) {
    const a = doc.createElement('a');
    a.id = uniqueId(doc, t.id);
    a.textContent = t.text;
    wrapper.appendChild(a);
  }
  pre.parentNode?.insertBefore(wrapper, pre);
}

/** Try to parse a string of IDL; return targets or throw. */
function parseIdlToTargets(idl: string): IdlTarget[] {
  const ast = WebIDL2.parse(idl);
  return collectTargetsFromAst(ast).defs;
}

/** Find candidate <pre> blocks containing IDL. */
function findIdlBlocks(root: Element): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  const pres = root.querySelectorAll<HTMLElement>('pre');
  pres.forEach((pre) => {
    const cls = (pre.getAttribute('class') || '').toLowerCase();
    const looksIdlClass = /\b(idl|language-idl)\b/.test(cls);
    const code = pre.querySelector('code');
    const text = (code ? code.textContent : pre.textContent) || '';
    const maybeIdl = looksIdlClass || /^\s*(interface|dictionary|enum|namespace|callback|typedef)\b/.test(text);
    if (maybeIdl && text.trim()) blocks.push(pre);
  });
  return blocks;
}

/** Build a map of resolvable IDL keys -> href based on parsed blocks. */
function buildIdlIndex(root: Element, warnings: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const blocks = findIdlBlocks(root);
  for (const pre of blocks) {
    const code = pre.querySelector('code');
    const idl = (code ? code.textContent : pre.textContent) || '';
    try {
      const targets = parseIdlToTargets(idl);
      insertAnchorsBefore(pre, targets);
      for (const t of targets) {
        const href = `#${t.id}`;
        if (!map.has(t.key)) map.set(t.key, href);
      }
    } catch (e: any) {
      const msg = e && e.message ? e.message : String(e);
      warnings.push(`IDL parse error: ${msg}`);
    }
  }
  return map;
}

/** Resolve <a data-idl> anchors using the built index. */
function resolveIdlLinks(root: Element, index: Map<string, string>, warnings: string[], suppressClass: string) {
  const anchors = root.querySelectorAll<HTMLAnchorElement>('a[data-idl]');
  Array.from(anchors).forEach((a) => {
    if (a.closest(`.${suppressClass}`)) return;
    const raw = a.getAttribute('data-idl') || '';
    const term = raw.trim();
    const hasMember = term.includes('.');
    let key = '';
    if (hasMember) {
      const [iface, member] = term.split('.', 2);
      key = `${norm(iface)}.${norm(member)}`;
    } else {
      key = norm(term);
    }

    const href = index.get(key);
    if (href) {
      a.setAttribute('href', href);
    } else {
      warnings.push(`Unresolved IDL link: "${term}"`);
    }
  })
}

/** Public pass */
export const idlPass: PipelinePass = {
  area: 'idl',
  async run(root: Element, _data: unknown, options: PostprocessOptions) {
    const warnings: string[] = [];
    const suppressClass = options.diagnostics?.suppressClass ?? 'no-link-warnings';
    const index = buildIdlIndex(root, warnings);
    resolveIdlLinks(root, index, warnings, suppressClass);
    return { warnings };
  },
};
