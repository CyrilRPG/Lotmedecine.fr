/* ============================================
   LotMédecine — Application JS
   ============================================ */

const SUPABASE_URL = 'https://gpccpvzweswtzklkvkrz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwY2Nwdnp3ZXN3dHprbGt2a3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzg3MDcsImV4cCI6MjA4ODgxNDcwN30.UgwUK_onkzcqBwKMzyb5kKKgrlbKRrbpQ21NY_BTWWQ';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* --- Utils --- */
function formatPrice(val) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function sanitizeFilename(name) {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase();
}

function randomId() {
  return Math.random().toString(36).substring(2, 8);
}

/* --- Header --- */
function initHeader() {
  const hamburger = document.querySelector('.header__hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileNav.classList.toggle('open');
  });

  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileNav.classList.remove('open');
    });
  });
}

/* --- Annonces Page --- */
async function initAnnonces() {
  const grid = document.getElementById('annonces-grid');
  const loading = document.getElementById('annonces-loading');
  const empty = document.getElementById('annonces-empty');
  if (!grid) return;

  try {
    const { data, error } = await sb
      .from('annonces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (loading) loading.style.display = 'none';

    if (!data || data.length === 0) {
      if (empty) empty.style.display = 'block';
      return;
    }

    grid.innerHTML = data.map(a => {
      const photo = a.photos && a.photos.length > 0
        ? `<img src="${a.photos[0]}" alt="${a.titre}" loading="lazy">`
        : '';
      const badgeClass = a.statut === 'vendu' ? 'card__badge--vendu' : 'card__badge--disponible';
      const badgeText = a.statut === 'vendu' ? 'Vendu' : 'Disponible';
      const emailSafe = (a.email || '').replace(/"/g, '&quot;');
      const telSafe = (a.telephone || '').replace(/"/g, '&quot;');
      const nameSafe = (a.prenom_nom || '').replace(/"/g, '&quot;');
      return `
        <article class="card">
          <div class="card__image">
            ${photo}
            <span class="card__badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="card__body">
            <h3 class="card__title">${a.titre}</h3>
            <p class="card__meta">${a.universite} · ${a.promo}</p>
            <p class="card__price">${formatPrice(a.prix)}</p>
            <button class="card__contact" data-email="${emailSafe}" data-tel="${telSafe}" data-name="${nameSafe}">Contacter</button>
          </div>
        </article>
      `;
    }).join('');

    // Bind contact buttons
    grid.querySelectorAll('.card__contact').forEach(btn => {
      btn.addEventListener('click', () => {
        openContactModal(btn.dataset.name, btn.dataset.email, btn.dataset.tel);
      });
    });
  } catch (err) {
    console.error('Erreur chargement annonces:', err);
    if (loading) loading.style.display = 'none';
    grid.innerHTML = '<p class="empty-state">Une erreur est survenue lors du chargement des annonces.</p>';
  }
}

/* --- Poster Page --- */
function initPoster() {
  const form = document.getElementById('poster-form');
  if (!form) return;

  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('photo-input');
  const previewsContainer = document.getElementById('photo-previews');
  const messageContainer = document.getElementById('form-message');
  let selectedFiles = [];

  // Drag & drop
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
      handleFiles(fileInput.files);
      fileInput.value = '';
    });
  }

  function handleFiles(fileList) {
    const newFiles = Array.from(fileList).filter(f =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 5 * 1024 * 1024
    );

    selectedFiles = [...selectedFiles, ...newFiles].slice(0, 5);
    renderPreviews();
  }

  function renderPreviews() {
    if (!previewsContainer) return;
    previewsContainer.innerHTML = selectedFiles.map((file, i) => `
      <div class="photo-preview" data-index="${i}">
        <img src="${URL.createObjectURL(file)}" alt="Aperçu">
        <button type="button" class="photo-preview__remove" data-index="${i}">&times;</button>
      </div>
    `).join('');

    previewsContainer.querySelectorAll('.photo-preview__remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        selectedFiles.splice(idx, 1);
        renderPreviews();
      });
    });
  }

  function showMessage(type, text) {
    if (!messageContainer) return;
    messageContainer.className = `form-message form-message--${type}`;
    messageContainer.textContent = text;
    messageContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function hideMessage() {
    if (!messageContainer) return;
    messageContainer.className = 'form-message';
    messageContainer.textContent = '';
  }

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Envoi en cours...';

    try {
      // Upload photos
      const photoUrls = [];
      for (const file of selectedFiles) {
        const filename = `${Date.now()}_${randomId()}_${sanitizeFilename(file.name)}`;
        const { error: uploadError } = await sb.storage
          .from('annonces-photos')
          .upload(filename, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = sb.storage
          .from('annonces-photos')
          .getPublicUrl(filename);

        photoUrls.push(urlData.publicUrl);
      }

      // Insert annonce
      const formData = new FormData(form);
      const { error: insertError } = await sb.from('annonces').insert({
        prenom_nom: formData.get('prenom_nom'),
        email: formData.get('email'),
        telephone: formData.get('telephone') || null,
        titre: formData.get('titre'),
        description: formData.get('description'),
        prix: parseFloat(formData.get('prix')),
        universite: formData.get('universite'),
        promo: formData.get('promo'),
        photos: photoUrls
      });

      if (insertError) throw insertError;

      showMessage('success', 'Ton annonce a bien été publiée ! Elle est maintenant visible sur la page Annonces.');
      form.reset();
      selectedFiles = [];
      renderPreviews();
    } catch (err) {
      console.error('Erreur soumission:', err);
      showMessage('error', 'Une erreur est survenue. Vérifie ta connexion et réessaie.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

/* --- Contact Modal --- */
function openContactModal(name, email, tel) {
  // Remove existing modal if any
  const existing = document.getElementById('contact-modal');
  if (existing) existing.remove();

  const emailRow = email ? `
    <div class="contact-info__row">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#111827" stroke-width="1.5"><rect x="2" y="4" width="16" height="12" rx="1"/><path d="M2 4l8 6 8-6"/></svg>
      <a href="mailto:${email}">${email}</a>
    </div>` : '';

  const telRow = tel ? `
    <div class="contact-info__row">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#111827" stroke-width="1.5"><path d="M3 5c0-1 1-2 2-2h1l2 4-1.5 1.5a10 10 0 004 4L12 11l4 2v1c0 1-1 2-2 2C8 16 3 11 3 5z"/></svg>
      <a href="tel:${tel}">${tel}</a>
    </div>` : '';

  const noInfo = !email && !tel ? '<p style="color:var(--color-secondary);">Aucune information de contact disponible.</p>' : '';

  const modal = document.createElement('div');
  modal.id = 'contact-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h3>Contacter ${name || 'le vendeur'}</h3>
        <button class="modal__close" id="contact-modal-close">&times;</button>
      </div>
      <div class="contact-info">
        ${emailRow}
        ${telRow}
        ${noInfo}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#contact-modal-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

/* --- Admin Page --- */
const ADMIN_PASSWORD = 'arnaultlebg';

function initAdmin() {
  const loginScreen = document.getElementById('admin-login');
  const dashboard = document.getElementById('admin-dashboard');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('admin-logout');
  if (!loginForm) return;

  // Check session
  if (sessionStorage.getItem('lotmed-admin') === 'true') {
    showDashboard();
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pwd = document.getElementById('admin-password').value;
    if (pwd === ADMIN_PASSWORD) {
      sessionStorage.setItem('lotmed-admin', 'true');
      loginError.style.display = 'none';
      showDashboard();
    } else {
      loginError.style.display = 'block';
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('lotmed-admin');
      loginScreen.style.display = 'flex';
      dashboard.style.display = 'none';
    });
  }

  function showDashboard() {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'block';
    loadAnnonces();
  }

  async function loadAnnonces() {
    const list = document.getElementById('admin-list');
    const loading = document.getElementById('admin-loading');
    const countEl = document.getElementById('admin-count');

    try {
      const { data, error } = await sb
        .from('annonces')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (loading) loading.style.display = 'none';
      if (countEl) countEl.textContent = `${data.length} annonce${data.length > 1 ? 's' : ''} au total`;

      if (!data || data.length === 0) {
        list.innerHTML = '<p style="color:var(--color-secondary);padding:32px 0;">Aucune annonce.</p>';
        return;
      }

      list.innerHTML = data.map(a => {
        const badgeClass = a.statut === 'vendu' ? 'card__badge--vendu' : 'card__badge--disponible';
        const badgeText = a.statut === 'vendu' ? 'Vendu' : 'Disponible';
        return `
          <div class="admin-row">
            <div class="admin-row__info">
              <div class="admin-row__title">${a.titre}</div>
              <div class="admin-row__meta">
                ${a.prenom_nom} · ${a.email} · ${formatPrice(a.prix)} · <span class="card__badge ${badgeClass}" style="position:static;display:inline;padding:2px 6px;font-size:10px;">${badgeText}</span> · ${formatDate(a.created_at)}
              </div>
            </div>
            <div class="admin-row__actions">
              <button class="btn btn--secondary btn--small admin-edit" data-id="${a.id}">Modifier</button>
              <button class="btn btn--danger btn--small admin-delete" data-id="${a.id}" data-titre="${(a.titre || '').replace(/"/g, '&quot;')}">Supprimer</button>
            </div>
          </div>
        `;
      }).join('');

      // Bind edit buttons
      list.querySelectorAll('.admin-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const annonce = data.find(a => a.id === btn.dataset.id);
          if (annonce) openEditModal(annonce, loadAnnonces);
        });
      });

      // Bind delete buttons
      list.querySelectorAll('.admin-delete').forEach(btn => {
        btn.addEventListener('click', () => {
          openDeleteModal(btn.dataset.id, btn.dataset.titre, loadAnnonces);
        });
      });
    } catch (err) {
      console.error('Admin load error:', err);
      if (loading) loading.style.display = 'none';
      list.innerHTML = '<p style="color:#991B1B;padding:32px 0;">Erreur de chargement.</p>';
    }
  }
}

function openEditModal(annonce, onSave) {
  const modal = document.getElementById('edit-modal');
  const form = document.getElementById('edit-form');
  const msg = document.getElementById('edit-message');

  document.getElementById('edit-id').value = annonce.id;
  document.getElementById('edit-titre').value = annonce.titre;
  document.getElementById('edit-prix').value = annonce.prix;
  document.getElementById('edit-universite').value = annonce.universite;
  document.getElementById('edit-promo').value = annonce.promo;
  document.getElementById('edit-prenom-nom').value = annonce.prenom_nom;
  document.getElementById('edit-email').value = annonce.email;
  document.getElementById('edit-telephone').value = annonce.telephone || '';
  document.getElementById('edit-statut').value = annonce.statut;
  document.getElementById('edit-description').value = annonce.description;

  msg.className = 'form-message';
  msg.textContent = '';
  modal.style.display = 'flex';

  const closeModal = () => { modal.style.display = 'none'; };
  document.getElementById('edit-modal-close').onclick = closeModal;
  document.getElementById('edit-cancel').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement...';

    try {
      const { error } = await sb.from('annonces').update({
        titre: document.getElementById('edit-titre').value,
        prix: parseFloat(document.getElementById('edit-prix').value),
        universite: document.getElementById('edit-universite').value,
        promo: document.getElementById('edit-promo').value,
        prenom_nom: document.getElementById('edit-prenom-nom').value,
        email: document.getElementById('edit-email').value,
        telephone: document.getElementById('edit-telephone').value || null,
        statut: document.getElementById('edit-statut').value,
        description: document.getElementById('edit-description').value,
      }).eq('id', document.getElementById('edit-id').value);

      if (error) throw error;

      closeModal();
      if (onSave) onSave();
    } catch (err) {
      console.error('Update error:', err);
      msg.className = 'form-message form-message--error';
      msg.textContent = 'Erreur lors de la sauvegarde.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer';
    }
  };
}

function openDeleteModal(id, titre, onDelete) {
  const modal = document.getElementById('delete-modal');
  document.getElementById('delete-id').value = id;
  document.getElementById('delete-title').textContent = titre;
  modal.style.display = 'flex';

  const closeModal = () => { modal.style.display = 'none'; };
  document.getElementById('delete-modal-close').onclick = closeModal;
  document.getElementById('delete-cancel').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };

  document.getElementById('delete-confirm').onclick = async () => {
    const btn = document.getElementById('delete-confirm');
    btn.disabled = true;
    btn.textContent = 'Suppression...';

    try {
      const { error } = await sb.from('annonces').delete().eq('id', id);
      if (error) throw error;
      closeModal();
      if (onDelete) onDelete();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Erreur lors de la suppression.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Supprimer';
    }
  };
}

/* --- Dispatcher --- */
document.addEventListener('DOMContentLoaded', () => {
  initHeader();

  const page = document.body.dataset.page;
  switch (page) {
    case 'annonces':
      initAnnonces();
      break;
    case 'poster':
      initPoster();
      break;
    case 'admin':
      initAdmin();
      break;
  }
});
