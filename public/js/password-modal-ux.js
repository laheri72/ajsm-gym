/**
 * Enterprise Password Modal UX Enhancer
 * Handles show/hide password toggling and real-time visual validation feedback.
 */

document.addEventListener('DOMContentLoaded', () => {
    initPasswordModalUX();
});

function initPasswordModalUX() {
    const modal = document.getElementById('forcePasswordChangeModal');
    if (!modal) return;

    const form = modal.querySelector('#setPasswordForm');
    if (!form) return;

    const newPassInput = form.querySelector('#newPassword');
    const confirmPassInput = form.querySelector('#confirmPassword');
    const lengthReqPill = form.querySelector('#lengthReqPill');
    const matchReqPill = form.querySelector('#matchReqPill');

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

    if (newPassInput) newPassInput.addEventListener('input', updateValidationUI);
    if (confirmPassInput) confirmPassInput.addEventListener('input', updateValidationUI);
}

// Global export in case modal is dynamically shown/rendered
window.initPasswordModalUX = initPasswordModalUX;
