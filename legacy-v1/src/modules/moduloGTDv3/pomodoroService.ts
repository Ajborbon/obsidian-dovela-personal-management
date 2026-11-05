import { Notice } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import type { PomodoroSession, PomodoroSessionType, PomodoroSettings, TimeLogEntry } from './model.js';
import { TaskStateManager } from './taskStateManager.js';
import moment from 'moment';

export class PomodoroService {
    private plugin: DovelaPersonalManagementPlugin;
    private interval: number | null = null;
    private onSessionCompleteCallback?: (session: PomodoroSession) => void;
    private onTickCallback?: (remainingSeconds: number) => void;
    private taskStateManager: TaskStateManager;

    constructor(plugin: DovelaPersonalManagementPlugin) {
        this.plugin = plugin;
        this.taskStateManager = new TaskStateManager(plugin.app);
    }

    public setCallbacks(
        onSessionComplete: (session: PomodoroSession) => void,
        onTick: (remainingSeconds: number) => void
    ) {
        this.onSessionCompleteCallback = onSessionComplete;
        this.onTickCallback = onTick;
    }

    public async startWorkSession(taskPath: string, taskDescription: string, _lineNumber?: number): Promise<void> {
        if (this.plugin.activePomodoroSession) {
            new Notice('Ya hay una sesión Pomodoro activa. Detén la actual antes de iniciar una nueva.');
            return;
        }

        const settings = this.plugin.data.pomodoroSettings;
        const session: PomodoroSession = {
            id: Date.now().toString(),
            type: 'work',
            startTime: moment().toISOString(true),
            duration: settings.workDuration,
            taskPath,
            taskDescription,
            completedCycles: this.plugin.data.activePomodoroSession?.completedCycles || 0,
            notes: ''
        };

        // Si es una tarea específica, ponerla en progreso automáticamente
        if (this.taskStateManager.isSpecificTask(taskPath, taskDescription)) {
            await this.taskStateManager.setTaskInProgress(taskPath, taskDescription);
        }

        this.plugin.activePomodoroSession = session;
        this.plugin.data.activePomodoroSession = session;
        await this.plugin.savePluginData();

        // Inicializar la barra de estado
        this.plugin.initializePomodoroFromState(session);
        
        this.startTimer(session);
        this.showNotification(`🍅 Pomodoro iniciado`, `Trabajando en: ${taskDescription || taskPath}`);
    }

    public async startBreakSession(type: 'shortBreak' | 'longBreak'): Promise<void> {
        // Conservar información de la sesión anterior antes de detenerla
        let previousTaskPath: string | undefined;
        let previousTaskDescription: string | undefined;
        let completedCycles = 0;

        if (this.plugin.activePomodoroSession) {
            const currentSession = this.plugin.activePomodoroSession;
            previousTaskPath = currentSession.taskPath;
            previousTaskDescription = currentSession.taskDescription;
            completedCycles = currentSession.completedCycles || 0;
            
            await this.stopCurrentSession();
        }

        const settings = this.plugin.data.pomodoroSettings;
        const duration = type === 'shortBreak' ? settings.shortBreakDuration : settings.longBreakDuration;

        const session: PomodoroSession = {
            id: Date.now().toString(),
            type,
            startTime: moment().toISOString(true),
            duration,
            completedCycles,
            // Conservar información de la tarea anterior para poder continuar después del descanso
            taskPath: previousTaskPath,
            taskDescription: previousTaskDescription,
        };

        this.plugin.activePomodoroSession = session;
        this.plugin.data.activePomodoroSession = session;
        await this.plugin.savePluginData();

        // Inicializar la barra de estado
        this.plugin.initializePomodoroFromState(session);

        this.startTimer(session);
        const breakName = type === 'shortBreak' ? 'Descanso corto' : 'Descanso largo';
        this.showNotification(`☕ ${breakName} iniciado`, `Tiempo de descanso: ${duration} minutos`);
    }

    public async pauseSession(): Promise<void> {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        new Notice('⏸️ Sesión pausada');
    }

    public async resumeSession(): Promise<void> {
        if (this.plugin.activePomodoroSession && !this.interval) {
            this.startTimer(this.plugin.activePomodoroSession);
            new Notice('▶️ Sesión reanudada');
        }
    }

    public async stopCurrentSession(shouldPromptCloseTask: boolean = true): Promise<void> {
        if (!this.plugin.activePomodoroSession) return;

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        const session = this.plugin.activePomodoroSession;
        
        // Si era una sesión de trabajo y se completó, registrar el tiempo
        if (session.type === 'work') {
            const startTime = moment(session.startTime);
            const endTime = moment();
            const actualDuration = endTime.diff(startTime, 'minutes');

            // Solo registrar si trabajó al menos 1 minuto
            if (actualDuration >= 1 && session.taskPath) {
                // Generar notas automáticas del sistema
                let systemNotes: string;
                if (session.isOvertime) {
                    systemNotes = `Sesión Pomodoro + Overtime (${actualDuration} min total)`;
                } else {
                    systemNotes = `Sesión Pomodoro (${actualDuration}/${session.duration} min)`;
                }

                // Agregar información de ciclos si aplica
                if (session.completedCycles > 0) {
                    systemNotes += ` - Ciclos completados: ${session.completedCycles}`;
                }

                // Combinar notas del sistema con notas del usuario
                let notes: string;
                if (session.notes && session.notes.trim() !== '') {
                    notes = `${systemNotes}\n\n${session.notes}`;
                } else {
                    notes = systemNotes;
                }

                const timeLogEntry: Omit<TimeLogEntry, 'id'> = {
                    taskNotePath: session.taskPath,
                    taskDescription: session.taskDescription || '',
                    startTime: session.startTime,
                    endTime: endTime.toISOString(true),
                    durationMinutes: actualDuration,
                    notes: notes
                };

                await this.plugin.timeTrackerService.addLogEntry(timeLogEntry);
            }

            // Mostrar modal para todas las sesiones de trabajo (tanto tareas específicas como notas generales)
            if (shouldPromptCloseTask) {
                // Limpiar sesión primero
                this.clearActiveSession();

                // Importar y mostrar modal de confirmación
                import('./pomodoroModal.js').then(({ PomodoroModal }) => {
                    const modal = new PomodoroModal(this.plugin.app, this.plugin, {
                        type: 'sessionComplete',
                        completedSession: session,
                        onFinish: async (shouldCloseTask?: boolean) => {
                            if (shouldCloseTask && this.hasSpecificTask(session)) {
                                await this.closeSessionTask(session);
                            }
                        }
                    });
                    modal.open();
                });

                new Notice('🛑 Sesión Pomodoro detenida');
            } else {
                this.clearActiveSession();
                new Notice('🛑 Sesión Pomodoro detenida');
            }
        } else {
            this.clearActiveSession();
            new Notice('🛑 Sesión Pomodoro detenida');
        }
    }

    public async startOvertimeMode(completedSession: PomodoroSession): Promise<void> {
        if (completedSession.type !== 'work') {
            new Notice('El modo overtime solo está disponible para sesiones de trabajo.');
            return;
        }

        // Marcar la sesión como completada para estadísticas
        this.updateStats(completedSession);
        completedSession.completedCycles++;

        // Configurar modo overtime
        const overtimeSession: PomodoroSession = {
            ...completedSession,
            isOvertime: true,
            overtimeStartTime: moment().toISOString(true),
            lastOvertimeAlert: moment().toISOString(true)
        };

        this.plugin.activePomodoroSession = overtimeSession;
        this.plugin.data.activePomodoroSession = overtimeSession;
        await this.plugin.savePluginData();

        // Inicializar la barra de estado con modo overtime
        this.plugin.initializePomodoroFromState(overtimeSession);
        
        this.startTimer(overtimeSession);
        this.showNotification(`🔴 Modo overtime iniciado`, `Continuando con: ${overtimeSession.taskDescription || overtimeSession.taskPath}`);
    }

    public async completeCurrentSession(): Promise<void> {
        if (!this.plugin.activePomodoroSession) return;

        const session = this.plugin.activePomodoroSession;
        const settings = this.plugin.data.pomodoroSettings;

        // DETENER el timer para evitar loop infinito
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        if (session.type === 'work') {
            // NO registrar el tiempo aquí - solo se registrará en stopCurrentSession()
            // cuando la sesión realmente termine (no cuando entre en overtime)

            // Actualizar estadísticas
            this.updateStats(session);

            // Incrementar ciclos completados
            session.completedCycles++;
        }

        // Ejecutar callback si existe (esto mostrará el modal)
        if (this.onSessionCompleteCallback) {
            this.onSessionCompleteCallback(session);
        }

        // NO limpiar la sesión aquí - se limpiará cuando se tome una decisión en el modal
        // o cuando se llame stopCurrentSession() si no se entra en overtime

        // Mostrar notificación de finalización
        this.showSessionCompleteNotification(session, settings);
    }

    public getRemainingTime(): number {
        if (!this.plugin.activePomodoroSession) return 0;

        const session = this.plugin.activePomodoroSession;
        const startTime = moment(session.startTime);
        const now = moment();
        const elapsedMinutes = now.diff(startTime, 'minutes', true);

        if (session.isOvertime) {
            // En modo overtime, retornar el tiempo total transcurrido desde el inicio (en segundos, como positivo)
            return Math.floor(elapsedMinutes * 60);
        } else {
            // En modo normal, retornar tiempo restante
            const remainingMinutes = session.duration - elapsedMinutes;
            return Math.max(0, remainingMinutes * 60); // Retornar en segundos
        }
    }

    public isActive(): boolean {
        return !!this.plugin.activePomodoroSession;
    }

    public getCurrentSession(): PomodoroSession | null {
        return this.plugin.activePomodoroSession || null;
    }

    public startTimer(session: PomodoroSession): void {
        if (this.interval) {
            clearInterval(this.interval);
        }

        this.interval = window.setInterval(() => {
            const timeValue = this.getRemainingTime();
            
            if (this.onTickCallback) {
                this.onTickCallback(timeValue);
            }

            if (session.isOvertime) {
                // En modo overtime, verificar alertas cada 5 minutos
                this.checkOvertimeAlerts(session);
            } else {
                // En modo normal, completar cuando se acabe el tiempo
                if (timeValue <= 0) {
                    this.completeCurrentSession();
                }
            }
        }, 1000);
    }

    private checkOvertimeAlerts(session: PomodoroSession): void {
        if (!session.lastOvertimeAlert) return;

        const settings = this.plugin.data.pomodoroSettings;
        const alertInterval = settings.overtimeAlertInterval || 5; // Fallback a 5 minutos

        const now = moment();
        const lastAlert = moment(session.lastOvertimeAlert);
        const minutesSinceLastAlert = now.diff(lastAlert, 'minutes');

        if (minutesSinceLastAlert >= alertInterval) {
            const totalMinutes = Math.floor(this.getRemainingTime() / 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            
            const timeText = hours > 0 
                ? `${hours}h ${minutes}m`
                : `${minutes} minutos`;

            this.showNotification(
                `⏰ Recordatorio de descanso`, 
                `Llevas ${timeText} trabajando en este registro. Recuerda descansar para balancear tu mente.`
            );

            // Actualizar el último momento de alerta
            session.lastOvertimeAlert = now.toISOString(true);
            this.plugin.data.activePomodoroSession = session;
            this.plugin.savePluginData();
        }
    }

    private updateStats(session: PomodoroSession): void {
        const stats = this.plugin.data.pomodoroStats;
        const today = moment().format('YYYY-MM-DD');
        const sessionDate = moment(session.startTime).format('YYYY-MM-DD');

        if (session.type === 'work') {
            stats.totalWorkSessions++;
            stats.totalWorkMinutes += session.duration;

            if (sessionDate === today) {
                stats.todayWorkSessions++;
                stats.todayWorkMinutes += session.duration;
            }

            // Si completó un ciclo (trabajo + descanso)
            if (session.completedCycles > 0) {
                stats.completedCycles++;
            }
        }
    }

    private clearActiveSession(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        // Usar la función del plugin principal para limpiar la barra de estado
        this.plugin.clearActivePomodoroSession();
        
        this.plugin.data.activePomodoroSession = undefined;
        this.plugin.savePluginData();
    }

    private showSessionCompleteNotification(session: PomodoroSession, settings: PomodoroSettings): void {
        const sessionName = this.getSessionTypeName(session.type);
        this.showNotification(
            `✅ ${sessionName} completado`,
            `Duración: ${session.duration} minutos`
        );

        if (settings.soundEnabled) {
            this.playCompletionSound();
        }
    }

    private getSessionTypeName(type: PomodoroSessionType): string {
        switch (type) {
            case 'work': return 'Sesión de trabajo';
            case 'shortBreak': return 'Descanso corto';
            case 'longBreak': return 'Descanso largo';
            default: return 'Sesión';
        }
    }

    private showNotification(title: string, body: string): void {
        if (!this.plugin.data.pomodoroSettings.notificationsEnabled) return;

        new Notice(`${title}: ${body}`, 4000);

        // Intentar notificación del sistema si está disponible
        if (window.Notification && window.Notification.permission === 'granted') {
            new window.Notification(title, { 
                body,
                icon: '🍅',
                tag: 'dovela-pomodoro' // Para evitar spam de notificaciones
            });
        }
    }

    private playCompletionSound(): void {
        try {
            // Sonido simple usando Web Audio API
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);

            // Vibración para móviles
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 200]);
            }
        } catch (error) {
            console.warn('Dovela PM: No se pudo reproducir el sonido de finalización:', error);
        }
    }

    /**
     * Cierra la tarea asociada a una sesión Pomodoro
     * @param session - Sesión con información de la tarea
     * @returns true si se cerró exitosamente
     */
    public async closeSessionTask(session: PomodoroSession): Promise<boolean> {
        if (!session.taskPath) {
            return false;
        }

        if (!this.taskStateManager.isSpecificTask(session.taskPath, session.taskDescription)) {
            return false;
        }

        return await this.taskStateManager.closeTask(session.taskPath, session.taskDescription);
    }

    /**
     * Verifica si una sesión tiene una tarea específica que puede ser cerrada
     * @param session - Sesión a verificar
     * @returns true si tiene tarea específica
     */
    public hasSpecificTask(session: PomodoroSession): boolean {
        return !!(session.taskPath && this.taskStateManager.isSpecificTask(session.taskPath, session.taskDescription));
    }

    public cleanup(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}