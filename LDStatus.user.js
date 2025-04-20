// ==UserScript==
// @name         LDStatus
// @namespace    http://tampermonkey.net/
// @version      1.11
// @description  在 Linux.do 页面显示信任级别进度
// @author       1e0n
// @match        https://linux.do/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_info
// @connect      connect.linux.do
// @connect      github.com
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/1e0n/LinuxDoStatus/master/LDStatus.user.js
// @downloadURL  https://raw.githubusercontent.com/1e0n/LinuxDoStatus/master/LDStatus.user.js
// ==/UserScript==

(function () {
	'use strict';

	// 创建样式 - 使用更特定的选择器以避免影响帖子界面的按钮
	const style = document.createElement('style');
	style.textContent = `
        /* 深色主题 */
        #ld-trust-level-panel.ld-dark-theme {
            background-color: #2d3748;
            color: #e2e8f0;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.4);
        }

        #ld-trust-level-panel.ld-dark-theme #ld-trust-level-header {
            background-color: #1a202c;
            color: white;
        }

        #ld-trust-level-panel.ld-dark-theme .ld-trust-level-item.ld-success .ld-value {
            color: #68d391;
        }

        #ld-trust-level-panel.ld-dark-theme .ld-trust-level-item.ld-fail .ld-value {
            color: #fc8181;
        }

        #ld-trust-level-panel.ld-dark-theme .ld-loading {
            color: #a0aec0;
        }

        #ld-trust-level-panel.ld-dark-theme .ld-daily-stats-title {
            color: #a0aec0;
        }

        #ld-trust-level-panel.ld-dark-theme .ld-daily-stats-item .ld-value {
            color: #68d391;
        }

        #ld-trust-level-panel.ld-dark-theme .ld-version {
            color: #a0aec0;
        }

        /* 亮色主题 - 提高对比度 */
        #ld-trust-level-panel.ld-light-theme {
            background-color: #ffffff;
            color: #1a202c;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
            border: 1px solid #e2e8f0;
        }

        #ld-trust-level-panel.ld-light-theme #ld-trust-level-header {
            background-color: #3182ce; /* 更深的蓝色 */
            color: #ffffff;
            border-bottom: 1px solid #2c5282; /* 添加底部边框 */
        }

        #ld-trust-level-panel.ld-light-theme .ld-trust-level-item.ld-success .ld-value {
            color: #276749; /* 更深的绿色 */
            font-weight: bold;
        }

        #ld-trust-level-panel.ld-light-theme .ld-trust-level-item.ld-fail .ld-value {
            color: #c53030;
            font-weight: bold;
        }

        /* 亮色主题下的文本颜色 */
        #ld-trust-level-panel.ld-light-theme .ld-name {
            color: #2d3748; /* 深灰色 */
        }

        #ld-trust-level-panel.ld-light-theme .ld-loading {
            color: #4a5568;
        }

        #ld-trust-level-panel.ld-light-theme .ld-daily-stats-title {
            color: #4a5568;
            font-weight: bold;
        }

        #ld-trust-level-panel.ld-light-theme .ld-daily-stats-item .ld-value {
            color: #2c7a4b;
            font-weight: bold;
        }

        #ld-trust-level-panel.ld-light-theme .ld-version {
            color: #e2e8f0;
        }

        /* 共用样式 */
        #ld-trust-level-panel {
            position: fixed;
            left: -40px; /* 默认隐藏在左侧，只露出一小部分 */
            top: 100px;
            width: 210px;
            border-radius: 8px;
            z-index: 9999;
            font-family: Arial, sans-serif;
            transition: all 0.3s ease;
            overflow: hidden;
            font-size: 12px;
        }

        /* 鼠标悬停时显示面板 */
        #ld-trust-level-panel.ld-hover-show {
            left: 10px;
        }

        #ld-trust-level-header {
            padding: 8px 10px;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
        }

        .ld-header-content {
            display: flex;
            width: 100%;
            align-items: center;
            justify-content: space-between;
            white-space: nowrap;
        }

        .ld-header-content > span:first-child {
            margin-right: auto;
            font-weight: bold;
        }

        #ld-trust-level-content {
            padding: 10px;
            max-height: none;
            overflow-y: visible;
        }

        .ld-trust-level-item {
            margin-bottom: 6px;
            display: flex;
            white-space: nowrap;
            width: 100%;
            justify-content: space-between;
        }

        .ld-trust-level-item .ld-name {
            flex: 0 1 auto;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 60%;
        }

        .ld-trust-level-item .ld-value {
            font-weight: bold;
            flex: 0 0 auto;
            text-align: right;
            min-width: 70px;
        }

        /* 这些样式已移动到主题特定样式中 */

        .ld-toggle-btn, .ld-refresh-btn, .ld-update-btn, .ld-theme-btn {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 14px;
            margin-left: 5px;
        }

        .ld-version {
            font-size: 10px;
            color: #a0aec0;
            margin-left: 5px;
            font-weight: normal;
        }

        .ld-collapsed {
            width: 40px !important;
            height: 40px !important;
            min-width: 40px !important;
            max-width: 40px !important;
            border-radius: 8px;
            overflow: hidden;
            transform: none !important;
            left: -35px !important; /* 在折叠状态下只露出5px */
        }

        /* 当鼠标悬停在左侧时，显示折叠的面板 */
        .ld-collapsed.ld-hover-show {
            left: -5px !important; /* 露出大部分按钮 */
        }

        .ld-collapsed #ld-trust-level-header {
            justify-content: center;
            width: 40px !important;
            height: 40px !important;
            min-width: 40px !important;
            max-width: 40px !important;
            padding: 0;
            display: flex;
            align-items: center;
        }

        .ld-collapsed #ld-trust-level-header > div {
            justify-content: center;
            width: 100%;
            height: 100%;
        }

        .ld-collapsed #ld-trust-level-content {
            display: none !important;
        }

        .ld-collapsed .ld-header-content > span,
        .ld-collapsed .ld-refresh-btn,
        .ld-collapsed .ld-update-btn,
        .ld-collapsed .ld-theme-btn,
        .ld-collapsed .ld-version {
            display: none !important;
        }

        .ld-collapsed .ld-toggle-btn {
            margin: 0;
            font-size: 16px;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
        }

        .ld-loading {
            text-align: center;
            padding: 10px;
        }

        /* 深色主题下的变化指示器 */
        .ld-dark-theme .ld-increase {
            color: #ffd700; /* 黄色 */
        }

        .ld-dark-theme .ld-decrease {
            color: #4299e1; /* 蓝色 */
        }

        /* 亮色主题下的变化指示器 */
        .ld-light-theme .ld-increase {
            color: #d69e2e; /* 深黄色 */
            font-weight: bold;
        }

        .ld-light-theme .ld-decrease {
            color: #2b6cb0; /* 深蓝色 */
            font-weight: bold;
        }

        /* 所有主题下的活动数据区域 */
        .ld-daily-stats {
            margin-top: 10px;
            font-size: 11px;
        }

        /* 深色主题下的分隔线 */
        .ld-dark-theme .ld-daily-stats {
            border-top: 1px solid #4a5568;
            padding-top: 10px;
        }

        /* 亮色主题下的分隔线 */
        .ld-light-theme .ld-daily-stats {
            border-top: 1px solid #cbd5e0;
            padding-top: 10px;
        }

        .ld-daily-stats-title {
            font-weight: bold;
            margin-bottom: 5px;
        }

        .ld-daily-stats-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
        }

        .ld-daily-stats-item .ld-name {
            flex: 0 1 auto;
            color: inherit;
        }

        .ld-daily-stats-item .ld-value {
            flex: 0 0 auto;
            font-weight: bold;
            color: inherit;
        }

        /* 添加两天数据的样式 */
        .ld-dual-stats {
            display: flex;
            justify-content: flex-end;
            gap: 5px;
            min-width: 70px;
            text-align: right;
        }

        .ld-day-stat {
            min-width: 25px;
            width: 25px;
            text-align: right;
            display: inline-block;
        }

        .ld-day1 {
            color: #68d391; /* 跟上部一致的绿色 */
        }

        .ld-day2 {
            color: #a0aec0; /* 跟上部一致的灰色 */
        }

        .ld-light-theme .ld-day1 {
            color: #276749; /* 浅色主题下与主面板绿色一致 */
        }

        .ld-light-theme .ld-day2 {
            color: #2d3748; /* 浅色主题下更深的灰色 */
        }

        .ld-dark-theme .ld-day2 {
            color: #cbd5e1; /* 深色主题下更亮的灰色，增强可读性 */
        }

        .ld-trend-indicator {
            margin-left: 2px;
            display: inline-block;
            min-width: 25px;
            width: 25px;
            text-align: left;
        }

        .ld-stats-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            font-size: 10px;
            color: inherit;
        }

        .ld-light-theme .ld-stats-header {
            color: #2d3748;
        }

        .ld-dark-theme .ld-stats-header {
            color: #e2e8f0;
        }

        .ld-stats-header-cols {
            display: flex;
            gap: 5px;
            min-width: 70px;
            justify-content: flex-end;
        }

        .ld-stats-header-col {
            min-width: 25px;
            width: 25px;
            text-align: center;
        }

        .ld-stats-header-trend {
            min-width: 25px;
            width: 25px;
            text-align: center;
        }
    `;
	document.head.appendChild(style);

	// 定义存储键
	const STORAGE_KEY_POSITION = 'ld_panel_position';
	const STORAGE_KEY_COLLAPSED = 'ld_panel_collapsed';
	const STORAGE_KEY_THEME = 'ld_panel_theme';
	const STORAGE_KEY_AUTO_THEME = 'ld_panel_auto_theme'; // 新增：自动主题切换模式

	// 创建面板
	const panel = document.createElement('div');
	panel.id = 'ld-trust-level-panel';

	// 检测浏览器主题的函数
	function detectBrowserTheme() {
		return window.matchMedia &&
			window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light';
	}

	// 设置默认主题
	const isAutoTheme = GM_getValue(STORAGE_KEY_AUTO_THEME, false); // 默认不启用自动主题
	let currentTheme;

	if (isAutoTheme) {
		// 如果启用了自动主题，则使用浏览器主题
		currentTheme = detectBrowserTheme();
	} else {
		// 否则使用用户设置的主题
		currentTheme = GM_getValue(STORAGE_KEY_THEME, 'dark');
	}

	panel.classList.add(
		currentTheme === 'dark' ? 'ld-dark-theme' : 'ld-light-theme'
	);

	// 获取脚本版本号
	const scriptVersion = GM_info.script.version;

	// 创建面板头部
	const header = document.createElement('div');
	header.id = 'ld-trust-level-header';
	header.innerHTML = `
        <div class="ld-header-content">
            <span>Status</span>
            <span class="ld-version">v${scriptVersion}</span>
            <button class="ld-update-btn" title="检查更新">🔎</button>
            <button class="ld-refresh-btn" title="刷新数据">🔄</button>
            <button class="ld-theme-btn" title="切换主题">🌙</button>
            <button class="ld-toggle-btn" title="展开/收起">◀</button>
        </div>
    `;

	// 创建内容区域
	const content = document.createElement('div');
	content.id = 'ld-trust-level-content';
	content.innerHTML = '<div class="ld-loading">加载中...</div>';

	// 组装面板
	panel.appendChild(header);
	panel.appendChild(content);
	document.body.appendChild(panel);

	// 保存窗口位置的函数
	function savePanelPosition() {
		const transform = window.getComputedStyle(panel).transform;
		if (transform && transform !== 'none') {
			const matrix = new DOMMatrix(transform);
			GM_setValue(STORAGE_KEY_POSITION, { x: matrix.e, y: matrix.f });
		}
	}

	// 保存窗口折叠状态的函数
	function savePanelCollapsedState() {
		GM_setValue(
			STORAGE_KEY_COLLAPSED,
			panel.classList.contains('ld-collapsed')
		);
	}

	// 恢复窗口状态
	function restorePanelState() {
		// 恢复折叠状态
		const isCollapsed = GM_getValue(STORAGE_KEY_COLLAPSED, true); // 默认折叠
		if (isCollapsed) {
			panel.classList.add('ld-collapsed');
			toggleBtn.textContent = '▶'; // 右箭头
		} else {
			panel.classList.remove('ld-collapsed');
			toggleBtn.textContent = '◀'; // 左箭头
		}

		// 恢复位置
		const position = GM_getValue(STORAGE_KEY_POSITION, null);
		if (position) {
			panel.style.transform = `translate(${position.x}px, ${position.y}px)`;
		}

		// 初始状态下不显示面板
		panel.classList.remove('ld-hover-show');
	}

	// 拖动功能
	let isDragging = false;
	let lastX, lastY;

	header.addEventListener('mousedown', (e) => {
		if (panel.classList.contains('ld-collapsed')) return;

		isDragging = true;
		lastX = e.clientX;
		lastY = e.clientY;

		// 添加拖动时的样式
		panel.style.transition = 'none';
		document.body.style.userSelect = 'none';
	});

	document.addEventListener('mousemove', (e) => {
		if (!isDragging) return;

		// 使用 transform 而不是改变 left/top 属性，性能更好
		const dx = e.clientX - lastX;
		const dy = e.clientY - lastY;

		const currentTransform = window.getComputedStyle(panel).transform;
		const matrix = new DOMMatrix(
			currentTransform === 'none' ? '' : currentTransform
		);

		const newX = matrix.e + dx;
		const newY = matrix.f + dy;

		panel.style.transform = `translate(${newX}px, ${newY}px)`;

		lastX = e.clientX;
		lastY = e.clientY;
	});

	document.addEventListener('mouseup', () => {
		if (!isDragging) return;

		isDragging = false;
		wasJustDragging = true; // 设置标记，表示刚刚在拖动
		panel.style.transition = '';
		document.body.style.userSelect = '';

		// 保存窗口位置
		savePanelPosition();

		// 延迟重置拖动标记，确保点击事件已处理
		setTimeout(() => {
			wasJustDragging = false;
		}, 10);
	});

	// 收起面板的函数
	function collapsePanel() {
		if (!panel.classList.contains('ld-collapsed')) {
			panel.classList.add('ld-collapsed');
			toggleBtn.textContent = '▶'; // 右箭头

			// 保存折叠状态
			savePanelCollapsedState();

			// 如果面板处于默认位置，也移除悬停显示类
			const transform = window.getComputedStyle(panel).transform;
			if (transform === 'none' || transform === '') {
				panel.classList.remove('ld-hover-show');
			}
		}
	}

	// 展开面板的函数
	function expandPanel() {
		if (panel.classList.contains('ld-collapsed')) {
			panel.classList.remove('ld-collapsed');
			toggleBtn.textContent = '◀'; // 左箭头

			// 确保面板可见
			panel.classList.add('ld-hover-show');

			// 保存折叠状态
			savePanelCollapsedState();
		}
	}

	// 展开/收起功能
	const toggleBtn = header.querySelector('.ld-toggle-btn');
	toggleBtn.addEventListener('click', () => {
		if (panel.classList.contains('ld-collapsed')) {
			expandPanel();
		} else {
			collapsePanel();
		}
	});

	// 刷新按钮
	const refreshBtn = header.querySelector('.ld-refresh-btn');
	refreshBtn.addEventListener('click', fetchTrustLevelData);

	// 检查更新按钮
	const updateBtn = header.querySelector('.ld-update-btn');
	updateBtn.addEventListener('click', checkForUpdates);

	// 主题切换按钮
	const themeBtn = header.querySelector('.ld-theme-btn');

	// 添加长按事件处理
	let themeBtnPressTimer;
	let isLongPress = false;

	themeBtn.addEventListener('mousedown', () => {
		isLongPress = false;
		themeBtnPressTimer = setTimeout(() => {
			isLongPress = true;
			// 长按处理
			const isAutoTheme = GM_getValue(STORAGE_KEY_AUTO_THEME, false);
			if (isAutoTheme) {
				// 如果当前是自动模式，长按切换主题
				const isDarkTheme = panel.classList.contains('ld-dark-theme');
				panel.classList.remove(
					isDarkTheme ? 'ld-dark-theme' : 'ld-light-theme'
				);
				panel.classList.add(isDarkTheme ? 'ld-light-theme' : 'ld-dark-theme');
			} else {
				// 如果当前是手动模式，长按开启自动模式
				GM_setValue(STORAGE_KEY_AUTO_THEME, true);
				applyBrowserTheme();
			}
			updateThemeButtonIcon();
		}, 500); // 500毫秒长按
	});

	themeBtn.addEventListener('mouseup', () => {
		clearTimeout(themeBtnPressTimer);
		if (!isLongPress) {
			// 单击处理
			toggleTheme();
		}
	});

	themeBtn.addEventListener('mouseleave', () => {
		clearTimeout(themeBtnPressTimer);
	});

	// 监听浏览器主题变化
	if (window.matchMedia) {
		window
			.matchMedia('(prefers-color-scheme: dark)')
			.addEventListener('change', () => {
				// 如果启用了自动主题模式，则应用新的浏览器主题
				if (GM_getValue(STORAGE_KEY_AUTO_THEME, false)) {
					applyBrowserTheme();
					updateThemeButtonIcon();
				}
			});
	}

	// 更新主题按钮图标
	updateThemeButtonIcon();

	// 切换主题函数
	function toggleTheme() {
		// 获取当前自动主题状态
		const isAuto = GM_getValue(STORAGE_KEY_AUTO_THEME, false);

		if (isAuto) {
			// 如果当前是自动模式，切换到手动模式
			// 保持当前主题，但关闭自动模式
			const currentTheme = panel.classList.contains('ld-dark-theme')
				? 'dark'
				: 'light';
			GM_setValue(STORAGE_KEY_THEME, currentTheme);
			GM_setValue(STORAGE_KEY_AUTO_THEME, false);
		} else {
			// 如果当前是手动模式，切换主题
			const isDarkTheme = panel.classList.contains('ld-dark-theme');

			// 切换主题类
			panel.classList.remove(isDarkTheme ? 'ld-dark-theme' : 'ld-light-theme');
			panel.classList.add(isDarkTheme ? 'ld-light-theme' : 'ld-dark-theme');

			// 保存主题设置
			GM_setValue(STORAGE_KEY_THEME, isDarkTheme ? 'light' : 'dark');
		}

		// 更新主题按钮图标
		updateThemeButtonIcon();
	}

	// 应用浏览器主题
	function applyBrowserTheme() {
		const browserTheme = detectBrowserTheme();
		const currentThemeClass = panel.classList.contains('ld-dark-theme')
			? 'dark'
			: 'light';

		if (browserTheme !== currentThemeClass) {
			// 如果浏览器主题与当前主题不同，则切换
			panel.classList.remove(
				currentThemeClass === 'dark' ? 'ld-dark-theme' : 'ld-light-theme'
			);
			panel.classList.add(
				browserTheme === 'dark' ? 'ld-dark-theme' : 'ld-light-theme'
			);
		}
	}

	// 更新主题按钮图标
	function updateThemeButtonIcon() {
		const isDarkTheme = panel.classList.contains('ld-dark-theme');
		const isAutoTheme = GM_getValue(STORAGE_KEY_AUTO_THEME, false);

		// 根据自动/手动模式和当前主题设置图标
		if (isAutoTheme) {
			// 自动模式使用自动图标
			themeBtn.textContent = '🔄'; // 循环箭头图标表示自动
			themeBtn.title = '当前为自动主题模式，点击切换为手动模式';
		} else {
			// 手动模式使用月亮/太阳图标
			themeBtn.textContent = isDarkTheme ? '🌙' : '☀️'; // 月亮或太阳图标
			themeBtn.title = isDarkTheme ? '切换为亮色主题' : '切换为深色主题';
		}

		// 添加长按提示
		if (isAutoTheme) {
			themeBtn.title += '\n长按切换主题';
		} else {
			themeBtn.title += '\n长按开启自动主题模式';
		}

		// 在亮色主题下调整按钮颜色
		if (!isDarkTheme) {
			document
				.querySelectorAll(
					'.ld-toggle-btn, .ld-refresh-btn, .ld-update-btn, .ld-theme-btn'
				)
				.forEach((btn) => {
					btn.style.color = 'white'; // 亮色主题下按钮使用白色，因为标题栏是蓝色
					btn.style.textShadow = '0 0 1px rgba(0,0,0,0.3)'; // 添加文字阴影增强可读性
				});
		} else {
			document
				.querySelectorAll(
					'.ld-toggle-btn, .ld-refresh-btn, .ld-update-btn, .ld-theme-btn'
				)
				.forEach((btn) => {
					btn.style.color = 'white';
					btn.style.textShadow = 'none';
				});
		}
	}

	// 检查脚本更新
	function checkForUpdates() {
		const updateURL =
			'https://raw.githubusercontent.com/1e0n/LinuxDoStatus/master/LDStatus.user.js';

		// 显示正在检查的状态
		updateBtn.textContent = '⌛'; // 沙漏图标
		updateBtn.title = '正在检查更新...';

		GM_xmlhttpRequest({
			method: 'GET',
			url: updateURL,
			onload: function (response) {
				if (response.status === 200) {
					// 提取远程脚本的版本号
					const versionMatch =
						response.responseText.match(/@version\s+([\d\.]+)/);
					if (versionMatch && versionMatch[1]) {
						const remoteVersion = versionMatch[1];

						// 比较版本
						if (remoteVersion > scriptVersion) {
							// 有新版本
							updateBtn.textContent = '⚠️'; // 警告图标
							updateBtn.title = `发现新版本 v${remoteVersion}，点击前往更新页面`;
							updateBtn.style.color = '#ffd700'; // 黄色

							// 点击按钮跳转到更新页面
							updateBtn.onclick = function () {
								window.open(updateURL, '_blank');
							};
						} else {
							// 已是最新版本
							updateBtn.textContent = '✔'; // 勾选图标
							updateBtn.title = '已是最新版本';
							updateBtn.style.color = '#68d391'; // 绿色

							// 3秒后恢复原样式
							setTimeout(() => {
								updateBtn.textContent = '🔎'; // 放大镜图标
								updateBtn.title = '检查更新';
								updateBtn.style.color = 'white';
								updateBtn.onclick = checkForUpdates;
							}, 3000);
						}
					} else {
						handleUpdateError();
					}
				} else {
					handleUpdateError();
				}
			},
			onerror: handleUpdateError,
		});

		// 处理更新检查错误
		function handleUpdateError() {
			updateBtn.textContent = '❌'; // 错误图标
			updateBtn.title = '检查更新失败，请稍后再试';
			updateBtn.style.color = '#fc8181'; // 红色

			// 3秒后恢复原样式
			setTimeout(() => {
				updateBtn.textContent = '🔎'; // 放大镜图标
				updateBtn.title = '检查更新';
				updateBtn.style.color = 'white';
			}, 3000);
		}
	}

	// 获取信任级别数据
	function fetchTrustLevelData() {
		content.innerHTML = '<div class="ld-loading">加载中...</div>';

		GM_xmlhttpRequest({
			method: 'GET',
			url: 'https://connect.linux.do',
			onload: function (response) {
				if (response.status === 200) {
					parseTrustLevelData(response.responseText);
				} else {
					content.innerHTML =
						'<div class="ld-loading">获取数据失败，请稍后再试</div>';
				}
			},
			onerror: function () {
				content.innerHTML =
					'<div class="ld-loading">获取数据失败，请稍后再试</div>';
			},
		});
	}

	// 解析信任级别数据
	function parseTrustLevelData(html) {
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');

		// 查找信任级别区块
		const trustLevelSection = Array.from(
			doc.querySelectorAll('.bg-white.p-6.rounded-lg')
		).find((div) => {
			const heading = div.querySelector('h2');
			return heading && heading.textContent.includes('信任级别');
		});

		if (!trustLevelSection) {
			content.innerHTML =
				'<div class="ld-loading">未找到信任级别数据，请确保已登录</div>';
			return;
		}

		// 获取用户名和当前级别
		const heading = trustLevelSection.querySelector('h2').textContent.trim();
		const match = heading.match(/(.*) - 信任级别 (\d+) 的要求/);
		const username = match ? match[1] : '未知用户';
		const targetLevel = match ? match[2] : '未知';

		// 获取表格数据
		const tableRows = trustLevelSection.querySelectorAll('table tr');
		const requirements = [];

		for (let i = 1; i < tableRows.length; i++) {
			// 跳过表头
			const row = tableRows[i];
			const cells = row.querySelectorAll('td');

			if (cells.length >= 3) {
				const name = cells[0].textContent.trim();
				const current = cells[1].textContent.trim();
				const required = cells[2].textContent.trim();
				const isSuccess = cells[1].classList.contains('text-green-500');

				// 提取当前完成数的数字部分
				const currentMatch = current.match(/(\d+)/);
				const currentValue = currentMatch ? parseInt(currentMatch[1], 10) : 0;

				// 查找上一次的数据记录
				let changeValue = 0;
				let hasChanged = false;

				if (previousRequirements.length > 0) {
					const prevReq = previousRequirements.find((pr) => pr.name === name);
					if (prevReq) {
						// 如果完成数有变化，更新变化值
						if (currentValue !== prevReq.currentValue) {
							changeValue = currentValue - prevReq.currentValue;
							hasChanged = true;
						} else if (prevReq.changeValue) {
							// 如果完成数没有变化，但之前有变化值，保留之前的变化值
							changeValue = prevReq.changeValue;
							hasChanged = true;
						}
					}
				}

				requirements.push({
					name,
					current,
					required,
					isSuccess,
					currentValue,
					changeValue, // 变化值
					hasChanged, // 是否有变化
				});
			}
		}

		// 获取总体结果
		const resultText = trustLevelSection.querySelector(
			'p.text-red-500, p.text-green-500'
		);
		const isMeetingRequirements = resultText
			? !resultText.classList.contains('text-red-500')
			: false;

		// 存储自然日的活动数据
		const dailyChanges = saveDailyStats(requirements);

		// 渲染数据
		renderTrustLevelData(
			username,
			targetLevel,
			requirements,
			isMeetingRequirements,
			dailyChanges
		);

		// 保存当前数据作为下次比较的基准
		previousRequirements = [...requirements];
	}

	// 渲染信任级别数据
	function renderTrustLevelData(
		username,
		targetLevel,
		requirements,
		isMeetingRequirements,
		dailyChanges = {}
	) {
		let html = `
            <div style="margin-bottom: 8px; font-weight: bold;">
                ${username} - 信任级别 ${targetLevel}
            </div>
            <div style="margin-bottom: 10px; ${
							isMeetingRequirements ? 'color: #68d391' : 'color: #fc8181'
						}; font-size: 11px;">
                ${
									isMeetingRequirements ? '已' : '未'
								}符合信任级别 ${targetLevel} 要求
            </div>
        `;

		requirements.forEach((req) => {
			// 简化项目名称
			let name = req.name;
			// 将一些常见的长名称缩短
			name = name.replace('已读帖子（所有时间）', '已读帖子(总)');
			name = name.replace('浏览的话题（所有时间）', '浏览话题(总)');
			name = name.replace('获赞：点赞用户数量', '点赞用户数');
			name = name.replace('获赞：单日最高数量', '单日最高获赞');
			name = name.replace('被禁言（过去 6 个月）', '被禁言');
			name = name.replace('被封禁（过去 6 个月）', '被封禁');

			// 提取数字部分以简化显示
			let current = req.current;
			let required = req.required;

			// 尝试从字符串中提取数字
			const currentMatch = req.current.match(/(\d+)/);
			const requiredMatch = req.required.match(/(\d+)/);

			if (currentMatch) current = currentMatch[1];
			if (requiredMatch) required = requiredMatch[1];

			// 添加目标完成数变化的标识
			let changeIndicator = '';
			if (req.hasChanged) {
				const diff = req.changeValue;
				if (diff > 0) {
					changeIndicator = `<span class="ld-increase"> ▲${diff}</span>`; // 增加标识，黄色
				} else if (diff < 0) {
					changeIndicator = `<span class="ld-decrease"> ▼${Math.abs(
						diff
					)}</span>`; // 减少标识，蓝色
				}
			}

			html += `
                <div class="ld-trust-level-item ${
									req.isSuccess ? 'ld-success' : 'ld-fail'
								}">
                    <span class="ld-name">${name}</span>
                    <span class="ld-value">${current}${changeIndicator} / ${required}</span>
                </div>
            `;
		});

		// 添加近期活动数据显示
		html += `
            <div class="ld-daily-stats">
                <div class="ld-daily-stats-title">近期的活动</div>
                <div class="ld-stats-header">
                    <span></span>
                    <span class="ld-stats-header-cols">
                        <span class="ld-stats-header-col">昨天</span>
                        <span class="ld-stats-header-col">今天</span>
                        <span class="ld-stats-header-trend">↕</span>
                    </span>
                </div>
        `;

		// 添加每个数据项
		const dailyStatsItems = [
			{ name: '浏览话题', key: '浏览的话题（所有时间）' },
			{ name: '回复话题', key: '回复的话题' },
			{ name: '已读帖子', key: '已读帖子（所有时间）' },
			{ name: '获得点赞', key: '获赞：点赞用户数量' },
			{ name: '点赞帖子', key: '点赞' },
		];

		dailyStatsItems.forEach((item) => {
			const data = dailyChanges[item.key] || { day1: 0, day2: 0, trend: 0 };

			// 创建趋势指示器
			let trendIndicator = '';
			if (data.trend > 0) {
				trendIndicator = `<span class="ld-trend-indicator ld-increase">▲${Math.abs(
					data.trend
				)}</span>`;
			} else if (data.trend < 0) {
				trendIndicator = `<span class="ld-trend-indicator ld-decrease">▼${Math.abs(
					data.trend
				)}</span>`;
			} else {
				trendIndicator = `<span class="ld-trend-indicator">0</span>`;
			}

			html += `
                <div class="ld-daily-stats-item">
                    <span class="ld-name">${item.name}</span>
                    <span class="ld-value">
                        <span class="ld-dual-stats">
                            <span class="ld-day-stat ld-day2">${data.day2}</span>
                            <span class="ld-day-stat ld-day1">${data.day1}</span>
                            ${trendIndicator}
                        </span>
                    </span>
                </div>
            `;
		});

		html += `</div>`;

		content.innerHTML = html;
	}

	// 存储上一次获取的数据，用于比较变化
	let previousRequirements = [];

	// 存储自然日的活动数据
	function saveDailyStats(requirements) {
		// 定义要跟踪的数据项
		const statsToTrack = [
			'浏览的话题（所有时间）', // 浏览话题总数
			'回复的话题', // 回复话题数
			'已读帖子（所有时间）', // 已读帖子总数
			'获赞：点赞用户数量', // 获赞数
			'点赞', // 点赞数
		];

		// 调试信息：输出所有数据项的名称
		console.log(
			'数据项名称：',
			requirements.map((r) => r.name)
		);
		console.log('要跟踪的数据项：', statsToTrack);

		// 获取当前时间和日期边界
		const now = new Date();
		const currentTime = now.getTime();
		const todayStart = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate()
		).getTime(); // 今天0点
		const yesterdayStart = todayStart - 24 * 60 * 60 * 1000; // 昨天0点

		// 从 localStorage 中获取已存储的数据
		let dailyStats = JSON.parse(localStorage.getItem('ld_daily_stats') || '[]');

		// 优化存储：只保留昨天和今天的数据点，且每天只保留自然日的第一个和最后一个数据点
		const newDailyStats = [];

		// 对于每个数据项，分别处理
		statsToTrack.forEach((statName) => {
			// 过滤出当前数据项的所有记录
			const allRecords = dailyStats.filter((item) => item.name === statName);
			if (allRecords.length === 0) {
				return; // 跳过这个数据项
			}

			// 查找今天和昨天自然日范围内的最早和最晚记录
			const todayRecords = allRecords.filter(
				(item) => item.timestamp >= todayStart
			);
			const yesterdayRecords = allRecords.filter(
				(item) =>
					item.timestamp >= yesterdayStart && item.timestamp < todayStart
			);

			// 处理昨天的数据：只保留最早和最晚的记录
			if (yesterdayRecords.length > 0) {
				// 查找昨天的第一条记录
				const firstRecord = yesterdayRecords.reduce(
					(earliest, current) =>
						current.timestamp < earliest.timestamp ? current : earliest,
					yesterdayRecords[0]
				);

				// 查找昨天的最后一条记录
				const lastRecord = yesterdayRecords.reduce(
					(latest, current) =>
						current.timestamp > latest.timestamp ? current : latest,
					yesterdayRecords[0]
				);

				// 如果最早和最晚的记录不同，则都保留
				newDailyStats.push(firstRecord);
				if (lastRecord !== firstRecord) {
					newDailyStats.push(lastRecord);
				}
			}

			// 处理今天的数据：保留最早的记录和当前这个最新记录
			if (todayRecords.length > 0) {
				// 查找今天的第一条记录
				const firstRecord = todayRecords.reduce(
					(earliest, current) =>
						current.timestamp < earliest.timestamp ? current : earliest,
					todayRecords[0]
				);

				// 保留今天最早的记录
				newDailyStats.push(firstRecord);
			}

			// 添加当前最新记录
			const req = requirements.find((r) => r.name === statName);
			if (req) {
				// 提取数字值
				const currentMatch = req.current.match(/(\d+)/);
				const currentValue = currentMatch ? parseInt(currentMatch[1], 10) : 0;

				// 创建新记录
				const newRecord = {
					name: statName,
					value: currentValue,
					timestamp: currentTime,
				};

				// 如果今天还没有记录，或者当前值与最新记录不同，则添加
				const latestRecord =
					todayRecords.length > 0
						? todayRecords.reduce(
								(latest, current) =>
									current.timestamp > latest.timestamp ? current : latest,
								todayRecords[0]
						  )
						: null;

				if (!latestRecord || latestRecord.value !== currentValue) {
					newDailyStats.push(newRecord);
				}
			}
		});

		// 保存优化后的数据
		console.log(
			'优化后的存储数据长度:',
			newDailyStats.length,
			'(之前:',
			dailyStats.length,
			')'
		);
		localStorage.setItem('ld_daily_stats', JSON.stringify(newDailyStats));

		return calculateDailyChanges(newDailyStats);
	}

	// 计算自然日内的活动数据
	function calculateDailyChanges(dailyStats) {
		// 定义要跟踪的数据项
		const statsToTrack = [
			'浏览的话题（所有时间）', // 浏览话题总数
			'回复的话题', // 回复话题数
			'已读帖子（所有时间）', // 已读帖子总数
			'获赞：点赞用户数量', // 获赞数
			'点赞', // 点赞数
		];

		const result = {};

		// 获取今天和昨天的日期范围
		const now = new Date();
		const todayStart = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate()
		).getTime(); // 今天0点
		const yesterdayStart = todayStart - 24 * 60 * 60 * 1000; // 昨天0点
		const yesterdayEnd = todayStart - 1; // 昨天23:59:59

		console.log(
			'时间范围: ',
			new Date(todayStart),
			new Date(yesterdayStart),
			new Date(yesterdayEnd)
		);

		// 对于每个要跟踪的数据项，计算今天和昨天的变化
		statsToTrack.forEach((statName) => {
			// 初始化结果对象结构
			result[statName] = {
				day1: 0, // 今天的变化
				day2: 0, // 昨天的变化
				trend: 0, // 趋势（今天与昨天的差异）
			};

			// 过滤出当前数据项的所有记录
			const allRecords = dailyStats.filter((item) => item.name === statName);
			if (allRecords.length === 0) {
				return; // 跳过这个数据项
			}

			// 查找今天和昨天自然日范围内的最早和最晚记录
			const todayRecords = allRecords.filter(
				(item) => item.timestamp >= todayStart
			);
			const yesterdayRecords = allRecords.filter(
				(item) =>
					item.timestamp >= yesterdayStart && item.timestamp <= yesterdayEnd
			);

			// 找到今天的最早记录和最新记录
			const todayFirstRecord =
				todayRecords.length > 0
					? todayRecords.reduce(
							(earliest, current) =>
								current.timestamp < earliest.timestamp ? current : earliest,
							todayRecords[0]
					  )
					: null;

			const todayLastRecord =
				todayRecords.length > 0
					? todayRecords.reduce(
							(latest, current) =>
								current.timestamp > latest.timestamp ? current : latest,
							todayRecords[0]
					  )
					: null;

			// 找到昨天的最早记录和最晚记录
			const yesterdayFirstRecord =
				yesterdayRecords.length > 0
					? yesterdayRecords.reduce(
							(earliest, current) =>
								current.timestamp < earliest.timestamp ? current : earliest,
							yesterdayRecords[0]
					  )
					: null;

			const yesterdayLastRecord =
				yesterdayRecords.length > 0
					? yesterdayRecords.reduce(
							(latest, current) =>
								current.timestamp > latest.timestamp ? current : latest,
							yesterdayRecords[0]
					  )
					: null;

			// 计算今天的变化值(最新记录 - 今天最早记录或昨天最晚记录)
			if (todayLastRecord) {
				const baseValue = todayFirstRecord
					? todayFirstRecord.value
					: yesterdayLastRecord
					? yesterdayLastRecord.value
					: 0;

				result[statName].day1 = todayLastRecord.value - baseValue;
			}

			// 计算昨天的变化值(昨天最晚记录 - 昨天最早记录)
			if (yesterdayFirstRecord && yesterdayLastRecord) {
				result[statName].day2 =
					yesterdayLastRecord.value - yesterdayFirstRecord.value;
			}

			// 计算趋势（今天与昨天的差异）
			result[statName].trend = result[statName].day1 - result[statName].day2;
		});

		console.log('自然日变化数据:', result);
		return result;
	}

	// 添加鼠标移动事件监听器，检测鼠标是否在左侧边缘
	document.addEventListener('mousemove', (e) => {
		// 如果鼠标在左侧 5px 范围内，显示面板
		if (e.clientX <= 5) {
			panel.classList.add('ld-hover-show');
		} else if (e.clientX > 250) {
			// 当鼠标远离左侧时隐藏
			// 只有当面板处于默认位置时才自动隐藏
			const transform = window.getComputedStyle(panel).transform;
			if (transform === 'none' || transform === '') {
				panel.classList.remove('ld-hover-show');
			}
		}
	});

	// 添加鼠标悬停事件，当鼠标悬停在面板上时保持显示
	panel.addEventListener('mouseenter', () => {
		panel.classList.add('ld-hover-show');
	});

	// 防止面板内的点击事件冒泡到文档级别
	panel.addEventListener('click', (e) => {
		// 防止事件冒泡到文档级别
		e.stopPropagation();
	});

	// 添加点击空白处收起面板的事件
	let wasJustDragging = false; // 标记是否刚刚在拖动

	document.addEventListener('click', (e) => {
		// 如果刚刚在拖动，则忽略这次点击
		if (wasJustDragging) {
			wasJustDragging = false;
			return;
		}

		// 检查点击是否在面板内
		const isClickInsidePanel = panel.contains(e.target);

		// 如果点击在面板外且面板已展开，则收起面板
		if (!isClickInsidePanel && !panel.classList.contains('ld-collapsed')) {
			collapsePanel();
		}
	});

	// 初始加载
	fetchTrustLevelData();

	// 恢复窗口状态和主题
	// 在所有DOM操作完成后执行，确保 toggleBtn 和 themeBtn 已经定义
	setTimeout(() => {
		restorePanelState();
		updateThemeButtonIcon();
	}, 100);

	// 定时刷新（每五分钟）
	setInterval(fetchTrustLevelData, 300000);
})();
