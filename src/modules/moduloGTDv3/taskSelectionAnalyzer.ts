import { MarkdownView } from 'obsidian';

export interface TaskAnalysisResult {
    isValid: boolean;
    taskContent?: string;
    lineNumber?: number;
    errorMessage?: string;
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
        const taskMatch = fullLine.match(/^(\s*)-\s\[([ \/])\]\s*(.*)$/);
        
        if (!taskMatch) {
            return {
                isValid: false,
                errorMessage: 'La selección en la nota no es una tarea. Borra la selección o verifica la tarea.'
            };
        }

        // Extraer el contenido de la tarea (después del checkbox)
        const taskContent = taskMatch[3]?.trim() || '';
        
        return {
            isValid: true,
            taskContent: taskContent,
            lineNumber: lineNumber
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
        const taskMatch = line.match(/^(\s*)-\s\[([ \/])\]\s*(.*)$/);
        return !!taskMatch && !!taskMatch[3]?.trim();
    }

    /**
     * Extrae el contenido de una tarea desde una línea
     * @param line - Contenido de la línea
     * @returns Contenido de la tarea o undefined si no es válida
     */
    static extractTaskContent(line: string): string | undefined {
        const taskMatch = line.match(/^(\s*)-\s\[([ \/])\]\s*(.*)$/);
        return taskMatch?.[3]?.trim();
    }
}
