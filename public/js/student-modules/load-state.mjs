// Each widget owns its success and in-flight state, so a partial failure can
// retry independently without reloading successful neighbours or binding twice.
const widgets = new Map();

export async function fetchJSON(url, options = {}) {
    const response = await fetch(url, { credentials: 'include', ...options });
    const data = await response.json();
    if (!response.ok || data?.success === false) {
        throw new Error(data?.message || data?.error || 'Unable to load data.');
    }
    return data;
}

export function loadWidget(key, anchor, task, { refresh = false, label = 'data' } = {}) {
    if (!anchor) return Promise.resolve(false);
    const state = widgets.get(key) || { loaded: false, pending: null, notice: null };
    widgets.set(key, state);
    if (state.pending) return state.pending;
    if (state.loaded && !refresh) return Promise.resolve(true);

    const notice = state.notice || document.createElement('div');
    state.notice = notice;
    notice.className = 'dashboard-load-state';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.textContent = `Loading ${label}…`;
    anchor.before(notice);
    anchor.setAttribute('aria-busy', 'true');

    // Schedule the task after assigning pending, including synchronous tasks.
    state.pending = Promise.resolve().then(task).then(() => {
        state.loaded = true;
        notice.remove();
        return true;
    }).catch(error => {
        state.loaded = false;
        console.error(`Could not load ${key}:`, error);
        notice.className = 'dashboard-load-state is-error';
        notice.setAttribute('role', 'alert');
        notice.textContent = `Unable to load ${label}. `;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn-sm btn-outline-secondary';
        retry.textContent = 'Retry';
        retry.addEventListener('click', () => loadWidget(key, anchor, task, { refresh: true, label }));
        notice.append(retry);
        return false;
    }).finally(() => {
        state.pending = null;
        anchor.setAttribute('aria-busy', 'false');
    });
    return state.pending;
}

export function creditedMinutes(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

export function elapsedMinutes(start, end) {
    if (!start || !end) return null;
    // SQL timestamps without an offset are UTC, just like moment.utc elsewhere.
    const utc = value => typeof value === 'string' && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)
        ? `${value}Z` : value;
    const difference = new Date(utc(end)) - new Date(utc(start));
    return Number.isFinite(difference) && difference >= 0 ? Math.floor(difference / 60000) : null;
}

export function attendanceExplanation({ present = 0, absent = 0, onLeave = 0 }) {
    const denominator = Number(present) + Number(absent);
    return `${present} present ÷ ${denominator} eligible days (present + absent). ${onLeave} approved leave days excluded from the rate.`;
}
