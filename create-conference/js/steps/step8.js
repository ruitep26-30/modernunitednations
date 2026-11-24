/**
 * Step 8 - Logo & Accent Color (Media & Branding)
 * Handles logo upload and accent color picker
 */

let logoFile = null;
let bannerFile = null;
let galleryFiles = [];
let accentColor = '#000000';

/**
 * Initialize Step 8
 */
export async function initStep8(existingData = {}) {
  // Restore data
  if (existingData.logoDataUrl) {
    showLogoPreview(existingData.logoDataUrl);
  }
  if (existingData.bannerDataUrl) {
    showBannerPreview(existingData.bannerDataUrl);
  }
  if (existingData.galleryDataUrls) {
    existingData.galleryDataUrls.forEach(url => addGalleryPreview(url));
  }
  if (existingData.accentColor) {
    accentColor = existingData.accentColor;
    updateColorPickerUI();
  }

  // Setup event listeners
  setupEventListeners();
}

/**
 * Cleanup Step 8
 */
export function cleanupStep8() {
  // Clean up object URLs
  if (logoFile) URL.revokeObjectURL(logoFile);
  if (bannerFile) URL.revokeObjectURL(bannerFile);
  galleryFiles.forEach(f => URL.revokeObjectURL(f));
}

/**
 * Get Step 8 data
 */
export function getStep8Data() {
  return {
    logoDataUrl: logoFile,
    bannerDataUrl: bannerFile,
    galleryDataUrls: galleryFiles,
    accentColor
  };
}

/**
 * Validate Step 8
 */
export function validateStep8(showErrors = false) {
  const hasLogo = Boolean(logoFile);
  const block = document.getElementById('logoUploadZone')?.closest('.cc-upload-block');

  if (!hasLogo) {
    if (showErrors) {
      if (block) {
        block.classList.add('has-error');
        block.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      window.dispatchEvent(new CustomEvent('wizard:toast', {
        detail: { message: 'Please upload a conference logo before proceeding.', type: 'error' }
      }));
    }
    return false;
  }

  if (block) {
    block.classList.remove('has-error');
  }

  return true;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Logo upload
  const logoInput = document.getElementById('logoInput');
  const logoZone = document.getElementById('logoUploadZone');
  const logoRemove = document.getElementById('logoRemoveBtn');

  logoInput?.addEventListener('change', e => handleLogoUpload(e.target.files[0]));
  logoZone?.addEventListener('click', () => logoInput?.click());
  logoZone?.addEventListener('dragover', handleDragOver);
  logoZone?.addEventListener('drop', e => handleLogoDrop(e));
  logoRemove?.addEventListener('click', removeLogo);

  // Banner upload
  const bannerInput = document.getElementById('bannerInput');
  const bannerZone = document.getElementById('bannerUploadZone');
  const bannerRemove = document.getElementById('bannerRemoveBtn');

  bannerInput?.addEventListener('change', e => handleBannerUpload(e.target.files[0]));
  bannerZone?.addEventListener('click', () => bannerInput?.click());
  bannerZone?.addEventListener('dragover', handleDragOver);
  bannerZone?.addEventListener('drop', e => handleBannerDrop(e));
  bannerRemove?.addEventListener('click', removeBanner);

  // Gallery uploads
  initGallerySlots();

  // Accent color picker
  const swatches = document.querySelectorAll('.cc-color-swatch');
  const hexInput = document.getElementById('accentHexInput');
  const accentDot = document.getElementById('accentDot');

  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      accentColor = swatch.dataset.color;
      if (hexInput) hexInput.value = accentColor;
      if (accentDot) accentDot.style.background = accentColor;
      window.dispatchEvent(new CustomEvent('wizard:dirty'));
    });
  });

  hexInput?.addEventListener('input', e => {
    const val = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      accentColor = val;
      if (accentDot) accentDot.style.background = val;
      swatches.forEach(s => s.classList.toggle('selected', s.dataset.color.toLowerCase() === val.toLowerCase()));
      window.dispatchEvent(new CustomEvent('wizard:dirty'));
    }
  });
}

/**
 * Handle logo upload
 */
function handleLogoUpload(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    window.dispatchEvent(new CustomEvent('wizard:toast', {
      detail: { message: 'Please upload an image file (PNG, JPG, SVG)', type: 'error' }
    }));
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    window.dispatchEvent(new CustomEvent('wizard:toast', {
      detail: { message: 'Logo file must be smaller than 5MB', type: 'error' }
    }));
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    logoFile = e.target.result;
    showLogoPreview(logoFile);
    document.getElementById('logoUploadZone')?.closest('.cc-upload-block')?.classList.remove('has-error');
    window.dispatchEvent(new CustomEvent('wizard:dirty'));
  };
  reader.readAsDataURL(file);
}

/**
 * Handle banner upload
 */
function handleBannerUpload(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    window.dispatchEvent(new CustomEvent('wizard:toast', {
      detail: { message: 'Please upload an image file (PNG, JPG)', type: 'error' }
    }));
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    window.dispatchEvent(new CustomEvent('wizard:toast', {
      detail: { message: 'Banner file must be smaller than 10MB', type: 'error' }
    }));
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    bannerFile = e.target.result;
    showBannerPreview(bannerFile);
    window.dispatchEvent(new CustomEvent('wizard:dirty'));
  };
  reader.readAsDataURL(file);
}

/**
 * Show logo preview
 */
function showLogoPreview(dataUrl) {
  const preview = document.getElementById('logoPreview');
  const img = document.getElementById('logoPreviewImg');
  const zone = document.getElementById('logoUploadZone');

  if (preview && img && zone) {
    img.src = dataUrl;
    preview.style.display = 'block';
    zone.style.display = 'none';
  }
}

/**
 * Remove logo
 */
function removeLogo(e) {
  e?.stopPropagation();
  logoFile = null;
  const preview = document.getElementById('logoPreview');
  const zone = document.getElementById('logoUploadZone');
  const input = document.getElementById('logoInput');

  if (preview && zone) {
    preview.style.display = 'none';
    zone.style.display = 'flex';
  }
  if (input) input.value = '';
  window.dispatchEvent(new CustomEvent('wizard:dirty'));
}

/**
 * Show banner preview
 */
function showBannerPreview(dataUrl) {
  const preview = document.getElementById('bannerPreview');
  const img = document.getElementById('bannerPreviewImg');
  const zone = document.getElementById('bannerUploadZone');

  if (preview && img && zone) {
    img.src = dataUrl;
    preview.style.display = 'block';
    zone.style.display = 'none';
  }
}

/**
 * Remove banner
 */
function removeBanner(e) {
  e?.stopPropagation();
  bannerFile = null;
  const preview = document.getElementById('bannerPreview');
  const zone = document.getElementById('bannerUploadZone');
  const input = document.getElementById('bannerInput');

  if (preview && zone) {
    preview.style.display = 'none';
    zone.style.display = 'flex';
  }
  if (input) input.value = '';
  window.dispatchEvent(new CustomEvent('wizard:dirty'));
}

/**
 * Initialize gallery slots
 */
function initGallerySlots() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  grid.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement('div');
    slot.className = 'cc-gallery-slot';
    slot.dataset.index = i;
    slot.innerHTML = `
      <input type="file" accept="image/*" style="display:none;" id="galleryInput_${i}" />
      <div class="cc-gallery-empty" id="galleryEmpty_${i}">
        <ion-icon name="add-outline"></ion-icon>
        <span>Add photo</span>
      </div>
      <div class="cc-gallery-filled" id="galleryFilled_${i}" style="display:none;">
        <img id="galleryImg_${i}" src="" alt="Gallery photo ${i + 1}" />
        <button class="cc-gallery-remove" data-index="${i}" title="Remove photo">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
    `;

    const input = slot.querySelector(`#galleryInput_${i}`);
    slot.addEventListener('click', e => {
      if (!e.target.closest('.cc-gallery-remove')) {
        input?.click();
      }
    });

    input?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) handleGalleryUpload(file, i);
    });

    const removeBtn = slot.querySelector('.cc-gallery-remove');
    removeBtn?.addEventListener('click', e => {
      e.stopPropagation();
      removeGalleryPhoto(i);
    });

    grid.appendChild(slot);
  }
}

/**
 * Handle gallery upload
 */
function handleGalleryUpload(file, index) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    window.dispatchEvent(new CustomEvent('wizard:toast', {
      detail: { message: 'Please upload an image file', type: 'error' }
    }));
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    galleryFiles[index] = e.target.result;
    showGalleryPreview(index, e.target.result);
    window.dispatchEvent(new CustomEvent('wizard:dirty'));
  };
  reader.readAsDataURL(file);
}

/**
 * Show gallery preview
 */
function showGalleryPreview(index, dataUrl) {
  const empty = document.getElementById(`galleryEmpty_${index}`);
  const filled = document.getElementById(`galleryFilled_${index}`);
  const img = document.getElementById(`galleryImg_${index}`);

  if (empty && filled && img) {
    img.src = dataUrl;
    empty.style.display = 'none';
    filled.style.display = 'block';
  }
}

/**
 * Remove gallery photo
 */
function removeGalleryPhoto(index) {
  galleryFiles[index] = null;
  const empty = document.getElementById(`galleryEmpty_${index}`);
  const filled = document.getElementById(`galleryFilled_${index}`);
  const input = document.getElementById(`galleryInput_${index}`);

  if (empty && filled) {
    empty.style.display = 'flex';
    filled.style.display = 'none';
  }
  if (input) input.value = '';
  window.dispatchEvent(new CustomEvent('wizard:dirty'));
}

/**
 * Add gallery preview (for restore)
 */
function addGalleryPreview(dataUrl) {
  const nextIndex = galleryFiles.findIndex(f => !f);
  const index = nextIndex >= 0 ? nextIndex : galleryFiles.length;
  if (index < 4) {
    galleryFiles[index] = dataUrl;
    showGalleryPreview(index, dataUrl);
  }
}

/**
 * Update color picker UI
 */
function updateColorPickerUI() {
  const swatches = document.querySelectorAll('.cc-color-swatch');
  const hexInput = document.getElementById('accentHexInput');
  const accentDot = document.getElementById('accentDot');

  if (hexInput) hexInput.value = accentColor;
  if (accentDot) accentDot.style.background = accentColor;
  swatches.forEach(s => {
    s.classList.toggle('selected', s.dataset.color.toLowerCase() === accentColor.toLowerCase());
  });
}

/**
 * Drag and drop handlers
 */
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
}

function handleLogoDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const file = e.dataTransfer.files[0];
  if (file) handleLogoUpload(file);
}

function handleBannerDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const file = e.dataTransfer.files[0];
  if (file) handleBannerUpload(file);
}
