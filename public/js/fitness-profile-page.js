import { mountFitnessProfile } from './fitness-profile-view.js';

const tr = new URLSearchParams(location.search).get('tr');
const host = document.getElementById('fitness-profile-root');
const staffSearch = document.getElementById('staff-search');
const back = document.getElementById('back-link');
const input = document.getElementById('profile-search');
const results = document.getElementById('profile-search-results');
const status = document.getElementById('profile-search-status');

async function init() {
  const staffResponse = await fetch('/api/session-user', { credentials:'include' });
  const staff = await staffResponse.json();
  const isStaff = staff.success && ['Staff','Admin','Trainer','Evaluator'].includes(staff.user?.Role);
  if (isStaff) {
    document.body.dataset.role = staff.user.Role;
    staffSearch.hidden = false;
    back.href = staff.user.Role === 'Trainer' ? '/trainer/trainer-dashboard.html' : staff.user.Role === 'Evaluator' ? '/staff/evaluation.html' : '/staff/test.html';
  } else {
    const studentResponse = await fetch('/api/student-session', { credentials:'include' });
    const student = await studentResponse.json();
    if (!student.success || !student.user?.TR) { location.replace('/Forbidden.html'); return; }
    back.href = '/student/student-dashboard.html#fitness';
  }
  if (isStaff && !tr) {
    host.innerHTML = '<div class="fp-empty">Search by name or TR above, then select a student to view tests, vital comparisons, trends, comments, and the report preview.</div>';
  } else await mountFitnessProfile(host, { tr, role:isStaff ? staff.user.Role : 'Student' });
}

let timer, searchAbort, sequence = 0;
input.addEventListener('input', () => {
  clearTimeout(timer);
  searchAbort?.abort();
  const current = ++sequence;
  const q = input.value.trim();
  results.replaceChildren();
  if (q.length < 2) { status.textContent = 'Enter at least two characters to search your section.'; delete status.dataset.loading; return; }
  status.textContent = `Searching for “${q}”…`;
  status.dataset.loading = 'true';
  timer = setTimeout(async () => {
    searchAbort = new AbortController();
    try {
      const response = await fetch(`/api/fitness-profiles/search?q=${encodeURIComponent(q)}`, { credentials:'include', signal:searchAbort.signal });
      if (!response.ok) throw new Error('Search is unavailable. Try again.');
      const { data } = await response.json();
      if (current !== sequence) return;
      results.replaceChildren(...data.map(student => {
        const link = document.createElement('a');
        link.href = `/fitness/profile.html?tr=${encodeURIComponent(student.TR)}`;
        const name = document.createElement('span'); name.textContent = student.Name;
        const detail = document.createElement('small'); detail.textContent = `TR ${student.TR} · ${student.Darajah || 'Class not recorded'}`;
        link.append(name, detail);
        return link;
      }));
      status.textContent = data.length ? `${data.length} matching student${data.length === 1 ? '' : 's'}. Select a result to open the profile.` : `No students found for “${q}” in your section.`;
    } catch (error) {
      if (error.name !== 'AbortError' && current === sequence) status.textContent = error.message;
    } finally { if (current === sequence) delete status.dataset.loading; }
  }, 250);
});
input.addEventListener('keydown', event => {
  if (event.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input')); }
});
init().catch(() => { host.textContent = 'Could not load this profile. Please sign in again.'; });
