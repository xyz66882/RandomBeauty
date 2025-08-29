# 项目介绍：RandomBeauty - 随机美女图片

![Web-page-player](https://socialify.git.ci/xyz66882/RandomBeauty/image?font=Raleway&forks=1&issues=1&name=1&owner=1&pattern=Plus&pulls=1&stargazers=1&theme=Auto)

<p align="center">
  <!-- 创建日期 --><img alt="GitHub Created At" src="https://img.shields.io/github/created-at/xyz66882/RandomBeauty?logo=github&label=%E5%88%9B%E5%BB%BA%E6%97%A5%E6%9C%9F">
  <!-- 下载量 --><a href="https://github.com/xyz66882/RandomBeauty/releases"><img src="https://img.shields.io/github/downloads/xyz66882/RandomBeauty/total?logo=github&label=%E4%B8%8B%E8%BD%BD%E9%87%8F"></a>
  <!-- 贡献者 --><a href="https://github.com/xyz66882/RandomBeauty/graphs/contributors"><img src="https://img.shields.io/github/contributors-anon/xyz66882/RandomBeauty?logo=github&label=%E8%B4%A1%E7%8C%AE%E8%80%85"></a>
  <!-- 最新版本 --><a href="https://github.com/xyz66882/RandomBeauty/releases/"><img src="https://img.shields.io/github/release/xyz66882/RandomBeauty?logo=github&label=%E6%9C%80%E6%96%B0%E7%89%88%E6%AC%A1"></a>
  <!-- 问题数 --><a href="https://github.com/xyz66882/RandomBeauty/issues"><img src="https://img.shields.io/github/issues-raw/xyz66882/RandomBeauty?logo=github&label=%E9%97%AE%E9%A2%98"></a>
  <!-- 讨论数 --><a href="https://github.com/xyz66882/RandomBeauty/discussions"><img src="https://img.shields.io/github/discussions/xyz66882/RandomBeauty?logo=github&label=%E8%AE%A8%E8%AE%BA"></a>
  <!-- 仓库大小 --><a href="https://github.com/xyz66882/RandomBeauty"><img src="https://img.shields.io/github/repo-size/xyz66882/RandomBeauty?logo=github&label=%E4%BB%93%E5%BA%93%E5%A4%A7%E5%B0%8F"></a>
</p>

![随机图片](https://github.com/user-attachments/assets/66ceeaa4-c621-4036-b829-9138c88a9ab5)


**发现每一刻的美好，感受视觉的极致体验。**

RandomBeauty 是一个精心设计的随机图片浏览应用，致力于为用户提供一个纯粹、流畅、个性化的视觉享受平台。我们旨在通过简洁直观的界面和强大的底层技术，让每一次图片加载都成为一次探索美的旅程。

***

## 🌟 项目概览

RandomBeauty 不仅仅是一个简单的图片展示工具，它是一个结合了现代前端技术与用户体验设计理念的应用。从流畅的主题切换到智能的本地缓存，从详尽的统计数据到便捷的图片管理，我们力求在每一个细节上都能带给用户极致的体验。

我们修复了原版应用在 CDN 引用上的潜在问题（由 typo 引发的），并进行了多项优化，确保应用的稳定性和性能。

## ✨ 主要功能与特色

### 1. 极致随机浏览体验

- **一键换图**：轻松点击“换一张”按钮（或按下 `空格键`），即刻呈现全新的精美图片，每一次浏览都是一次惊喜。
- **直观的用户界面**：简洁大方的布局，图片为核心，两侧边栏提供丰富功能。
- **流畅的加载动画**：图片加载时，优雅的加载动画将提示用户，避免等待的枯燥。

### 2. 个性化收藏与历史记录

- **我的收藏**：将心仪的图片一键收藏（或按下 `F 键`），随时回顾，永不遗失。收藏内容会智能缓存，即使离线也能查看（基于 IndexedDB）。
- **浏览历史**：自动记录您的浏览足迹，方便回溯查看近期欣赏过的图片。
- **管理选项**：提供清空收藏、清空浏览历史的功能，让您的数据管理更加灵活。

### 3. 多样化图片操作

- **图片下载**：支持一键下载当前显示的图片（或按下 `D 键`），保存到本地设备。
- **无缝分享**：支持将图片链接分享至微博、微信（复制链接）、QQ 等主流社交平台（或按下 `S 键`）。
- **全屏查看**：点击图片或全屏按钮，进入沉浸式全屏模式，细致欣赏图片每个细节（支持 `Esc` 关闭，`空格键` 切换下一张）。
- **图片质量选择**：提供原图、高清、标准三种图片质量选项，满足不同网络环境和存储需求。

### 4. 数据统计与管理

- **实时统计**：清晰展示您的浏览次数、收藏数量、下载次数和分享次数，让您对自己的使用情况一目了然。
- **本地缓存管理**：支持清空图片缓存，释放本地存储空间，同时保留收藏和历史记录的元数据。
- **统计数据清空**：可以单独清空所有的统计数据。

### 5. 优雅的用户体验设计

- **主题切换**：支持深色（默认）和浅色主题（或按下 `T 键`）无缝切换，适应不同偏好和照明环境。
- **动态粒子背景**：精心设计的粒子动画背景，为界面增添科技感和活力。
- **响应式布局**：完美适配不同尺寸的设备（PC、平板、手机），提供一致的视觉体验。
- **友好通知**：操作成功或失败，会有简洁的通知提示。

## ⚙ 技术栈

- **前端框架**：`HTML5`、`CSS3`、`JavaScript (ES6+)`
- **UI/UX**：灵活运用 CSS 变量、渐变、模糊背景 (`backdrop-filter`)、阴影等现代 CSS 特性，打造精致视觉效果。
- **数据存储**：

  - `IndexedDB`：用于高效、持久地缓存图片 Blob 数据，确保收藏和历史图片在刷新后依然可见，并支持离线查看。
  - `localStorage`：用于存储用户偏好（如主题）、统计数据、收藏列表和浏览历史的元数据。

- **API 集成**：通过 `Fetch API` 从外部接口获取随机图片资源。
- **第三方库**：`Font Awesome` 用于图标支持。

## 🔧 核心亮点

- **持久化图片缓存**：利用 `IndexedDB` 技术，用户浏览过的图片会自动缓存，并在收藏和历史记录中直接显示缓存图片，极大提升加载速度和离线可用性，避免重复请求。
- **代码优化与修复**：修正了原版 CSS 链接的 typo 问题，并对 JavaScript 逻辑进行了增强和优化，提升了整体稳定性和健壮性。
- **关注用户体验细节**：包括键盘快捷键支持、全屏模式的细节处理、友好的错误提示和通知机制。

## 🚀 快速使用

1. **打开应用**：访问部署地址或在本地启动 `index.html` 文件。
2. **浏览图片**：点击“换一张”按钮或按下 `空格键`。
3. **收藏/下载/分享**：当您看到喜欢的图片时，点击相应按钮或使用 `F`/`D`/`S` 快捷键。
4. **管理数据**：在右侧边栏的“管理选项”中，您可以清空历史、收藏、缓存或统计数据。
5. **切换主题**：点击导航栏右侧的开关或按下 `T 键`。

# 🚀 贡献者

<a href="https://github.com/xyz66882/RandomBeauty/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=xyz66882/RandomBeauty" />
</a>
<br /><br />

# ⭐️ 收藏 历史

<a href="https://www.star-history.com/#xyz66882/RandomBeauty&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=xyz66882/RandomBeauty&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=xyz66882/RandomBeauty&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=xyz66882/RandomBeauty&type=Date" />
 </picture>
</a>
