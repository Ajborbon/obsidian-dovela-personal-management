import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BREADCRUMB_STYLES, breadcrumbText, computeBreadcrumb, folderTargetNote, nextBreadcrumbStyle, parsePathSegments,
  type Breadcrumb,
} from '../../src/core/links/breadcrumbs';

const seg15 = (c: string): string => c.repeat(15);

function names(b: Breadcrumb): string[] {
  if (b.kind !== 'full') throw new Error(`esperaba full, fue ${b.kind}`);
  return b.segments.map((s) => s.name);
}

describe('breadcrumbs (RI-D §6.1)', () => {
  it('B1–B3: ruta vacía', () => {
    expect(computeBreadcrumb('', 'full', 60)).toEqual({ kind: 'root', label: '📁 Root' });
    expect(computeBreadcrumb('', 'compact', 60)).toEqual({ kind: 'root', label: '📁' });
    expect(computeBreadcrumb('', 'smart', 60)).toEqual({ kind: 'root', label: '📁 Root' });
  });

  it('B4: completo con rutas acumuladas', () => {
    const b = computeBreadcrumb('A/B/C', 'full', 60);
    expect(b).toEqual({ kind: 'full', segments: [{ name: 'A', path: 'A' }, { name: 'B', path: 'A/B' }, { name: 'C', path: 'A/B/C' }] });
  });

  it('B5: barras sobrantes', () => {
    expect(parsePathSegments('/A//B/')).toEqual([{ name: 'A', path: 'A' }, { name: 'B', path: 'A/B' }]);
    expect(computeBreadcrumb('/A//B/', 'full', 60)).toEqual(computeBreadcrumb('A/B', 'full', 60));
  });

  it('B6–B7: ruta corta → completa', () => {
    expect(names(computeBreadcrumb('A/B', 'smart', 60))).toEqual(['A', 'B']);
    expect(names(computeBreadcrumb('A/B', 'compact', 60))).toEqual(['A', 'B']);
  });

  it('B8–B9: 5 segmentos de 15 (79 > 60) → primero › … › último con título completo', () => {
    const path = ['a', 'b', 'c', 'd', 'e'].map(seg15).join('/');
    for (const style of ['smart', 'compact'] as const) {
      const b = computeBreadcrumb(path, style, 60);
      expect(b.kind).toBe('elided');
      if (b.kind !== 'elided') return;
      expect(b.first).toEqual({ name: seg15('a'), path: seg15('a') });
      expect(b.last.name).toBe(seg15('e'));
      expect(b.last.path).toBe(path);
      expect(b.title).toBe(path);
      expect(b.hidden).toBe(3);
      expect(breadcrumbText(b)).toBe(`${seg15('a')} › … › ${seg15('e')}`);
    }
    expect(computeBreadcrumb(path, 'smart', 60)).toEqual(computeBreadcrumb(path, 'compact', 60));
  });

  it('B10–B11: límite inclusivo', () => {
    // 5 segmentos: 4 separadores + 56 caracteres = 60.
    const p60 = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd', 'eeeeeeeeeeee'].join('/');
    expect(p60.length).toBe(60);
    expect(computeBreadcrumb(p60, 'smart', 60).kind).toBe('full');
    const p61 = `${p60}e`;
    expect(computeBreadcrumb(p61, 'smart', 60).kind).toBe('elided');
  });

  it('B12: 2 segmentos largos (81 caracteres) → completo, sin elipsis (regresión de la recursión de julio 2026)', () => {
    const path = `${'x'.repeat(40)}/${'y'.repeat(40)}`;
    expect(path.length).toBe(81);
    for (const style of ['smart', 'compact'] as const) expect(names(computeBreadcrumb(path, style, 60))).toHaveLength(2);
  });

  it('B13: 1 segmento de 100 caracteres, compacto → completo', () => {
    expect(names(computeBreadcrumb('z'.repeat(100), 'compact', 60))).toEqual(['z'.repeat(100)]);
  });

  it('B14: termina para todo estilo × ruta × máximo (sin RangeError)', () => {
    const long = (n: number): string => Array.from({ length: n }, (_, i) => `${'s'.repeat(30)}${i}`).join('/');
    const paths = ['', 'a', 'a/b', 'a/b/c', long(2), long(5), '/', '//a//'];
    for (const style of BREADCRUMB_STYLES) {
      for (const p of paths) {
        for (const max of [0, 1, 30, 60, Number.NaN, Number.POSITIVE_INFINITY, -5]) {
          expect(() => computeBreadcrumb(p, style, max)).not.toThrow();
        }
      }
    }
  });

  it('B14 estructural: el módulo no contiene llamadas recursivas entre funciones de decisión', () => {
    const src = readFileSync(new URL('../../src/core/links/breadcrumbs.ts', import.meta.url), 'utf8');
    const body = src.slice(src.indexOf('export function computeBreadcrumb'));
    const fnBody = body.slice(body.indexOf('{'), body.indexOf('\n}\n'));
    expect(fnBody).not.toMatch(/computeBreadcrumb\(/);
    expect(fnBody).not.toMatch(/nextBreadcrumbStyle\(|breadcrumbText\(/);
  });

  it('B15: el estilo completo nunca abrevia', () => {
    const path = ['a', 'b', 'c', 'd', 'e'].map(seg15).join('/');
    expect(names(computeBreadcrumb(path, 'full', 0))).toHaveLength(5);
  });

  it('B16: max 0 con 3 segmentos → abreviado', () => {
    const b = computeBreadcrumb('A/B/C', 'smart', 0);
    expect(b.kind).toBe('elided');
    expect(breadcrumbText(b)).toBe('A › … › C');
  });

  it('ciclo de estilos', () => {
    expect(nextBreadcrumbStyle('full')).toBe('smart');
    expect(nextBreadcrumbStyle('smart')).toBe('compact');
    expect(nextBreadcrumbStyle('compact')).toBe('full');
  });

  it('B17 (lógica): nota de carpeta preferida; si no, primera directa por nombre', () => {
    expect(folderTargetNote('A/B', ['A/B/z.md', 'A/B/B.md', 'A/B/a.md'])).toBe('A/B/B.md');
    expect(folderTargetNote('A/B', ['A/B/z.md', 'A/B/sub/x.md', 'A/B/a.md'])).toBe('A/B/a.md');
    expect(folderTargetNote('A/B', ['A/B/sub/x.md'])).toBeNull();
    expect(folderTargetNote('', ['n.md', 'A/x.md'])).toBe('n.md');
  });
});
