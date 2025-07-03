import type { HierarchicalItem, HierarchicalItemType } from './model.js';

// Define el orden de clasificación para los tipos de item.
const TYPE_ORDER: Record<HierarchicalItemType, number> = {
    'Root': 0, 'Group': 1, 'AV': 2, 'AI': 3, 'PQ': 4, 'PGTD': 5, 'Cp': 6,
    'EMkt': 7, 'Ax': 8, 'Tx': 9, 'Reu': 10, 'Rf': 11, 'Sue': 12, 'Vx': 13,
    'RR': 14, 'RT': 15, 'RL': 16, 'Dly': 17, 'Wk': 18, 'M': 19, 'Q': 20,
    'H': 21, 'Y': 22
};

function sortChildrenRecursive(item: HierarchicalItem): void {
    if (!item.children || item.children.length === 0) return;

    item.children.sort((a: HierarchicalItem, b: HierarchicalItem) => {
        const typeOrderA = TYPE_ORDER[a.type] ?? 99;
        const typeOrderB = TYPE_ORDER[b.type] ?? 99;
        if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;

        const estadoA = a.frontmatter?.['estado'];
        const estadoB = b.frontmatter?.['estado'];
        if (estadoA && estadoB && estadoA !== estadoB) return (estadoA as string).localeCompare(estadoB as string);

        if (a.file && b.file) return b.file.stat.ctime - a.file.stat.ctime;

        return a.name.localeCompare(b.name);
    });

    for (const child of item.children) {
        sortChildrenRecursive(child);
    }
}

function calculateTaskCountsRecursive(item: HierarchicalItem): void {
    let totalTasks = item.tasks.length;
    if (item.children && item.children.length > 0) {
        for (const child of item.children) {
            calculateTaskCountsRecursive(child);
            totalTasks += child.totalTaskCount;
        }
    }
    item.totalTaskCount = totalTasks;
}

/**
 * Construye la estructura jerárquica a partir de una lista plana de items.
 * @param items - La lista plana de HierarchicalItem (notas y carpetas) generada por el parser.
 * @returns Una lista de los items raíz de la jerarquía.
 */
export function buildHierarchy(items: HierarchicalItem[]): HierarchicalItem[] {
    const itemMap = new Map<string, HierarchicalItem>();
    for (const item of items) {
        itemMap.set(item.id, item);
    }

    // 1. Iterar sobre todos los items para establecer las relaciones padre-hijo.
    for (const item of items) {
        const pathParts = item.id.split('/');
        pathParts.pop(); // Obtener la ruta de la carpeta contenedora.
        const parentPath = pathParts.join('/');

        if (!parentPath) continue; // Este item está en la raíz, no puede tener padre.

        // Un padre puede ser una nota (ej. `AV - ... .md`) o una carpeta de grupo (ej. `01 - Productividad`).
        // Se busca primero una nota padre, y si no, una carpeta padre.
        const parent = itemMap.get(parentPath + '.md') ?? itemMap.get(parentPath);

        if (parent && parent.id !== item.id) {
            parent.children.push(item);
            item.parent = parent;
        }
    }

    // 2. Los verdaderos nodos raíz son aquellos que no tienen padre después del proceso.
    const roots = items.filter(item => !item.parent);

    // 3. Post-procesamiento del árbol (cálculos y ordenación).
    for (const root of roots) {
        calculateTaskCountsRecursive(root);
        sortChildrenRecursive(root);
    }

    return roots;
}