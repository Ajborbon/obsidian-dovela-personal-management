import { describe, expect, it } from 'vitest';
import { ancestorFolders, insertTask, insertTaskAt, normalizeNotePath, parseHeadingSpec } from '../../src/core/capture/insert';

const T = '- [ ] nueva';
const H = '## Tareas';

describe('insertTask', () => {
  it('archivo nuevo/vacío → encabezado + tarea (v1 dejaba la tarea sin encabezado)', () => {
    expect(insertTask('', H, T)).toBe('## Tareas\n- [ ] nueva\n');
    expect(insertTask('  \n', H, T)).toBe('## Tareas\n- [ ] nueva\n');
  });

  it('al final de la sección, antes del siguiente encabezado del mismo nivel', () => {
    const c = '# Nota\n\n## Tareas\n- [ ] a\n- [ ] b\n\n## Notas\ntexto\n';
    expect(insertTask(c, H, T)).toBe('# Nota\n\n## Tareas\n- [ ] a\n- [ ] b\n- [ ] nueva\n\n## Notas\ntexto\n');
  });

  it('los subencabezados forman parte de la sección', () => {
    const c = '## Tareas\n- [ ] a\n### Sub\n- [ ] s\n## Otra\n';
    expect(insertTask(c, H, T)).toBe('## Tareas\n- [ ] a\n### Sub\n- [ ] s\n- [ ] nueva\n## Otra\n');
  });

  it('se detiene ante un encabezado de nivel superior', () => {
    const c = '## Tareas\n- [ ] a\n# Capítulo\n';
    expect(insertTask(c, H, T)).toBe('## Tareas\n- [ ] a\n- [ ] nueva\n# Capítulo\n');
  });

  it('sección vacía: justo tras el encabezado', () => {
    const c = '## Tareas\n\n## Notas\n';
    expect(insertTask(c, H, T)).toBe('## Tareas\n- [ ] nueva\n\n## Notas\n');
  });

  it('sección al final del archivo, con y sin salto final', () => {
    expect(insertTask('## Tareas\n- [ ] a\n', H, T)).toBe('## Tareas\n- [ ] a\n- [ ] nueva\n');
    expect(insertTask('## Tareas\n- [ ] a', H, T)).toBe('## Tareas\n- [ ] a\n- [ ] nueva\n');
    expect(insertTask('## Tareas\n- [ ] a\n\n\n', H, T)).toBe('## Tareas\n- [ ] a\n- [ ] nueva\n\n\n');
  });

  it('sin encabezado: se añade al final', () => {
    expect(insertTask('# Nota\ntexto\n\n', H, T)).toBe('# Nota\ntexto\n\n## Tareas\n- [ ] nueva\n');
  });

  it('coincidencia exacta preferida; prefijo como respaldo (v1 casaba `## Tareas pendientes`)', () => {
    const c = '## Tareas pendientes\n- [ ] p\n## Tareas\n- [ ] a\n';
    expect(insertTask(c, H, T)).toBe('## Tareas pendientes\n- [ ] p\n## Tareas\n- [ ] a\n- [ ] nueva\n');
    expect(insertTask('## Tareas pendientes\n- [ ] p\n## Otra\n', H, T)).toBe('## Tareas pendientes\n- [ ] p\n- [ ] nueva\n## Otra\n');
    expect(insertTask('## Tareasx\n', H, T)).toBe('## Tareasx\n\n## Tareas\n- [ ] nueva\n');
  });

  it('no confunde `### Tareas` con `## Tareas`', () => {
    expect(insertTask('### Tareas\n- [ ] a\n', H, T)).toBe('### Tareas\n- [ ] a\n\n## Tareas\n- [ ] nueva\n');
  });

  it('ignora encabezados en frontmatter y bloques de código', () => {
    const c = '---\ntitle: x\n---\n```\n## Tareas\n```\n## Tareas\n- [ ] a\n';
    expect(insertTask(c, H, T)).toBe('---\ntitle: x\n---\n```\n## Tareas\n```\n## Tareas\n- [ ] a\n- [ ] nueva\n');
    const fenced = '## Tareas\n- [ ] a\n```\n## Notas\n```\n## Fin\n';
    expect(insertTask(fenced, H, T)).toBe('## Tareas\n- [ ] a\n```\n## Notas\n```\n- [ ] nueva\n## Fin\n');
  });

  it('frontmatter solo', () => {
    expect(insertTask('---\nestado: 🟢\n---\n', H, T)).toBe('---\nestado: 🟢\n---\n\n## Tareas\n- [ ] nueva\n');
  });

  it('sin distinguir mayúsculas y con encabezado configurado sin #', () => {
    expect(insertTask('## TAREAS\n- [ ] a\n', 'Tareas', T)).toBe('## TAREAS\n- [ ] a\n- [ ] nueva\n');
    expect(insertTask('### Acciones\n', '### Acciones', T)).toBe('### Acciones\n- [ ] nueva\n');
  });

  it('conserva CRLF', () => {
    expect(insertTask('## Tareas\r\n- [ ] a\r\n\r\n## B\r\n', H, T)).toBe('## Tareas\r\n- [ ] a\r\n- [ ] nueva\r\n\r\n## B\r\n');
    expect(insertTask('## Tareas\r\n- [ ] a', H, T)).toBe('## Tareas\r\n- [ ] a\r\n- [ ] nueva\r\n');
  });
});

describe('rutas', () => {
  it('parseHeadingSpec', () => {
    expect(parseHeadingSpec('## Tareas')).toEqual({ level: 2, text: 'Tareas', raw: '## Tareas' });
    expect(parseHeadingSpec('Tareas')).toEqual({ level: 2, text: 'Tareas', raw: '## Tareas' });
    expect(parseHeadingSpec('')).toEqual({ level: 2, text: 'Tareas', raw: '## Tareas' });
  });

  it('normalizeNotePath y ancestorFolders', () => {
    expect(normalizeNotePath('/00 - Inbox//Bandeja de entrada')).toBe('00 - Inbox/Bandeja de entrada.md');
    expect(normalizeNotePath('  ')).toBe('00 - Inbox/Bandeja de entrada.md');
    expect(ancestorFolders('a/b/c.md')).toEqual(['a', 'a/b']);
    expect(ancestorFolders('c.md')).toEqual([]);
  });
});

describe('insertTaskAt', () => {
  it('indica la línea donde quedó la tarea', () => {
    const cases: Array<[string, number]> = [
      ['', 1],
      ['# Nota\ntexto\n', 4],
      ['## Tareas\n- [ ] a\n\n## B\n', 2],
      ['## Tareas\n- [ ] a', 2],
    ];
    for (const [c, line] of cases) {
      const r = insertTaskAt(c, '## Tareas', T);
      expect(r.content.split('\n')[r.line]).toBe(T);
      expect(r.line).toBe(line);
    }
  });
});
