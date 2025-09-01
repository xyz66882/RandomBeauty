// js/script.js - 终极修复版 v4 (修复下载按钮闪烁问题)

// 默认示例 API。
const API_URL = 'https://api.jkyai.top/API/sjmtzs.php';

// ----- IndexedDB 简单封装 -----
const DB_NAME = 'random_beauty_db';
const DB_VERSION = 1;
const STORE_IMAGES = 'images';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function(e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_IMAGES)) {
                const store = db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        req.onsuccess = function(e) {
            resolve(e.target.result);
        };
        req.onerror = function(e) {
            reject(e.target.error);
        };
    });
}

async function dbPutImage(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readwrite');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.put(record);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function dbGetImage(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readonly');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function dbClearAllImages() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readwrite');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
    });
}


// ----- 状态与 DOM -----
const state = {
    currentImageId: localStorage.getItem('lastImageId') || '',
    currentImageUrl: '',
    favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
    history: JSON.parse(localStorage.getItem('history') || '[]'),
    stats: JSON.parse(localStorage.getItem('stats') || '{"views":0,"downloads":0,"shares":0}'),
    theme: localStorage.getItem('theme') || 'dark',
    quality: localStorage.getItem('quality') || 'original',
    preloadedImage: null,
    isPreloading: false,
    isLoadingMainImage: false,
    currentPreloadSessionId: null
};

const elements = {
    image: document.getElementById('randomImage'),
    loading: document.getElementById('loading'),
    error: document.getElementById('errorMsg'),
    loadBtn: document.getElementById('loadBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    favoriteBtn: document.getElementById('favoriteBtn'),
    favoriteIcon: document.getElementById('favoriteIcon'),
    fullscreenOverlay: document.getElementById('fullscreenOverlay'),
    fullscreenInner: document.getElementById('fullscreenInner'),
    fullscreenImage: document.getElementById('fullscreenImage'),
    fullscreenClose: document.getElementById('fullscreenClose'),
    sharePanel: document.getElementById('sharePanel'),
    favoritesList: document.getElementById('favoritesList'),
    historyList: document.getElementById('historyList'),
    viewCount: document.getElementById('viewCount'),
    favoriteCount: document.getElementById('favoriteCount'),
    downloadCount: document.getElementById('downloadCount'),
    shareCount: document.getElementById('shareCount'),
    preloadIndicator: document.getElementById('preloadIndicator')
};

let currentObjectUrl = null;

// ----- 初始化 -----
async function init() {
    createParticles();
    applyTheme();
    loadStats();
    loadFavorites();
    loadHistory();
    setupQualitySelector();
    setupFullscreenHandlers();

    document.querySelectorAll('.quality-btn').forEach(btn => {
        if (btn.getAttribute('data-quality') === state.quality) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    try {
        if (state.currentImageId) {
            const record = await dbGetImage(state.currentImageId);
            if (record && record.blob) {
                console.log("Found lastImageId in cache, displaying...");
                await fetchAndDisplayImage(
                    () => Promise.resolve({
                        id: state.currentImageId,
                        blob: record.blob,
                        sourceUrl: record.sourceUrl
                    }),
                    false // Don't show loading for cached images
                );
            } else {
                await fetchAndDisplayNewImage();
            }
        } else {
            await fetchAndDisplayNewImage();
        }
    } catch (err) {
        console.error('Initial image loading failed:', err);
        showNotification(`初始化加载图片失败: ${err.message}`, 'fas fa-exclamation-triangle');
        showError();
    }
}

/**
 * 通用的图片获取与显示流程控制器
 * @param {Function} imageFetchFn - 一个返回 {id, blob, sourceUrl} 的 Promise 函数
 * @param {boolean} [showMainLoading=true] - 是否显示主加载动画
 * @returns {Promise<void>}
 */
async function fetchAndDisplayImage(imageFetchFn, showMainLoading = true) {
    if (state.isLoadingMainImage) {
        console.warn("fetchAndDisplayImage called while another is in progress. Aborting.");
        return;
    }
    state.isLoadingMainImage = true;
    if (showMainLoading) {
        showLoading();
    }
    elements.error.style.display = 'none';

    try {
        const imageData = await imageFetchFn();
        await displayAndProcessImage(imageData);

        // 图片成功显示后，立即开始预加载下一张
        triggerPreload();

    } catch (err) {
        console.error('Failed to fetch and display image:', err);
        showError();
        showNotification(`加载图片失败: ${err.message}`, 'fas fa-exclamation-triangle');
    } finally {
        state.isLoadingMainImage = false;
        if (showMainLoading) {
            hideLoading();
        }
    }
}


/**
 * 核心函数：显示图片到主区域并处理相关逻辑
 * @param {Object} imageData - 包含 id, blob, sourceUrl 的图片数据对象
 */
async function displayAndProcessImage(imageData) {
    if (currentObjectUrl) {
        try { URL.revokeObjectURL(currentObjectUrl); } catch (e) { /* silent error */ }
    }
    const objUrl = URL.createObjectURL(imageData.blob);
    currentObjectUrl = objUrl;

    elements.image.src = objUrl;
    elements.image.style.display = 'block';

    await new Promise((resolve, reject) => {
        const img = elements.image;
        const loadHandler = () => {
            img.removeEventListener('load', loadHandler);
            img.removeEventListener('error', errorHandler);
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        };
        const errorHandler = (e) => {
            img.removeEventListener('load', loadHandler);
            img.removeEventListener('error', errorHandler);
            reject(new Error('主图片元素加载失败或无法显示。', { cause: e }));
        };
        img.addEventListener('load', loadHandler);
        img.addEventListener('error', errorHandler);
        if (img.complete && img.naturalHeight !== 0 && img.src === objUrl) {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        }
    });

    state.currentImageId = imageData.id;
    state.currentImageUrl = imageData.sourceUrl;
    localStorage.setItem('lastImageId', imageData.id);

    hideLoading();

    addToHistory({ id: imageData.id, url: imageData.sourceUrl });
    updateStats('views');
    updateFavoriteButton();
    console.log(`Current image (ID: ${imageData.id}) displayed successfully.`);
}

function triggerPreload() {
    preloadNextImage().then(() => {
        if (state.preloadedImage && state.preloadedImage.isReady && !state.isLoadingMainImage) {
            showNotification('下一张图片已预加载', 'fas fa-sync', state.preloadedImage.objUrl);
        }
    });
}

function fetchAndDisplayNewImage() {
    return fetchAndDisplayImage(() => {
        const requestUrl = API_URL + '?t=' + Date.now() + '&quality=' + encodeURIComponent(state.quality);
        return loadImageToBlob(requestUrl).then(async ({ blob, id, timestamp }) => {
            await dbPutImage({ id, blob, timestamp, sourceUrl: requestUrl });
            return { blob, id, sourceUrl: requestUrl };
        });
    });
}


// ----- 粒子背景 -----
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
        particlesContainer.appendChild(particle);
    }
}

// ----- 显示/隐藏状态 -----
function showLoading() {
    elements.loading.style.display = 'block';
    elements.image.style.display = 'none';
    elements.loadBtn.disabled = true;
    elements.downloadBtn.disabled = true;
    elements.favoriteBtn.disabled = true;
}

function hideLoading() {
    elements.loading.style.display = 'none';
    elements.loadBtn.disabled = false;
    elements.downloadBtn.disabled = false;
    elements.favoriteBtn.disabled = false;
}

function showError() {
    elements.error.style.display = 'block';
    elements.image.style.display = 'none';
    hideLoading();
}

let notificationTimeoutId = null;
function showNotification(message, iconClass, imageUrl = null) {
    if (notificationTimeoutId) {
        clearTimeout(notificationTimeoutId);
        notificationTimeoutId = null;
    }
    document.querySelectorAll('.notification').forEach(oldNotification => {
        const oldThumb = oldNotification.querySelector('.notification-thumb');
        if (oldThumb && oldThumb.src.startsWith('blob:')) {
            try { URL.revokeObjectURL(oldThumb.src); } catch (e) { }
        }
        oldNotification.remove();
    });
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="${iconClass}"></i>
        <span>${message}</span>
        ${imageUrl ? `<img src="${imageUrl}" class="notification-thumb" alt="预览">` : ''}
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);
    notificationTimeoutId = setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentElement) {
                document.body.removeChild(notification);
                if (imageUrl && imageUrl.startsWith('blob:')) {
                    try { URL.revokeObjectURL(imageUrl); } catch (e) { }
                }
            }
            notificationTimeoutId = null;
        }, 400);
    }, 3000);
}

// ----- 生成唯一 ID -----
function genId() {
    return 'img_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
}

async function loadImageToBlob(url, maxRetries = 2) {
    console.log("Attempting to load image to Blob from:", url);
    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.src = url;

            await new Promise((resolve, reject) => {
                const timeout = 15000;
                const timer = setTimeout(() => reject(new Error('图片元素加载超时。')), timeout);
                image.onload = () => { clearTimeout(timer); resolve(); };
                image.onerror = (e) => { clearTimeout(timer); reject(new Error(`图片加载元素失败 (尝试 ${attempt + 1}/${maxRetries + 1})`)); };
            });

            await image.decode();

            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(b => b ? resolve(b) : reject(new Error('无法从 Canvas 获取图片 Blob 数据。')), 'image/jpeg', 0.9);
            });
            console.log(`Image loaded to Blob successfully on attempt ${attempt + 1}.`);
            return { blob, id: genId(), timestamp: Date.now() };

        } catch (err) {
            console.warn(`loadImageToBlob failed on attempt ${attempt + 1}:`, err.message);
            attempt++;
            if (attempt > maxRetries) throw new Error(`图片加载失败，已达最大重试次数 (${maxRetries + 1})。`, { cause: err });
            await new Promise(res => setTimeout(res, 500 * attempt));
        }
    }
}

// ----- 预加载下一张图片 -----
async function preloadNextImage() {
    if (state.isPreloading) {
        console.log("Skipping preload: another preload is already running.");
        return;
    }

    state.isPreloading = true;
    const thisPreloadSessionId = Date.now();
    state.currentPreloadSessionId = thisPreloadSessionId;

    elements.preloadIndicator.style.display = 'flex';

    if (state.preloadedImage && state.preloadedImage.objUrl) {
        try { URL.revokeObjectURL(state.preloadedImage.objUrl); } catch (e) { /* ignore */ }
    }
    state.preloadedImage = null;

    try {
        const preloadUrl = API_URL + '?t=' + Date.now() + '&quality=' + encodeURIComponent(state.quality);
        console.log(`Starting preload for session: ${thisPreloadSessionId}`);
        const { blob, id, timestamp } = await loadImageToBlob(preloadUrl);

        if (state.currentPreloadSessionId !== thisPreloadSessionId) {
            console.log(`Aborting preload session ${thisPreloadSessionId}: a new one has started.`);
            return;
        }

        await dbPutImage({ id, blob, timestamp, sourceUrl: preloadUrl });
        const objUrl = URL.createObjectURL(blob);

        state.preloadedImage = { id, blob, sourceUrl: preloadUrl, objUrl, isReady: true };
        console.log(`Preload session ${thisPreloadSessionId} completed successfully.`);

    } catch (err) {
        console.error(`Preload session ${thisPreloadSessionId} failed:`, err);
        if (state.currentPreloadSessionId === thisPreloadSessionId) {
            state.preloadedImage = null;
        }
    } finally {
        if (state.currentPreloadSessionId === thisPreloadSessionId) {
            state.isPreloading = false;
            elements.preloadIndicator.style.display = 'none';
        }
    }
}

// ----- 加载随机图片 -----
async function loadRandomImage() {
    if (state.isLoadingMainImage) {
        console.log("Main image is already loading, skipping loadRandomImage call.");
        return;
    }

    state.currentPreloadSessionId = null;
    state.isPreloading = false;
    elements.preloadIndicator.style.display = 'none';

    if (state.preloadedImage && state.preloadedImage.isReady) {
        console.log("Using preloaded image:", state.preloadedImage.id);
        const preloadedData = state.preloadedImage;
        state.preloadedImage = null;

        await fetchAndDisplayImage(() => Promise.resolve(preloadedData), false);
    } else {
        console.log("No valid preloaded image available, fetching a new one directly.");
        await fetchAndDisplayNewImage();
    }
}


// ----- 全屏 -----
let fullscreenImageObjectUrl = null;

function setupFullscreenHandlers() {
    elements.fullscreenOverlay.addEventListener('click', (e) => {
        if (!elements.fullscreenInner.contains(e.target)) {
            exitFullscreen();
        }
    });

    elements.fullscreenClose.addEventListener('click', (e) => {
        e.stopPropagation();
        exitFullscreen();
    });

    elements.fullscreenImage.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

function openFullscreen() {
    enterFullscreen();
}

function enterFullscreen() {
    if (!state.currentImageId) {
        showNotification('请先加载一张图片', 'fas fa-exclamation-triangle');
        return;
    }

    dbGetImage(state.currentImageId).then(rec => {
        if (!rec || !rec.blob) {
            showNotification('无法进入全屏：图片未缓存或已失效', 'fas fa-exclamation-triangle');
            return;
        }
        if (fullscreenImageObjectUrl) {
            try { URL.revokeObjectURL(fullscreenImageObjectUrl); } catch (e) { }
            fullscreenImageObjectUrl = null;
        }
        fullscreenImageObjectUrl = URL.createObjectURL(rec.blob);
        elements.fullscreenImage.src = fullscreenImageObjectUrl;
        elements.fullscreenOverlay.style.display = 'flex';
        elements.fullscreenOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleFullscreenKeydown, { capture: true });
        setTimeout(() => elements.fullscreenClose.focus(), 0);
    }).catch(err => {
        console.error('enterFullscreen error', err);
        showNotification('进入全屏失败', 'fas fa-exclamation-triangle');
    });
}

function exitFullscreen() {
    elements.fullscreenOverlay.style.display = 'none';
    elements.fullscreenOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleFullscreenKeydown, { capture: true });
    try {
        if (fullscreenImageObjectUrl) {
            URL.revokeObjectURL(fullscreenImageObjectUrl);
            fullscreenImageObjectUrl = null;
        }
    } catch (e) {
        console.warn('Error revoke fullscreen URL', e);
    }
    elements.fullscreenImage.src = '';
}

function handleFullscreenKeydown(e) {
    const overlayVisible = elements.fullscreenOverlay.style.display === 'flex';
    if (!overlayVisible) return;

    if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        exitFullscreen();
        return;
    }
    if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        loadRandomImage();
        return;
    }
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (state.history && state.history.length > 0) {
            let prevImageId = null;
            const currentHistoryIndex = state.history.findIndex(item => item.id === state.currentImageId);
            if (currentHistoryIndex !== -1 && (currentHistoryIndex + 1) < state.history.length) {
                prevImageId = state.history[currentHistoryIndex + 1].id;
            }
            if (prevImageId && prevImageId !== state.currentImageId) {
                loadImageFromHistory(prevImageId);
            } else {
                showNotification('没有更早的浏览历史了', 'fas fa-info-circle');
            }
        } else {
            showNotification('没有浏览历史可供回退', 'fas fa-info-circle');
        }
    }
}

// ----- 收藏 -----
function toggleFavorite() {
    if (!state.currentImageId) {
        showNotification('请先加载一张图片才能收藏', 'fas fa-info-circle');
        return;
    }
    const existIndex = state.favorites.findIndex(f => f.id === state.currentImageId);
    if (existIndex !== -1) {
        state.favorites.splice(existIndex, 1);
        showNotification('已取消收藏', 'fas fa-heart-broken');
    } else {
        const item = { id: state.currentImageId, url: state.currentImageUrl, timestamp: new Date().toLocaleString() };
        state.favorites.unshift(item);
        showNotification('收藏成功', 'fas fa-heart');
    }
    state.favorites = state.favorites.slice(0, 100);
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    loadFavorites();
    updateFavoriteButton();
    updateStats('favorites');
}

function updateFavoriteButton() {
    const isFavorited = state.favorites.some(f => f.id === state.currentImageId);
    elements.favoriteIcon.className = isFavorited ? 'fas fa-heart' : 'far fa-heart';
    elements.favoriteBtn.innerHTML = `<i class="${isFavorited ? 'fas' : 'far'} fa-heart"></i><span>${isFavorited ? '已收藏' : '收藏'}</span>`;
}

async function loadFavorites() {
    const container = elements.favoritesList;
    if (!state.favorites || state.favorites.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px 20px;"><i class="far fa-heart" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>暂无收藏</div>`;
        elements.favoriteCount.textContent = 0;
        return;
    }
    const rows = await Promise.all(state.favorites.slice(0, 50).map(async fav => {
        const rec = await dbGetImage(fav.id);
        let thumbUrl = '';
        if (rec && rec.blob) {
            try { thumbUrl = URL.createObjectURL(rec.blob); } catch (e) { thumbUrl = ''; }
        } else {
            if (fav.url) { thumbUrl = fav.url; }
        }
        return `<div class="content-item" onclick="loadImageFromFavorite('${fav.id}');"><img class="content-thumb" src="${thumbUrl}" alt="收藏图片" loading="lazy"><div class="content-info">${fav.timestamp}</div><button class="remove-btn" onclick="event.stopPropagation(); removeFavorite('${fav.id}')"><i class="fas fa-times"></i></button></div>`;
    }));
    container.innerHTML = rows.join('') || '<div style="text-align:center;color:var(--text-muted);padding:30px 20px;">暂无收藏</div>';
    elements.favoriteCount.textContent = state.favorites.length;
}

async function loadImageFromId(id, isFavorite = true) {
    if (state.isLoadingMainImage) {
        console.log("Main image is already loading, skipping loadImageFromId call.");
        return;
    }
    const imageFetchFn = async () => {
        let rec = await dbGetImage(id);
        if (rec && rec.blob) {
            return { id: rec.id, blob: rec.blob, sourceUrl: rec.sourceUrl || '' };
        }
        const item = (isFavorite ? state.favorites : state.history).find(f => f.id === id);
        if (!item || !item.url) throw new Error(`${isFavorite ? '收藏' : '历史'}元数据丢失图片地址`);
        const { blob, id: newId, timestamp } = await loadImageToBlob(item.url);
        await dbPutImage({ id: newId, blob, timestamp, sourceUrl: item.url });
        showNotification('图片已从远程加载并缓存', 'fas fa-check-circle');
        return { id: newId, blob, sourceUrl: item.url };
    };
    fetchAndDisplayImage(imageFetchFn);
}

function loadImageFromFavorite(id) {
    return loadImageFromId(id, true);
}

function loadImageFromHistory(id) {
    return loadImageFromId(id, false);
}

function removeFavorite(id) {
    state.favorites = state.favorites.filter(f => f.id !== id);
    const favItem = elements.favoritesList.querySelector(`[onclick*="loadImageFromFavorite('${id}')"] .content-thumb`);
    if (favItem && favItem.src.startsWith('blob:')) {
        try { URL.revokeObjectURL(favItem.src); } catch (e) { }
    }
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    loadFavorites();
    updateStats('favorites');
    showNotification('已移除收藏', 'fas fa-times');
}

// ----- 分享 -----
function showSharePanel() {
    if (!state.currentImageId) {
        showNotification('请先加载一张图片才能分享', 'fas fa-info-circle');
        return;
    }
    elements.loadBtn.disabled = true;
    elements.downloadBtn.disabled = true;
    elements.favoriteBtn.disabled = true;
    elements.sharePanel.classList.add('active');
    elements.sharePanel.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
        const firstFocusable = elements.sharePanel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) firstFocusable.focus();
    }, 100);
}

function hideSharePanel() {
    elements.sharePanel.classList.remove('active');
    elements.sharePanel.setAttribute('aria-hidden', 'true');
    elements.loadBtn.disabled = false;
    elements.downloadBtn.disabled = false;
    elements.favoriteBtn.disabled = false;
    document.activeElement?.blur();
    elements.shareBtn.focus();
}

async function shareToWeibo() {
    const shareUrl = state.currentImageUrl || '';
    const text = encodeURIComponent('发现一张超美的图片！快来看看吧！');
    if (shareUrl) {
        window.open(`https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${text}`, '_blank');
        updateStats('shares');
        hideSharePanel();
    } else {
        showNotification('无法获取图片链接分享', 'fas fa-exclamation-triangle');
    }
}

function shareToWeixin() {
    copyLink();
    showNotification('链接已复制，请在微信中粘贴分享', 'fab fa-weixin');
    hideSharePanel();
}

async function shareToQQ() {
    const shareUrl = state.currentImageUrl || '';
    const text = encodeURIComponent('发现一张超美的图片！快来看看吧！');
    if (shareUrl) {
        window.open(`https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(shareUrl)}&title=${text}`, '_blank');
        updateStats('shares');
        hideSharePanel();
    } else {
        showNotification('无法获取图片链接分享', 'fas fa-exclamation-triangle');
    }
}

function copyLink() {
    const url = state.currentImageUrl || '';
    if (!url) {
        showNotification('当前没有图片链接可复制', 'fas fa-exclamation-triangle');
        return;
    }
    navigator.clipboard.writeText(url).then(() => {
        showNotification('图片链接已复制到剪贴板', 'fas fa-link');
        updateStats('shares');
    }).catch(err => {
        console.error('复制链接失败：', err);
        showNotification('复制失败，请手动复制', 'fas fa-exclamation-triangle');
    });
}

// ----- 主题 -----
function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', state.theme);
    applyTheme();
}

function applyTheme() {
    document.body.setAttribute('data-theme', state.theme);
}

// ----- 质量 -----
function setupQualitySelector() {
    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (state.isLoadingMainImage || state.isPreloading) {
                showNotification('图片正在加载或预加载中，请稍后再切换质量。', 'fas fa-info-circle');
                return;
            }
            document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const newQuality = btn.getAttribute('data-quality');
            if (state.quality !== newQuality) {
                state.quality = newQuality;
                localStorage.setItem('quality', state.quality);
                showNotification(`图片质量已设置为：${btn.textContent}`, 'fas fa-check-circle');
                state.currentPreloadSessionId = null;
                if (state.preloadedImage && state.preloadedImage.objUrl) {
                    try { URL.revokeObjectURL(state.preloadedImage.objUrl); } catch (e) { }
                }
                state.preloadedImage = null;
                state.isPreloading = false;
                await fetchAndDisplayNewImage();
            }
        });
    });
}

// ----- 下载 (核心修改，消除闪烁) -----
async function downloadImage() {
    if (!state.currentImageId) {
        showNotification('请先加载一张图片', 'fas fa-exclamation-triangle');
        return;
    }
    if (elements.downloadBtn.disabled) {
        return;
    }

    const originalBtnContent = elements.downloadBtn.innerHTML;
    elements.downloadBtn.disabled = true;
    elements.downloadBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>下载中...</span>`;

    try {
        const rec = await dbGetImage(state.currentImageId);
        let blobToDownload = null;
        if (!rec || !rec.blob) {
            showNotification('当前图片未缓存，正在重新加载后下载...', 'fas fa-info-circle');
            const imgUrl = state.currentImageUrl;
            if (!imgUrl) {
                throw new Error('当前图片URL未知，无法重新加载下载。');
            }
            const { blob } = await loadImageToBlob(imgUrl);
            await dbPutImage({ id: state.currentImageId, blob, timestamp: Date.now(), sourceUrl: imgUrl });
            blobToDownload = blob;
        } else {
            blobToDownload = rec.blob;
        }
        await performBlobDownload(blobToDownload, state.currentImageId);
        updateStats('downloads');
        showNotification('下载成功', 'fas fa-download');
    } catch (e) {
        console.error('下载图片失败', e);
        showNotification(`下载失败: ${e.message}。请尝试右键另存为`, 'fas fa-exclamation-triangle');
    } finally {
        // [核心修复]：恢复按钮状态
        elements.downloadBtn.disabled = false;
        elements.downloadBtn.innerHTML = originalBtnContent;
    }
}

function performBlobDownload(blob, imageId) {
    return new Promise(resolve => {
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        const filename = `美女图片_${imageId}.jpg`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            try { URL.revokeObjectURL(url); } catch (e) { }
            resolve();
        }, 150);
    });
}

// ----- 历史 -----
function addToHistory(meta = null) {
    if (!meta) {
        meta = { id: state.currentImageId, url: state.currentImageUrl };
    }
    if (!meta.id) return;
    const existingIndex = state.history.findIndex(item => item.id === meta.id);
    if (existingIndex !== -1) {
        const [existingItem] = state.history.splice(existingIndex, 1);
        state.history.unshift(existingItem);
    } else {
        const historyItem = { id: meta.id, url: meta.url, timestamp: new Date().toLocaleString() };
        state.history.unshift(historyItem);
    }
    state.history = state.history.slice(0, 50);
    localStorage.setItem('history', JSON.stringify(state.history));
    loadHistory();
}

async function loadHistory() {
    const container = elements.historyList;
    if (!state.history || state.history.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px 20px;"><i class="fas fa-history" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>暂无历史</div>`;
        return;
    }
    const rows = await Promise.all(state.history.map(async item => {
        const rec = await dbGetImage(item.id);
        let thumbUrl = '';
        if (rec && rec.blob) {
            try { thumbUrl = URL.createObjectURL(rec.blob); } catch (e) { thumbUrl = ''; }
        } else {
            if (item.url) { thumbUrl = item.url; }
        }
        return `<div class="content-item" onclick="loadImageFromHistory('${item.id}');"><img class="content-thumb" src="${thumbUrl}" alt="历史图片" loading="lazy"><div class="content-info">${item.timestamp}</div></div>`;
    }));
    container.innerHTML = rows.join('');
}

// ----- 统计 -----
function updateStats(type, opts = { incrementDirect: true }) {
    switch (type) {
        case 'views':
            if (opts.incrementDirect !== false) state.stats.views++;
            elements.viewCount.textContent = state.stats.views;
            break;
        case 'downloads':
            state.stats.downloads++;
            elements.downloadCount.textContent = state.stats.downloads;
            break;
        case 'shares':
            state.stats.shares++;
            elements.shareCount.textContent = state.stats.shares;
            break;
        case 'favorites':
            elements.favoriteCount.textContent = state.favorites.length;
            break;
    }
    localStorage.setItem('stats', JSON.stringify(state.stats));
}

function loadStats() {
    elements.viewCount.textContent = state.stats.views;
    elements.downloadCount.textContent = state.stats.downloads;
    elements.shareCount.textContent = state.stats.shares;
    elements.favoriteCount.textContent = state.favorites.length;
}

// ----- 清理 -----
function clearHistory() {
    if (!confirm('确认清空浏览历史？此操作不可撤销。')) return;
    elements.historyList.querySelectorAll('.content-thumb').forEach(thumb => {
        if (thumb.src.startsWith('blob:')) { try { URL.revokeObjectURL(thumb.src); } catch (e) { } }
    });
    state.history = [];
    localStorage.setItem('history', JSON.stringify(state.history));
    loadHistory();
    showNotification('浏览历史已清空', 'fas fa-history');
}

function clearFavorites() {
    if (!confirm('确认清空我的收藏？此操作不可撤销。')) return;
    elements.favoritesList.querySelectorAll('.content-thumb').forEach(thumb => {
        if (thumb.src.startsWith('blob:')) { try { URL.revokeObjectURL(thumb.src); } catch (e) { } }
    });
    state.favorites = [];
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    loadFavorites();
    updateStats('favorites');
    showNotification('收藏已清空', 'fas fa-heart-broken');
}

async function clearCache() {
    if (!confirm('确认清空缓存？清空后本地存储的图片将被删除（收藏项和历史记录仍保留元数据，但缩略图将不可用）。')) return;
    state.isLoadingMainImage = true;
    state.isPreloading = true;
    showLoading();
    elements.preloadIndicator.style.display = 'none';
    await dbClearAllImages();
    if (state.preloadedImage && state.preloadedImage.objUrl) {
        try { URL.revokeObjectURL(state.preloadedImage.objUrl); } catch (e) { }
    }
    state.preloadedImage = null;
    state.isPreloading = false;
    if (currentObjectUrl) {
        try { URL.revokeObjectURL(currentObjectUrl); } catch (e) { }
        currentObjectUrl = null;
    }
    state.currentImageId = '';
    state.currentImageUrl = '';
    localStorage.removeItem('lastImageId');
    elements.image.src = '';
    elements.image.style.display = 'none';
    hideLoading();
    showNotification('缓存已清空，正在加载新图片', 'fas fa-trash');
    await fetchAndDisplayNewImage();
}

function clearStats() {
    if (!confirm('确认清空统计数据？此操作不会影响收藏与缓存。')) return;
    state.stats = { views: 0, downloads: 0, shares: 0 };
    localStorage.setItem('stats', JSON.stringify(state.stats));
    loadStats();
    showNotification('统计已清空', 'fas fa-chart-bar');
}

// ----- 全局事件 -----
document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (elements.fullscreenOverlay.style.display === 'flex') { return; }
    switch (e.code) {
        case 'Space': e.preventDefault(); if (!elements.loadBtn.disabled) loadRandomImage(); break;
        case 'KeyF': e.preventDefault(); if (!elements.favoriteBtn.disabled) toggleFavorite(); break;
        case 'KeyD': e.preventDefault(); if (!elements.downloadBtn.disabled) downloadImage(); break;
        case 'KeyS': e.preventDefault(); if (!elements.shareBtn.disabled) showSharePanel(); break;
        case 'KeyT': e.preventDefault(); toggleTheme(); break;
        case 'Escape': if (elements.sharePanel && elements.sharePanel.classList.contains('active')) { hideSharePanel(); } break;
    }
});
document.addEventListener('click', function(e) {
    if (elements.sharePanel && elements.sharePanel.classList.contains('active') && !elements.sharePanel.contains(e.target) && !e.target.closest('.share-btn') && !e.target.closest('#shareBtn')) {
        hideSharePanel();
    }
});

// ----- 页面加载后初始化 -----
window.addEventListener('load', init);

// 暴露函数给 HTML 事件绑定使用
window.loadRandomImage = loadRandomImage;
window.openFullscreen = openFullscreen;
window.exitFullscreen = exitFullscreen;
window.toggleFavorite = toggleFavorite;
window.toggleTheme = toggleTheme;
window.downloadImage = downloadImage;
window.showSharePanel = showSharePanel;
window.hideSharePanel = hideSharePanel;
window.shareToWeibo = shareToWeibo;
window.shareToWeixin = shareToWeixin;
window.shareToQQ = shareToQQ;
window.copyLink = copyLink;
window.loadImageFromFavorite = loadImageFromFavorite;
window.loadImageFromHistory = loadImageFromHistory;
window.removeFavorite = removeFavorite;
window.clearHistory = clearHistory;
window.clearFavorites = clearFavorites;
window.clearCache = clearCache;
window.clearStats = clearStats;
