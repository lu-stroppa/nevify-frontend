// =========================
// Configurações
// =========================
const BASE_URL = "http://localhost:5000/api"; 
let currentType = "home";  
let currentSort = "recent"; 
let searchTimeout;
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let currentQuery = "";
const searchInput = document.getElementById("search-input");
const container = document.getElementById("movies");
const pageTitle = document.getElementById("page-title");
const favoritesControls = document.getElementById("favorites-controls");
const mainContainer = document.getElementById('container'); // necessário para showSettings

// =========================
// Subtítulo apenas na home
// =========================
let pageSubtitle = document.createElement("p");
pageSubtitle.id = "page-subtitle";
pageSubtitle.textContent = "Milhões de Filmes novos para Descobrir. Explore já.";
pageSubtitle.style.textAlign = "center";
pageSubtitle.style.color = "#fff";
pageSubtitle.style.marginTop = "8px";
pageSubtitle.style.fontSize = "18px";
pageTitle.insertAdjacentElement("afterend", pageSubtitle);
pageSubtitle.style.display = "none";

// =========================
// Carregar nome do usuário via token JWT
// =========================
function loadUserName() {
    const userNameElement = document.querySelector("#user_infos .username");
    const token = localStorage.getItem("token");
    if (!token) return userNameElement.textContent = "Usuário";

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userNameElement.textContent = payload.username || "Usuário";
    } catch (err) {
        console.error(err);
        userNameElement.textContent = "Usuário";
    }
}

// =========================
// Ativar/desativar favorito
// =========================
async function toggleFavorite(movieElement, movie) {
    const favDiv = movieElement.querySelector(".movie-fav");
    const favIcon = favDiv.querySelector("img");
    const favText = favDiv.querySelector("p");

    favDiv.addEventListener("click", async () => {
        const token = localStorage.getItem("token");
        const isFav = movieElement.classList.toggle("favorite");
        favIcon.src = isFav ? "src/dashboard/img/fullheart.svg" : "src/dashboard/img/heart.svg";
        favText.textContent = isFav ? "Favorito" : "Favoritar";

        try {
            if (isFav) {
                await fetch(`${BASE_URL}/favorites`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        id: movie.tmdbId || movie.id,
                        title: movie.title,
                        poster_path: movie.posterPath,
                        vote_average: movie.voteAverage,
                        release_date: movie.releaseDate,
                        overview: movie.overview
                    })
                });
            } else {
                await fetch(`${BASE_URL}/favorites/${movie.movieId || movie.id}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (currentType === "favorites") {
                    movieElement.remove();
                    if (!container.children.length) {
                        container.innerHTML = "<p style='color:#fff; font-size:18px; text-align:center;'>Nenhum favorito ainda.</p>";
                    }
                }
            }
        } catch (err) {
            console.error("Erro ao atualizar favorito:", err);
        }
    });

    if (movie.isFavorite || currentType === "favorites") {
        movieElement.classList.add("favorite");
        favIcon.src = "src/dashboard/img/fullheart.svg";
        favText.textContent = "Favorito";
    }
}

// =========================
// Renderizar filme
// =========================
function renderMovie(movie) {
    const movieEl = document.createElement("div");
    movieEl.classList.add("movie");
    movieEl.dataset.id = movie.id;

    movieEl.innerHTML = `
        <div class="movie-image">
            <img src="${movie.posterPath ? `https://image.tmdb.org/t/p/w500${movie.posterPath}` : 'src/dashboard/img/no-image.png'}" alt="${movie.title}">
        </div>
        <div class="movie-information">
            <div class="movie-name"><p>${movie.title} (${movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : ''})</p></div>
            <div class="movie-details">
                <div class="movie-rate"><img src="src/dashboard/img/star.svg" alt=""><p>${movie.voteAverage?.toFixed(1) || 'N/A'}</p></div>
                <div class="movie-fav">
                    <img src="src/dashboard/img/heart.svg" alt="">
                    <p>Favoritar</p>
                </div>
            </div>
        </div>
        <div class="movie-description">
            <div class="movie-text">${movie.overview || "Descrição não disponível."}</div>
        </div>
    `;
    container.appendChild(movieEl);
    toggleFavorite(movieEl, movie);
}

// =========================
// Buscar filmes do backend
// =========================
async function fetchMovies(type, page = 1) {
    try {
        const token = localStorage.getItem("token");
        let url;

        if (type === "nowplaying") url = `${BASE_URL}/movies/nowplaying?page=${page}`;
        else if (type === "upcoming") url = `${BASE_URL}/movies/upcoming?page=${page}`;
        else if (type === "favorites") url = `${BASE_URL}/favorites`;
        else url = `${BASE_URL}/movies/${type}?page=${page}`;

        const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const data = await res.json();

        currentPage = data.page || page;
        totalPages = data.totalPages || 1;

        let movies = data.results || data;

        movies = movies.map(m => ({
            id: m.id || m.movieId,
            tmdbId: m.tmdbId || m.id,
            title: m.title,
            posterPath: m.posterPath || m.poster_path || "",
            overview: m.overview || m.description || "",
            voteAverage: m.voteAverage || m.vote_average || 0,
            releaseDate: m.releaseDate || m.release_date || null,
            isFavorite: m.isFavorite || false,
            createdAt: m.createdAt || new Date()
        }));

        if (type !== "favorites") {
            const favRes = await fetch(`${BASE_URL}/favorites`, { headers: { "Authorization": `Bearer ${token}` } });
            if (favRes.ok) {
                const favMovies = await favRes.json();
                const favIds = favMovies.map(f => f.movieId);
                movies.forEach(m => m.isFavorite = favIds.includes(m.id));
            }
        }

        return movies;
    } catch (err) {
        console.error(`Erro ao buscar filmes ${type}:`, err);
        return [];
    }
}

// =========================
// Mostrar filmes com pesquisa filtrada
// =========================
async function showMovies(type, searchQuery = "", sortType = "recent", append = false) {
    currentType = type;
    if (!append) container.innerHTML = "";

    if (type === "home" && !searchQuery) {
        pageTitle.textContent = "Bem-Vindo(a).";
        pageSubtitle.style.display = "block";
        container.style.display = "none";
        if (favoritesControls) favoritesControls.style.display = "none";
        return;
    } else {
        pageSubtitle.style.display = "none";
        container.style.display = "grid";
        if (favoritesControls) favoritesControls.style.display = type === "favorites" ? "flex" : "none";
    }

    let movies = [];

    if (type === "favorites") {
        const allFavs = await fetchMovies("favorites", 1);
        movies = allFavs.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
        if (sortType === "recent") movies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        else if (sortType === "rated") movies.sort((a, b) => b.voteAverage - a.voteAverage);
    } 
    else if (type === "nowplaying") {
        const allNow = await fetchMovies("nowplaying", 1);
        movies = allNow.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
    } 
    else if (type === "upcoming") {
        const allUpcoming = await fetchMovies("upcoming", 1);
        movies = allUpcoming.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
    } 
    else {
        if (searchQuery) {
            const token = localStorage.getItem("token");
            const res = await fetch(`${BASE_URL}/movies/search?q=${encodeURIComponent(searchQuery)}&page=${currentPage}`, { headers: { "Authorization": `Bearer ${token}` } });
            const data = await res.json();
            movies = data.results.map(m => ({
                id: m.id || m.movieId,
                tmdbId: m.tmdbId || m.id,
                title: m.title,
                posterPath: m.posterPath || m.poster_path || "",
                overview: m.overview || m.description || "",
                voteAverage: m.voteAverage || m.vote_average || 0,
                releaseDate: m.releaseDate || m.release_date || null,
                isFavorite: m.isFavorite || false,
                createdAt: m.createdAt || new Date()
            }));
        } else {
            movies = await fetchMovies(type === "home" ? "popular" : type, currentPage);
        }
    }

    const existingIds = Array.from(container.querySelectorAll(".movie")).map(el => parseInt(el.dataset.id));
    const newMovies = movies.filter(m => !existingIds.includes(m.id));
    newMovies.forEach(movie => renderMovie(movie));

    if (!container.children.length && type !== "home") {
        container.innerHTML = "<p style='color:#fff; font-size:18px; text-align:center;'>Nenhum filme encontrado.</p>";
    }

    if (type === "home" && searchQuery) pageTitle.textContent = "Resultados da pesquisa";
    else if (type === "popular") pageTitle.textContent = "Filmes Populares";
    else if (type === "toprated") pageTitle.textContent = "Mais Avaliados";
    else if (type === "favorites") pageTitle.textContent = "Favoritos";
    else if (type === "nowplaying") pageTitle.textContent = "Em Cartaz";
    else if (type === "upcoming") pageTitle.textContent = "Próximas Estreias";
}

// =========================
// Input pesquisa com debounce
// =========================
searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentQuery = searchInput.value;
        currentPage = 1;
        totalPages = 1;
        showMovies(currentType, currentQuery, currentSort);
    }, 300);
});

// =========================
// Scroll infinito
// =========================
window.addEventListener("scroll", () => {
    if (isLoading || currentType === "settings") return; // não carrega scroll na aba Configurações
    if (currentPage >= totalPages) return;
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
        currentPage++;
        showMovies(currentType, currentQuery, currentSort, true);
    }
});

// =========================
// Sidebar interações seguro
// =========================
const homeBtn = document.getElementById("home-btn");
const popularBtn = document.getElementById("popular-btn");
const nowPlayingBtn = document.getElementById("nowplaying-btn");
const upcomingBtn = document.getElementById("upcoming-btn");
const favoritesBtn = document.getElementById("favorites-btn");
const topRatedBtn = document.getElementById("top-rated-btn");
const settingsBtn = document.getElementById("settings-btn"); // botão da aba de configurações

const sideItems = [homeBtn, popularBtn, nowPlayingBtn, upcomingBtn, favoritesBtn, topRatedBtn, settingsBtn].filter(Boolean);

function resetActive() {
    sideItems.forEach(b => b.classList.remove("active"));
}

sideItems.forEach(btn => {
    btn.addEventListener("click", () => {
        resetActive();
        btn.classList.add("active");

        currentPage = 1;
        totalPages = 1;
        currentQuery = "";
        searchInput.value = "";
        currentSort = "recent";

        const settingsContainer = document.getElementById('settings-container');
        if (settingsContainer) settingsContainer.style.display = "none";

        container.style.display = "grid";
        searchInput.style.display = "block";
        const searchIcon = document.querySelector("#search-box i");
        if (searchIcon) searchIcon.style.display = "block";
        if (favoritesControls) favoritesControls.style.display = "none";

        if (btn === homeBtn) showMovies("home", currentQuery, currentSort);
        else if (btn === popularBtn) showMovies("popular", currentQuery, currentSort);
        else if (btn === nowPlayingBtn) showMovies("nowplaying", currentQuery, currentSort);
        else if (btn === upcomingBtn) showMovies("upcoming", currentQuery, currentSort);
        else if (btn === favoritesBtn) showMovies("favorites", currentQuery, currentSort);
        else if (btn === topRatedBtn) showMovies("toprated", currentQuery, currentSort);
        else if (btn === settingsBtn) showSettings();
    });
});

// =========================
// Toggle Sidebar Expand/Collapse
// =========================
const sidebar = document.getElementById("sidebar");
const sidebarToggleBtn = document.getElementById("open_btn");

if (sidebar && sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle('open-sidebar');
    });
}

// =========================
// Topnav Mobile Refatorado
// =========================
const hamburgerBtn = document.getElementById("hamburger-btn");
const mobileMenu = document.getElementById("mobile-menu");

function loadMobileUser() {
    if (!mobileMenu) return;
    const token = localStorage.getItem("token");
    let username = "Usuário";

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            username = payload.username || username;
        } catch(e) {
            console.error(e);
        }
    }

    // Atualiza ou cria o elemento de usuário no mobile menu
    const mobileUserInfo = document.getElementById("mobile_user_infos");
    if (mobileUserInfo) {
        mobileUserInfo.querySelector(".username").textContent = username;
    } else {
        const mobileUser = document.createElement("p");
        mobileUser.id = "mobile_user_infos";
        mobileUser.innerHTML = `<span class="greeting">Olá, </span><span class="username">${username}</span>`;
        mobileMenu.prepend(mobileUser);
    }
}

if (hamburgerBtn && mobileMenu) {
    hamburgerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        mobileMenu.classList.toggle("open");
        document.body.classList.toggle("menu-open");
    });
}

document.addEventListener("click", (e) => {
    if (
        mobileMenu.classList.contains("open") &&
        !mobileMenu.contains(e.target) &&
        e.target !== hamburgerBtn
    ) {
        mobileMenu.classList.remove("open");
        document.body.classList.remove("menu-open");
    }
});

function initMobileMenuItems() {
    if (!mobileMenu) return;
    const mobileItems = mobileMenu.querySelectorAll(".mobile-side-item");
    mobileItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.stopPropagation();
            mobileItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");
            mobileMenu.classList.remove("open");
            document.body.classList.remove("menu-open");

            const btnId = item.dataset.target;
            if (btnId) {
                const btn = document.getElementById(btnId);
                if (btn) btn.click();
            }
        });
    });
}

// =========================
// Função Configurações
// =========================
function showSettings() {
    currentType = "settings";
    pageTitle.textContent = "Configurações da Conta";
    pageSubtitle.style.display = "none";
    container.style.display = "none";
    searchInput.style.display = "none";
    const searchIcon = document.querySelector("#search-box i");
    if (searchIcon) searchIcon.style.display = "none";
    if (favoritesControls) favoritesControls.style.display = "none";

    const existingSettings = document.getElementById('settings-container');
    if (existingSettings) existingSettings.remove();

    const settingsDiv = document.createElement("div");
    settingsDiv.id = "settings-container";
    settingsDiv.className = "settings";
    settingsDiv.innerHTML = `
        <h2></h2>
        <div class="setting-option">
            <label for="username">Alterar username:</label>
            <input type="text" id="new-username" placeholder="Novo username">
            <button id="change-username-btn">Salvar</button>
        </div>
        <div class="setting-option">
            <label for="password">Alterar senha:</label>
            <div class="password-wrapper">
                <input type="password" id="new-password" placeholder="Nova senha">
                <i class="password-icon fa fa-eye"></i>
            </div>
            <button id="change-password-btn">Salvar</button>
        </div>
        <div class="setting-option">
            <button id="clear-favorites-btn">Limpar favoritos</button>
        </div>
        <div class="setting-option">
            <button id="delete-account-btn" class="danger">Excluir conta</button>
        </div>
        <div id="settings-message" style="margin-top:10px;color:green;"></div>
    `;
    mainContainer.appendChild(settingsDiv);

    const token = localStorage.getItem("token");
    const messageEl = settingsDiv.querySelector('#settings-message');

    // Alterar username
    settingsDiv.querySelector('#change-username-btn').addEventListener('click', async () => {
        const newUsername = settingsDiv.querySelector('#new-username').value.trim();
        if (!newUsername) return alert("Digite um username válido.");

        try {
            const res = await fetch(`${BASE_URL}/user/username`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username: newUsername })
            });
            const data = await res.json();
            if (res.ok) {
                messageEl.textContent = "Username alterado com sucesso! Relogue para atualizar";
                messageEl.style.color = "green";
            } else {
                messageEl.textContent = "Erro: " + data.message;
                messageEl.style.color = "red";
            }
        } catch (err) {
            console.error(err);
            messageEl.textContent = "Erro ao alterar username.";
            messageEl.style.color = "red";
        }
    });

    // Alterar senha
    const passwordInput = settingsDiv.querySelector('#new-password');
    const eyeIcon = settingsDiv.querySelector('.password-icon');
    const changePasswordBtn = settingsDiv.querySelector('#change-password-btn');

    eyeIcon.addEventListener('click', () => {
        passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
        eyeIcon.classList.toggle('fa-eye');
        eyeIcon.classList.toggle('fa-eye-slash');
    });

    function passwordIsSecure(value) {
        if (!value.trim()) return '⚠ É obrigatório digitar uma senha';
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#\$%\^&\*]).{8,}$/;
        if (!regex.test(value)) return `
⚠ Sua senha deve conter ao menos: <br>
- 8 caracteres <br>
- 1 letra maiúscula <br>
- 1 letra minúscula <br>
- 1 número <br>
- 1 caractere especial (!@#$%^&*)
        `;
        return null;
    }

    function showInlineError(input, message) {
        const box = input.closest('.setting-option');
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
        const box = input.closest('.setting-option');
        const errorSpan = box.querySelector('.error');
        if (errorSpan) errorSpan.remove();
        box.classList.remove('invalid');
    }

    passwordInput.addEventListener('input', () => clearInlineError(passwordInput));

    changePasswordBtn.addEventListener('click', async () => {
        const newPassword = passwordInput.value.trim();
        clearInlineError(passwordInput);

        const passwordError = passwordIsSecure(newPassword);
        if (passwordError) {
            showInlineError(passwordInput, passwordError);
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}/user/password`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ password: newPassword })
            });
            const data = await res.json();
            if (res.ok) {
                messageEl.textContent = "Senha alterada com sucesso!";
                messageEl.style.color = "green";
                passwordInput.value = "";
            } else {
                showInlineError(passwordInput, data.message || "Erro ao alterar senha");
            }
        } catch (err) {
            console.error(err);
            showInlineError(passwordInput, "Erro de conexão com o servidor");
        }
    });

    // Limpar favoritos
    settingsDiv.querySelector('#clear-favorites-btn').addEventListener('click', async () => {
        if (!confirm("Deseja realmente limpar todos os favoritos?")) return;
        try {
            const res = await fetch(`${BASE_URL}/user/favorites`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                messageEl.textContent = "Favoritos limpos com sucesso!";
                messageEl.style.color = 'green';
            } else {
                const data = await res.json();
                messageEl.textContent = "Erro: " + data.message;
                messageEl.style.color = 'red';
            }
        } catch (err) {
            console.error(err);
            messageEl.textContent = "Erro ao limpar favoritos.";
            messageEl.style.color = 'red';
        }
    });

    // Excluir conta
    settingsDiv.querySelector('#delete-account-btn').addEventListener('click', async () => {
        if (!confirm("Tem certeza que deseja excluir sua conta? Esta ação é irreversível!")) return;
        try {
            const res = await fetch(`${BASE_URL}/user`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                alert("Conta excluída com sucesso!");
                localStorage.removeItem('token');
                window.location.href = "index.html";
            } else {
                const data = await res.json();
                messageEl.textContent = "Erro: " + data.message;
                messageEl.style.color = 'red';
            }
        } catch (err) {
            console.error(err);
            messageEl.textContent = "Erro ao excluir conta.";
            messageEl.style.color = 'red';
        }
    });
}

// =========================
// Logout
// =========================
document.getElementById("logout_btn").addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "index.html";
});

// Logout Mobile
document.getElementById("mobile-logout")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "index.html";
});

// =========================
// Dropdown customizado
// =========================
const customSelects = document.querySelectorAll(".custom-select");
customSelects.forEach(wrapper => {
    const selected = wrapper.querySelector(".select-selected");
    const optionsContainer = wrapper.querySelector(".select-items");

    selected.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllSelects(selected);
        const open = optionsContainer.style.display === "flex";
        optionsContainer.style.display = open ? "none" : "flex";
        selected.classList.toggle("active", !open);
    });

    optionsContainer.querySelectorAll("div").forEach(option => {
        option.addEventListener("click", () => {
            selected.textContent = option.textContent;
            currentSort = option.dataset.value;
            showMovies(currentType, currentQuery, currentSort);
            optionsContainer.style.display = "none";
            selected.classList.remove("active");
        });
    });
});

function closeAllSelects(except) {
    customSelects.forEach(wrapper => {
        const selected = wrapper.querySelector(".select-selected");
        const options = wrapper.querySelector(".select-items");
        if (selected !== except) {
            options.style.display = "none";
            selected.classList.remove("active");
        }
    });
}
document.addEventListener("click", closeAllSelects);

// =========================
// Inicialização
// =========================
window.onload = () => {
    loadUserName();
    loadMobileUser();
    initMobileMenuItems();

    // Marca o sidebar home ativo
    document.querySelectorAll('.side-item').forEach(b => b.classList.remove('active'));
    document.getElementById('home-btn')?.classList.add('active');

    // Marca o mobile menu home ativo
    const mobileHome = document.querySelector('#mobile-items .mobile-side-item[data-target="home-btn"]');
    if (mobileHome) mobileHome.classList.add('active');

    showMovies("home");
};