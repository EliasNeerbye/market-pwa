const form = document.getElementById('myForm');
const errorMsg = document.getElementById('errorMsg'); // Existing element for error messages
const pwdImg = document.getElementById('pwdImg');
const passwordInput = document.getElementById('password');

form.addEventListener('submit', (event) => {
    event.preventDefault(); // Prevent the default form submission

    const username = document.getElementById('username').value;
    const password = passwordInput.value;

    // Clear previous warnings
    errorMsg.textContent = ''; // Clear existing error message

    let valid = true;

    // Username Validation
    if (/\s/.test(username)) {
        valid = false;
        errorMsg.textContent = 'Username should not contain spaces.';
    } else if (username.length < 3 || username.length > 15) {
        valid = false;
        errorMsg.textContent = 'Username must be between 3 and 15 characters long.';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        valid = false;
        errorMsg.textContent = 'Username can only contain letters, numbers, and underscores.';
    }

    // Password Validation
    if (/\s/.test(password)) {
        valid = false;
        errorMsg.textContent = 'Password should not contain spaces.';
    } else if (password.length < 8) {
        valid = false;
        errorMsg.textContent = 'Password must be at least 8 characters long.';
    } else if (!/[A-Z]/.test(password)) {
        valid = false;
        errorMsg.textContent = 'Password must contain at least one uppercase letter.';
    } else if (!/[a-z]/.test(password)) {
        valid = false;
        errorMsg.textContent = 'Password must contain at least one lowercase letter.';
    } else if (!/[0-9]/.test(password)) {
        valid = false;
        errorMsg.textContent = 'Password must contain at least one number.';
    }

    // If valid, submit the form data (or proceed to AJAX submission)
    if (valid) {
        console.log('Form is valid. Proceed with submission.');
        form.submit(); // If you want to actually submit the form
    }
});

// Password visibility toggle
pwdImg.addEventListener('click', () => {
    const isPasswordVisible = passwordInput.getAttribute('type') === 'text';
    
    // Toggle the input type between password and text
    passwordInput.setAttribute('type', isPasswordVisible ? 'password' : 'text');
    
    // Change the eye icon and alt attribute based on visibility
    pwdImg.src = isPasswordVisible ? '/assets/closedeye.png' : '/assets/openeye.png';
    pwdImg.alt = isPasswordVisible ? 'Hide password' : 'Show password'; // Update the alt text
});