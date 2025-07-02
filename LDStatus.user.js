// ==UserScript==
// @name         LDStatus
// @namespace    http://tampermonkey.net/
// @version      1.12
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

(function() {
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



        #ld-trust-level-panel.ld-light-theme .ld-version {
            color: #e2e8f0;
        }

        /* 共用样式 */
        #ld-trust-level-panel {
            position: fixed;
            left: 10px;
            top: 100px;
            width: 210px;
            border-radius: 8px;
            z-index: 9999;
            font-family: Arial, sans-serif;
            transition: all 0.3s ease;
            overflow: hidden;
            font-size: 12px;
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
            display: block;
            width: 100%;
        }

        .ld-item-content {
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




        /* 进度条样式 */
        .ld-progress-bar {
            height: 3px;
            width: 100%;
            margin-top: 2px;
            margin-bottom: 4px;
            border-radius: 1px;
            overflow: hidden;
            background-color: transparent;
            position: relative;
        }

        .ld-progress-fill {
            height: 100%;
            border-radius: 1px;
            transition: width 0.3s ease;
            position: relative;
        }

        /* 正常项目：已完成绿色，未完成红色 */
        .ld-progress-normal .ld-progress-fill {
            background-color: #68d391; /* 绿色 - 已完成部分 */
        }

        .ld-progress-normal {
            background-color: #fc8181; /* 红色 - 未完成部分 */
        }

        /* 反向项目（被举报帖子、发起举报用户）：已完成红色，未完成绿色 */
        .ld-progress-reverse .ld-progress-fill {
            background-color: #fc8181; /* 红色 - 已完成部分 */
        }

        .ld-progress-reverse {
            background-color: #68d391; /* 绿色 - 未完成部分 */
        }

        /* 深色主题下的进度条颜色调整 */
        .ld-dark-theme .ld-progress-normal .ld-progress-fill {
            background-color: #68d391; /* 绿色 */
        }

        .ld-dark-theme .ld-progress-normal {
            background-color: #fc8181; /* 红色 */
        }

        .ld-dark-theme .ld-progress-reverse .ld-progress-fill {
            background-color: #fc8181; /* 红色 */
        }

        .ld-dark-theme .ld-progress-reverse {
            background-color: #68d391; /* 绿色 */
        }

        /* 亮色主题下的进度条颜色调整 */
        .ld-light-theme .ld-progress-normal .ld-progress-fill {
            background-color: #276749; /* 深绿色 */
        }

        .ld-light-theme .ld-progress-normal {
            background-color: #c53030; /* 深红色 */
        }

        .ld-light-theme .ld-progress-reverse .ld-progress-fill {
            background-color: #c53030; /* 深红色 */
        }

        .ld-light-theme .ld-progress-reverse {
            background-color: #276749; /* 深绿色 */
        }

    `;
    document.head.appendChild(style);

    // 定义存储键
    const STORAGE_KEY_POSITION = 'ld_panel_position';
    const STORAGE_KEY_COLLAPSED = 'ld_panel_collapsed';
    const STORAGE_KEY_THEME = 'ld_panel_theme';

    // 创建面板
    const panel = document.createElement('div');
    panel.id = 'ld-trust-level-panel';

    // 设置默认主题
    const currentTheme = GM_getValue(STORAGE_KEY_THEME, 'dark');
    panel.classList.add(currentTheme === 'dark' ? 'ld-dark-theme' : 'ld-light-theme');

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
        GM_setValue(STORAGE_KEY_COLLAPSED, panel.classList.contains('ld-collapsed'));
    }

    // 恢复窗口状态
    function restorePanelState() {
        // 恢复折叠状态
        const isCollapsed = GM_getValue(STORAGE_KEY_COLLAPSED, false);
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
        const matrix = new DOMMatrix(currentTransform === 'none' ? '' : currentTransform);

        const newX = matrix.e + dx;
        const newY = matrix.f + dy;

        panel.style.transform = `translate(${newX}px, ${newY}px)`;

        lastX = e.clientX;
        lastY = e.clientY;
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;

        isDragging = false;
        panel.style.transition = '';
        document.body.style.userSelect = '';

        // 保存窗口位置
        savePanelPosition();
    });

    // 展开/收起功能
    const toggleBtn = header.querySelector('.ld-toggle-btn');
    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('ld-collapsed');
        toggleBtn.textContent = panel.classList.contains('ld-collapsed') ? '▶' : '◀';

        // 保存折叠状态
        savePanelCollapsedState();
    });

    // 刷新按钮
    const refreshBtn = header.querySelector('.ld-refresh-btn');
    refreshBtn.addEventListener('click', fetchTrustLevelData);

    // 检查更新按钮
    const updateBtn = header.querySelector('.ld-update-btn');
    updateBtn.addEventListener('click', checkForUpdates);

    // 主题切换按钮
    const themeBtn = header.querySelector('.ld-theme-btn');
    themeBtn.addEventListener('click', toggleTheme);

    // 更新主题按钮图标
    updateThemeButtonIcon();

    // 切换主题函数
    function toggleTheme() {
        const isDarkTheme = panel.classList.contains('ld-dark-theme');

        // 切换主题类
        panel.classList.remove(isDarkTheme ? 'ld-dark-theme' : 'ld-light-theme');
        panel.classList.add(isDarkTheme ? 'ld-light-theme' : 'ld-dark-theme');

        // 保存主题设置
        GM_setValue(STORAGE_KEY_THEME, isDarkTheme ? 'light' : 'dark');

        // 更新主题按钮图标
        updateThemeButtonIcon();
    }

    // 更新主题按钮图标
    function updateThemeButtonIcon() {
        const isDarkTheme = panel.classList.contains('ld-dark-theme');
        themeBtn.textContent = isDarkTheme ? '🌙' : '☀️'; // 月亮或太阳图标
        themeBtn.title = isDarkTheme ? '切换为亮色主题' : '切换为深色主题';

        // 在亮色主题下调整按钮颜色
        if (!isDarkTheme) {
            document.querySelectorAll('.ld-toggle-btn, .ld-refresh-btn, .ld-update-btn, .ld-theme-btn').forEach(btn => {
                btn.style.color = 'white'; // 亮色主题下按钮使用白色，因为标题栏是蓝色
                btn.style.textShadow = '0 0 1px rgba(0,0,0,0.3)'; // 添加文字阴影增强可读性
            });
        } else {
            document.querySelectorAll('.ld-toggle-btn, .ld-refresh-btn, .ld-update-btn, .ld-theme-btn').forEach(btn => {
                btn.style.color = 'white';
                btn.style.textShadow = 'none';
            });
        }
    }

    // 检查脚本更新
    function checkForUpdates() {
        const updateURL = 'https://raw.githubusercontent.com/1e0n/LinuxDoStatus/master/LDStatus.user.js';

        // 显示正在检查的状态
        updateBtn.textContent = '⌛'; // 沙漏图标
        updateBtn.title = '正在检查更新...';

        GM_xmlhttpRequest({
            method: 'GET',
            url: updateURL,
            onload: function(response) {
                if (response.status === 200) {
                    // 提取远程脚本的版本号
                    const versionMatch = response.responseText.match(/@version\s+([\d\.]+)/);
                    if (versionMatch && versionMatch[1]) {
                        const remoteVersion = versionMatch[1];

                        // 比较版本
                        if (remoteVersion > scriptVersion) {
                            // 有新版本
                            updateBtn.textContent = '⚠️'; // 警告图标
                            updateBtn.title = `发现新版本 v${remoteVersion}，点击前往更新页面`;
                            updateBtn.style.color = '#ffd700'; // 黄色

                            // 点击按钮跳转到更新页面
                            updateBtn.onclick = function() {
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
            onerror: handleUpdateError
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
            onload: function(response) {
                if (response.status === 200) {
                    parseTrustLevelData(response.responseText);
                } else {
                    content.innerHTML = '<div class="ld-loading">获取数据失败，请稍后再试</div>';
                }
            },
            onerror: function() {
                content.innerHTML = '<div class="ld-loading">获取数据失败，请稍后再试</div>';
            }
        });
    }

    // 解析信任级别数据
    function parseTrustLevelData(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 查找信任级别区块
        const trustLevelSection = Array.from(doc.querySelectorAll('.bg-white.p-6.rounded-lg')).find(div => {
            const heading = div.querySelector('h2');
            return heading && heading.textContent.includes('信任级别');
        });

        if (!trustLevelSection) {
            content.innerHTML = '<div class="ld-loading">未找到信任级别数据，请确保已登录</div>';
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

        for (let i = 1; i < tableRows.length; i++) { // 跳过表头
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
                    const prevReq = previousRequirements.find(pr => pr.name === name);
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
                    changeValue,  // 变化值
                    hasChanged    // 是否有变化
                });
            }
        }

        // 获取总体结果
        const resultText = trustLevelSection.querySelector('p.text-red-500, p.text-green-500');
        const isMeetingRequirements = resultText ? !resultText.classList.contains('text-red-500') : false;

        // 渲染数据
        renderTrustLevelData(username, targetLevel, requirements, isMeetingRequirements);

        // 保存当前数据作为下次比较的基准
        previousRequirements = [...requirements];
    }

    // 渲染信任级别数据
    function renderTrustLevelData(username, targetLevel, requirements, isMeetingRequirements) {
        let html = `
            <div style="margin-bottom: 8px; font-weight: bold;">
                ${username} - 信任级别 ${targetLevel}
            </div>
            <div style="margin-bottom: 10px; ${isMeetingRequirements ? 'color: #68d391' : 'color: #fc8181'}; font-size: 11px;">
                ${isMeetingRequirements ? '已' : '未'}符合信任级别 ${targetLevel} 要求
            </div>
        `;

        requirements.forEach(req => {
            // 简化项目名称
            let name = req.name;
            // 将一些常见的长名称缩短
            name = name.replace('已读帖子（所有时间）', '已读帖子(总)');
            name = name.replace('浏览的话题（所有时间）', '浏览话题(总)');
            name = name.replace('获赞：点赞用户数量', '点赞用户数');
            name = name.replace('获赞：单日最高数量', '总获赞天数');
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
                    changeIndicator = `<span class="ld-decrease"> ▼${Math.abs(diff)}</span>`; // 减少标识，蓝色
                }
            }

            // 计算进度百分比
            const currentValue = parseInt(current, 10) || 0;
            const requiredValue = parseInt(required, 10) || 0;

            let progressPercent;
            if (requiredValue === 0) {
                // 当目标值为0时，如果当前值也是0，则视为100%完成
                progressPercent = (currentValue === 0) ? 100 : 0;
            } else {
                progressPercent = Math.min((currentValue / requiredValue) * 100, 100);
            }

            // 判断是否为反向项目（被举报相关）
            const isReverseItem = name.includes('被举报') || name.includes('发起举报');
            const progressClass = isReverseItem ? 'ld-progress-reverse' : 'ld-progress-normal';

            html += `
                <div class="ld-trust-level-item ${req.isSuccess ? 'ld-success' : 'ld-fail'}">
                    <div class="ld-item-content">
                        <span class="ld-name">${name}</span>
                        <span class="ld-value">${current}${changeIndicator} / ${required}</span>
                    </div>
                    <div class="ld-progress-bar ${progressClass}">
                        <div class="ld-progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
            `;
        });

        content.innerHTML = html;
    }

    // 存储上一次获取的数据，用于比较变化
    let previousRequirements = [];

    // 清理近期活动相关的localStorage缓存
    localStorage.removeItem('ld_daily_stats');

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
