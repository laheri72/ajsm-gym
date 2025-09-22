// Wait for the entire HTML document to be loaded and parsed before running the script.
document.addEventListener('DOMContentLoaded', () => {

    /**
     * Initializes the rotating quote slideshow.
     * Uses CSS classes for smooth transitions instead of direct style manipulation.
     */
    function initSlideshow() {
        const slides = document.querySelectorAll('.quote-slide');
        if (slides.length === 0) return; // Exit if no slides are found

        let currentSlideIndex = 0;

        // Hide all slides initially except the first one
        slides.forEach((slide, index) => {
            if (index !== currentSlideIndex) {
                slide.classList.remove('is-active');
            } else {
                slide.classList.add('is-active');
            }
        });

        setInterval(() => {
            // Remove active class from the current slide
            slides[currentSlideIndex].classList.remove('is-active');

            // Update the index, looping back to 0 if at the end
            currentSlideIndex = (currentSlideIndex + 1) % slides.length;

            // Add active class to the new current slide
            slides[currentSlideIndex].classList.add('is-active');
        }, 5000); // Change quote every 5 seconds
    }

    /**
     * Sets up navigation for all login buttons using a single event listener.
     * This is more efficient than adding a listener to each button.
     */
    function initNavigation() {
        const loginContainer = document.querySelector('.login-buttons');
        if (!loginContainer) return; // Exit if the container isn't on the page

        loginContainer.addEventListener('click', (event) => {
            // Find the closest button element that was clicked
            const button = event.target.closest('.login-btn');
            
            // Check if a button was clicked and if it has a data-href attribute
            if (button && button.dataset.href) {
                window.location.href = button.dataset.href;
            }
        });
    }

    /**
     * Handles the submission of the attendance form using localStorage.
     */
    function initAttendanceForm() {
        const attendanceForm = document.getElementById('attendanceForm');
        if (!attendanceForm) return; // Exit if the form isn't on the page

        attendanceForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const formData = new FormData(this);
            const studentId = formData.get('studentId');
            const attendance = formData.get('attendance');
            const day = formData.get('day');

            if (!studentId || !attendance || !day) {
                alert('Please fill out all fields.');
                return;
            }

            const record = {
                day,
                studentId,
                attendance,
                timestamp: new Date().toISOString()
            };

            // Get existing records or initialize an empty array
            const records = JSON.parse(localStorage.getItem('attendanceRecords')) || [];
            records.push(record);

            // Save back to localStorage
            localStorage.setItem('attendanceRecords', JSON.stringify(records));

            this.reset();
            alert('Attendance recorded successfully!');
        });
    }

    // Initialize all modules
    initSlideshow();
    initNavigation();
    initAttendanceForm(); // This will run but do nothing if the form is not on the current page.
});