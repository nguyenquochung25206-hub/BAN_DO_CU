function showAuthMessage(message, type = 'error') {
  const alertBox = document.getElementById('auth-message');
  if (!alertBox) return;
  alertBox.textContent = message;
  alertBox.className = `auth-alert ${type}`;
}

function getCurrentUser() {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

function requireLogin() {
  const token = getToken();
  const user = getCurrentUser();
  if (!token || !user) {
    alert('Vui lòng đăng nhập để tiếp tục!');
    window.location.href = '/pages/login.html';
    return false;
  }
  return true;
}

async function logout() {
  try {
    if (getToken()) {
      await apiFetch('/auth/logout', { method: 'POST' });
    }
  } catch (err) {
    console.warn('Logout warning:', err.message);
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/pages/login.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Xử lý Form Đăng nhập
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const submitBtn = document.getElementById('submit-btn');

      if (!email || !password) {
        return showAuthMessage('Vui lòng nhập đầy đủ email và mật khẩu.');
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang xử lý...';

      try {
        const result = await apiFetch('/auth/login', {
          method: 'POST',
          body: { email, password }
        });

        localStorage.setItem('token', result.data.token);
        localStorage.setItem('user', JSON.stringify(result.data.user));

        showAuthMessage('Đăng nhập thành công! Đang chuyển hướng...', 'success');
        setTimeout(() => {
          window.location.href = '/index.html';
        }, 800);
      } catch (error) {
        showAuthMessage(error.message || 'Đăng nhập thất bại.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đăng nhập';
      }
    });
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const full_name = document.getElementById('full_name').value.trim();
      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const password = document.getElementById('password').value;
      const confirm_password = document.getElementById('confirm_password').value;
      const submitBtn = document.getElementById('submit-btn');

      if (!full_name || !email || !password || !confirm_password) {
        return showAuthMessage('Vui lòng điền đầy đủ các trường bắt buộc (*).');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return showAuthMessage('Email không đúng định dạng.');
      }

      if (password.length < 6) {
        return showAuthMessage('Mật khẩu phải có ít nhất 6 ký tự.');
      }

      if (password !== confirm_password) {
        return showAuthMessage('Mật khẩu nhập lại không khớp.');
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang đăng ký...';

      try {
        await apiFetch('/auth/register', {
          method: 'POST',
          body: { full_name, email, phone, password, confirm_password }
        });

        showAuthMessage('Đăng ký thành công! Đang chuyển sang trang đăng nhập...', 'success');
        setTimeout(() => {
          window.location.href = '/pages/login.html';
        }, 1200);
      } catch (error) {
        showAuthMessage(error.message || 'Đăng ký thất bại.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đăng ký';
      }
    });
  }
});