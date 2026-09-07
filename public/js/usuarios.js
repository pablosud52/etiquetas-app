function initUsuariosModule() {
  loadUsersTable();
}

// Cargar lista de usuarios desde la API
async function loadUsersTable() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  try {
    let res = await fetch('/api/users');
    if (!res.ok) {
      res = await fetch('/api/usuarios');
    }

    if (!res.ok) throw new Error('Error al conectar con la API de usuarios');

    const users = await res.json();
    tbody.innerHTML = '';

    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-500">No hay usuarios registrados</td></tr>';
      return;
    }

    users.forEach(u => {
      const tr = document.createElement('tr');
      const isInactive = u.activo === 0;
      
      tr.className = `transition-colors border-b border-slate-700/40 ${isInactive ? 'bg-slate-900/40 text-slate-500 opacity-75' : 'hover:bg-slate-700/30'}`;

      const username = u.username || u.usuario || 'Sin nombre';
      const roleRaw = u.role || u.rol || 'Operador';
      const isAdmin = roleRaw.toLowerCase().includes('admin');
      const isMainAdmin = username.toLowerCase() === 'admin' || Number(u.id) === 1;
      const roleDisplay = isAdmin ? 'Administrador' : 'Operador';
      
      const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : (u.created_at || u.fecha || '-');

      // Badges por rol:
      // Admin: Verde Esmeralda | Operador: Púrpura
      const roleBadge = isAdmin
        ? `<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
            ${roleDisplay}
           </span>`
        : `<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1.5 shadow-[0_0_6px_rgba(192,132,252,0.8)]"></span>
            ${roleDisplay}
           </span>`;

      // Status badge (Activo / Inactivo)
      const statusBadge = isInactive
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
            Inactivo
           </span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
            Activo
           </span>`;

      // Botón Deshabilitar / Habilitar
      const toggleActiveHtml = isMainAdmin
        ? ''
        : isInactive
          ? `<button onclick="toggleUserActive(${u.id}, '${username}', false)" class="px-2.5 py-1.5 bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-500/30 text-xs font-medium rounded-lg transition-colors cursor-pointer">
              Habilitar
             </button>`
          : `<button onclick="toggleUserActive(${u.id}, '${username}', true)" class="px-2.5 py-1.5 bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 border border-amber-500/30 text-xs font-medium rounded-lg transition-colors cursor-pointer">
              Deshabilitar
             </button>`;

      // Botón de eliminar deshabilitado/oculto para 'admin'
      const deleteButtonHtml = isMainAdmin
        ? `<span class="px-2 py-1.5 text-xs text-slate-500 italic">Protegido</span>`
        : `<button onclick="deleteUser(${u.id}, '${username}')" class="px-2.5 py-1.5 bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-500/30 text-xs font-medium rounded-lg transition-colors cursor-pointer">
            Eliminar
           </button>`;

      const userDisplayClass = isInactive ? 'line-through text-slate-500' : 'font-semibold text-white';

      tr.innerHTML = `
        <td class="py-3.5 px-4 font-mono text-slate-400 text-xs">${u.id}</td>
        <td class="py-3.5 px-4 ${userDisplayClass}">${username}</td>
        <td class="py-3.5 px-4">${roleBadge} ${statusBadge}</td>
        <td class="py-3.5 px-4 text-slate-400 text-xs">${dateStr}</td>
        <td class="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
          <button onclick="editUser(${u.id}, '${username}', '${isAdmin ? 'admin' : 'operador'}')" class="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer">
            Editar
          </button>
          ${toggleActiveHtml}
          ${deleteButtonHtml}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-red-400">${err.message}</td></tr>`;
  }
}

// Abrir modal para NUEVO usuario
function openUserModal() {
  document.getElementById('modal-user-title').textContent = 'Nuevo Usuario';
  document.getElementById('modal-user-id').value = '';
  document.getElementById('modal-username').value = '';
  document.getElementById('modal-username').disabled = false;
  
  const passInput = document.getElementById('modal-password');
  const confirmInput = document.getElementById('modal-password-confirm');
  const btnUnlockPass = document.getElementById('btn-unlock-password');

  passInput.value = '';
  confirmInput.value = '';
  passInput.disabled = false;
  confirmInput.disabled = false;
  passInput.required = true;

  if (btnUnlockPass) btnUnlockPass.classList.add('hidden');

  const roleSelect = document.getElementById('modal-role');
  if (roleSelect) {
    roleSelect.value = 'operador';
    roleSelect.disabled = false;
  }

  document.getElementById('user-modal').classList.remove('hidden');
}

// Abrir modal para EDITAR usuario (Modo Seguro de Cambio de Contraseña)
function editUser(id, username, role) {
  const isMainAdmin = username.toLowerCase() === 'admin' || Number(id) === 1;

  document.getElementById('modal-user-title').textContent = `Editar Usuario: ${username}`;
  document.getElementById('modal-user-id').value = id;
  
  const usernameInput = document.getElementById('modal-username');
  usernameInput.value = username;
  usernameInput.disabled = isMainAdmin; // No renombrar admin principal

  const passInput = document.getElementById('modal-password');
  const confirmInput = document.getElementById('modal-password-confirm');
  const btnUnlockPass = document.getElementById('btn-unlock-password');

  passInput.value = '';
  confirmInput.value = '';
  passInput.disabled = true; // Deshabilitado por defecto para evitar sobrescrituras accidentales
  confirmInput.disabled = true;
  passInput.required = false;

  if (btnUnlockPass) btnUnlockPass.classList.remove('hidden');

  const roleSelect = document.getElementById('modal-role');
  if (roleSelect) {
    roleSelect.value = isMainAdmin ? 'admin' : (role || 'operador');
    roleSelect.disabled = isMainAdmin; // Proteger rol de admin principal
  }

  document.getElementById('user-modal').classList.remove('hidden');
}

// Habilitar campos de nueva contraseña en modo seguro
function unlockPasswordFields() {
  const passInput = document.getElementById('modal-password');
  const confirmInput = document.getElementById('modal-password-confirm');
  const btnUnlockPass = document.getElementById('btn-unlock-password');

  if (passInput) {
    passInput.disabled = false;
    passInput.focus();
  }
  if (confirmInput) confirmInput.disabled = false;
  if (btnUnlockPass) btnUnlockPass.classList.add('hidden');
}

function closeUserModal() {
  document.getElementById('user-modal').classList.add('hidden');
}

// Enviar formulario de usuario
async function handleUserSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('modal-user-id').value;
  const username = document.getElementById('modal-username').value.trim();
  const passInput = document.getElementById('modal-password');
  const confirmInput = document.getElementById('modal-password-confirm');
  const password = passInput && !passInput.disabled ? passInput.value : '';
  const passwordConfirm = confirmInput && !confirmInput.disabled ? confirmInput.value : '';
  const roleSelect = document.getElementById('modal-role');
  const role = roleSelect ? roleSelect.value : 'operador';

  if (!passInput.disabled && password) {
    if (password !== passwordConfirm) {
      alert('Las contraseñas no coinciden');
      return;
    }
  }

  const payload = { 
    usuario: username, 
    username: username, 
    rol: role, 
    role: role 
  };
  if (!passInput.disabled && password) payload.password = password;

  const method = id ? 'PUT' : 'POST';
  const primaryUrl = id ? `/api/users/${id}` : '/api/users';
  const fallbackUrl = id ? `/api/usuarios/${id}` : '/api/usuarios';

  try {
    let res = await fetch(primaryUrl, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok && res.status === 404) {
      res = await fetch(fallbackUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Error al guardar el usuario');

    closeUserModal();
    loadUsersTable();
  } catch (err) {
    alert(err.message);
  }
}

// Alternar estado activo / inactivo
async function toggleUserActive(id, username, currentlyActive) {
  const newStatus = !currentlyActive;
  const actionText = newStatus ? 'habilitar' : 'deshabilitar';

  if (!confirm(`¿Estás seguro de que deseas ${actionText} al usuario "${username}"?`)) return;

  try {
    let res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: newStatus })
    });

    if (!res.ok && res.status === 404) {
      res = await fetch(`/api/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: newStatus })
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || `Error al ${actionText} usuario`);

    loadUsersTable();
  } catch (err) {
    alert(err.message);
  }
}

// Eliminar usuario
async function deleteUser(id, username) {
  if (username.toLowerCase() === 'admin' || Number(id) === 1) {
    alert('El usuario principal "admin" no puede ser eliminado.');
    return;
  }

  if (!confirm(`¿Estás seguro de eliminar el usuario "${username}"?`)) return;

  try {
    let res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status === 404) {
      res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Error al eliminar usuario');

    loadUsersTable();
  } catch (err) {
    alert(err.message);
  }
}