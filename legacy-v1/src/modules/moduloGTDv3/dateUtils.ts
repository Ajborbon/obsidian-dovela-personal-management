import moment from 'moment';

// --- Date Helper Functions ---

export function isDatePast(dateString: string): boolean {
    const date = moment(dateString, 'YYYY-MM-DD');
    return date.isBefore(moment(), 'day');
}

export function isDateToday(dateString: string): boolean {
    const date = moment(dateString, 'YYYY-MM-DD');
    return date.isSame(moment(), 'day');
}

export function isDateFuture(dateString: string): boolean {
    const date = moment(dateString, 'YYYY-MM-DD');
    return date.isAfter(moment(), 'day');
}

export function isWeekPast(weekString: string): boolean {
    const match = weekString.match(/\[\[(\d{4})-W(\d{2})\]\]/);
    if (!match || !match[1] || !match[2]) return false;
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    const today = moment();
    const dateToCheck = moment().year(year).isoWeek(week);

    return dateToCheck.isBefore(today, 'isoWeek');
}

export function isWeekToday(weekString: string): boolean {
    const match = weekString.match(/\[\[(\d{4})-W(\d{2})\]\]/);
    if (!match || !match[1] || !match[2]) return false;
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    const today = moment();
    const dateToCheck = moment().year(year).isoWeek(week);

    return dateToCheck.isSame(today, 'isoWeek');
}

export function isWeekFuture(weekString: string): boolean {
    const match = weekString.match(/\[\[(\d{4})-W(\d{2})\]\]/);
    if (!match || !match[1] || !match[2]) return false;
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    const today = moment();
    const dateToCheck = moment().year(year).isoWeek(week);

    return dateToCheck.isAfter(today, 'isoWeek');
}
