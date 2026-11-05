import { describe, expect, it } from 'vitest';
import { appendEmptyTask } from '../../src/core/panels/addTask';

describe('appendEmptyTask', () => {
  it('al final de la sección, antes de las líneas en blanco y del siguiente encabezado', () => {
    const r = appendEmptyTask('# P\n## Tareas\n- [ ] a\n- [x] b\n\n## Notas\ntexto\n');
    expect(r.content).toBe('# P\n## Tareas\n- [ ] a\n- [x] b\n- [ ] \n\n## Notas\ntexto\n');
    expect(r.line).toBe(4);
    expect(r.ch).toBe(6);
    expect(r.createdHeading).toBe(false);
  });

  it('sección vacía al final del archivo (con y sin salto final)', () => {
    expect(appendEmptyTask('## Tareas\n').content).toBe('## Tareas\n- [ ] \n');
    const r = appendEmptyTask('x\n## Tareas');
    expect(r.content).toBe('x\n## Tareas\n- [ ] ');
    expect(r.line).toBe(2);
  });

  it('subsecciones (###) forman parte de la sección', () => {
    const r = appendEmptyTask('## Tareas\n### Fase 1\n- [ ] a\n## Otra\n');
    expect(r.content).toBe('## Tareas\n### Fase 1\n- [ ] a\n- [ ] \n## Otra\n');
  });

  it('crea la sección al final si falta', () => {
    const r = appendEmptyTask('---\nestado: 🟢\n---\n# Proyecto\nTexto\n');
    expect(r.content).toBe('---\nestado: 🟢\n---\n# Proyecto\nTexto\n\n## Tareas\n- [ ] \n');
    expect(r.line).toBe(7);
    expect(r.createdHeading).toBe(true);
    expect(appendEmptyTask('').content).toBe('## Tareas\n- [ ] \n');
    expect(appendEmptyTask('Texto\n\n\n').content).toBe('Texto\n\n## Tareas\n- [ ] \n');
  });

  it('ignora encabezados en bloques de código y frontmatter', () => {
    const r = appendEmptyTask('```\n## Tareas\n```\nfin');
    expect(r.createdHeading).toBe(true);
    expect(r.content).toBe('```\n## Tareas\n```\nfin\n\n## Tareas\n- [ ] \n');
  });

  it('conserva CRLF y encabezado configurable', () => {
    const r = appendEmptyTask('## Acciones\r\n- [ ] a\r\n', '## Acciones');
    expect(r.content).toBe('## Acciones\r\n- [ ] a\r\n- [ ] \r\n');
    expect(appendEmptyTask('## tareas  \n').content).toBe('## tareas  \n- [ ] \n');
  });
});
