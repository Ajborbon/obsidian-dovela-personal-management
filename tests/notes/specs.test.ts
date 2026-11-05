/**
 * Especificaciones de tipos de nota: la nota generada (frontmatter + cuerpo) debe ser IDÉNTICA a la que
 * produce la plantilla Templater real con las mismas respuestas; además nombres, carpetas y enlaces.
 */
import { describe, expect, it } from 'vitest';
import { getNoteSpec, NOTE_SPECS, nextStep, NotePlanError, type Answers, type NoteEnv, type NotePlan, type NoteTypeSpec } from '../../src/core/notes/specs';
import { readTemplate, renderTemplater, splitFm } from './templater';

const ORIGEN = 'enlaceOrigen ? `"${enlaceOrigen}"` : \'""\'';
const PARENT_FOLDER = '01 - Productividad/AV - Negocios/PGTD 251001 - Proyecto X';

function env(opts: { parent?: boolean; existing?: string[]; folder?: string } = {}): NoteEnv {
  const folder = opts.folder ?? PARENT_FOLDER;
  const name = folder.slice(folder.lastIndexOf('/') + 1);
  const existing = new Set(opts.existing ?? []);
  return {
    date: '2025-11-05',
    time: '14:30',
    parent: opts.parent === false ? null : { path: `${folder}/${name}.md`, basename: name, folder },
    contextFolder: 'Carpeta del explorador',
    inboxFolder: '00 - Inbox',
    exists: (p) => existing.has(p),
  };
}

/** Recorre el flujo de preguntas como la UI; devuelve los ids preguntados y el plan. */
function walk(spec: NoteTypeSpec, e: NoteEnv, given: Record<string, string>): { asked: string[]; plan: NotePlan } {
  const answers: Record<string, string> = {};
  const asked: string[] = [];
  for (let s = nextStep(spec, e, answers); s; s = nextStep(spec, e, answers)) {
    asked.push(s.id);
    const v = given[s.id] ?? (s.kind === 'text' ? s.defaultValue : undefined);
    if (v === undefined) throw new Error(`Falta respuesta para ${s.id}`);
    if (s.kind === 'choice') expect(s.options.map((o) => o.value)).toContain(v);
    answers[s.id] = v;
  }
  return { asked, plan: spec.plan(e, answers as Answers) };
}

function spec(id: string): NoteTypeSpec {
  const s = getNoteSpec(id);
  if (!s) throw new Error(id);
  return s;
}

function exprs(plan: NotePlan, e: NoteEnv, extra: Record<string, string> = {}): Record<string, string> {
  const p = e.parent?.basename;
  return {
    tipo: plan.vars['tipo'] ?? '',
    fechaISO: e.date,
    nuevoTitulo: plan.title,
    [ORIGEN]: p ? `"[[${p}]]"` : '""',
    'enlaceOrigen || \'""\'': p ? `"[[${p}]]"` : '""',
    'enlaceOrigen ? `origen:: ${enlaceOrigen}` : ""': p ? `origen:: [[${p}]]` : '',
    fechaHoraISO: `${e.date} ${e.time}`,
    modalidad: 'virtual',
    ...extra,
  };
}

/** Réplica literal del cálculo de participantes de `Plt - Reunión.md`. */
function v1ParticipantsYaml(raw: string): string {
  const ps = raw.split(',').map((p) => p.trim()).filter(Boolean)
    .map((p) => p.replace(/^\[\[/, '').replace(/\]\]$/, '').replace(/^#/, '').trim());
  return ps.length ? ps.map((p) => `  - "${p.replace(/"/g, '\\"')}"`).join('\n') : '  - ';
}

describe('22 tipos: 17 especificaciones de creación', () => {
  it('ids únicos y plantilla de origen existente', () => {
    expect(NOTE_SPECS.map((s) => s.id)).toEqual(['Ax', 'Btx', 'PGTD', 'Tx', 'Reu', 'Cmt', 'Ref', 'Sue', 'Vx', 'Podx', 'Prx', 'AV', 'AI', 'RR', 'RR-Tx', 'RR-Btx', 'RC']);
    for (const s of NOTE_SPECS) expect(() => readTemplate(s.template)).not.toThrow();
  });
});

describe('contenido idéntico a la plantilla real', () => {
  const simple: [string, string][] = [
    ['Ax', 'Plt - Anotacion.md'], ['Podx', 'Plt - Podcast.md'], ['Prx', 'Plt - Prompt.md'], ['Tx', 'Plt - Transacción.md'], ['Vx', 'Plt - Video.md'],
  ];
  for (const [id, tpl] of simple) {
    for (const withParent of [true, false]) {
      it(`${id} ${withParent ? 'con' : 'sin'} nota padre`, () => {
        const e = env({ parent: withParent });
        const { plan } = walk(spec(id), e, { nombre: 'Mi nota de prueba', destino: 'misma' });
        expect(plan.content).toBe(renderTemplater(readTemplate(tpl), { exprs: exprs(plan, e) }));
      });
    }
  }

  it('Btx', () => {
    const e = env();
    const { plan } = walk(spec('Btx'), e, { sesion: '03', descripcion: 'Motor de notas' });
    expect(plan.content).toBe(renderTemplater(readTemplate('Plt - Bitacora.md'), { exprs: exprs(plan, e) }));
  });

  for (const withParent of [true, false]) {
    it(`Cmt ${withParent ? 'con' : 'sin'} padre (origen:: en el cuerpo)`, () => {
      const e = env({ parent: withParent });
      const { plan } = walk(spec('Cmt'), e, { nombre: 'feat notas', hash: 'abc1234', destino: 'misma' });
      expect(plan.content).toBe(renderTemplater(readTemplate('Plt - Commit.md'), { exprs: exprs(plan, e, { commitHash: 'abc1234' }) }));
    });
  }

  for (const [id, tpl] of [['Ref', 'Plt - Reflexión.md'], ['Sue', 'Plt - Sueño.md']] as const) {
    for (const capture of [false, true]) {
      for (const withParent of [true, false]) {
        it(`${id} ${capture ? 'captura' : 'nombrada'} ${withParent ? 'con' : 'sin'} padre`, () => {
          const e = env({ parent: withParent });
          const { plan } = walk(spec(id), e, { modo: capture ? 'b' : 'a', nombre: 'Algo importante', destino: 'misma' });
          const expected = renderTemplater(readTemplate(tpl), {
            exprs: exprs(plan, e, { 'esCaptura ? "🟡" : "🟢"': capture ? '🟡' : '🟢' }), flags: { esCaptura: capture },
          });
          expect(plan.content).toBe(expected);
        });
      }
    }
  }

  for (const capture of [false, true]) {
    for (const parts of ['', 'Ana, [[Luis Pérez]], #Bob, Juan "JJ"']) {
      it(`Reu ${capture ? 'con' : 'sin'} grabación, participantes "${parts}"`, () => {
        const e = env();
        const { plan } = walk(spec('Reu'), e, {
          modo: capture ? 'con_grabacion' : 'sin_grabacion', nombre: 'Kickoff', hora_inicio: '09:00', hora_fin: '',
          participantes: parts, destino: 'misma',
        });
        const expected = renderTemplater(readTemplate('Plt - Reunión.md'), {
          exprs: exprs(plan, e, { horaInicio: '09:00', horaFin: '14:30', participantesYaml: v1ParticipantsYaml(parts) }),
          flags: { esCaptura: capture },
        });
        expect(plan.content).toBe(expected);
      });
    }
  }

  const containers: [string, string][] = [
    ['PGTD', 'Plt - PGTD Fecha.md'], ['AV', 'Plt - Area Vida.md'], ['AI', 'Plt - Area Interes.md'], ['RR', 'Plt - Recurso Recurrente.md'],
    ['RR-Tx', 'Plt - Recurso Recurrente Transacciones.md'], ['RC', 'Plt - Registro Commits.md'],
  ];
  for (const [id, tpl] of containers) {
    for (const withParent of [true, false]) {
      it(`${id} ${withParent ? 'con' : 'sin'} padre`, () => {
        const e = env({ parent: withParent, folder: '01 - Productividad' });
        const { plan } = walk(spec(id), e, { inbox: 'no', modo: 'folder', nombre: 'Nuevo' });
        expect(plan.content).toBe(renderTemplater(readTemplate(tpl), { exprs: exprs(plan, e) }));
      });
    }
  }

  it('RR-Btx: mismo cuerpo; frontmatter válido (la plantilla empezaba con `---\\n---\\n`)', () => {
    const e = env();
    const { asked, plan } = walk(spec('RR-Btx'), e, {});
    expect(asked).toEqual([]);
    const v1 = renderTemplater(readTemplate('Plt - Recurso Recurrente Bitacoras.md'), { exprs: exprs(plan, e) });
    expect(v1.startsWith('---\n---\n')).toBe(true);
    expect(plan.content).toBe(v1.slice(4));
    expect(splitFm(plan.content).fm).toBe('---\ntype: RR\nestado: 🟢\norigen: "[[PGTD 251001 - Proyecto X]]"\ntags:\n  - "#cx-SesionesTrabajo"\n---\n');
  });
});

describe('nombres, destino y enlace en el padre', () => {
  it('Ax: misma carpeta → enlace [[t|t]]; Inbox → sin enlace; sin padre → carpeta del contexto', () => {
    const same = walk(spec('Ax'), env(), { nombre: '  Idea  nueva ', destino: 'misma' }).plan;
    expect(same.title).toBe('Ax 251105 - Idea nueva');
    expect(same.path).toBe(`${PARENT_FOLDER}/Ax 251105 - Idea nueva.md`);
    expect(same.parentLink).toBe('[[Ax 251105 - Idea nueva|Ax 251105 - Idea nueva]]');
    const inbox = walk(spec('Ax'), env(), { nombre: 'Idea', destino: 'inbox' }).plan;
    expect(inbox.path).toBe('00 - Inbox/Ax 251105 - Idea.md');
    expect(inbox.parentLink).toBeNull();
    expect(inbox.frontmatter).toContain('origen: "[[PGTD 251001 - Proyecto X]]"');
    const { asked, plan } = walk(spec('Ax'), env({ parent: false }), { nombre: 'Idea' });
    expect(asked).toEqual(['nombre']);
    expect(plan.path).toBe('Carpeta del explorador/Ax 251105 - Idea.md');
    expect(plan.frontmatter).toContain('origen: ""');
  });

  it('saneo de nombre (: → -, se quitan / \\ < > | " ? *)', () => {
    const p = walk(spec('Cmt'), env(), { nombre: 'fix: a/b\\c <d> |e| "f"? *g*', hash: '', destino: 'misma' }).plan;
    expect(p.title).toBe('Cmt 251105 1430 - fix- abc d e f g');
    expect(p.frontmatter).toContain('\ncommit: \n');
    const ax = walk(spec('Ax'), env(), { nombre: 'Nota: parte 1/2', destino: 'misma' }).plan;
    expect(ax.title).toBe('Ax 251105 - Nota- parte 12');
  });

  it('nombre vacío o solo caracteres inválidos → NotePlanError (no se crea nada)', () => {
    const s = spec('Ax');
    expect(() => s.plan(env(), { nombre: '   ', destino: 'misma' })).toThrow(NotePlanError);
    expect(() => s.plan(env(), { nombre: '???', destino: 'misma' })).toThrow('el nombre no puede estar vacío');
  });

  it('Btx: descripción ≤ 50, título ≤ 80, enlace con fecha y descripción, siempre en la carpeta del padre', () => {
    const long = 'Implementación completa del motor de notas propio con especificaciones declarativas';
    const p = walk(spec('Btx'), env(), { sesion: '12', descripcion: long }).plan;
    expect(p.title.length).toBeLessThanOrEqual(80);
    expect(p.title).toBe(`Btx 251105 - Sesión 12 - ${long.slice(0, 50).trim()}`);
    expect(p.folder).toBe(PARENT_FOLDER);
    expect(p.parentLink).toBe(`- [[${p.title}]] — 2025-11-05 | ${long.slice(0, 50).trim()}\n`);
    const huge = walk(spec('Btx'), env(), { sesion: '123456789012345678901234567', descripcion: long }).plan;
    expect(huge.title.length).toBeLessThanOrEqual(80);
    expect(walk(spec('Btx'), env(), { descripcion: 'x' }).plan.title).toBe('Btx 251105 - Sesión 01 - x');
  });

  it('Ref/Sue captura: nombre con hora, Bandeja de Entrada, estado 🟡, sin enlace en el padre', () => {
    const r = walk(spec('Ref'), env(), { modo: 'b' });
    expect(r.asked).toEqual(['modo']);
    expect(r.plan.path).toBe('00 - Inbox/Ref 251105-1430 - Sin título.md');
    expect(r.plan.frontmatter).toContain('fechaHora: 2025-11-05 14:30\n');
    expect(r.plan.frontmatter).toContain('estado: 🟡');
    expect(r.plan.parentLink).toBeNull();
    expect(walk(spec('Sue'), env(), { modo: 'b' }).plan.title).toBe('Sue 251105-1430 - Sueño sin título');
  });

  it('Reu: con grabación sin nombre → captura con hora; “Dejar aquí” → carpeta del contexto', () => {
    const cap = walk(spec('Reu'), env({ parent: false }), { modo: 'con_grabacion', nombre: '', participantes: '' });
    expect(cap.plan.path).toBe('00 - Inbox/Reu 251105-1430 - Sin título.md');
    expect(cap.plan.frontmatter).toContain('hora_inicio: 14:30\nhora_fin: 14:30\n');
    expect(cap.plan.frontmatter).toContain('participantes:\n  - \n');
    const aqui = walk(spec('Reu'), env(), { modo: 'sin_grabacion', nombre: 'Comité', participantes: '', destino: 'aqui' });
    expect(aqui.plan.path).toBe('Carpeta del explorador/Reu 251105 - Comité.md');
    expect(aqui.asked).toEqual(['modo', 'nombre', 'hora_inicio', 'hora_fin', 'participantes', 'destino']);
    expect(() => spec('Reu').plan(env(), { modo: 'sin_grabacion', nombre: '' })).toThrow(NotePlanError);
  });
});

describe('reglas de carpeta de contenedores (RI-E §5.5)', () => {
  it('PGTD nuevo con carpeta propia: base/Título/Título.md y enlace [[ruta|Título]]', () => {
    const { asked, plan } = walk(spec('PGTD'), env({ folder: '01 - Productividad/AV - Negocios' }), { inbox: 'no', modo: 'folder', nombre: 'Lanzamiento' });
    expect(asked).toEqual(['inbox', 'modo', 'nombre']);
    expect(plan.path).toBe('01 - Productividad/AV - Negocios/PGTD 251105 - Lanzamiento/PGTD 251105 - Lanzamiento.md');
    expect(plan.parentLink).toBe('[[01 - Productividad/AV - Negocios/PGTD 251105 - Lanzamiento/PGTD 251105 - Lanzamiento|PGTD 251105 - Lanzamiento]]');
    const file = walk(spec('PGTD'), env({ folder: '01 - Productividad' }), { inbox: 'no', modo: 'file', nombre: 'Suelto' }).plan;
    expect(file.path).toBe('01 - Productividad/PGTD 251105 - Suelto.md');
  });

  it('PGTD dentro de una carpeta PGTD sin nota índice → ofrece crear la principal', () => {
    const e = env({ folder: '01 - Productividad/PGTD 251001 - Proyecto X', parent: false });
    const e2: NoteEnv = { ...e, contextFolder: '01 - Productividad/PGTD 251001 - Proyecto X' };
    const main = walk(spec('PGTD'), e2, { inbox: 'no', principal: 'si' });
    expect(main.asked).toEqual(['inbox', 'principal']);
    expect(main.plan.path).toBe('01 - Productividad/PGTD 251001 - Proyecto X/PGTD 251001 - Proyecto X.md');
    const step = spec('PGTD').steps(e2, { inbox: 'no' }).find((s) => s.id === 'principal');
    expect(step?.kind === 'choice' && step.options[0]?.label).toBe('Sí, crear el proyecto principal "Proyecto X"');
    const sub = walk(spec('PGTD'), e2, { inbox: 'no', principal: 'no', modo: 'file', nombre: 'Fase 2' });
    expect(sub.asked).toEqual(['inbox', 'principal', 'modo', 'nombre']);
    expect(sub.plan.path).toBe('01 - Productividad/PGTD 251001 - Proyecto X/PGTD 251105 - Fase 2.md');
  });

  it('carpeta del tipo con nota índice existente → directamente sub-ítem', () => {
    const folder = '03 - Gestion Personal/AV - Gerente de Vida';
    const e = env({ folder, existing: [`${folder}/AV - Gerente de Vida.md`] });
    const { asked, plan } = walk(spec('AV'), e, { inbox: 'no', modo: 'folder', nombre: 'Salud' });
    expect(asked).toEqual(['inbox', 'modo', 'nombre']);
    expect(spec('AV').steps(e, { inbox: 'no' }).find((s) => s.id === 'modo')?.prompt).toBe('¿Cómo deseas crear el nuevo sub-item AV?');
    expect(plan.path).toBe(`${folder}/AV - Salud/AV - Salud.md`);
  });

  it('Bandeja de Entrada sustituye la carpeta base', () => {
    const p = walk(spec('RR'), env(), { inbox: 'si', modo: 'folder', nombre: 'Pagos' }).plan;
    expect(p.path).toBe('00 - Inbox/RR - Pagos/RR - Pagos.md');
    const ai = walk(spec('AI'), env(), { inbox: 'si', modo: 'file', nombre: 'Trading' }).plan;
    expect(ai.path).toBe('00 - Inbox/AI - Trading.md');
  });

  it('RC sin origen; raíz del vault', () => {
    const p = walk(spec('RC'), env({ parent: false }), { inbox: 'no', modo: 'file', nombre: 'Dovela' });
    const root: NoteEnv = { ...env({ parent: false }), contextFolder: '' };
    expect(p.plan.frontmatter).toBe('---\ntype: RC\nestado: 🟢\ntags:\n---\n');
    expect(walk(spec('RC'), root, { inbox: 'no', modo: 'folder', nombre: 'Dovela' }).plan.path).toBe('RC - Dovela/RC - Dovela.md');
  });

  it('RR - Sesiones de trabajo: carpeta fija en la carpeta del padre', () => {
    const p = walk(spec('RR-Btx'), env(), {}).plan;
    expect(p.path).toBe(`${PARENT_FOLDER}/RR - Sesiones de trabajo/RR - Sesiones de trabajo.md`);
    expect(p.parentLink).toBe(`- [[${PARENT_FOLDER}/RR - Sesiones de trabajo/RR - Sesiones de trabajo|RR - Sesiones de trabajo]] — Repositorio de sesiones de trabajo del proyecto.\n`);
  });
});
