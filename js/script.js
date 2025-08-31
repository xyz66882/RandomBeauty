// js/script.js - 最终修复版 (利用 Image 对象和 Canvas 解决 403 问题)

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

async function dbDeleteImage(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readwrite');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function dbGetAllImages() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readonly');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.getAll();
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
    currentImageUrl: '', // 记录当前展示图片的原始API URL
    favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
    history: JSON.parse(localStorage.getItem('history') || '[]'),
    stats: JSON.parse(localStorage.getItem('stats') || '{"views":0,"downloads":0,"shares":0}'),
    theme: localStorage.getItem('theme') || 'dark',
    quality: localStorage.getItem('quality') || 'original',
    // Removed loadingFetchAbortController as we are not using fetch directly for loading
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
    shareCount: document.getElementById('shareCount')
};

// ----- 初始化 -----
function init() {
    createParticles();
    applyTheme();
    loadStats();
    loadFavorites();
    loadHistory();
    setupQualitySelector();
    setupFullscreenHandlers();

    // 初始化时激活当前质量按钮
    document.querySelectorAll('.quality-btn').forEach(btn => {
        if (btn.getAttribute('data-quality') === state.quality) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 如果有 lastImageId，优先加载缓存显示
    if (state.currentImageId) {
        showLoading();
        dbGetImage(state.currentImageId).then(record => {
            if (record && record.blob) {
                const objUrl = URL.createObjectURL(record.blob);
                state.currentImageUrl = record.sourceUrl || '';
                displayImageObjectUrl(objUrl);
                hideLoading();
                updateStats('views', { incrementDirect: false });
                updateFavoriteButton();
            } else {
                loadRandomImage(); // 缓存失效，加载新图片
            }
        }).catch(err => {
            console.error('读取缓存图片失败', err);
            loadRandomImage(); // 读取失败也加载新图片
        });
    } else {
        loadRandomImage(); // 首次加载或无历史图片时加载新图片
    }
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
    elements.error.style.display = 'none';
    elements.loadBtn.disabled = true;
    elements.downloadBtn.disabled = true;
}

function hideLoading() {
    elements.loading.style.display = 'none';
    elements.loadBtn.disabled = false;
    elements.downloadBtn.disabled = false;
}

function showError() {
    elements.error.style.display = 'block';
    elements.image.style.display = 'none';
    hideLoading();
}

function showNotification(message, iconClass) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="${iconClass}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentElement) document.body.removeChild(notification);
        }, 400);
    }, 3000);
}

// ----- 图片显示（使用 objectURL） -----
let currentObjectUrl = null;
function displayImageObjectUrl(objUrl) {
    if (currentObjectUrl) {
        try { URL.revokeObjectURL(currentObjectUrl); } catch (e) { /* silent error */ }
    }
    currentObjectUrl = objUrl;
    elements.image.src = objUrl;
    elements.image.style.display = 'block';
}

// ----- 生成唯一 ID -----
function genId() {
    return 'img_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
}

// ----- 加载随机图片 (!!! 核心修改在此处 !!!) -----
async function loadRandomImage() {
    showLoading();
    elements.error.style.display = 'none';

    const requestUrl = API_URL + '?t=' + Date.now() + '&quality=' + encodeURIComponent(state.quality);
    console.log("Attempting to load image via Image object from:", requestUrl); // Debug log

    try {
        const image = new Image();
        image.crossOrigin = 'anonymous'; // 尝试设置 crossOrigin，尽可能避免 CORS 问题，并允许 canvas 读写
        image.src = requestUrl;

        await new Promise((resolve, reject) => {
            image.onload = () => {
                resolve();
            };
            image.onerror = (e) => {
                // Image.onerror event doesn't provide status codes, so we infer it's a network/server issue.
                console.error('Image loading failed:', e);
                reject(new Error('图片加载失败，可能是网络问题或服务器拒绝访问。'));
            };
        });

        // 图片加载成功，将其绘制到 canvas 并获取 Blob
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(b => {
                if (b) {
                    resolve(b);
                } else {
                    reject(new Error('无法从 Canvas 获取图片 Blob 数据。'));
                }
            }, 'image/jpeg'); // 可以指定图片格式，这里默认为 JPEG
        });

        const id = genId();
        const record = {
            id,
            blob,
            timestamp: Date.now(),
            sourceUrl: requestUrl // 记录 API url 作为原始来源
        };
        await dbPutImage(record);

        state.currentImageId = id;
        state.currentImageUrl = requestUrl;
        localStorage.setItem('lastImageId', id);

        const objUrl = URL.createObjectURL(blob);
        displayImageObjectUrl(objUrl);

        hideLoading();
        addToHistory({ id, url: requestUrl });
        updateStats('views');
        updateFavoriteButton();

    } catch (err) {
        console.error('加载图片失败', err);
        hideLoading();
        showError();
        showNotification(`加载图片失败: ${err.message}`, 'fas fa-exclamation-triangle');
    }
}


// ----- 全屏（修复相关逻辑） -----
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
            try { URL.revokeObjectURL(fullscreenImageObjectUrl); } catch (e) { /* silent error */ }
            fullscreenImageObjectUrl = null;
        }

        fullscreenImageObjectUrl = URL.createObjectURL(rec.blob);
        elements.fullscreenImage.src = fullscreenImageObjectUrl;

        elements.fullscreenOverlay.style.display = 'flex';
        elements.fullscreenOverlay.setAttribute('aria-hidden', 'false');

        document.body.style.overflow = 'hidden';

        document.addEventListener('keydown', handleFullscreenKeydown, { capture: true });

        elements.fullscreenClose.focus && elements.fullscreenClose.focus();
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
            const prevImageId = (state.history[1] && state.history[1].id) || null;
            if (prevImageId && prevImageId !== state.currentImageId) {
                loadImageFromFavorite(prevImageId);
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
        const item = {
            id: state.currentImageId,
            url: state.currentImageUrl,
            timestamp: new Date().toLocaleString()
        };
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
    elements.favoriteBtn.innerHTML = `
        <i class="${isFavorited ? 'fas' : 'far'} fa-heart"></i>
        <span>${isFavorited ? '已收藏' : '收藏'}</span>
    `;
}

async function loadFavorites() {
    const container = elements.favoritesList;
    if (!state.favorites || state.favorites.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 30px 20px;">
                <i class="far fa-heart" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                暂无收藏
            </div>
        `;
        elements.favoriteCount.textContent = 0;
        return;
    }

    const rows = await Promise.all(state.favorites.slice(0, 50).map(async fav => {
        const rec = await dbGetImage(fav.id);
        let thumbUrl = '';
        if (rec && rec.blob) {
            try { thumbUrl = URL.createObjectURL(rec.blob); } catch (e) { thumbUrl = ''; }
        } else if (fav.url) {
            thumbUrl = '';
        }
        return `
            <div class="content-item" onclick="loadImageFromFavorite('${fav.id}');">
                <img class="content-thumb" src="${thumbUrl}" alt="收藏图片" loading="lazy">
                <div class="content-info">${fav.timestamp}</div>
                <button class="remove-btn" onclick="event.stopPropagation(); removeFavorite('${fav.id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }));
    container.innerHTML = rows.join('') || '<div style="text-align:center;color:var(--text-muted);padding:30px 20px;">暂无收藏</div>';
    elements.favoriteCount.textContent = state.favorites.length;
}

async function loadImageFromFavorite(id) {
    showLoading();
    elements.error.style.display = 'none';

    try {
        const rec = await dbGetImage(id);
        if (!rec || !rec.blob) {
            const fav = state.favorites.find(f => f.id === id);
            if (!fav || !fav.url) {
                throw new Error('收藏元数据丢失图片地址');
            }

            // 收藏图片在缓存中不存在时，尝试通过 Image 对象重新加载
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.src = fav.url;

            await new Promise((resolve, reject) => {
                image.onload = () => resolve();
                image.onerror = (e) => reject(new Error('远程加载收藏图片失败，可能服务器拒绝访问或图片已失效。'));
            });

            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(b => {
                    if (b) resolve(b);
                    else reject(new Error('无法从 Canvas 获取远程收藏图片的 Blob 数据。'));
                }, 'image/jpeg');
            });

            await dbPutImage({ id, blob, timestamp: Date.now(), sourceUrl: fav.url });
            showNotification('图片已从远程加载并缓存', 'fas fa-check-circle');
            state.currentImageId = id;
            state.currentImageUrl = fav.url;
        } else {
            state.currentImageId = id;
            state.currentImageUrl = rec.sourceUrl || '';
        }

        localStorage.setItem('lastImageId', state.currentImageId);
        displayImageObjectUrl(URL.createObjectURL((await dbGetImage(state.currentImageId)).blob));
        hideLoading();
        updateFavoriteButton();
        updateStats('views', { incrementDirect: false });
        addToHistory({ id: state.currentImageId, url: state.currentImageUrl });
    } catch (e) {
        console.error('加载收藏图片失败', e);
        showNotification(`加载收藏图片失败: ${e.message}`, 'fas fa-exclamation-triangle');
        showError();
        hideLoading();
    }
}


function removeFavorite(id) {
    state.favorites = state.favorites.filter(f => f.id !== id);
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
    elements.sharePanel.classList.add('active');
    elements.sharePanel.setAttribute('aria-hidden', 'false');
}

function hideSharePanel() {
    elements.sharePanel.classList.remove('active');
    elements.sharePanel.setAttribute('aria-hidden', 'true');
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

// ----- 质量按钮 -----
function setupQualitySelector() {
    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.quality = btn.getAttribute('data-quality');
            localStorage.setItem('quality', state.quality);
            showNotification(`图片质量已设置为：${btn.textContent}`, 'fas fa-check-circle');
            //loadRandomImage(); // 如果需要立即应用，可以取消注释
        });
    });
}

// ----- 下载当前图片 -----
async function downloadImage() {
    if (!state.currentImageId) {
        showNotification('请先加载一张图片', 'fas fa-exclamation-triangle');
        return;
    }
    try {
        const rec = await dbGetImage(state.currentImageId);
        if (!rec || !rec.blob) {
            showNotification('当前图片未缓存，正在尝试重新加载后下载...', 'fas fa-spinner');
            const imgUrl = state.currentImageUrl; // 使用当前显示的图片URL尝试重新加载
            if (!imgUrl) {
                 throw new Error('当前图片URL未知，无法重新加载下载。');
            }

            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.src = imgUrl;

            await new Promise((resolve, reject) => {
                image.onload = () => resolve();
                image.onerror = (e) => reject(new Error('重新加载图片失败，无法进行下载。'));
            });

            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(b => {
                    if (b) resolve(b);
                    else reject(new Error('无法从 Canvas 获取重新加载图片的 Blob 数据。'));
                }, 'image/jpeg');
            });

            await dbPutImage({ id: state.currentImageId, blob, timestamp: Date.now(), sourceUrl: imgUrl });
            await performBlobDownload(blob, state.currentImageId);
            updateStats('downloads');
            showNotification('下载成功', 'fas fa-download');

            return;
        }
        await performBlobDownload(rec.blob, state.currentImageId);
        updateStats('downloads');
        showNotification('下载成功', 'fas fa-download');
    } catch (e) {
        console.error('下载图片失败', e);
        showNotification(`下载失败: ${e.message}。请尝试右键另存为`, 'fas fa-exclamation-triangle');
    }
}

function performBlobDownload(blob, imageId) {
    return new Promise((resolve) => {
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        const filename = `美女图片_${imageId}.jpg`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            try { URL.revokeObjectURL(url); } catch (e) { /* silent error */ }
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
        const historyItem = {
            id: meta.id,
            url: meta.url,
            timestamp: new Date().toLocaleString()
        };
        state.history.unshift(historyItem);
    }

    state.history = state.history.slice(0, 50);
    localStorage.setItem('history', JSON.stringify(state.history));
    loadHistory();
}

async function loadHistory() {
    const container = elements.historyList;
    if (!state.history || state.history.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 30px 20px;">
                <i class="fas fa-history" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                暂无历史
            </div>
        `;
        return;
    }
    const rows = await Promise.all(state.history.map(async item => {
        const rec = await dbGetImage(item.id);
        let thumbUrl = '';
        if (rec && rec.blob) {
            try { thumbUrl = URL.createObjectURL(rec.blob); } catch (e) { thumbUrl = ''; }
        }
        return `
            <div class="content-item" onclick="loadImageFromFavorite('${item.id}');">
                <img class="content-thumb" src="${thumbUrl}" alt="历史图片" loading="lazy">
                <div class="content-info">${item.timestamp}</div>
            </div>
        `;
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

// ----- 清理功能 -----
function clearHistory() {
    if (!confirm('确认清空浏览历史？此操作不可撤销。')) return;
    state.history = [];
    localStorage.setItem('history', JSON.stringify(state.history));
    loadHistory();
    showNotification('浏览历史已清空', 'fas fa-history');
}

function clearFavorites() {
    if (!confirm('确认清空我的收藏？此操作不可撤销。')) return;
    state.favorites = [];
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    loadFavorites();
    updateStats('favorites');
    showNotification('收藏已清空', 'fas fa-heart-broken');
}

async function clearCache() {
    if (!confirm('确认清空缓存？清空后本地存储的图片将被删除（收藏项和历史记录仍保留元数据，但缩略图将不可用）。')) return;
    await dbClearAllImages();
    state.currentImageId = '';
    state.currentImageUrl = '';
    localStorage.removeItem('lastImageId');
    elements.image.src = '';
    elements.image.style.display = 'none';
    showNotification('缓存已清空，正在加载新图片', 'fas fa-trash');
    loadRandomImage();
}

function clearStats() {
    if (!confirm('确认清空统计数据？此操作不会影响收藏与缓存。')) return;
    state.stats = { views: 0, downloads: 0, shares: 0 };
    localStorage.setItem('stats', JSON.stringify(state.stats));
    loadStats();
    showNotification('统计已清空', 'fas fa-chart-bar');
}

// ----- 全局键盘与点击行为 -----
document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.code) {
        case 'Space':
            e.preventDefault();
            if (!elements.loadBtn.disabled) loadRandomImage();
            break;
        case 'KeyF':
            e.preventDefault();
            toggleFavorite();
            break;
        case 'KeyD':
            e.preventDefault();
            downloadImage();
            break;
        case 'KeyS':
            e.preventDefault();
            showSharePanel();
            break;
        case 'KeyT':
            e.preventDefault();
            toggleTheme();
            break;
        case 'Escape':
            if (elements.sharePanel && elements.sharePanel.classList.contains('active')) {
                hideSharePanel();
            }
            break;
    }
});

document.addEventListener('click', function (e) {
    if (
        elements.sharePanel && elements.sharePanel.classList.contains('active') &&
        !elements.sharePanel.contains(e.target) &&
        !e.target.closest('.share-btn') &&
        !e.target.closest('#shareBtn')
    ) {
        hideSharePanel();
    }
});


// ----- 页面加载后初始化 -----
window.addEventListener('load', init);

// 暴露函数给 HTML 事件绑定使用
window.loadRandomImage = loadRandomImage;
window.openFullscreen = openFullscreen;
window.enterFullscreen = enterFullscreen;
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
window.removeFavorite = removeFavorite;
window.clearHistory = clearHistory;
window.clearFavorites = clearFavorites;
window.clearCache = clearCache;
window.clearStats = clearStats;
