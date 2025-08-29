// js/script.js
// 修复/增强版：使用 IndexedDB 持久缓存图片 Blob，保证刷新后仍显示同一张图片，收藏/历史/下载使用本地缓存。
// 注意：现代浏览器支持 IndexedDB、fetch、Blob、navigator.clipboard 等 API。

// NOTE: 将 typo 修正为 https://
// 默认示例 API（需替换为可用接口）。可以使用之前的 API 地址替换此处常量。
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
    currentImageUrl: '', // 原始请求 URL（仅作记录）
    favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
    history: JSON.parse(localStorage.getItem('history') || '[]'),
    stats: JSON.parse(localStorage.getItem('stats') || '{"views":0,"downloads":0,"shares":0}'),
    theme: localStorage.getItem('theme') || 'dark',
    quality: 'original',
    loadingFetchAbortController: null
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
                loadRandomImage();
            }
        }).catch(err => {
            console.error('读取缓存图片失败', err);
            loadRandomImage();
        });
    } else {
        loadRandomImage();
    }
}

// ----- 粒子背景 -----
function createParticles() {
    const particlesContainer = document.getElementById('particles');
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
        try { URL.revokeObjectURL(currentObjectUrl); } catch (e) {}
    }
    currentObjectUrl = objUrl;
    elements.image.src = objUrl;
    elements.image.style.display = 'block';
}

// ----- 生成唯一 ID -----
function genId() {
    return 'img_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
}

// ----- 加载随机图片 -----
let lastFetchUrl = null;
async function loadRandomImage(force = false) {
    if (state.loadingFetchAbortController) {
        try { state.loadingFetchAbortController.abort(); } catch (e) {}
        state.loadingFetchAbortController = null;
    }

    showLoading();
    elements.error.style.display = 'none';

    // 构造请求 URL（API 本身返回图片或图片链接）
    const requestUrl = API_URL + '?t=' + Date.now() + '&quality=' + encodeURIComponent(state.quality);
    lastFetchUrl = requestUrl;

    const controller = new AbortController();
    state.loadingFetchAbortController = controller;

    try {
        // 先请求 API（该 API 预期返回一个直接可用的图片 URL 或图片内容）
        const resp = await fetch(requestUrl, { signal: controller.signal, cache: 'no-store' });
        if (!resp.ok) throw new Error('网络响应错误: ' + resp.status);

        // 兼容两种情况：API 直接返回图片二进制，或返回 JSON 包含图片 URL
        const contentType = resp.headers.get('Content-Type') || '';
        let blob;
        let sourceUrl = requestUrl;

        if (contentType.includes('application/json')) {
            // 假设 JSON 中包含 { url: '...' } 或类似字段
            const json = await resp.json();
            const urlFromApi = json.url || json.data || json.image || json.img || json.src;
            if (!urlFromApi) throw new Error('API 返回格式不包含图片 URL');
            sourceUrl = urlFromApi;
            const imgResp = await fetch(urlFromApi, { signal: controller.signal, cache: 'no-store' });
            if (!imgResp.ok) throw new Error('图片下载失败: ' + imgResp.status);
            blob = await imgResp.blob();
        } else {
            // API 直接返回图片二进制
            blob = await resp.blob();
            sourceUrl = requestUrl;
        }

        // 生成 id 并保存到 indexedDB
        const id = genId();
        const record = {
            id,
            blob,
            timestamp: Date.now(),
            sourceUrl
        };
        await dbPutImage(record);

        // 更新状态
        state.currentImageId = id;
        state.currentImageUrl = sourceUrl;
        localStorage.setItem('lastImageId', id);

        // 显示图片（使用 object URL）
        const objUrl = URL.createObjectURL(blob);
        displayImageObjectUrl(objUrl);

        hideLoading();
        addToHistory({ id, url: sourceUrl });
        updateStats('views');
        updateFavoriteButton();
        state.loadingFetchAbortController = null;
    } catch (err) {
        console.error('加载图片失败', err);
        hideLoading();
        showError();
        state.loadingFetchAbortController = null;
    }
}

// ----- 全屏（修复相关逻辑） -----
let fullscreenImageObjectUrl = null;

function setupFullscreenHandlers() {
    // 点击遮罩（但不在图片区域）退出全屏
    elements.fullscreenOverlay.addEventListener('click', (e) => {
        // 若点击在 inner 区域（包含图片与关闭按钮），忽略（允许内部按钮处理）
        if (!elements.fullscreenInner.contains(e.target)) {
            exitFullscreen();
        }
    });

    // 关闭按钮
    elements.fullscreenClose.addEventListener('click', (e) => {
        e.stopPropagation();
        exitFullscreen();
    });

    // 防止图片内的点击传播到遮罩（例如点击图片本身不退出）
    elements.fullscreenImage.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

function openFullscreen() {
    // 这个函数与 enterFullscreen 名称保持兼容（页面上按钮绑定 openFullscreen）
    enterFullscreen();
}

function enterFullscreen() {
    if (!state.currentImageId) {
        console.warn('No current image to fullscreen.');
        return;
    }

    dbGetImage(state.currentImageId).then(rec => {
        if (!rec || !rec.blob) {
            showNotification('无法进入全屏：图片未缓存', 'fas fa-exclamation-triangle');
            return;
        }

        // 清理之前的 objectURL（如果有）
        if (fullscreenImageObjectUrl) {
            try { URL.revokeObjectURL(fullscreenImageObjectUrl); } catch (e) {}
            fullscreenImageObjectUrl = null;
        }

        fullscreenImageObjectUrl = URL.createObjectURL(rec.blob);
        elements.fullscreenImage.src = fullscreenImageObjectUrl;

        // 显示 overlay（使用 flex）
        elements.fullscreenOverlay.style.display = 'flex';
        elements.fullscreenOverlay.setAttribute('aria-hidden', 'false');

        // 禁止 body 滚动
        document.body.style.overflow = 'hidden';

        // 绑定键盘事件
        document.addEventListener('keydown', handleFullscreenKeydown, { capture: true });

        // focus to support keyboard
        elements.fullscreenClose.focus && elements.fullscreenClose.focus();
    }).catch(err => {
        console.error('enterFullscreen error', err);
    });
}

function exitFullscreen() {
    // 隐藏 overlay
    elements.fullscreenOverlay.style.display = 'none';
    elements.fullscreenOverlay.setAttribute('aria-hidden', 'true');

    // 恢复 body 滚动
    document.body.style.overflow = '';

    // 移除键盘事件
    document.removeEventListener('keydown', handleFullscreenKeydown, { capture: true });

    // 清理 objectURL
    try {
        if (fullscreenImageObjectUrl) {
            URL.revokeObjectURL(fullscreenImageObjectUrl);
            fullscreenImageObjectUrl = null;
        }
    } catch (e) {
        console.warn('Error revoke fullscreen URL', e);
    }

    // 清空图片 src（防止内存泄漏）
    elements.fullscreenImage.src = '';
}

function handleFullscreenKeydown(e) {
    // 当全屏可见时，Esc 关闭，全屏下左右或空格切换图片
    const overlayVisible = elements.fullscreenOverlay.style.display === 'flex';
    if (!overlayVisible) return;

    if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        exitFullscreen();
        return;
    }

    if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        // 切换到下一张图片（相当于换一张）
        loadRandomImage();
        return;
    }

    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        // 可实现回退到历史第一项（如果存在）
        if (state.history && state.history.length > 0) {
            const first = state.history[0];
            if (first && first.id) loadImageFromFavorite(first.id);
        }
    }
}

// ----- 收藏 -----
function toggleFavorite() {
    if (!state.currentImageId) return;
    const exist = state.favorites.find(f => f.id === state.currentImageId);
    if (exist) {
        state.favorites = state.favorites.filter(f => f.id !== state.currentImageId);
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
            // 不在缓存时可选择不主动下载（避免大量流量），这里用 placeholder
            thumbUrl = '';
        }
        return `
            <div class="content-item" onclick="loadImageFromFavorite('${fav.id}')">
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
    const rec = await dbGetImage(id);
    if (!rec || !rec.blob) {
        showNotification('收藏图片未缓存，尝试远程加载...', 'fas fa-spinner');
        const fav = state.favorites.find(f => f.id === id);
        if (fav && fav.url) {
            try {
                const resp = await fetch(fav.url, { cache: 'no-store' });
                if (!resp.ok) throw new Error('加载失败');
                const blob = await resp.blob();
                await dbPutImage({ id, blob, timestamp: Date.now(), sourceUrl: fav.url });
                state.currentImageId = id;
                state.currentImageUrl = fav.url;
                localStorage.setItem('lastImageId', id);
                displayImageObjectUrl(URL.createObjectURL(blob));
                updateFavoriteButton();
                showNotification('图片已从远程加载并缓存', 'fas fa-check-circle');
                return;
            } catch (e) {
                showNotification('加载失败', 'fas fa-exclamation-triangle');
                return;
            }
        } else {
            showNotification('收藏元数据不存在图片地址', 'fas fa-exclamation-triangle');
            return;
        }
    }
    state.currentImageId = id;
    state.currentImageUrl = rec.sourceUrl || '';
    localStorage.setItem('lastImageId', id);
    displayImageObjectUrl(URL.createObjectURL(rec.blob));
    updateFavoriteButton();
    updateStats('views', { incrementDirect: false });
}

function removeFavorite(id) {
    state.favorites = state.favorites.filter(f => f.id !== id);
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    loadFavorites();
    updateStats('favorites');
}

// ----- 分享 -----
function showSharePanel() {
    if (!state.currentImageId) return;
    elements.sharePanel.classList.add('active');
    elements.sharePanel.setAttribute('aria-hidden', 'false');
}

function hideSharePanel() {
    elements.sharePanel.classList.remove('active');
    elements.sharePanel.setAttribute('aria-hidden', 'true');
}

function shareToWeibo() {
    dbGetImage(state.currentImageId).then(rec => {
        const text = encodeURIComponent('发现一张超美的图片！');
        const url = encodeURIComponent(rec ? (rec.sourceUrl || '') : '');
        window.open(`https://service.weibo.com/share/share.php?url=${url}&title=${text}`, '_blank');
        updateStats('shares');
        hideSharePanel();
    });
}

function shareToWeixin() {
    copyLink();
    showNotification('链接已复制，请在微信中粘贴分享', 'fab fa-weixin');
    hideSharePanel();
}

function shareToQQ() {
    dbGetImage(state.currentImageId).then(rec => {
        const text = encodeURIComponent('发现一张超美的图片！');
        const url = encodeURIComponent(rec ? (rec.sourceUrl || '') : '');
        window.open(`https://connect.qq.com/widget/shareqq/index.html?url=${url}&title=${text}`, '_blank');
        updateStats('shares');
        hideSharePanel();
    });
}

function copyLink() {
    const url = state.currentImageUrl || '';
    navigator.clipboard.writeText(url).then(() => {
        showNotification('链接已复制到剪贴板', 'fas fa-link');
        updateStats('shares');
    }).catch(() => {
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
            showNotification('当前图片未缓存，正在尝试缓存后下载...', 'fas fa-spinner');
            if (rec && rec.sourceUrl) {
                try {
                    const resp = await fetch(rec.sourceUrl, { cache: 'no-store' });
                    const blob = await resp.blob();
                    await dbPutImage({ id: state.currentImageId, blob, timestamp: Date.now(), sourceUrl: rec.sourceUrl });
                    await performBlobDownload(blob);
                    updateStats('downloads');
                    showNotification('下载成功', 'fas fa-download');
                } catch (e) {
                    showNotification('下载失败，请右键另存为', 'fas fa-exclamation-triangle');
                }
            } else {
                showNotification('无可用资源下载', 'fas fa-exclamation-triangle');
            }
            return;
        }
        await performBlobDownload(rec.blob);
        updateStats('downloads');
        showNotification('下载成功', 'fas fa-download');
    } catch (e) {
        console.error(e);
        showNotification('下载失败，请右键另存为', 'fas fa-exclamation-triangle');
    }
}

function performBlobDownload(blob) {
    return new Promise((resolve) => {
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        const filename = `美女图片_${state.currentImageId}.jpg`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            try { URL.revokeObjectURL(url); } catch (e) {}
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
    if (state.history.length > 0 && state.history[0].id === meta.id) return;
    const historyItem = {
        id: meta.id,
        url: meta.url,
        timestamp: new Date().toLocaleString()
    };
    state.history.unshift(historyItem);
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
            <div class="content-item" onclick="loadImageFromFavorite('${item.id}')">
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
    if (!confirm('确认清空缓存？清空后本地存储的图片将被删除（收藏项仍保留元数据，但缩略将不可用）。')) return;
    await dbClearAllImages();
    state.currentImageId = '';
    state.currentImageUrl = '';
    localStorage.removeItem('lastImageId');
    loadRandomImage();
    showNotification('缓存已清空', 'fas fa-trash');
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
            // 如果 sharePanel 打开则关闭，否则如在全屏中也会由 fullscreen 键处理器处理
            if (elements.sharePanel.classList.contains('active')) {
                hideSharePanel();
            }
            break;
    }
});

// 点击页面时，如果点击在分享面板外则隐藏（但避免误关）
document.addEventListener('click', function (e) {
    if (elements.sharePanel.classList.contains('active') && !elements.sharePanel.contains(e.target) && !e.target.closest('.share-btn') && !e.target.closest('#shareBtn')) {
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