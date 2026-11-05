import { MarkdownView } from 'obsidian';

export interface TaskAnalysisResult {
    isValid: boolean;
    taskContent?: string;
    lineNumber?: number;
    errorMessage?: string;
    taskState?: 'open' | 'in-progress' | 'completed' | 'other';
    fullLine?: string;
}

export class TaskSelectionAnalyzer {
    /**
     * Analiza la selección actual en el editor para determinar si corresponde a una tarea válida
     * @param editor - El editor de Obsidian
     * @returns Resultado del análisis con información de la tarea o errores
     */
    static analyzeSelection(editor: any): TaskAnalysisResult {
        const selection = editor.getSelection();
        
        // Caso 1: No hay selección
        if (!selection || selection.trim() === '') {
            return { isValid: false };
        }

        // Obtener información de la selección
        const cursor = editor.getCursor('from');
        const selectionStart = cursor;
        const selectionEnd = editor.getCursor('to');
        
        // Verificar si la selección abarca múltiples líneas
        if (selectionStart.line !== selectionEnd.line) {
            return {
                isValid: false,
                errorMessage: 'Verifica la tarea que has seleccionado para hacer seguimiento de tiempo.'
            };
        }

        // Obtener la línea completa donde está la selección
        const lineNumber = selectionStart.line;
        const fullLine = editor.getLine(lineNumber);
        
        // Verificar si la línea contiene una tarea válida
        const taskMatch = fullLine.match(/^(\s*)-\s\[([\s\/xX!?*+-])\]\s*(.*)$/);
        
        if (!taskMatch) {
            return {
                isValid: false,
                errorMessage: 'La selección en la nota no es una tarea. Borra la selección o verifica la tarea.'
            };
        }

        // Extraer el contenido de la tarea (después del checkbox)
        const taskContent = taskMatch[3]?.trim() || '';
        const checkboxState = taskMatch[2];
        
        // Determinar el estado de la tarea
        let taskState: 'open' | 'in-progress' | 'completed' | 'other';
        if (checkboxState === ' ') {
            taskState = 'open';
        } else if (checkboxState === '/') {
            taskState = 'in-progress';
        } else if (checkboxState === 'x' || checkboxState === 'X') {
            taskState = 'completed';
        } else {
            taskState = 'other';
        }
        
        return {
            isValid: true,
            taskContent: taskContent,
            lineNumber: lineNumber,
            taskState: taskState,
            fullLine: fullLine
        };
    }

    /**
     * Extrae información de tarea desde una vista de Markdown activa
     * @param view - Vista activa de Markdown
     * @returns Resultado del análisis
     */
    static extractTaskFromActiveView(view: MarkdownView): TaskAnalysisResult {
        if (!view.editor) {
            return { 
                isValid: false, 
                errorMessage: 'No hay editor disponible en la vista activa.' 
            };
        }

        return this.analyzeSelection(view.editor);
    }

    /**
     * Valida si una línea específica contiene una tarea válida
     * @param line - Contenido de la línea
     * @returns true si es una tarea válida
     */
    static isValidTaskLine(line: string): boolean {
        const taskMatch = line.match(/^(\s*)-\s\[([\s\/xX!?*+-])\]\s*(.*)$/);
        return !!taskMatch && !!taskMatch[3]?.trim();
    }

    /**
     * Extrae el contenido de una tarea desde una línea
     * @param line - Contenido de la línea
     * @returns Contenido de la tarea o undefined si no es válida
     */
    static extractTaskContent(line: string): string | undefined {
        const taskMatch = line.match(/^(\s*)-\s\[([\s\/xX!?*+-])\]\s*(.*)$/);
        return taskMatch?.[3]?.trim();
    }

    /**
     * Cambia el estado de una tarea de abierta (- [ ]) a en progreso (- [/])
     * @param editor - Editor de Obsidian
     * @param lineNumber - Número de línea donde está la tarea
     * @param currentLine - Contenido actual de la línea
     * @returns true si se realizó el cambio, false si no era necesario
     */
    static changeTaskStateToInProgress(editor: any, lineNumber: number, currentLine: string): boolean {
        // Verificar si la tarea está en estado abierto
        const openTaskMatch = currentLine.match(/^(\s*-\s\[)( )(\]\s*.*)$/);
        
        if (!openTaskMatch) {
            // La tarea no está en estado abierto, no hacer cambios
            return false;
        }

        // Construir la nueva línea con estado "en progreso"
        const newLine = `${openTaskMatch[1]}/${openTaskMatch[3]}`;
        
        // Reemplazar la línea en el editor
        const lineStart = { line: lineNumber, ch: 0 };
        const lineEnd = { line: lineNumber, ch: currentLine.length };
        
        editor.replaceRange(newLine, lineStart, lineEnd);
        
        return true;
    }

    /**
     * Obtiene el estado actual de una tarea desde una línea
     * @param line - Contenido de la línea
     * @returns Estado de la tarea o null si no es una tarea válida
     */
    static getTaskState(line: string): 'open' | 'in-progress' | 'completed' | 'other' | null {
        const taskMatch = line.match(/^\s*-\s\[([\s\/xX!?*+-])\]\s*(.*)$/);
        
        if (!taskMatch) {
            return null;
        }

        const checkboxState = taskMatch[1];
        
        if (checkboxState === ' ') {
            return 'open';
        } else if (checkboxState === '/') {
            return 'in-progress';
        } else if (checkboxState === 'x' || checkboxState === 'X') {
            return 'completed';
        } else {
            return 'other';
        }
    }
}
