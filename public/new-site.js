// Slideshow functionality
let slideIndex = 0;
showSlides();

function showSlides() {
    let i;
    let slides = document.getElementsByClassName("quote-slide");
    
    if (slides.length > 0) {
        // Hide all slides
        for (i = 0; i < slides.length; i++) {
            slides[i].style.display = "none";  
        }
        
        // Move to next slide
        slideIndex++;
        if (slideIndex > slides.length) {slideIndex = 1}
        
        // Show current slide
        slides[slideIndex-1].style.display = "block";
        
        // Change slide every 3 seconds
        setTimeout(showSlides, 3000);
    }
}

function setupButton(selector, page) {
    const btn = document.querySelector(selector);
    if (btn) {
        btn.addEventListener('click', () => {
            window.location.href = page;
        });
    }
}

setupButton('.trainer-btn', 'trainer.html');
setupButton('.student-btn', 'student.html');
setupButton('.staff-btn', 'staff.html');
setupButton('.blog-btn', 'blog.html');

// Attendance Form Handling (only if form exists)
const attendanceForm = document.getElementById('attendanceForm');
if (attendanceForm) {
    attendanceForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Get form values
        const day = document.getElementById('day').value;
        const studentId = document.getElementById('studentId').value;
        const attendance = document.querySelector('input[name="attendance"]:checked').value;

        // Create attendance record
        const record = {
            day,
            studentId,
            attendance,
            date: new Date().toISOString()
        };

        // Get existing records or initialize array
        let records = JSON.parse(localStorage.getItem('attendanceRecords')) || [];

        // Add new record
        records.push(record);

        // Save back to localStorage
        localStorage.setItem('attendanceRecords', JSON.stringify(records));

        // Reset form
        this.reset();

        // Show success message
        alert('Attendance recorded successfully!');
    });
}

