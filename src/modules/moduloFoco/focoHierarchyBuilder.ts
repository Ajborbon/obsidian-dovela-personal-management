import type { HierarchicalItem, HierarchicalItemType } from './focoModel.js';

// Define el orden de clasificación para los tipos de item.
const TYPE_ORDER: Record<HierarchicalItemType, number> = {
    'Root': 0, 'GrupoAV': 1, 'AV': 2, 'AI': 3, 'PQ': 4, 'PGTD': 5, 'Cp': 6,
    'EMkt': 7, 'RR': 8, 'Ax': 9, 'Tx': 10, 'Reu': 11, 'Rf': 12, 'Sue': 13, 'Vx': 14,
    'RT': 15, 'RL': 16, 'Dly': 17, 'Wk': 18, 'M': 19, 'Q': 20,
    'H': 21, 'Y': 22
};

function sortChildrenRecursive(item: HierarchicalItem, level: number = 0): void {
    if (!item.children || item.children.length === 0) return;

    item.children.sort((a: HierarchicalItem, b: HierarchicalItem) => {
        // Lógica de ordenamiento específica para el primer nivel (Grupos de Áreas de Vida)
        if (level === 0) {
            return a.name.localeCompare(b.name);
        }

        // Lógica de ordenamiento existente para niveles más profundos
        const typeOrderA = TYPE_ORDER[a.type] ?? 99;
        const typeOrderB = TYPE_ORDER[b.type] ?? 99;
        if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;

        const estadoA = a.frontmatter?.['estado'];
        const estadoB = b.frontmatter?.['estado'];
        if (estadoA && estadoB && estadoA !== estadoB) return (estadoA as string).localeCompare(estadoB as string);

        // Si los nombres son iguales, usar la fecha de creación como desempate final
        if (a.file && b.file) return b.file.stat.ctime - a.file.stat.ctime;

        return a.name.localeCompare(b.name); // Desempate final por nombre
    });

    for (const child of item.children) {
        sortChildrenRecursive(child, level + 1); // Pasar el nivel incrementado
    }
}

function calculateTaskCountsRecursive(item: HierarchicalItem): void {
    if (!item.children || item.children.length === 0) {
        item.descendantTaskCount = 0;
        return;
    }

    let descendantCount = 0;
    for (const child of item.children) {
        calculateTaskCountsRecursive(child);
        descendantCount += child.ownTaskCount + child.descendantTaskCount;
    }
    item.descendantTaskCount = descendantCount;
}

/**
 * Construye la estructura jerárquica a partir de una lista plana de items.
 * @param items - La lista plana de HierarchicalItem (notas y carpetas) generada por el parser.
 * @returns Una lista de los items raíz de la jerarquía.
 */
export function buildHierarchy(items: HierarchicalItem[]): HierarchicalItem[] {
    const noteMap = new Map<string, HierarchicalItem>();
    const hierarchyMap = new Map<string, HierarchicalItem>();
    const allFolderPaths = new Set<string>();

    // 1. Map all notes by their path and collect all unique folder paths.
    for (const item of items) {
        if (!item.file) continue;
        const pathWithoutExt = item.file.path.replace(/\.md$/, '');
        noteMap.set(pathWithoutExt, item);

        const pathParts = pathWithoutExt.split('/');
        if (pathParts.length > 1) {
            for (let i = pathParts.length - 1; i > 0; i--) {
                allFolderPaths.add(pathParts.slice(0, i).join('/'));
            }
        }
    }

    // 2. Fusion Step: Populate hierarchyMap with folder notes or placeholders.
    for (const folderPath of allFolderPaths) {
        if (hierarchyMap.has(folderPath)) continue;

        const folderName = folderPath.split('/').pop() || '';
        const folderNotePath = `${folderPath}/${folderName}`;
        const folderNote = noteMap.get(folderNotePath);

        if (folderNote) {
            // Fusion: This folder has a dedicated note. Use it.
            hierarchyMap.set(folderPath, folderNote);
        } else {
            // No folder note. Create a placeholder.
            const placeholder: HierarchicalItem = {
                id: folderPath,
                type: 'Ax', // Default type
                name: `[FALTA] ${folderName}`,
                children: [],
                tasks: [],
                ownTaskCount: 0,
                descendantTaskCount: 0,
                frontmatter: {},
                isNoteMissing: true,
            };
            hierarchyMap.set(folderPath, placeholder);
        }
    }

    // 3. Add all remaining non-folder-notes to the hierarchyMap.
    for (const [path, note] of noteMap.entries()) {
        // Check if the note is already in the hierarchyMap as a value (it would be a folder note).
        // A simple way is to check if its path is a key in the hierarchyMap. If it is, it's a folder note.
        if (!hierarchyMap.has(path)) {
             // It's a regular note, not a folder note that has been used for a folder path key
            const isFolderNote = (note.file && hierarchyMap.get(note.file.path.split('/').slice(0, -1).join('/')) === note);
            if (!isFolderNote) {
                hierarchyMap.set(path, note);
            }
        }
    }

    // 4. Link items to their parents.
    for (const [key, item] of hierarchyMap.entries()) {
        const pathParts = key.split('/');
        if (pathParts.length <= 1) continue; // Root level entity

        pathParts.pop();
        const parentKey = pathParts.join('/');
        const parent = hierarchyMap.get(parentKey);

        if (parent && parent !== item) {
            parent.children.push(item);
            item.parent = parent;
        }
    }

    // 5. Identify the true root items.
    const roots = [...hierarchyMap.values()].filter(item => !item.parent);

    // 6. Create a virtual root to contain all top-level items.
    const virtualRoot: HierarchicalItem = {
        id: 'root',
        type: 'Root',
        name: 'Vault',
        children: roots,
        tasks: [],
        ownTaskCount: 0,
        descendantTaskCount: 0,
        frontmatter: {},
    };

    for (const root of roots) {
        root.parent = virtualRoot;
    }

    // 7. Perform final calculations and sorting.
    calculateTaskCountsRecursive(virtualRoot);
    sortChildrenRecursive(virtualRoot, 0);

    return [virtualRoot];
}