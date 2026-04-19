/* ===== STREAMVAULT — APP.JS (Supabase Edition) ===== */

// ================================================================
// ⚙️  CONFIGURAÇÃO SUPABASE — substitua pelos seus valores reais
// ================================================================
const SUPABASE_URL = 'https://SEU_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY';
// ================================================================

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado da aplicação
const state = {
  videos: [],
  currentVideo: null,
  currentPage: 'home',
  user: null,
  filterCategory: null,
};

// ================================================================
// INICIALIZAÇÃO
// ================================================================
async function init() {
  // Detecta sessão ativa
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    setUser(session.user);
  }

  // Escuta mudanças de auth
  sb.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      setUser(session.user);
    } else {
      setUser(null);
    }
  });

  // Carrega vídeos da home
  await loadVideos();

  // Event listeners
  document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
  document.getElementById('searchBtn').addEventListener('click', handleSearch);
  document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });
}

// ================================================================
// AUTH — USUÁRIO
// ================================================================
function setUser(user) {
  state.user = user;
  const btn = document.getElementById('btnAuth');
  const label = document.getElementById('btnAuthLabel');

  if (user) {
    label.textContent = user.email?.split('@')[0] || 'Perfil';
    btn.onclick = handleLogout;
    // Mostra form de upload
    const blocked = document.getElementById('upload-blocked');
    const formWrap = document.getElementById('upload-form-wrap');
    if (blocked) blocked.style.display = 'none';
    if (formWrap) formWrap.style.display = 'block';
  } else {
    label.textContent = 'Entrar';
    btn.onclick = () => openModal('loginModal');
    // Esconde form de upload
    const blocked = document.getElementById('upload-blocked');
    const formWrap = document.getElementById('upload-form-wrap');
    if (blocked) blocked.style.display = 'block';
    if (formWrap) formWrap.style.display = 'none';
  }
}

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  errEl.style.display = 'none';
  if (!email || !password) {
    errEl.textContent = 'Preencha e-mail e senha.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando...';

  const { error } = await sb.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = 'Entrar na Conta';

  if (error) {
    errEl.textContent = 'E-mail ou senha incorretos.';
    errEl.style.display = 'block';
    return;
  }

  closeModal('loginModal');
  showToast('Login realizado com sucesso! 🎉');
}

async function handleRegister() {
  const username = document.getElementById('registerUsername').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const errEl = document.getElementById('registerError');
  const btn = document.getElementById('registerBtn');

  errEl.style.display = 'none';

  if (!username || !email || !password) {
    errEl.textContent = 'Preencha todos os campos.';
    errEl.style.display = 'block';
    return;
  }
  if (password.length < 8) {
    errEl.textContent = 'A senha deve ter no mínimo 8 caracteres.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Criando conta...';

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { username } }
  });

  btn.disabled = false;
  btn.textContent = 'Criar Conta Grátis';

  if (error) {
    errEl.textContent = error.message === 'User already registered'
      ? 'Este e-mail já está cadastrado.'
      : 'Erro ao criar conta. Tente novamente.';
    errEl.style.display = 'block';
    return;
  }

  // Salva perfil na tabela profiles
  if (data.user) {
    await sb.from('profiles').upsert({
      id: data.user.id,
      username,
      email,
    });
  }

  closeModal('registerModal');
  showToast('Conta criada! Verifique seu e-mail para confirmar. ✅');
}

async function handleLogout() {
  await sb.auth.signOut();
  showToast('Você saiu da conta.');
}

// ================================================================
// VÍDEOS — CARREGAR
// ================================================================
async function loadVideos(category = null) {
  showLoadingState(true);

  let query = sb.from('videos').select('*').order('created_at', { ascending: false });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  showLoadingState(false);

  if (error) {
    console.error('Erro ao carregar vídeos:', error);
    showEmptyState(true);
    return;
  }

  state.videos = data || [];

  if (state.videos.length === 0) {
    showEmptyState(true);
  } else {
    showEmptyState(false);
    renderVideosGrid(state.videos);
  }
}

function renderVideosGrid(videos) {
  const grid = document.getElementById('videos-grid');
  const section = document.getElementById('videos-grid-section');

  section.style.display = 'block';
  grid.innerHTML = videos.map(v => `
    <div class="video-card" onclick="openVideo('${v.id}')" style="cursor:pointer;">
      <div class="video-card-thumb" style="position:relative; border-radius:10px; overflow:hidden; aspect-ratio:16/9; background:#1a1a2e;">
        ${v.thumbnail_url
          ? `<img src="${v.thumbnail_url}" alt="${escapeHtml(v.title)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fas fa-film" style="font-size:32px;color:var(--text-muted)"></i></div>`
        }
        ${v.is_premium ? `<div style="position:absolute;top:8px;right:8px;background:var(--accent-pink);color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;"><i class="fas fa-crown"></i> PREMIUM</div>` : ''}
        ${v.duration ? `<div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.75);color:#fff;font-size:11px;padding:2px 7px;border-radius:4px;font-weight:600;">${escapeHtml(v.duration)}</div>` : ''}
      </div>
      <div style="padding:10px 4px 4px;">
        <div style="font-weight:600;font-size:14px;line-height:1.4;margin-bottom:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(v.title)}</div>
        <div style="font-size:12px;color:var(--text-muted);">${escapeHtml(v.creator_name || '')}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${formatViews(v.views)} views · ${formatDate(v.created_at)}</div>
      </div>
    </div>
  `).join('');
}

// ================================================================
// VÍDEOS — ABRIR DETALHE
// ================================================================
async function openVideo(id) {
  const video = state.videos.find(v => v.id === id);
  if (!video) return;
  state.currentVideo = video;

  // Incrementa views
  await sb.from('videos').update({ views: (video.views || 0) + 1 }).eq('id', id);

  // Preenche a página
  document.getElementById('videoDetailTitle').textContent = video.title;
  document.getElementById('videoDetailViews').textContent = formatViews(video.views || 0);
  document.getElementById('videoDetailDuration').textContent = video.duration || '—';
  document.getElementById('videoDetailDate').textContent = formatDate(video.created_at);
  document.getElementById('likeCount').textContent = formatViews(video.likes || 0);
  document.getElementById('videoDetailDesc').textContent = video.description || 'Sem descrição.';
  document.getElementById('creatorName').textContent = video.creator_name || '—';
  document.getElementById('creatorAvatar').textContent = (video.creator_name || '?')[0].toUpperCase();

  // Player de vídeo
  const container = document.getElementById('videoPlayerContainer');
  if (video.video_url) {
    // Tenta embed como vídeo direto ou iframe
    const isYoutube = video.video_url.includes('youtube.com') || video.video_url.includes('youtu.be');
    const isVimeo = video.video_url.includes('vimeo.com');

    if (isYoutube) {
      const ytId = extractYoutubeId(video.video_url);
      container.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytId}" style="width:100%;aspect-ratio:16/9;border:none;border-radius:12px;" allowfullscreen></iframe>`;
    } else if (isVimeo) {
      const vmId = video.video_url.split('/').pop();
      container.innerHTML = `<iframe src="https://player.vimeo.com/video/${vmId}" style="width:100%;aspect-ratio:16/9;border:none;border-radius:12px;" allowfullscreen></iframe>`;
    } else {
      container.innerHTML = `<video src="${video.video_url}" controls style="width:100%;border-radius:12px;background:#000;"></video>`;
    }
  } else {
    container.innerHTML = `<div class="video-placeholder"><i class="fas fa-play-circle"></i><p style="color:var(--text-muted)">URL de vídeo não disponível</p></div>`;
  }

  // Vídeos relacionados
  const related = state.videos.filter(v => v.id !== id && v.category === video.category).slice(0, 4);
  document.getElementById('relatedVideos').innerHTML = related.map(v => `
    <div onclick="openVideo('${v.id}')" style="display:flex;gap:10px;margin-bottom:12px;cursor:pointer;align-items:flex-start;">
      <div style="width:100px;min-width:100px;aspect-ratio:16/9;border-radius:6px;overflow:hidden;background:#1a1a2e;">
        ${v.thumbnail_url ? `<img src="${v.thumbnail_url}" style="width:100%;height:100%;object-fit:cover;">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fas fa-film" style="color:var(--text-muted)"></i></div>'}
      </div>
      <div>
        <div style="font-size:13px;font-weight:600;line-height:1.3;">${escapeHtml(v.title)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${escapeHtml(v.creator_name || '')}</div>
      </div>
    </div>
  `).join('') || '<p style="color:var(--text-muted);font-size:13px;">Sem vídeos relacionados.</p>';

  // Vídeos do criador
  document.getElementById('creatorVideos').textContent = state.videos.filter(v => v.creator_name === video.creator_name).length;

  showPage('video');
}

// ================================================================
// VÍDEOS — PUBLICAR
// ================================================================
async function handleUploadSubmit() {
  if (!state.user) {
    openModal('loginModal');
    return;
  }

  const url = document.getElementById('uploadUrl').value.trim();
  const thumbnail = document.getElementById('uploadThumbnail').value.trim();
  const title = document.getElementById('uploadTitle').value.trim();
  const desc = document.getElementById('uploadDesc').value.trim();
  const category = document.getElementById('uploadCategory').value;
  const creator = document.getElementById('uploadCreator').value.trim();
  const duration = document.getElementById('uploadDuration').value.trim();
  const isPremium = document.getElementById('uploadPremium').checked;

  if (!title || !creator) {
    showToast('Preencha pelo menos o título e o criador!');
    return;
  }

  const btn = document.querySelector('#page-upload .form-submit');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>Publicando...';

  const { error } = await sb.from('videos').insert({
    title,
    description: desc,
    video_url: url || null,
    thumbnail_url: thumbnail || null,
    category: category || null,
    creator_name: creator,
    duration: duration || null,
    is_premium: isPremium,
    user_id: state.user.id,
    views: 0,
    likes: 0,
  });

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-cloud-upload-alt" style="margin-right:8px"></i>Publicar Vídeo';

  if (error) {
    showToast('Erro ao publicar vídeo. Tente novamente.');
    console.error(error);
    return;
  }

  // Limpa o form
  ['uploadUrl','uploadThumbnail','uploadTitle','uploadDesc','uploadCreator','uploadDuration'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('uploadPremium').checked = false;
  document.getElementById('uploadCategory').value = '';

  showToast('Vídeo publicado com sucesso! 🎬');
  await loadVideos(state.filterCategory);
  showPage('home');
}

// ================================================================
// FILTROS E BUSCA
// ================================================================
async function filterByCategory(slug) {
  state.filterCategory = slug;

  const names = {
    destaques: 'Destaques', lancamentos: 'Lançamentos', premium: 'Premium',
    'em-alta': 'Em Alta', 'top-films': 'Top Films', selecao: 'Seleção Imperdível'
  };
  const icons = {
    destaques: 'fa-star', lancamentos: 'fa-rocket', premium: 'fa-crown',
    'em-alta': 'fa-fire', 'top-films': 'fa-film', selecao: 'fa-gem'
  };

  document.getElementById('grid-title').textContent = names[slug] || slug;
  document.getElementById('grid-icon').className = `fas ${icons[slug] || 'fa-play'}`;
  document.getElementById('btn-clear-filter').style.display = 'inline-flex';

  await loadVideos(slug);
  showPage('home');
}

async function clearFilter() {
  state.filterCategory = null;
  document.getElementById('grid-title').textContent = 'Todos os Vídeos';
  document.getElementById('grid-icon').className = 'fas fa-play';
  document.getElementById('btn-clear-filter').style.display = 'none';
  await loadVideos();
}

async function handleSearch() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  if (!q) {
    await clearFilter();
    return;
  }

  const filtered = state.videos.filter(v =>
    v.title?.toLowerCase().includes(q) ||
    v.creator_name?.toLowerCase().includes(q) ||
    v.category?.toLowerCase().includes(q)
  );

  document.getElementById('grid-title').textContent = `Resultados para "${q}"`;
  document.getElementById('grid-icon').className = 'fas fa-search';
  document.getElementById('btn-clear-filter').style.display = 'inline-flex';
  document.getElementById('btn-clear-filter').onclick = clearFilter;

  const section = document.getElementById('videos-grid-section');
  const emptyState = document.getElementById('empty-state');
  const loading = document.getElementById('loading-state');

  loading.style.display = 'none';

  if (filtered.length === 0) {
    section.style.display = 'none';
    emptyState.style.display = 'block';
    emptyState.querySelector('h2').textContent = 'Nenhum resultado';
    emptyState.querySelector('p').textContent = `Não encontramos vídeos para "${q}"`;
  } else {
    section.style.display = 'block';
    emptyState.style.display = 'none';
    renderVideosGrid(filtered);
  }

  showPage('home');
}

async function toggleLike() {
  if (!state.currentVideo) return;
  const v = state.currentVideo;
  const newLikes = (v.likes || 0) + 1;
  await sb.from('videos').update({ likes: newLikes }).eq('id', v.id);
  state.currentVideo.likes = newLikes;
  document.getElementById('likeCount').textContent = formatViews(newLikes);
  showToast('❤️ Curtida registrada!');
}

function shareVideo() {
  if (navigator.share) {
    navigator.share({ title: state.currentVideo?.title, url: window.location.href });
  } else {
    navigator.clipboard.writeText(window.location.href).then(() => showToast('Link copiado!'));
  }
}

// ================================================================
// NAVEGAÇÃO
// ================================================================
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');
  state.currentPage = page;

  // Upload: mostra/esconde form conforme login
  if (page === 'upload') {
    const blocked = document.getElementById('upload-blocked');
    const formWrap = document.getElementById('upload-form-wrap');
    if (state.user) {
      if (blocked) blocked.style.display = 'none';
      if (formWrap) formWrap.style.display = 'block';
    } else {
      if (blocked) blocked.style.display = 'block';
      if (formWrap) formWrap.style.display = 'none';
    }
  }

  closeSidebar();
  window.scrollTo(0, 0);
}

function showLoadingState(show) {
  document.getElementById('loading-state').style.display = show ? 'block' : 'none';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('videos-grid-section').style.display = show ? 'none' : 'block';
}

function showEmptyState(show) {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('empty-state').style.display = show ? 'block' : 'none';
  document.getElementById('videos-grid-section').style.display = show ? 'none' : 'block';
}

// ================================================================
// SIDEBAR
// ================================================================
function toggleSidebar() {
  const sidebar = document.getElementById('siteSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('siteSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ================================================================
// MODAIS
// ================================================================
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  // Limpa erros
  const err = document.getElementById(id === 'loginModal' ? 'loginError' : 'registerError');
  if (err) err.style.display = 'none';
}

// Fecha modal clicando fora
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ================================================================
// TOAST
// ================================================================
function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('active');
  setTimeout(() => toast.classList.remove('active'), duration);
}

// ================================================================
// UTILS
// ================================================================
function formatViews(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + ' mi';
  if (n >= 1000) return (n / 1000).toFixed(1) + ' mil';
  return String(n);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d atrás`;
  return d.toLocaleDateString('pt-BR');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function extractYoutubeId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([^&\s?]+)/);
  return m ? m[1] : '';
}

// ================================================================
// START
// ================================================================
document.addEventListener('DOMContentLoaded', init);
