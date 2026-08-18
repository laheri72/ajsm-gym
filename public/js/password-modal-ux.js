/**
 * Enterprise Password Modal UX Enhancer
 * Handles show/hide password toggling and real-time visual validation feedback.
 */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initPasswordModalUX());
} else {
    initPasswordModalUX();
}

function initPasswordModalUX() {
    const modal = document.getElementById('forcePasswordChangeModal');
    if (!modal) return;

    const form = modal.querySelector('#setPasswordForm');
    if (!form) return;

    const newPassInput = form.querySelector('#newPassword');
    const confirmPassInput = form.querySelector('#confirmPassword');
    const lengthReqPill = form.querySelector('#lengthReqPill');
    const matchReqPill = form.querySelector('#matchReqPill');

    // 2. Real-time Live Validation Indicators
    function updateValidationUI() {
        const passVal = newPassInput ? newPassInput.value : '';
        const confirmVal = confirmPassInput ? confirmPassInput.value : '';

        // Length validation (Min 6 characters)
        if (lengthReqPill) {
            const isLengthValid = passVal.length >= 6;
            lengthReqPill.classList.toggle('valid', isLengthValid);
            const icon = lengthReqPill.querySelector('i');
            if (icon) {
                icon.className = isLengthValid ? 'bi bi-check-circle-fill me-1' : 'bi bi-circle me-1';
            }
        }

        // Passwords Match validation
        if (matchReqPill) {
            const isMatchValid = passVal.length > 0 && passVal === confirmVal;
            matchReqPill.classList.toggle('valid', isMatchValid);
            const icon = matchReqPill.querySelector('i');
            if (icon) {
                icon.className = isMatchValid ? 'bi bi-check-circle-fill me-1' : 'bi bi-circle me-1';
            }
        }
    }

    // Run initial UI state update
    updateValidationUI();

    // Prevent duplicate event listener bindings
    if (form.dataset.uxInitialized === 'true') return;
    form.dataset.uxInitialized = 'true';

    // 1. Password Visibility Toggles
    const toggleBtns = form.querySelectorAll('.toggle-password-btn');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const wrapper = btn.closest('.security-input-wrapper');
            const input = wrapper ? wrapper.querySelector('input') : null;
            if (!input) return;

            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';

            const icon = btn.querySelector('i');
            if (icon) {
                if (isPassword) {
                    icon.classList.remove('bi-eye', 'fa-eye');
                    icon.classList.add('bi-eye-slash', 'fa-eye-slash');
                } else {
                    icon.classList.remove('bi-eye-slash', 'fa-eye-slash');
                    icon.classList.add('bi-eye', 'fa-eye');
                }
            }
        });
    });

    if (newPassInput) newPassInput.addEventListener('input', updateValidationUI);
    if (confirmPassInput) confirmPassInput.addEventListener('input', updateValidationUI);

    modal.addEventListener('shown.bs.modal', updateValidationUI);
}

// Global export in case modal is dynamically shown/rendered
window.initPasswordModalUX = initPasswordModalUX;
