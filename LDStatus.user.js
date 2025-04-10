// ==UserScript==
// @name         LDStatus
// @namespace    http://tampermonkey.net/
// @version      1.6
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
        #ld-trust-level-panel {
            position: fixed;
            left: 10px;
            top: 100px;
            width: 210px;
            background-color: #2d3748;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.4);
            z-index: 9999;
            font-family: Arial, sans-serif;
            transition: all 0.3s ease;
            overflow: hidden;
            color: #e2e8f0;
            font-size: 12px;
        }

        #ld-trust-level-header {
            background-color: #1a202c;
            color: white;
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

        .ld-trust-level-item.ld-success .ld-value {
            color: #68d391;
        }

        .ld-trust-level-item.ld-fail .ld-value {
            color: #fc8181;
        }

        .ld-toggle-btn, .ld-refresh-btn, .ld-update-btn {
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
            color: #a0aec0;
        }

        .ld-increase {
            color: #ffd700; /* 黄色 */
        }

        .ld-decrease {
            color: #4299e1; /* 蓝色 */
        }

        .ld-daily-stats {
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #4a5568;
            font-size: 11px;
        }

        .ld-daily-stats-title {
            font-weight: bold;
            margin-bottom: 5px;
            color: #a0aec0;
        }

        .ld-daily-stats-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
        }

        .ld-daily-stats-item .ld-name {
            flex: 0 1 auto;
        }

        .ld-daily-stats-item .ld-value {
            flex: 0 0 auto;
            font-weight: bold;
            color: #68d391;
        }
    `;
    document.head.appendChild(style);

    // 定义存储键
    const STORAGE_KEY_POSITION = 'ld_panel_position';
    const STORAGE_KEY_COLLAPSED = 'ld_panel_collapsed';

    // 创建面板
    const panel = document.createElement('div');
    panel.id = 'ld-trust-level-panel';

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

        // 存储24小时内的数据变化
        const dailyChanges = saveDailyStats(requirements);

        // 渲染数据
        renderTrustLevelData(username, targetLevel, requirements, isMeetingRequirements, dailyChanges);

        // 保存当前数据作为下次比较的基准
        previousRequirements = [...requirements];
    }

    // 渲染信任级别数据
    function renderTrustLevelData(username, targetLevel, requirements, isMeetingRequirements, dailyChanges = {}) {
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
                    changeIndicator = `<span class="ld-decrease"> ▼${Math.abs(diff)}</span>`; // 减少标识，蓝色
                }
            }

            html += `
                <div class="ld-trust-level-item ${req.isSuccess ? 'ld-success' : 'ld-fail'}">
                    <span class="ld-name">${name}</span>
                    <span class="ld-value">${current}${changeIndicator} / ${required}</span>
                </div>
            `;
        });

        // 添加24小时内的活动数据显示
        html += `
            <div class="ld-daily-stats">
                <div class="ld-daily-stats-title">24小时内的活动</div>
        `;

        // 添加每个数据项
        const dailyStatsItems = [
            { name: '浏览话题', key: '浏览的话题（所有时间）' },
            { name: '回复话题', key: '回复的话题' },
            { name: '已读帖子', key: '已读帖子（所有时间）' },
            { name: '获得点赞', key: '获赞：点赞用户数量' },
            { name: '点赞帖子', key: '点赞的帖子' }
        ];

        dailyStatsItems.forEach(item => {
            const value = dailyChanges[item.key] || 0;
            html += `
                <div class="ld-daily-stats-item">
                    <span class="ld-name">${item.name}</span>
                    <span class="ld-value">${value}</span>
                </div>
            `;
        });

        html += `</div>`;

        content.innerHTML = html;
    }

    // 存储上一次获取的数据，用于比较变化
    let previousRequirements = [];

    // 存储24小时内的数据变化
    function saveDailyStats(requirements) {
        // 定义要跟踪的数据项
        const statsToTrack = [
            '浏览的话题（所有时间）', // 浏览话题总数
            '回复的话题', // 回复话题数
            '已读帖子（所有时间）', // 已读帖子总数
            '获赞：点赞用户数量', // 获赞数
            '点赞的帖子' // 点赞数
        ];

        // 获取当前时间
        const now = new Date().getTime();

        // 从 localStorage 中获取已存储的数据
        let dailyStats = JSON.parse(localStorage.getItem('ld_daily_stats') || '[]');

        // 删除超过24小时的数据
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        dailyStats = dailyStats.filter(item => item.timestamp > oneDayAgo);

        // 对于每个要跟踪的数据项，找到当前值并添加到历史记录中
        statsToTrack.forEach(statName => {
            const req = requirements.find(r => r.name === statName);
            if (req) {
                // 添加新的数据点
                dailyStats.push({
                    name: statName,
                    value: req.currentValue,
                    timestamp: now
                });
            }
        });

        // 将更新后的数据保存回 localStorage
        localStorage.setItem('ld_daily_stats', JSON.stringify(dailyStats));

        return calculateDailyChanges(dailyStats);
    }

    // 计箞24小时内的变化量
    function calculateDailyChanges(dailyStats) {
        // 定义要跟踪的数据项
        const statsToTrack = [
            '浏览的话题（所有时间）', // 浏览话题总数
            '回复的话题', // 回复话题数
            '已读帖子（所有时间）', // 已读帖子总数
            '获赞：点赞用户数量', // 获赞数
            '点赞的帖子' // 点赞数
        ];

        const result = {};

        // 对于每个要跟踪的数据项，计算24小时内的变化
        statsToTrack.forEach(statName => {
            // 过滤出当前数据项的所有记录，并按时间戳排序
            const statRecords = dailyStats
                .filter(item => item.name === statName)
                .sort((a, b) => a.timestamp - b.timestamp);

            if (statRecords.length >= 2) {
                // 获取最早和最新的记录
                const oldest = statRecords[0];
                const newest = statRecords[statRecords.length - 1];

                // 计算变化量
                const change = newest.value - oldest.value;

                // 存储结果
                result[statName] = change;
            } else {
                // 如果没有足够的数据点，设置为0
                result[statName] = 0;
            }
        });

        return result;
    }

    // 初始加载
    fetchTrustLevelData();

    // 恢复窗口状态
    // 在所有DOM操作完成后执行，确保 toggleBtn 已经定义
    setTimeout(restorePanelState, 100);

    // 定时刷新（每两分钟）
    setInterval(fetchTrustLevelData, 120000);
})();
