import type { HierarchicalItem, HierarchicalItemType } from './model.js';

// Define el orden de clasificación para los tipos de item.
const TYPE_ORDER: Record<HierarchicalItemType, number> = {
    'Root': 0, 'GrupoAV': 1, 'AV': 2, 'AI': 3, 'PQ': 4, 'PGTD': 5, 'Cp': 6,
    'EMkt': 7, 'RR': 8, 'Ax': 9, 'Tx': 10, 'Reu': 11, 'Rf': 12, 'Sue': 13, 'Vx': 14,
    'RT': 15, 'RL': 16, 'Dly': 17, 'Wk': 18, 'M': 19, 'Q': 20,
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
    const itemMap = new Map<string, HierarchicalItem>();

    // 1. Prime the map with all actual notes from the vault.
    for (const item of items) {
        // The key for a note is its path without the .md extension.
        if (item.file) {
            const key = item.file.path.replace(/\.md$/, '');
            itemMap.set(key, item);
        }
    }

    // 2. Link items to their parents, creating placeholders as needed.
    // We iterate over the map's values, which includes notes and any newly created placeholders.
    for (const item of itemMap.values()) {
        // Determine the parent's key, which is the path of the containing folder.
        const path = item.file ? item.file.path.replace(/\.md$/, '') : item.id;
        const pathParts = path.split('/');
        pathParts.pop();
        const parentKey = pathParts.join('/');

        if (!parentKey) {
            continue; // This item is at the root of the vault, so it has no parent.
        }

        let parent = itemMap.get(parentKey);

        if (!parent) {
            // If the parent doesn't exist in our map, it means there's no corresponding .md file.
            // We must create a placeholder item for this folder.
            const folderName = parentKey.split('/').pop() || parentKey;
            parent = {
                id: parentKey,
                type: 'Ax', // Default type for a placeholder folder.
                name: `[FALTA] ${folderName}`,
                children: [],
                tasks: [],
                ownTaskCount: 0,
                descendantTaskCount: 0,
                frontmatter: {},
                isNoteMissing: true, // Mark this item as a placeholder.
            };
            itemMap.set(parentKey, parent);
        }

        // Establish the parent-child relationship.
        parent.children.push(item);
        item.parent = parent;
    }

    // 3. Identify the true root items (those without a parent).
    const roots = [...itemMap.values()].filter(item => !item.parent);

    // 4. Create a virtual root to contain all top-level items and perform final processing.
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

    // Perform recursive calculations and sorting from the top down.
    calculateTaskCountsRecursive(virtualRoot);
    sortChildrenRecursive(virtualRoot);

    return [virtualRoot];
}