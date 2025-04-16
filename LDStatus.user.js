// ==UserScript==
// @name         LDStatus
// @namespace    http://tampermonkey.net/
// @version      2.0
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

    // 模块化结构
    const LDStatus = {
        // 配置
        config: {
            refreshInterval: 300000, // 5分钟刷新一次
            storageKeys: {
                position: 'ld_panel_position',
                collapsed: 'ld_panel_collapsed',
                theme: 'ld_panel_theme',
                lastData: 'ld_last_successful_data'
            },
            maxStorageItems: 500,
            statsToTrack: [
                '浏览的话题（所有时间）',
                '回复的话题',
                '已读帖子（所有时间）',
                '获赞：点赞用户数量',
                '点赞'
            ],
            nameMapping: {
                '已读帖子（所有时间）': '已读帖子(总)',
                '浏览的话题（所有时间）': '浏览话题(总)',
                '获赞：点赞用户数量': '点赞用户数',
                '获赞：单日最高数量': '单日最高获赞',
                '被禁言（过去 6 个月）': '被禁言',
                '被封禁（过去 6 个月）': '被封禁'
            }
        },

        // 变量
        vars: {
            panel: null,
            header: null,
            content: null,
            toggleBtn: null,
            refreshBtn: null,
            updateBtn: null,
            themeBtn: null,
            isDragging: false,
            lastX: 0,
            lastY: 0,
            refreshTimer: null,
            previousRequirements: [],
            isDarkTheme: true
        },

        // UI相关方法
        ui: {
            // 创建CSS样式
            createStyles: function() {
                const style = document.createElement('style');
                style.textContent = `
                    /* CSS变量 - 主题颜色 */
                    :root {
                        --ld-bg-color: #ffffff;
                        --ld-text-color: #1a202c;
                        --ld-header-bg: #3182ce;
                        --ld-header-color: #ffffff;
                        --ld-success-color: #276749;
                        --ld-fail-color: #c53030;
                        --ld-border-color: #e2e8f0;
                        --ld-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
                        --ld-secondary-color: #4a5568;
                        --ld-increase-color: #d69e2e;
                        --ld-decrease-color: #2b6cb0;
                        --ld-day1-color: #276749;
                        --ld-day2-color: #2d3748;
                    }

                    .ld-dark-theme {
                        --ld-bg-color: #2d3748;
                        --ld-text-color: #e2e8f0;
                        --ld-header-bg: #1a202c;
                        --ld-header-color: #ffffff;
                        --ld-success-color: #68d391;
                        --ld-fail-color: #fc8181;
                        --ld-border-color: #4a5568;
                        --ld-shadow: 0 0 10px rgba(0, 0, 0, 0.4);
                        --ld-secondary-color: #a0aec0;
                        --ld-increase-color: #ffd700;
                        --ld-decrease-color: #4299e1;
                        --ld-day1-color: #68d391;
                        --ld-day2-color: #cbd5e1;
                    }

                    /* 面板基础样式 */
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
                        background-color: var(--ld-bg-color);
                        color: var(--ld-text-color);
                        box-shadow: var(--ld-shadow);
                        border: 1px solid var(--ld-border-color);
                    }

                    #ld-trust-level-header {
                        padding: 8px 10px;
                        cursor: move;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        user-select: none;
                        background-color: var(--ld-header-bg);
                        color: var(--ld-header-color);
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
                        color: var(--ld-success-color);
                    }

                    .ld-trust-level-item.ld-fail .ld-value {
                        color: var(--ld-fail-color);
                    }

                    .ld-toggle-btn, .ld-refresh-btn, .ld-update-btn, .ld-theme-btn {
                        background: none;
                        border: none;
                        color: var(--ld-header-color);
                        cursor: pointer;
                        font-size: 14px;
                        margin-left: 5px;
                    }

                    .ld-version {
                        font-size: 10px;
                        color: var(--ld-secondary-color);
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
                        color: var(--ld-secondary-color);
                    }

                    .ld-increase {
                        color: var(--ld-increase-color);
                    }

                    .ld-decrease {
                        color: var(--ld-decrease-color);
                    }

                    /* 活动数据区域 */
                    .ld-daily-stats {
                        margin-top: 10px;
                        font-size: 11px;
                        border-top: 1px solid var(--ld-border-color);
                        padding-top: 10px;
                    }

                    .ld-daily-stats-title {
                        font-weight: bold;
                        margin-bottom: 5px;
                        color: var(--ld-secondary-color);
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

                    /* 两天数据的样式 */
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
                        color: var(--ld-day1-color);
                    }

                    .ld-day2 {
                        color: var(--ld-day2-color);
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

                    /* 进度条样式 */
                    .ld-progress-container {
                        height: 3px;
                        background-color: var(--ld-border-color);
                        border-radius: 2px;
                        margin-top: 3px;
                        overflow: hidden;
                    }

                    .ld-progress-bar {
                        height: 100%;
                        background-color: var(--ld-success-color);
                        border-radius: 2px;
                        transition: width 0.3s;
                    }

                    .ld-fail .ld-progress-bar {
                        background-color: var(--ld-fail-color);
                    }

                    .ld-notice {
                        font-size: 10px;
                        color: var(--ld-secondary-color);
                        text-align: center;
                        margin-top: 5px;
                        padding-top: 5px;
                        border-top: 1px dashed var(--ld-border-color);
                    }
                `;
                document.head.appendChild(style);
            },

            // 创建面板
            createPanel: function() {
                // 创建主面板
                const panel = document.createElement('div');
                panel.id = 'ld-trust-level-panel';
                LDStatus.vars.panel = panel;

                // 设置默认主题
                const currentTheme = GM_getValue(LDStatus.config.storageKeys.theme, 'dark');
                LDStatus.vars.isDarkTheme = currentTheme === 'dark';
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
                LDStatus.vars.header = header;

                // 创建内容区域
                const content = document.createElement('div');
                content.id = 'ld-trust-level-content';
                content.innerHTML = '<div class="ld-loading">加载中...</div>';
                LDStatus.vars.content = content;

                // 组装面板
                panel.appendChild(header);
                panel.appendChild(content);
                document.body.appendChild(panel);

                // 设置按钮引用
                LDStatus.vars.toggleBtn = header.querySelector('.ld-toggle-btn');
                LDStatus.vars.refreshBtn = header.querySelector('.ld-refresh-btn');
                LDStatus.vars.updateBtn = header.querySelector('.ld-update-btn');
                LDStatus.vars.themeBtn = header.querySelector('.ld-theme-btn');

                // 更新主题按钮图标
                this.updateThemeButtonIcon();
            },

            // 更新主题按钮图标
            updateThemeButtonIcon: function() {
                const themeBtn = LDStatus.vars.themeBtn;
                if (!themeBtn) return;

                const isDarkTheme = LDStatus.vars.panel.classList.contains('ld-dark-theme');
                themeBtn.textContent = isDarkTheme ? '🌙' : '☀️'; // 月亮或太阳图标
                themeBtn.title = isDarkTheme ? '切换为亮色主题' : '切换为深色主题';
            },

            // 显示通知
            showNotice: function(message, type = 'info', duration = 3000) {
                const noticeEl = document.createElement('div');
                noticeEl.className = `ld-notice ld-notice-${type}`;
                noticeEl.textContent = message;
                LDStatus.vars.content.appendChild(noticeEl);

                if (duration > 0) {
                    setTimeout(() => {
                        if (noticeEl.parentNode) {
                            noticeEl.parentNode.removeChild(noticeEl);
                        }
                    }, duration);
                }

                return noticeEl;
            },

            // 创建进度条
            createProgressBar: function(current, required) {
                const currentNum = parseInt(current.match(/\d+/)[0], 10);
                const requiredNum = parseInt(required.match(/\d+/)[0], 10);
                const percent = Math.min(100, Math.floor((currentNum / requiredNum) * 100));

                return `
                    <div class="ld-progress-container">
                        <div class="ld-progress-bar" style="width: ${percent}%"></div>
                    </div>
                `;
            },

            // 渲染信任级别数据
            renderTrustLevelData: function(username, targetLevel, requirements, isMeetingRequirements, dailyChanges = {}) {
                const content = LDStatus.vars.content;

                let html = `
                    <div style="margin-bottom: 8px; font-weight: bold;">
                        ${username} - 信任级别 ${targetLevel}
                    </div>
                    <div style="margin-bottom: 10px; color: ${isMeetingRequirements ? 'var(--ld-success-color)' : 'var(--ld-fail-color)'}; font-size: 11px;">
                        ${isMeetingRequirements ? '已' : '未'}符合信任级别 ${targetLevel} 要求
                    </div>
                `;

                requirements.forEach(req => {
                    // 简化项目名称
                    let name = req.name;
                    // 使用配置中的名称映射简化名称
                    Object.entries(LDStatus.config.nameMapping).forEach(([original, simplified]) => {
                        name = name.replace(original, simplified);
                    });

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
                            changeIndicator = `<span class="ld-increase"> ▲${diff}</span>`;
                        } else if (diff < 0) {
                            changeIndicator = `<span class="ld-decrease"> ▼${Math.abs(diff)}</span>`;
                        }
                    }

                    html += `
                        <div class="ld-trust-level-item ${req.isSuccess ? 'ld-success' : 'ld-fail'}">
                            <span class="ld-name">${name}</span>
                            <span class="ld-value">${current}${changeIndicator} / ${required}</span>
                        </div>
                        ${LDStatus.ui.createProgressBar(current, required)}
                    `;
                });

                // 添加近期活动数据显示
                html += `
                    <div class="ld-daily-stats">
                        <div class="ld-daily-stats-title">近期的活动</div>
                        <div class="ld-stats-header">
                            <span></span>
                            <span class="ld-stats-header-cols">
                                <span class="ld-stats-header-col">48h</span>
                                <span class="ld-stats-header-col">24h</span>
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
                    { name: '点赞帖子', key: '点赞' }
                ];

                dailyStatsItems.forEach(item => {
                    const data = dailyChanges[item.key] || { day1: 0, day2: 0, trend: 0 };

                    // 创建趋势指示器
                    let trendIndicator = '';
                    if (data.trend > 0) {
                        trendIndicator = `<span class="ld-trend-indicator ld-increase">▲${Math.abs(data.trend)}</span>`;
                    } else if (data.trend < 0) {
                        trendIndicator = `<span class="ld-trend-indicator ld-decrease">▼${Math.abs(data.trend)}</span>`;
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

                // 检查是否使用缓存数据
                const cachedData = GM_getValue(LDStatus.config.storageKeys.lastData, null);
                if (cachedData && !navigator.onLine) {
                    html += `
                        <div class="ld-notice">
                            使用缓存数据，最后更新: ${new Date(cachedData.timestamp).toLocaleString()}
                        </div>
                    `;
                }

                content.innerHTML = html;
            },

            // 渲染缓存数据
            renderCachedData: function() {
                const cachedData = GM_getValue(LDStatus.config.storageKeys.lastData, null);
                if (cachedData) {
                    this.renderTrustLevelData(
                        cachedData.username,
                        cachedData.targetLevel,
                        cachedData.requirements,
                        cachedData.isMeetingRequirements,
                        cachedData.dailyChanges
                    );
                    this.showNotice(`使用缓存数据，最后更新: ${new Date(cachedData.timestamp).toLocaleString()}`);
                } else {
                    LDStatus.vars.content.innerHTML = '<div class="ld-loading">无可用数据，请检查网络连接</div>';
                }
            }
        },

        // 数据处理相关方法
        data: {
            // 获取信任级别数据
            fetchTrustLevelData: function() {
                LDStatus.vars.content.innerHTML = '<div class="ld-loading">加载中...</div>';

                // 如果离线，使用缓存数据
                if (!navigator.onLine) {
                    LDStatus.ui.renderCachedData();
                    return;
                }

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://connect.linux.do',
                    timeout: 10000,  // 设置超时时间
                    onload: function(response) {
                        try {
                            if (response.status === 200) {
                                LDStatus.data.parseTrustLevelData(response.responseText);
                            } else {
                                throw new Error(`HTTP错误: ${response.status}`);
                            }
                        } catch (error) {
                            console.error('数据处理错误:', error);
                            LDStatus.vars.content.innerHTML = `<div class="ld-loading">处理数据时出错: ${error.message}</div>`;
                            // 尝试使用缓存数据
                            LDStatus.ui.renderCachedData();
                        }
                    },
                    onerror: function(error) {
                        console.error('请求错误:', error);
                        LDStatus.vars.content.innerHTML = '<div class="ld-loading">网络请求失败，请检查网络连接</div>';
                        // 尝试使用缓存数据
                        LDStatus.ui.renderCachedData();
                    },
                    ontimeout: function() {
                        LDStatus.vars.content.innerHTML = '<div class="ld-loading">请求超时，请稍后再试</div>';
                        // 尝试使用缓存数据
                        LDStatus.ui.renderCachedData();
                    }
                });
            },

            // 解析信任级别数据
            parseTrustLevelData: function(html) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // 查找信任级别区块
                const trustLevelSection = Array.from(doc.querySelectorAll('.bg-white.p-6.rounded-lg')).find(div => {
                    const heading = div.querySelector('h2');
                    return heading && heading.textContent.includes('信任级别');
                });

                if (!trustLevelSection) {
                    LDStatus.vars.content.innerHTML = '<div class="ld-loading">未找到信任级别数据，请确保已登录</div>';
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

                        if (LDStatus.vars.previousRequirements.length > 0) {
                            const prevReq = LDStatus.vars.previousRequirements.find(pr => pr.name === name);
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

                // 存储48小时内的数据变化
                const dailyChanges = this.saveDailyStats(requirements);

                // 缓存数据，以备网络问题时使用
                GM_setValue(LDStatus.config.storageKeys.lastData, {
                    username,
                    targetLevel,
                    requirements,
                    isMeetingRequirements,
                    dailyChanges,
                    timestamp: new Date().getTime()
                });

                // 渲染数据
                LDStatus.ui.renderTrustLevelData(username, targetLevel, requirements, isMeetingRequirements, dailyChanges);

                // 保存当前数据作为下次比较的基准
                LDStatus.vars.previousRequirements = [...requirements];
            },

            // 存储48小时内的数据变化
            saveDailyStats: function(requirements) {
                const statsToTrack = LDStatus.config.statsToTrack;

                // 获取当前时间
                const now = new Date().getTime();

                // 从 localStorage 中获取已存储的数据
                let dailyStats = JSON.parse(localStorage.getItem('ld_daily_stats') || '[]');

                // 删除超过48小时的数据
                const twoDaysAgo = now - 48 * 60 * 60 * 1000;
                dailyStats = dailyStats.filter(item => item.timestamp > twoDaysAgo);

                // 对于每个要跟踪的数据项，找到当前值并添加到历史记录中
                statsToTrack.forEach(statName => {
                    const req = requirements.find(r => r.name === statName);
                    if (req) {
                        // 提取数字值
                        const currentMatch = req.current.match(/(\d+)/);
                        const currentValue = currentMatch ? parseInt(currentMatch[1], 10) : 0;

                        // 添加新的数据点
                        dailyStats.push({
                            name: statName,
                            value: currentValue,
                            timestamp: now
                        });
                    }
                });

                // 清理过量的历史数据
                this.cleanupStorage(dailyStats);

                // 将更新后的数据保存回 localStorage
                localStorage.setItem('ld_daily_stats', JSON.stringify(dailyStats));

                return this.calculateDailyChanges(dailyStats);
            },

            // 清理过量的存储数据
            cleanupStorage: function(stats) {
                const maxItems = LDStatus.config.maxStorageItems;

                if (stats.length > maxItems) {
                    // 按时间戳排序并只保留最新的数据
                    stats.sort((a, b) => b.timestamp - a.timestamp);
                    return stats.slice(0, maxItems);
                }

                return stats;
            },

            // 计算近两天内的变化量
            calculateDailyChanges: function(dailyStats) {
                const statsToTrack = LDStatus.config.statsToTrack;
                const result = {};
                const now = new Date().getTime();
                const oneDayAgo = now - 24 * 60 * 60 * 1000;
                const twoDaysAgo = now - 48 * 60 * 60 * 1000;

                // 对于每个要跟踪的数据项，计算两天内的变化
                statsToTrack.forEach(statName => {
                    // 过滤出当前数据项的所有记录，并按时间戳排序
                    const statRecords = dailyStats
                        .filter(item => item.name === statName)
                        .sort((a, b) => a.timestamp - b.timestamp);

                    // 初始化结果对象结构
                    result[statName] = {
                        day1: 0, // 最近24小时
                        day2: 0, // 24-48小时
                        trend: 0  // 趋势：day1 - day2
                    };

                    if (statRecords.length >= 2) {
                        // 找出最新记录和其前面两个时间段的记录
                        const newest = statRecords[statRecords.length - 1];

                        // 找最近24小时内最早的记录
                        const oldestDay1 = statRecords.filter(item => item.timestamp > oneDayAgo)[0];

                        // 找24-48小时内最早的记录和最新的记录
                        const recordsDay2 = statRecords.filter(item =>
                            item.timestamp <= oneDayAgo && item.timestamp > twoDaysAgo);

                        const oldestDay2 = recordsDay2.length > 0 ? recordsDay2[0] : null;
                        const newestDay2 = recordsDay2.length > 0 ?
                            recordsDay2[recordsDay2.length - 1] : null;

                        // 计算最近24小时的变化
                        if (oldestDay1) {
                            result[statName].day1 = newest.value - oldestDay1.value;
                        }

                        // 计算24-48小时的变化
                        if (oldestDay2 && newestDay2) {
                            result[statName].day2 = newestDay2.value - oldestDay2.value;
                        }

                        // 计算趋势（今天和昨天的变化差异）
                        result[statName].trend = result[statName].day1 - result[statName].day2;
                    }
                });

                return result;
            },

            // 检查脚本更新
            checkForUpdates: function() {
                const updateURL = 'https://raw.githubusercontent.com/1e0n/LinuxDoStatus/master/LDStatus.user.js';
                const updateBtn = LDStatus.vars.updateBtn;

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
                                const scriptVersion = GM_info.script.version;

                                // 比较版本
                                if (remoteVersion > scriptVersion) {
                                    // 有新版本
                                    updateBtn.textContent = '⚠️'; // 警告图标
                                    updateBtn.title = `发现新版本 v${remoteVersion}，点击前往更新页面`;
                                    updateBtn.style.color = 'var(--ld-increase-color)'; // 黄色

                                    // 点击按钮跳转到更新页面
                                    updateBtn.onclick = function() {
                                        window.open(updateURL, '_blank');
                                    };
                                } else {
                                    // 已是最新版本
                                    updateBtn.textContent = '✔'; // 勾选图标
                                    updateBtn.title = '已是最新版本';
                                    updateBtn.style.color = 'var(--ld-success-color)'; // 绿色

                                    // 3秒后恢复原样式
                                    setTimeout(() => {
                                        updateBtn.textContent = '🔎'; // 放大镜图标
                                        updateBtn.title = '检查更新';
                                        updateBtn.style.color = '';
                                        updateBtn.onclick = LDStatus.events.onUpdateBtnClick;
                                    }, 3000);
                                }
                            } else {
                                LDStatus.data.handleUpdateError();
                            }
                        } else {
                            LDStatus.data.handleUpdateError();
                        }
                    },
                    onerror: LDStatus.data.handleUpdateError
                });
            },

            // 处理更新检查错误
            handleUpdateError: function() {
                const updateBtn = LDStatus.vars.updateBtn;
                updateBtn.textContent = '❌'; // 错误图标
                updateBtn.title = '检查更新失败，请稍后再试';
                updateBtn.style.color = 'var(--ld-fail-color)'; // 红色

                // 3秒后恢复原样式
                setTimeout(() => {
                    updateBtn.textContent = '🔎'; // 放大镜图标
                    updateBtn.title = '检查更新';
                    updateBtn.style.color = '';
                }, 3000);
            }
        },

        // 事件处理相关方法
        events: {
            // 注册所有事件监听
            registerEvents: function() {
                // 拖动面板相关事件
                this.setupDragEvents();

                // 按钮点击事件
                LDStatus.vars.toggleBtn.addEventListener('click', this.onToggleBtnClick);
                LDStatus.vars.refreshBtn.addEventListener('click', this.onRefreshBtnClick);
                LDStatus.vars.updateBtn.addEventListener('click', this.onUpdateBtnClick);
                LDStatus.vars.themeBtn.addEventListener('click', this.onThemeBtnClick);

                // 页面可见性变化时刷新数据
                document.addEventListener('visibilitychange', this.onVisibilityChange);
            },

            // 设置拖动面板的事件
            setupDragEvents: function() {
                const header = LDStatus.vars.header;

                header.addEventListener('mousedown', this.onPanelDragStart);
                document.addEventListener('mousemove', this.onPanelDragMove);
                document.addEventListener('mouseup', this.onPanelDragEnd);
            },

            // 面板拖动开始
            onPanelDragStart: function(e) {
                if (LDStatus.vars.panel.classList.contains('ld-collapsed')) return;

                LDStatus.vars.isDragging = true;
                LDStatus.vars.lastX = e.clientX;
                LDStatus.vars.lastY = e.clientY;

                // 添加拖动时的样式
                LDStatus.vars.panel.style.transition = 'none';
                document.body.style.userSelect = 'none';
            },

            // 面板拖动中
            onPanelDragMove: function(e) {
                if (!LDStatus.vars.isDragging) return;

                // 使用 transform 而不是改变 left/top 属性，性能更好
                const dx = e.clientX - LDStatus.vars.lastX;
                const dy = e.clientY - LDStatus.vars.lastY;

                const currentTransform = window.getComputedStyle(LDStatus.vars.panel).transform;
                const matrix = new DOMMatrix(currentTransform === 'none' ? '' : currentTransform);

                const newX = matrix.e + dx;
                const newY = matrix.f + dy;

                LDStatus.vars.panel.style.transform = `translate(${newX}px, ${newY}px)`;

                LDStatus.vars.lastX = e.clientX;
                LDStatus.vars.lastY = e.clientY;
            },

            // 面板拖动结束
            onPanelDragEnd: function() {
                if (!LDStatus.vars.isDragging) return;

                LDStatus.vars.isDragging = false;
                LDStatus.vars.panel.style.transition = '';
                document.body.style.userSelect = '';

                // 保存窗口位置
                LDStatus.storage.savePanelPosition();
            },

            // 折叠/展开面板按钮点击
            onToggleBtnClick: function() {
                const panel = LDStatus.vars.panel;
                panel.classList.toggle('ld-collapsed');
                LDStatus.vars.toggleBtn.textContent = panel.classList.contains('ld-collapsed') ? '▶' : '◀';

                // 保存折叠状态
                LDStatus.storage.savePanelCollapsedState();
            },

            // 刷新按钮点击
            onRefreshBtnClick: function() {
                LDStatus.data.fetchTrustLevelData();
            },

            // 更新按钮点击
            onUpdateBtnClick: function() {
                LDStatus.data.checkForUpdates();
            },

            // 主题按钮点击
            onThemeBtnClick: function() {
                const panel = LDStatus.vars.panel;
                const isDarkTheme = panel.classList.contains('ld-dark-theme');

                // 切换主题类
                panel.classList.remove(isDarkTheme ? 'ld-dark-theme' : 'ld-light-theme');
                panel.classList.add(isDarkTheme ? 'ld-light-theme' : 'ld-dark-theme');

                // 更新主题变量
                LDStatus.vars.isDarkTheme = !isDarkTheme;

                // 更新按钮图标
                LDStatus.ui.updateThemeButtonIcon();

                // 保存主题设置
                GM_setValue(LDStatus.config.storageKeys.theme, LDStatus.vars.isDarkTheme ? 'dark' : 'light');
            },

            // 页面可见性变化处理
            onVisibilityChange: function() {
                if (!document.hidden) {
                    // 检查上次刷新时间，如果超过指定间隔则刷新数据
                    const lastRefreshTime = LDStatus.vars.lastRefreshTime || 0;
                    const now = Date.now();

                    if (now - lastRefreshTime > LDStatus.config.refreshInterval) {
                        LDStatus.data.fetchTrustLevelData();
                        LDStatus.vars.lastRefreshTime = now;
                    }
                }
            }
        },

        // 存储相关方法
        storage: {
            // 初始化存储
            initStorage: function() {
                // 恢复面板位置
                this.restorePanelPosition();

                // 恢复折叠状态
                this.restorePanelCollapsedState();
            },

            // 保存面板位置
            savePanelPosition: function() {
                const style = window.getComputedStyle(LDStatus.vars.panel);
                const transform = style.transform;

                if (transform !== 'none') {
                    GM_setValue(LDStatus.config.storageKeys.position, transform);
                }
            },

            // 恢复面板位置
            restorePanelPosition: function() {
                const savedPosition = GM_getValue(LDStatus.config.storageKeys.position, null);

                if (savedPosition) {
                    LDStatus.vars.panel.style.transform = savedPosition;
                }
            },

            // 保存面板折叠状态
            savePanelCollapsedState: function() {
                const isCollapsed = LDStatus.vars.panel.classList.contains('ld-collapsed');
                GM_setValue(LDStatus.config.storageKeys.collapsed, isCollapsed);
            },

            // 恢复面板折叠状态
            restorePanelCollapsedState: function() {
                const isCollapsed = GM_getValue(LDStatus.config.storageKeys.collapsed, false);

                if (isCollapsed) {
                    LDStatus.vars.panel.classList.add('ld-collapsed');
                    LDStatus.vars.toggleBtn.textContent = '▶';
                } else {
                    LDStatus.vars.panel.classList.remove('ld-collapsed');
                    LDStatus.vars.toggleBtn.textContent = '◀';
                }
            }
        },

        // 初始化方法
        init: function() {
            // 初始化 UI
            this.ui.createStyles();
            this.ui.createPanel();

            // 初始化存储
            this.storage.initStorage();

            // 注册事件
            this.events.registerEvents();

            // 获取数据
            this.data.fetchTrustLevelData();

            // 设置定时刷新
            LDStatus.vars.refreshTimer = setInterval(function() {
                LDStatus.data.fetchTrustLevelData();
                LDStatus.vars.lastRefreshTime = Date.now();
            }, this.config.refreshInterval);

            // 记录初始化时间
            LDStatus.vars.lastRefreshTime = Date.now();
        }
    };

    // 初始化脚本
    LDStatus.init();
})();
