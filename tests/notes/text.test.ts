import { describe, expect, it } from 'vitest';
import { folderChain, folderName, inboxFolder, joinPath, notePath, parentFolder } from '../../src/core/notes/folders';
import { fm, renderFrontmatter } from '../../src/core/notes/frontmatter';
import { btxTitle, captureTitle, commitTitle, containerTitle, datedTitle, sanitizeName } from '../../src/core/notes/naming';
import { insertChildLink } from '../../src/core/notes/parentLink';
import { hasTemplaterCode, interpolate, renderOverrideBody, stripFrontmatter } from '../../src/core/notes/templateText';

describe('interpolación sin código', () => {
  it('solo sustituye variables conocidas; deja intacto lo demás', () => {
    expect(interpolate('# {{titulo}} ({{fecha}}) {{otra}} {{año}}', { titulo: 'T', fecha: '2025-11-05', año: '2025' }))
      .toBe('# T (2025-11-05) {{otra}} 2025');
    expect(interpolate('style={{ a: 1 }} <% tp.date.now() %>', { a: 'x' })).toBe('style={{ a: 1 }} <% tp.date.now() %>');
  });
  it('personalización: quita frontmatter, interpola y avisa si hay código Templater', () => {
    const r = renderOverrideBody('---\ntype: Ax\n---\n# {{titulo}}\n<% tp.file.title %>\n', { titulo: 'Hola' });
    expect(r).toEqual({ body: '# Hola\n<% tp.file.title %>\n', hasCode: true });
    expect(hasTemplaterCode('sin código {{titulo}}')).toBe(false);
    expect(stripFrontmatter('﻿---\r\na: 1\r\n---\r\ncuerpo')).toBe('cuerpo');
    expect(stripFrontmatter('sin frontmatter')).toBe('sin frontmatter');
  });
});

describe('frontmatter exacto', () => {
  it('distingue `key:` y `key: `, listas, comillas y líneas en blanco', () => {
    expect(renderFrontmatter([
      fm.value('type', 'Ax'), fm.empty('tags'), fm.value('monto', ''), fm.origen(null), fm.origen('Padre "x"'),
      fm.blank(), fm.list('participantes', []), fm.list('tags', ['suenos']), fm.link('mes', '2025-08'),
    ])).toBe('---\ntype: Ax\ntags:\nmonto: \norigen: ""\norigen: "[[Padre \\"x\\"]]"\n\nparticipantes:\n  - \ntags:\n  - suenos\nmes: "[[2025-08]]"\n---\n');
  });
});

describe('nomenclatura', () => {
  it('títulos por tipo', () => {
    expect(datedTitle('Ax', '2025-11-05', 'Idea')).toBe('Ax 251105 - Idea');
    expect(commitTitle('2025-11-05', '09:07', 'fix')).toBe('Cmt 251105 0907 - fix');
    expect(captureTitle('Ref', '2025-11-05', '09:07', 'Sin título')).toBe('Ref 251105-0907 - Sin título');
    expect(containerTitle('AV', ' Salud ')).toBe('AV - Salud');
    expect(btxTitle('2025-11-05', '01', 'x'.repeat(70))).toBe(`Btx 251105 - Sesión 01 - ${'x'.repeat(50)}`);
  });
  it('saneo', () => {
    expect(sanitizeName(' a:b / c\\d<e>f|g"h?i*j ')).toBe('a-b cdefghij');
    expect(sanitizeName('línea\nnueva')).toBe('línea nueva');
  });
});

describe('rutas', () => {
  it('helpers', () => {
    expect(joinPath('', 'a/', '/b')).toBe('a/b');
    expect(parentFolder('a/b/c.md')).toBe('a/b');
    expect(parentFolder('c.md')).toBe('');
    expect(folderName('a/AV - X')).toBe('AV - X');
    expect(notePath('', 'X')).toBe('X.md');
    expect(folderChain('a/b/c')).toEqual(['a', 'a/b', 'a/b/c']);
    expect(folderChain('')).toEqual([]);
    expect(inboxFolder('00 - Inbox/Bandeja de entrada.md')).toBe('00 - Inbox');
    expect(inboxFolder('Entrada')).toBe('Entrada');
    expect(inboxFolder('')).toBe('00 - Inbox');
  });
});

describe('enlace al hijo en el padre (editor no activo)', () => {
  const pgtd = '---\ntype: PGTD\n---\n\n## Descripción\n\n\n## Historial\n\n\n## Recursos\n';
  it('al final de ## Historial', () => {
    const once = insertChildLink(pgtd, '[[a|a]]');
    expect(once).toBe('---\ntype: PGTD\n---\n\n## Descripción\n\n\n## Historial\n[[a|a]]\n\n\n## Recursos\n');
    expect(insertChildLink(once, '- [[b]] — 2025-11-05 | d\n')).toContain('## Historial\n[[a|a]]\n- [[b]] — 2025-11-05 | d\n\n\n## Recursos');
  });
  it('sin sección: al final de la nota; ignora encabezados dentro de bloques de código', () => {
    expect(insertChildLink('texto', '[[a]]')).toBe('texto\n[[a]]\n');
    expect(insertChildLink('texto\n', '[[a]]')).toBe('texto\n[[a]]\n');
    expect(insertChildLink('', '[[a]]')).toBe('[[a]]\n');
    const withCode = '## Historial\n- x\n```\n## no\n```\n### sub\n- y\n## Otra\n';
    expect(insertChildLink(withCode, '[[a]]')).toBe('## Historial\n- x\n```\n## no\n```\n### sub\n- y\n[[a]]\n## Otra\n');
  });
});
