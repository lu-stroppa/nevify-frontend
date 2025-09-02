// ---------------- SELETORES ----------------
const modal = document.getElementById("modal");
const closeModal = document.getElementById("close-modal");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const switchToRegister = document.getElementById("open-register");
const modalTitle = document.getElementById("modal-title");

// ---------------- CONTAINERS DE TOASTS ----------------
const toastContainer = document.createElement("div");
toastContainer.id = "toast-container";
document.body.appendChild(toastContainer);

// ---------------- FUNÇÃO DE TOAST ----------------
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.classList.add("toast", type, "show");
  toast.innerHTML = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove());
  }, 3000);
}

// ---------------- MODAL ----------------
switchToRegister.addEventListener("click", e => {
  e.preventDefault();
  modal.classList.remove("hidden");
  modal.classList.add("show");
  modalTitle.textContent = "Registrar";
  registerForm.classList.remove("hidden");
});

closeModal.addEventListener("click", () => {
  modal.classList.add("hidden");
  modal.classList.remove("show");
});

modal.addEventListener("click", e => { 
  if(e.target === modal) { 
    modal.classList.add("hidden"); 
    modal.classList.remove("show"); 
  } 
});

// Mostrar/Esconder senha
document.querySelectorAll('.password-icon').forEach(icon => {
  icon.addEventListener('click', () => {
    const input = icon.previousElementSibling;
    input.type = input.type === 'password' ? 'text' : 'password';
    icon.classList.toggle('fa-eye');
  });
});

// ---------------- CONFIG ----------------
const API_URL = 'https://nevify.up.railway.app/api';

// ---------------- VALIDATORS ----------------
function emailIsValid(value) {
  if (!value.trim()) return '⚠ Seu e-mail é obrigatório';
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!regex.test(value)) return '⚠ E-mail inválido';
  return null;
}

function passwordIsSecure(value) {
  if (!value.trim()) return '⚠ É obrigatório digitar uma senha';
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#\$%\^&\*]).{8,}$/;
  if (!regex.test(value)) return `
⚠ Sua senha deve conter ao menos: <br/>
- 8 caracteres <br/>
- 1 letra maiúscula <br/>
- 1 letra minúscula <br/>
- 1 número <br/>
- 1 caractere especial
  `;
  return null;
}

// ---------------- FUNÇÃO PARA ERROS INLINE ----------------
function showInlineError(input, message) {
  const box = input.closest('.input-box');
  let errorSpan = box.querySelector('.error');
  if (!errorSpan) {
    errorSpan = document.createElement('span');
    errorSpan.classList.add('error');
    box.appendChild(errorSpan);
  }
  errorSpan.innerHTML = message;
  box.classList.add('invalid');
}

function clearInlineError(input) {
  const box = input.closest('.input-box');
  const errorSpan = box.querySelector('.error');
  if (errorSpan) errorSpan.innerHTML = '';
  box.classList.remove('invalid');
}

// ---------------- REGISTRO ----------------
registerForm.addEventListener("submit", async e => {
  e.preventDefault();

  const full_name = document.getElementById("full_name").value.trim();
  const username = document.getElementById("username").value.trim();
  const birth = document.getElementById("birth").value.trim();
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirm_password");

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const confirm_password = confirmPasswordInput.value.trim();

  [emailInput, passwordInput, confirmPasswordInput].forEach(clearInlineError);

  let hasError = false;
  const emailError = emailIsValid(email);
  const passwordError = passwordIsSecure(password);

  if (emailError) { showInlineError(emailInput, emailError); hasError = true; }
  if (passwordError) { showInlineError(passwordInput, passwordError); hasError = true; }
  if (password !== confirm_password) { showInlineError(confirmPasswordInput, "⚠ Senhas não conferem"); hasError = true; }
  if (!full_name) { showInlineError(document.getElementById("full_name"), "⚠ Nome completo é obrigatório"); hasError = true; }
  if (!username) { showInlineError(document.getElementById("username"), "⚠ Nome de usuário é obrigatório"); hasError = true; }
  if (!birth) { showInlineError(document.getElementById("birth"), "⚠ Data de nascimento é obrigatória"); hasError = true; }

  if (hasError) return;

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ full_name, username, birth, email, password })
    });

    const data = await res.json();

    if(res.ok){
      showToast("Usuário registrado com sucesso! Faça login.", "success");
      registerForm.reset();
      modal.classList.add("hidden");
      modal.classList.remove("show");
    } else {
      showToast(data.message || "Erro ao registrar usuário", "error");
    }
  } catch(err){
    console.error(err);
    showToast("Erro de conexão com o servidor", "error");
  }
});

// ---------------- LOGIN ----------------
loginForm.addEventListener("submit", async e => {
  e.preventDefault();

  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!username || !password) {
    showToast("⚠ Preencha todos os campos", "error");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if(res.ok){
      localStorage.setItem('token', data.token);
      showToast("Login bem-sucedido!", "success");
      setTimeout(() => window.location.href = "dashboard.html", 1000);
    } else {
      showToast(data.message || "Usuário ou senha incorretos!", "error");
    }
  } catch(err){
    console.error(err);
    showToast("Erro de conexão com o servidor", "error");
  }
});

// ---------------- REMOVER ERROS AO DIGITAR ----------------
document.querySelectorAll('.form-control').forEach(input => {
  input.addEventListener('input', () => clearInlineError(input));

});

