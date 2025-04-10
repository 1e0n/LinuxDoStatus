// ==UserScript==
// @name         LDStatus
// @namespace    http://tampermonkey.net/
// @version      1.8
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
    const STORAGE_KEY_LAST_UPDATE_CHECK = 'ld_last_update_check';

    // 创建面板
    const panel = document.createElement('div');
    panel.id = 'ld-trust-level-panel';

    // 获取脚本版本号
    const scriptVersion = GM_info.script.version;

    // 创建面板头部
    const header = document.createElement('div');
    header.id = 'ld-trust-level-header';
    
    const headerContent = document.createElement('div');
    headerContent.className = 'ld-header-content';
    
    const statusSpan = document.createElement('span');
    statusSpan.textContent = 'Status';
    headerContent.appendChild(statusSpan);
    
    const versionSpan = document.createElement('span');
    versionSpan.className = 'ld-version';
    versionSpan.textContent = `v${scriptVersion}`;
    headerContent.appendChild(versionSpan);
    
    const updateBtn = document.createElement('button');
    updateBtn.className = 'ld-update-btn';
    updateBtn.title = '检查更新';
    updateBtn.textContent = '🔎';
    headerContent.appendChild(updateBtn);
    
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'ld-refresh-btn';
    refreshBtn.title = '刷新数据';
    refreshBtn.textContent = '🔄';
    headerContent.appendChild(refreshBtn);
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ld-toggle-btn';
    toggleBtn.title = '展开/收起';
    toggleBtn.textContent = '◀';
    headerContent.appendChild(toggleBtn);
    
    header.appendChild(headerContent);

    // 创建内容区域
    const content = document.createElement('div');
    content.id = 'ld-trust-level-content';
    
    // 组装面板
    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);

    // 显示加载信息的函数
    function showLoading() {
        clearContent();
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ld-loading';
        loadingDiv.textContent = '加载中...';
        content.appendChild(loadingDiv);
    }

    // 显示错误信息的函数
    function showErrorMessage(message) {
        clearContent();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'ld-loading';
        errorDiv.textContent = message;
        content.appendChild(errorDiv);
    }

    // 清空内容区域的函数
    function clearContent() {
        while (content.firstChild) {
            content.removeChild(content.firstChild);
        }
    }

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

    // 实现节流函数
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
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

    document.addEventListener('mousemove', throttle((e) => {
        if (!isDragging) return;

        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        requestAnimationFrame(() => {
            const currentTransform = window.getComputedStyle(panel).transform;
            const matrix = new DOMMatrix(currentTransform === 'none' ? '' : currentTransform);
            const newX = matrix.e + dx;
            const newY = matrix.f + dy;
            panel.style.transform = `translate(${newX}px, ${newY}px)`;
        });
    }, 16));

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;

        isDragging = false;
        panel.style.transition = '';
        document.body.style.userSelect = '';

        // 保存窗口位置
        savePanelPosition();
    });

    // 展开/收起功能
    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('ld-collapsed');
        toggleBtn.textContent = panel.classList.contains('ld-collapsed') ? '▶' : '◀';

        // 保存折叠状态
        savePanelCollapsedState();
    });

    // 刷新按钮
    refreshBtn.addEventListener('click', fetchTrustLevelData);

    // 检查更新按钮
    updateBtn.addEventListener('click', checkForUpdates);

    // 检查脚本更新
    function checkForUpdates() {
        const lastCheck = GM_getValue(STORAGE_KEY_LAST_UPDATE_CHECK, 0);
        const now = Date.now();
        
        // 一天只检查一次
        if (now - lastCheck < 86400000) {
            updateBtn.textContent = '⏱️';
            updateBtn.title = '今天已检查过更新';
            setTimeout(() => {
                updateBtn.textContent = '🔎';
                updateBtn.title = '检查更新';
            }, 2000);
            return;
        }
        
        const updateURL = 'https://raw.githubusercontent.com/1e0n/LinuxDoStatus/master/LDStatus.user.js';

        // 显示正在检查的状态
        updateBtn.textContent = '⌛'; // 沙漏图标
        updateBtn.title = '正在检查更新...';

        GM_xmlhttpRequest({
            method: 'GET',
            url: updateURL,
            timeout: 10000, // 添加超时设置
            onload: function(response) {
                if (response.status === 200) {
                    try {
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
                            handleUpdateError('无法解析版本信息');
                        }
                    } catch (error) {
                        handleUpdateError('处理更新信息时出错: ' + error.message);
                    }
                } else {
                    handleUpdateError(`请求失败 (${response.status})`);
                }
                
                // 更新检查时间
                GM_setValue(STORAGE_KEY_LAST_UPDATE_CHECK, now);
            },
            onerror: function(error) {
                handleUpdateError('网络请求失败');
            },
            ontimeout: function() {
                handleUpdateError('请求超时');
            }
        });

        // 处理更新检查错误
        function handleUpdateError(message) {
            console.error('检查更新失败:', message);
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
        showLoading();

        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://connect.linux.do',
            timeout: 10000, // 添加超时设置
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        parseTrustLevelData(response.responseText);
                    } catch (error) {
                        console.error('解析数据时出错:', error);
                        showErrorMessage('解析数据时出错: ' + error.message);
                    }
                } else {
                    showErrorMessage(`获取数据失败 (${response.status})`);
                }
            },
            onerror: function(error) {
                console.error('请求错误:', error);
                showErrorMessage('网络请求失败');
            },
            ontimeout: function() {
                showErrorMessage('请求超时');
            }
        });
    }

    // 查找信任级别区块
    function findTrustLevelSection(doc) {
        const headers = doc.querySelectorAll('h2');
        const trustHeader = Array.from(headers).find(h => h.textContent.includes('信任级别'));
        return trustHeader ? trustHeader.closest('.bg-white.p-6.rounded-lg') : null;
    }

    // 提取用户信息
    function extractUserInfo(section) {
        const heading = section.querySelector('h2').textContent.trim();
        const match = heading.match(/(.*) - 信任级别 (\d+) 的要求/);
        return {
            username: match ? match[1] : '未知用户',
            targetLevel: match ? match[2] : '未知'
        };
    }

    // 检查需求状态
    function checkRequirementStatus(section) {
        const resultText = section.querySelector('p.text-red-500, p.text-green-500');
        return resultText ? !resultText.classList.contains('text-red-500') : false;
    }

    // 提取需求数据
    function extractRequirements(section, previousRequirements) {
        const tableRows = section.querySelectorAll('table tr');
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

        return requirements;
    }

    // 解析信任级别数据
    function parseTrustLevelData(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 查找信任级别区块
        const trustLevelSection = findTrustLevelSection(doc);

        if (!trustLevelSection) {
            showErrorMessage('未找到信任级别数据，请确保已登录');
            return;
        }

        // 获取用户名和当前级别
        const { username, targetLevel } = extractUserInfo(trustLevelSection);

        // 获取表格数据
        const requirements = extractRequirements(trustLevelSection, previousRequirements);

        // 获取总体结果
        const isMeetingRequirements = checkRequirementStatus(trustLevelSection);

        // 存储24小时内的数据变化
        const dailyChanges = saveDailyStats(requirements);

        // 渲染数据
        renderTrustLevelData(username, targetLevel, requirements, isMeetingRequirements, dailyChanges);

        // 保存当前数据作为下次比较的基准
        previousRequirements = [...requirements];
    }

    // 渲染信任级别数据
    function renderTrustLevelData(username, targetLevel, requirements, isMeetingRequirements, dailyChanges = {}) {
        clearContent();
        
        const fragment = document.createDocumentFragment();
        
        // 创建用户和级别信息
        const headerDiv = document.createElement('div');
        headerDiv.style.marginBottom = '8px';
        headerDiv.style.fontWeight = 'bold';
        headerDiv.textContent = `${username} - 信任级别 ${targetLevel}`;
        fragment.appendChild(headerDiv);
        
        // 创建需求状态信息
        const statusDiv = document.createElement('div');
        statusDiv.style.marginBottom = '10px';
        statusDiv.style.color = isMeetingRequirements ? '#68d391' : '#fc8181';
        statusDiv.style.fontSize = '11px';
        statusDiv.textContent = `${isMeetingRequirements ? '已' : '未'}符合信任级别 ${targetLevel} 要求`;
        fragment.appendChild(statusDiv);
        
        // 创建需求列表
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
            
            // 创建需求项
            const reqDiv = document.createElement('div');
            reqDiv.className = `ld-trust-level-item ${req.isSuccess ? 'ld-success' : 'ld-fail'}`;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'ld-name';
            nameSpan.textContent = name;
            reqDiv.appendChild(nameSpan);
            
            const valueSpan = document.createElement('span');
            valueSpan.className = 'ld-value';
            
            // 添加目标完成数
            valueSpan.textContent = `${current} / ${required}`;
            
            // 添加变化指示器
            if (req.hasChanged) {
                const changeIndicator = document.createElement('span');
                const diff = req.changeValue;
                if (diff > 0) {
                    changeIndicator.className = 'ld-increase';
                    changeIndicator.textContent = ` ▲${diff}`;
                } else if (diff < 0) {
                    changeIndicator.className = 'ld-decrease';
                    changeIndicator.textContent = ` ▼${Math.abs(diff)}`;
                }
                valueSpan.appendChild(changeIndicator);
            }
            
            reqDiv.appendChild(valueSpan);
            fragment.appendChild(reqDiv);
        });
        
        // 创建24小时活动数据
        const dailyStatsDiv = document.createElement('div');
        dailyStatsDiv.className = 'ld-daily-stats';
        
        const dailyStatsTitleDiv = document.createElement('div');
        dailyStatsTitleDiv.className = 'ld-daily-stats-title';
        dailyStatsTitleDiv.textContent = '24小时内的活动';
        dailyStatsDiv.appendChild(dailyStatsTitleDiv);
        
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
            
            const statsItemDiv = document.createElement('div');
            statsItemDiv.className = 'ld-daily-stats-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'ld-name';
            nameSpan.textContent = item.name;
            statsItemDiv.appendChild(nameSpan);
            
            const valueSpan = document.createElement('span');
            valueSpan.className = 'ld-value';
            valueSpan.textContent = value;
            statsItemDiv.appendChild(valueSpan);
            
            dailyStatsDiv.appendChild(statsItemDiv);
        });
        
        fragment.appendChild(dailyStatsDiv);
        content.appendChild(fragment);
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
            '获赞：点赞用户数量', // 获得点赞
            '点赞的帖子' // 点赞帖子
        ];

        // 从存储中获取之前的记录
        let dailyStats = GM_getValue('ld_daily_stats', []);

        // 获取当前时间戳
        const now = Date.now();

        // 清理超过24小时的旧数据
        dailyStats = dailyStats.filter(stat => now - stat.timestamp < 24 * 60 * 60 * 1000);

        // 提取要跟踪的数据项
        const trackedStats = requirements.filter(req => statsToTrack.includes(req.name));

        // 为每个要跟踪的项目添加新记录
        trackedStats.forEach(stat => {
            dailyStats.push({
                name: stat.name,
                value: stat.currentValue,
                timestamp: now
            });
        });

        // 限制每种统计类型的条目数，防止过度存储
        const MAX_ENTRIES_PER_STAT = 50;
        statsToTrack.forEach(statName => {
            const statEntries = dailyStats.filter(item => item.name === statName);
            if (statEntries.length > MAX_ENTRIES_PER_STAT) {
                // 只保留最新的 MAX_ENTRIES_PER_STAT 条记录
                const sortedEntries = statEntries.sort((a, b) => b.timestamp - a.timestamp);
                const toKeep = sortedEntries.slice(0, MAX_ENTRIES_PER_STAT);
                // 移除多余条目
                dailyStats = dailyStats.filter(item => item.name !== statName || toKeep.includes(item));
            }
        });

        // 保存更新后的数据
        GM_setValue('ld_daily_stats', dailyStats);

        // 计算24小时内每项的变化量
        let changes = {};
        statsToTrack.forEach(statName => {
            const stats = dailyStats.filter(stat => stat.name === statName);
            if (stats.length >= 2) {
                // 排序数据，最新的在前面
                stats.sort((a, b) => b.timestamp - a.timestamp);
                
                // 获取最新的值
                const latestValue = stats[0].value;
                
                // 获取最老的，但不超过24小时的值
                const oldestStats = stats.filter(stat => now - stat.timestamp < 24 * 60 * 60 * 1000);
                if (oldestStats.length > 0) {
                    oldestStats.sort((a, b) => a.timestamp - b.timestamp);
                    const oldestValue = oldestStats[0].value;
                    
                    // 计算变化
                    changes[statName] = latestValue - oldestValue;
                }
            }
        });

        return changes;
    }

    // 实现闲置检测，避免页面不活跃时进行不必要的刷新
    let refreshInterval;
    let visibilityState = true;

    function setupRefreshInterval() {
        clearInterval(refreshInterval);
        if (visibilityState) {
            refreshInterval = setInterval(fetchTrustLevelData, 120000); // 2分钟刷新一次
        }
    }

    // 监听可见性变化
    document.addEventListener('visibilitychange', () => {
        visibilityState = document.visibilityState === 'visible';
        setupRefreshInterval();
    });

    // 初始化
    function initialize() {
        // 恢复面板状态
        restorePanelState();
        
        // 首次获取数据
        fetchTrustLevelData();
        
        // 设置刷新间隔
        setupRefreshInterval();
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
