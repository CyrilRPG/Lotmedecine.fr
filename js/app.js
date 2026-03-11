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
          </div>
        </article>
      `;
    }).join('');
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
  }
});
