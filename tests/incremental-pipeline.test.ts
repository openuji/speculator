import { Speculator } from '../src/browser';
import { IdlPass } from '../src/pipeline/passes/idl';
import { XrefPass } from '../src/pipeline/passes/xref';
import { ReferencesPass } from '../src/pipeline/passes/references';
import { BoilerplatePass } from '../src/pipeline/passes/boilerplate';
import { TocPass } from '../src/pipeline/passes/toc';
import { DiagnosticsPass } from '../src/pipeline/passes/diagnostics';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

function createSection() {
  const section = document.createElement('section');
  section.innerHTML = '<p>test</p>';
  return section;
}

describe('incremental rendering', () => {
  let renderer: Speculator;
  let spies: Array<jest.SpyInstance> = [];

  beforeEach(() => {
    renderer = new Speculator();
    spies = [
      jest.spyOn(IdlPass.prototype, 'run'),
      jest.spyOn(XrefPass.prototype, 'run'),
      jest.spyOn(ReferencesPass.prototype, 'run'),
      jest.spyOn(BoilerplatePass.prototype, 'run'),
      jest.spyOn(TocPass.prototype, 'run'),
      jest.spyOn(DiagnosticsPass.prototype, 'run'),
    ];
  });

  afterEach(() => {
    spies.forEach(s => s.mockRestore());
  });

  it('skips passes when config is unchanged', async () => {
    const sections = [createSection()];
    await renderer.renderDocument({ sections });
    await renderer.renderDocument({ sections });

    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });

  it('only reruns boilerplate when header changes', async () => {
    const sections = [createSection()];
    const header1 = document.createElement('header');
    await renderer.renderDocument({ sections, header: header1 });

    const header2 = document.createElement('header');
    await renderer.renderDocument({ sections, header: header2 });

    const [idl, xref, refs, boiler, toc, diag] = spies;
    expect(idl).toHaveBeenCalledTimes(1);
    expect(xref).toHaveBeenCalledTimes(1);
    expect(refs).toHaveBeenCalledTimes(1);
    expect(boiler).toHaveBeenCalledTimes(2);
    expect(toc).toHaveBeenCalledTimes(1);
    expect(diag).toHaveBeenCalledTimes(1);
  });

  it('reruns all passes when sections change', async () => {
    const sections1 = [createSection()];
    await renderer.renderDocument({ sections: sections1 });
    const sections2 = [createSection()];
    await renderer.renderDocument({ sections: sections2 });
    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(2);
    }
  });
});

