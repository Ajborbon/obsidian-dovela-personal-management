export function formatDuration(minutes: number, asHoursMinutes: boolean = false): string {
    if (asHoursMinutes) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        const paddedHours = String(hours).padStart(2, '0');
        const paddedMinutes = String(remainingMinutes).padStart(2, '0');
        return `${paddedHours}:${paddedMinutes}`;
    }

    if (minutes < 1) {
        return '< 1 min';
    }
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
        return `${hours} h`;
    }
    return `${hours} h ${remainingMinutes} min`;
}
