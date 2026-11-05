/** Mantiene sincronizados los resultados esperados de docs/v2/guia/journal-weekly.md (§0 datos de prueba). */
import { describe, expect, it } from 'vitest';
import { classifyDay, dayCounts, dayGroups } from '../../src/core/journal/daily';
import { classifyWeek, weekGroups } from '../../src/core/journal/weekly';
import type { Task } from '../../src/core/tasks/model';
import { parseTasksInNote } from '../../src/core/tasks/parse';

const NOTE = `## Tareas
- [ ] A 📅 2025-10-24 [hI:: 10:00]
- [ ] A2 📅 2025-10-24 [hI:: 9:00]
- [ ] B ⏳ 2025-10-24
- [ ] C 🛫 2025-10-24
- [ ] D 📅 2025-10-23 [[Nota enlazada J]]
- [ ] E 🛫 2025-10-01
- [ ] F 📅 2025-10-23 [hI:: 08:00]
- [ ] G 📅 2025-10-25
- [/] H
- [ ] I [w::[[2025-W43]]]
- [ ] J [w::[[2025-W42]]]
- [ ] K [w::[[2025-W44]]]
- [ ] L [w::[[2025-W43]]] 📅 2025-10-10
- [/] M [w::[[2025-W43]]]
- [ ] N ⛔ x 📅 2025-10-24
- [ ] O ⛔ x
- [ ] P ⛔ ^y 📅 2025-10-24
- [ ] P2 ⛔ noexiste 📅 2025-10-24
- [x] Q ✅ 2025-10-24
- [x] R
- [x] S ✅ 2025-10-23
- [ ] W ⏫ 📅 2025-10-22
- [ ] X 🆔 x
- [x] Y 🆔 y ✅ 2025-10-20
- [-] Z 📅 2025-10-24
- [ ] K4 📅 2025-10-26
- [ ] K6 📅 2025-10-19
- [ ] K7 🛫 2025-10-19
- [ ] K8 ⏳ 2025-10-27
- [x] K9 ✅ 2025-10-22`;

const all = parseTasksInNote(NOTE, 'Pruebas/Journal tareas.md');
const names = (ts: readonly Task[]): string => ts.map((t) => t.text.split(' ')[0]).join(',');

describe('guía journal-weekly: datos de prueba', () => {
  it('vista diaria 2025-10-24', () => {
    const c = classifyDay(all, '2025-10-24');
    expect(dayGroups(c).map((g) => `${g.title}: ${names(g.tasks)}`)).toEqual([
      '⏰ Calendario del Día (2): A2,A',
      '📅⏳🛫 Programadas para Hoy (4): P,P2,B,C',
      '📊 Tareas para esta Semana (2): I,L',
      '🔥📊 Tareas de Semanas Anteriores (1): J',
      '🔄 En Progreso (2): H,M',
      '🔥 Vencidas a Hoy (6): E,K6,K7,W,D,F',
      '⛔ Bloqueadas por Dependencias (1): N',
      '✅ Completadas Hoy (1): Q',
    ]);
    expect(dayCounts(c)).toEqual({ calendar: 2, programmed: 4, overdue: 6, inProgress: 2, blocked: 1, completed: 1, weekly: 2, weeklyOverdue: 1 });
    const crit = dayGroups(c, { showOnlyCritical: true }).find((g) => g.id === 'overdue');
    expect([crit?.title, crit?.note]).toEqual(['🔥 Vencidas a Hoy (1)', '5 vencidas sin prioridad 🔺/⏫ ocultas (solo críticas)']);
    const byWeek = dayGroups(c, { groupOverdueByWeek: true }).find((g) => g.id === 'overdue');
    expect(byWeek?.subgroups?.map((s) => `${s.title}: ${names(s.tasks)}`)).toEqual(['📊 2025-W40 (1): E', '📊 2025-W42 (2): K6,K7', '📊 2025-W43 (3): W,D,F']);
    expect(dayGroups(c, { showOverdueLimit: 2 }).find((g) => g.id === 'overdue')?.hidden).toBe(4);
  });

  it('vista semanal 2025-W43', () => {
    const g = weekGroups(classifyWeek(all, '2025-W43'), { showOverdueLimit: 10 }, '2026-11-05');
    expect(g.map((x) => `${x.title}: ${names(x.tasks)}`)).toEqual([
      '📊 Tareas Semanales (3): I,L,M', // Weekly no distingue [/] (como v1)
      '🔥 Tareas Vencidas por Fecha (1): K6',
      '📅 Tareas por Día: ',
      '🔥 Tareas Vencidas de Semanas Anteriores (1): J',
      '✅ Completadas esta Semana (4): Y,K9,S,Q',
    ]);
    expect(g[2]?.subgroups?.map((s) => `${s.title}: ${names(s.tasks)}`)).toEqual([
      'Miércoles 22: W', 'Jueves 23: F,D', 'Viernes 24: A2,A,N,P,P2,B,C', 'Sábado 25: G', 'Domingo 26: K4',
    ]);
  });
});
