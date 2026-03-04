import type { ThemeSlots, RenderPageVm } from '#src/theme/types';
import type { DocumentMetadata, TocEntry } from '@openuji/speculator';
import { baseSlots, baseComponents } from '#src/theme/themes/base/components';
import { AstComponentsContext } from '#src/theme/themes/base/context';
// import { TocNav } from '#src/theme/themes/bikeshed/TocNav';

import type { JSX } from 'preact';

function formatPersonList(people: DocumentMetadata['editors'] | DocumentMetadata['authors']): JSX.Element | null {
  if (!people || people.length === 0) return null;
  return (
    <>
      {people.map((person, i) => (
        <span key={i}>
          {i > 0 ? <br /> : null}
          {person.url ? <a href={person.url}>{person.name}</a> : person.name}
          {person.company ? ` (${person.company})` : null}
        </span>
      ))}
    </>
  );
}

function BikeshedHeader(props: Parameters<ThemeSlots['Header']>[0]) {
  const { vm } = props;
  const meta = vm.metadata || {};
  const custom = meta.custom || {};

  let formattedDate = meta.lastUpdateDate;
  if (formattedDate) {
    try {
      const d = new Date(formattedDate);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch {
      // ignore
    }
  }

  let formattedCreationDate = meta.creationDate;
  if (formattedCreationDate) {
    try {
      const d = new Date(formattedCreationDate);
      if (!isNaN(d.getTime())) {
        formattedCreationDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch {
      // ignore
    }
  }

  const w3cState = () => {
    if (meta.status === 'CG-DRAFT') {
      return (
        <p id="w3c-state">
          <a href="https://www.w3.org/standards/types/#CG-DRAFT">Draft Community Group Report</a>,{' '}
          <time class="dt-updated" datetime={meta.lastUpdateDate || ''}>
            {formattedDate}
          </time>
        </p>
      );
    }
    return null;
  };

  return (
    <header class="spec-header spec-header--bikeshed">
      <div class="spec-header-top float-right">
        {meta.custom?.logo && <SpecLogo logo={meta.custom.logo as SpecLogoType}/> || null}
      </div>
      <h1 class="spec-title" id="title">
        {vm.titleText}
      </h1>
      {w3cState()}
      

      <details class="spec-more bikeshed-more-details" open>
        <summary>More details about this document</summary>
        <dl class="spec-meta">
          {meta.respec?.thisVersion || custom.thisVersion ? (<>
              <dt>This version:</dt>
              <dd><a href={String(meta.respec?.thisVersion || custom.thisVersion)}>{String(meta.respec?.thisVersion || custom.thisVersion)}</a></dd>
              </>
          ) : null}
          
          {meta.respec?.latestVersion || custom.latestVersion ? (
            <>
              <dt>Latest published version:</dt>
              <dd><a href={String(meta.respec?.latestVersion || custom.latestVersion)}>{String(meta.respec?.latestVersion || custom.latestVersion)}</a></dd>
            </>
          ) : null}

          {custom.testSuite ? (
            <>
              <dt>Test Suite:</dt>
              <dd><a href={String(custom.testSuite)}>{String(custom.testSuite)}</a></dd>
            </>
          ) : null}

          {formattedCreationDate ? (
            <>
              <dt>Created:</dt>
              <dd>
                <time datetime={meta.creationDate || ''}>{formattedCreationDate}</time>
              </dd>
            </>
          ) : null}

          {formattedDate ? (
            <>
              <dt>Modified:</dt>
              <dd>
                <time datetime={meta.lastUpdateDate || ''}>{formattedDate}</time>
              </dd>
            </>
          ) : null}

          {custom.feedback || meta.repository ? (() => {
            const repoUrl = meta.repository 
              ? (typeof meta.repository === 'string' ? meta.repository : meta.repository.url)
              : '';
            const feedbackUrl = custom.feedback 
              ? String(custom.feedback) 
              : `${repoUrl.replace(/\/$/, '')}/issues`;
            const text = custom.feedback ? String(custom.feedback) : `${repoUrl.replace(/\/$/, '')}/issues`;
            
            return (
              <>
                 <dt>Feedback:</dt>
                 <dd><a href={feedbackUrl}>{text}</a></dd>
              </>
            );
          })() : null}

          {meta.editors && meta.editors.length > 0 ? (
            <>
              <dt>Editors:</dt>
              <dd>{formatPersonList(meta.editors)}</dd>
            </>
          ) : null}

          {custom.formerEditors && Array.isArray(custom.formerEditors) && custom.formerEditors.length > 0 ? (
            <>
              <dt>Former Editors:</dt>
              <dd>{formatPersonList(custom.formerEditors as DocumentMetadata['editors'])}</dd>
            </>
          ) : null}
        </dl>
      </details>
      {meta.copyright ? (() => {
        const copyright = String(meta.copyright)
          .replace(/\[YEAR\]/g, String(new Date().getFullYear()))
          .replace(/\[TITLE\]/g, vm.titleText);
        return (
          <p
            class="copyright text-sm"
            dangerouslySetInnerHTML={{ __html: copyright }}
          />
        );
      })() : null}
    </header>
  );
}

function BikeshedTocTree({ entries }: { entries: TocEntry[] }): JSX.Element | null {
  if (!entries || entries.length === 0) return null;
  return (
    <ol class="toc">
      {entries.map((entry, i) => {
        const href = entry.id ? `#${entry.id}` : '#';
        return (
          <li key={i}>
            <a href={href}>
              <span class="toc-number">{entry.number || ''}</span>
              <span>{entry.text}</span>
            </a>
            {entry.children?.length && entry.depth < 3 ? <BikeshedTocTree entries={entry.children} /> : null}
          </li>
        );
      })}
    </ol>
  );
}


function BikeshedToc({ vm }: { vm: RenderPageVm }): JSX.Element | null {
  if (vm.includeToc === false || !vm.toc || vm.toc.length === 0) return null;
  return (
    <aside class="toc-sidebar">
      <W3CCommunityDraftReportLogo />
      <nav id="toc">
        <h2>TABLE OF CONTENTS</h2>
        <BikeshedTocTree entries={vm.toc} />
      </nav>
    </aside>
  );
}

function BikeshedLayout({ vm, children }: { vm: RenderPageVm; children?: JSX.Element }): JSX.Element {
  
  return (
    <div class="spec-page">
      <BikeshedToc vm={vm} />      
      <div class="spec-content">
        <BikeshedHeader vm={vm} />
        <article class="spec-article">
        {children || (
          <div class="spec-prose">
            <baseSlots.Components.Document document={vm.document} ctx={vm.blockCtx} />
          </div>
        )}
      </article>
      </div>
      
    </div>
  );
}

const W3CCommunityDraftReportLogo = () => (
    <img
      alt="W3C Community Group Draft Report"
      src="https://www.w3.org/StyleSheets/TR/2021/logos/back-cg-draft.png"
    />
);

type SpecLogoType = {href: string, alt: string, src: string, width: string, height: string}
const SpecLogo = ({logo}: {logo: SpecLogoType}) => (
  <a class="logo" href={logo.href}>
    <img
      alt={logo.alt}
      src={logo.src}
      width={logo.width}
      height={logo.height}
    />
  </a>
);


function BikeshedFragmentShell({ vm, children }: { vm: RenderPageVm; children?: JSX.Element }): JSX.Element {
  return (
    <AstComponentsContext.Provider value={baseComponents}>
      <main
        class="solospec-root bikeshed-theme-bg"
        data-solospec-theme={vm.themeName}
        data-solospec-mode={vm.mode}
      >
        <BikeshedLayout vm={vm}>{children}</BikeshedLayout>
      </main>
    </AstComponentsContext.Provider>
  );
}

export const bikeshedSlots: ThemeSlots = {
  ...baseSlots,
  Header: BikeshedHeader,
  Toc: BikeshedToc,
  Layout: BikeshedLayout,
  FragmentShell: BikeshedFragmentShell,
};
