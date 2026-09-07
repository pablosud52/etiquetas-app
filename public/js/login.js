// Manejo de autenticación / Inicio de sesión
async function iniciarSesion(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const errorEl = document.getElementById('login-error');
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!username || !password) {
    showLoginError('Por favor ingresa usuario y contraseña.');
    return false;
  }

  const submitBtn = document.getElementById('btn-login-submit');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Iniciando sesión...';
  }

  const payload = {
    usuario: username,
    username: username,
    password: password
  };

  try {
    let response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.status === 404) {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      showLoginError(data.error || data.message || 'Usuario o contraseña incorrectos.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Iniciar Sesión';
      }
      return false;
    }

    // Guardar usuario en sessionStorage (expira al cerrar el navegador)
    const userPayload = data.user || {
      usuario: username,
      username: username,
      rol: 'Operador',
      role: 'Operador'
    };

    sessionStorage.setItem('user', JSON.stringify(userPayload));
    currentUser = userPayload;

    // Limpiar campos
    if (passwordInput) passwordInput.value = '';

    // Transición directa al dashboard
    if (typeof showAppScreen === 'function') {
      showAppScreen();
    } else {
      window.location.reload();
    }

  } catch (err) {
    showLoginError('Error al conectar con el servidor: ' + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Iniciar Sesión';
    }
  }

  return false;
}

function showLoginError(msg) {
  const errorEl = document.getElementById('login-error');
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  } else {
    alert(msg);
  }
}

// Alternar visibilidad de contraseña
function togglePass(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}