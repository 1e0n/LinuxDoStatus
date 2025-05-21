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
            },
            icons: {
                SEARCH: '🔎',
                REFRESH: '🔄',
                THEME_DARK: '🌙',
                THEME_LIGHT: '☀️',
                COLLAPSE: '◀',
                EXPAND: '▶',
                LOADING: '⌛',
                UPDATE_AVAILABLE: '⚠️',
                UP_TO_DATE: '✔',
                ERROR: '❌',
                ARROW_UP: '▲',
                ARROW_DOWN: '▼',
                TREND_INCREASE: '▲',
                TREND_DECREASE: '▼',
                TREND_STABLE: '–' // Using '–' for better visual than '0'
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
                        <button class="ld-update-btn" title="检查更新">${LDStatus.config.icons.SEARCH}</button>
                        <button class="ld-refresh-btn" title="刷新数据">${LDStatus.config.icons.REFRESH}</button>
                        <button class="ld-theme-btn" title="切换主题">${LDStatus.config.icons.THEME_DARK}</button>
                        <button class="ld-toggle-btn" title="展开/收起">${LDStatus.config.icons.COLLAPSE}</button>
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
                themeBtn.textContent = isDarkTheme ? LDStatus.config.icons.THEME_DARK : LDStatus.config.icons.THEME_LIGHT;
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
                // Ensure current and required are strings before trying to match
                const currentStr = String(current || ''); // Default to empty string if null/undefined
                const requiredStr = String(required || ''); // Default to empty string

                const currentNumMatch = currentStr.match(/\d+/);
                const requiredNumMatch = requiredStr.match(/\d+/);

                // Default to 0 if parsing fails to avoid NaN errors or errors from null[0]
                const currentNum = (currentNumMatch && currentNumMatch[0]) ? parseInt(currentNumMatch[0], 10) : 0;
                const requiredNum = (requiredNumMatch && requiredNumMatch[0]) ? parseInt(requiredNumMatch[0], 10) : 0;

                // Avoid division by zero if requiredNum is 0
                const percent = (requiredNum > 0)
                    ? Math.min(100, Math.floor((currentNum / requiredNum) * 100))
                    : (currentNum > 0 ? 100 : 0); // If required is 0, 100% if current > 0, else 0%

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

                    // For display, use the text directly from req.current and req.required (which are already strings)
                    // The numerical parsing for logic (currentValue) is done in parseTrustLevelData
                    // The createProgressBar function will also safely parse numbers from these strings.
                    let currentTextForDisplay = req.current;
                    let requiredTextForDisplay = req.required;

                    // 添加目标完成数变化的标识
                    let changeIndicator = '';
                    if (req.hasChanged) {
                        const diff = req.changeValue;
                        if (diff > 0) {
                            changeIndicator = `<span class="ld-increase"> ${LDStatus.config.icons.ARROW_UP}${diff}</span>`;
                        } else if (diff < 0) {
                            changeIndicator = `<span class="ld-decrease"> ${LDStatus.config.icons.ARROW_DOWN}${Math.abs(diff)}</span>`;
                        }
                    }

                    html += `
                        <div class="ld-trust-level-item ${req.isSuccess ? 'ld-success' : 'ld-fail'}">
                            <span class="ld-name">${name}</span>
                            <span class="ld-value">${currentTextForDisplay}${changeIndicator} / ${requiredTextForDisplay}</span>
                        </div>
                        ${LDStatus.ui.createProgressBar(req.current, req.required)}
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
                    const data = dailyChanges[item.key] || { changeLast24h: 0, change24hTo48hAgo: 0, trend: 0 };

                    // 创建趋势指示器
                    let trendIndicator = '';
                    if (data.trend > 0) {
                        trendIndicator = `<span class="ld-trend-indicator ld-increase">${LDStatus.config.icons.TREND_INCREASE}${Math.abs(data.trend)}</span>`;
                    } else if (data.trend < 0) {
                        trendIndicator = `<span class="ld-trend-indicator ld-decrease">${LDStatus.config.icons.TREND_DECREASE}${Math.abs(data.trend)}</span>`;
                    } else {
                        trendIndicator = `<span class="ld-trend-indicator">${LDStatus.config.icons.TREND_STABLE}</span>`;
                    }

                    html += `
                        <div class="ld-daily-stats-item">
                            <span class="ld-name">${item.name}</span>
                            <span class="ld-value">
                                <span class="ld-dual-stats">
                                    <span class="ld-day-stat ld-day2">${data.change24hTo48hAgo}</span> 
                                    <span class="ld-day-stat ld-day1">${data.changeLast24h}</span>
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
            // Purpose: Fetches HTML from the connect page, parses it to find trust level data,
            // calculates changes from previously stored data (previousRequirements),
            // and prepares the data object for rendering and caching.
            parseTrustLevelData: function(html) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // HTML Structure Assumption:
                // Assumes the trust level data is within a div with classes '.bg-white.p-6.rounded-lg'.
                // and contains a h2 element with text including '信任级别'.
                const trustLevelSection = Array.from(doc.querySelectorAll('.bg-white.p-6.rounded-lg')).find(div => {
                    const heading = div.querySelector('h2');
                    return heading && heading.textContent.includes('信任级别');
                });

                if (!trustLevelSection) {
                    LDStatus.vars.content.innerHTML = '<div class="ld-loading">未找到信任级别数据，请确保已登录</div>';
                    return;
                }

                // 获取用户名和当前级别
                let username = '未知用户';
                let targetLevel = '未知';
                const headingElement = trustLevelSection.querySelector('h2');

                if (headingElement && headingElement.textContent) {
                    const headingText = headingElement.textContent.trim();
                    const match = headingText.match(/(.*) - 信任级别 (\d+) 的要求/);
                    if (match && match[1] && match[2]) {
                        username = match[1];
                        targetLevel = match[2];
                    } else {
                        console.warn(`LDStatus: Could not parse username and targetLevel from heading: "${headingText}". Using defaults.`);
                        LDStatus.vars.content.innerHTML = '<div class="ld-loading">数据格式错误（标题解析失败），请检查页面结构或脚本。</div>';
                        // Depending on how critical this is, you might return or allow proceeding with defaults.
                    }
                } else {
                    console.warn('LDStatus: Trust level heading element not found or has no text content.');
                    LDStatus.vars.content.innerHTML = '<div class="ld-loading">数据格式错误（未找到标题），请检查页面结构或脚本。</div>';
                    return; // Stop if critical heading info is missing
                }

                // HTML Structure Assumption:
                // Assumes requirements are listed in a <table> within the trustLevelSection.
                // Each requirement is a <tr>, with <td> elements for name, current progress, and required progress.
                const tableElement = trustLevelSection.querySelector('table');
                if (!tableElement) {
                    console.warn('LDStatus: Trust level table element not found.');
                    LDStatus.vars.content.innerHTML = '<div class="ld-loading">数据格式错误（未找到表格），请检查页面结构或脚本。</div>';
                    return; // Stop if table is missing
                }
                const tableRows = tableElement.querySelectorAll('tr');
                const requirements = [];

                for (let i = 1; i < tableRows.length; i++) { // 跳过表头
                    const row = tableRows[i];
                    const cells = row.querySelectorAll('td');

                    // Ensure cells and their textContent are valid
                    if (cells.length >= 3 &&
                        cells[0] && cells[0].textContent &&
                        cells[1] && cells[1].textContent &&
                        cells[2] && cells[2].textContent) {

                        const name = cells[0].textContent.trim();
                        const currentText = cells[1].textContent.trim(); // Keep original text for display
                        const requiredText = cells[2].textContent.trim(); // Keep original text for display
                        const isSuccess = cells[1].classList ? cells[1].classList.contains('text-green-500') : false;

                        // Robustly extract current value as a number for logic
                        let currentValue = 0;
                        const currentNumMatch = currentText.match(/(\d+)/);
                        if (currentNumMatch && currentNumMatch[0]) {
                            currentValue = parseInt(currentNumMatch[0], 10);
                        } else {
                            console.warn(`LDStatus: Could not parse current value number from: "${currentText}" for item "${name}"`);
                        }

                        // (Optional: Robustly extract required value as a number if needed for logic later)
                        // let requiredValue = 0;
                        // const requiredNumMatch = requiredText.match(/(\d+)/);
                        // if (requiredNumMatch && requiredNumMatch[0]) {
                        //     requiredValue = parseInt(requiredNumMatch[0], 10);
                        // } else {
                        //     console.warn(`LDStatus: Could not parse required value number from: "${requiredText}" for item "${name}"`);
                        // }

                        // `previousRequirements` Usage:
                        // `LDStatus.vars.previousRequirements` stores the full `requirements` array from the *last successful parse*.
                        // This allows comparison to detect changes in `currentValue` for each requirement.
                        let changeValue = 0;
                        let hasChanged = false;

                        if (LDStatus.vars.previousRequirements.length > 0) {
                            const prevReq = LDStatus.vars.previousRequirements.find(pr => pr.name === name);
                            if (prevReq) {
                                // If current numeric value differs from the previous one, calculate the new change.
                                if (currentValue !== prevReq.currentValue) {
                                    changeValue = currentValue - prevReq.currentValue;
                                    hasChanged = true;
                                } else if (prevReq.changeValue) {
                                    // Persisted Change Logic:
                                    // If current value matches previous, but previous had a change indicator (non-zero changeValue),
                                    // persist that indicator (changeValue and hasChanged flag).
                                    // This aligns with the feature: "Even if the value does not change after refresh, the indicator will be preserved."
                                    changeValue = prevReq.changeValue;
                                    hasChanged = true;
                                }
                                // If currentValue matches prevReq.currentValue AND prevReq.changeValue was 0,
                                // then changeValue remains 0 and hasChanged remains false (no new change, no persisted change).
                            }
                        }

                        requirements.push({
                            name,
                            current: currentText, // Use original text for display
                            required: requiredText, // Use original text for display
                            isSuccess,
                            currentValue, // Parsed number for logic
                            changeValue,
                            hasChanged
                        });
                    } else {
                        console.warn(`LDStatus: Skipping table row at index ${i} due to insufficient cells or missing text content. Cells found: ${cells.length}.`);
                    }
                }

                // 获取总体结果
                const resultTextElement = trustLevelSection.querySelector('p.text-red-500, p.text-green-500');
                let isMeetingRequirements = false; // Default to false

                if (resultTextElement && resultTextElement.classList) {
                    isMeetingRequirements = !resultTextElement.classList.contains('text-red-500');
                } else {
                    console.warn('LDStatus: Result text (overall status) element not found or classList is not available. Defaulting to "not meeting requirements".');
                    // Optionally, inform the user in the panel if this is critical
                    // LDStatus.ui.showNotice("无法确定总体状态", "warn");
                }

                // 存储48小时内的数据变化
                const dailyChanges = this.saveDailyStats(requirements); // This calculates and stores daily activity.

                // Data Caching:
                // The full parsed data (including calculated changes and daily activity) is cached to GM_setValue.
                // This allows the panel to display the last known data if the user is offline
                // or if a subsequent fetch from connect.linux.do fails.
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

                // `previousRequirements` Update:
                // Save the current set of requirements (with their currentValues, changeValues, and hasChanged flags)
                // to `LDStatus.vars.previousRequirements` for the next fetch cycle's comparison.
                // A shallow copy is made to prevent modifications to the rendered data from affecting the next comparison.
                LDStatus.vars.previousRequirements = [...requirements];
            },

            // 存储48小时内的数据变化
            saveDailyStats: function(requirements) {
                const statsToTrack = LDStatus.config.statsToTrack;
                const now = new Date().getTime();
                const twoDaysAgo = now - 48 * 60 * 60 * 1000;

                // 1. Load Existing Data
                let allDailyStats = [];
                try {
                    const storedStats = localStorage.getItem('ld_daily_stats');
                    if (storedStats) {
                        allDailyStats = JSON.parse(storedStats);
                        if (!Array.isArray(allDailyStats)) { // Basic validation
                            console.warn("LDStatus: ld_daily_stats from localStorage was not an array. Resetting.");
                            allDailyStats = [];
                        }
                    }
                } catch (e) {
                    console.error("LDStatus: Error parsing ld_daily_stats from localStorage:", e);
                    allDailyStats = []; // Start fresh if parsing fails
                }

                // 2. Filter Old Data
                allDailyStats = allDailyStats.filter(item => item.timestamp > twoDaysAgo);

                // 3. Add New Data
                statsToTrack.forEach(statName => {
                    const req = requirements.find(r => r.name === statName);
                    if (req) {
                        // req.currentValue is already parsed as a number in parseTrustLevelData
                        const currentValue = req.currentValue;

                        allDailyStats.push({
                            name: statName,
                            value: currentValue,
                            timestamp: now
                        });
                    }
                });

                // 4. Clean Up/Limit (ensure cleanupStorage returns the cleaned array)
                allDailyStats = this.cleanupStorage(allDailyStats); // cleanupStorage sorts and slices

                // 5. Save Data
                localStorage.setItem('ld_daily_stats', JSON.stringify(allDailyStats));

                // Return the result of calculateDailyChanges based on the new allDailyStats
                return this.calculateDailyChanges(allDailyStats);
            },

            // 清理过量的存储数据
            cleanupStorage: function(stats) {
                const maxItems = LDStatus.config.maxStorageItems;

                if (stats.length > maxItems) {
                    // 按时间戳排序并只保留最新的数据 (descending to keep newest)
                    stats.sort((a, b) => b.timestamp - a.timestamp);
                    return stats.slice(0, maxItems); // Important: it returns the sliced array
                }
                return stats; // Return the original array if not over limit
            },

            // 计算近两天内的变化量
            // Purpose: Calculates the net change in tracked statistics over two distinct 24-hour periods:
            // 1. The most recent 24 hours (Last 24h).
            // 2. The 24-hour period immediately preceding the "Last 24h" (24h-48h Ago).
            // It also calculates the 'trend', which is the difference between these two net changes.
            // Input: dailyStats - Array of objects: { name: string, value: number, timestamp: number }
            // Output: An object where keys are statNames and values are { changeLast24h, change24hTo48hAgo, trend }.
            calculateDailyChanges: function(dailyStats) {
                const statsToTrack = LDStatus.config.statsToTrack;
                const result = {};
                const now = new Date().getTime();

                // Time Period Definitions:
                // `oneDayAgo` marks the boundary between "Last 24h" and "24h-48h Ago".
                // `twoDaysAgo` marks the older boundary for the "24h-48h Ago" period.
                const oneDayAgo = now - 24 * 60 * 60 * 1000;
                const twoDaysAgo = now - 48 * 60 * 60 * 1000;

                statsToTrack.forEach(statName => {
                    // Filter records for the current stat and sort them by timestamp (ascending).
                    // This makes it easier to find the earliest and latest records in a period.
                    const statRecords = dailyStats
                        .filter(item => item.name === statName)
                        .sort((a, b) => a.timestamp - b.timestamp);

                    result[statName] = {
                        changeLast24h: 0,     // Net change in value over the most recent 24 hours.
                        change24hTo48hAgo: 0, // Net change in value over the 24-hour period before the most recent one.
                        trend: 0              // Difference: changeLast24h - change24hTo48hAgo.
                    };

                    if (statRecords.length >= 2) {
                        // Record Identification:
                        // `newest`: The absolute latest record available for this statistic.
                        const newest = statRecords[statRecords.length - 1];

                        // `oldestLast24h`: The earliest record that falls within the "Last 24h" window (timestamp > oneDayAgo).
                        // Used as the starting point to calculate change during the most recent 24 hours.
                        const oldestLast24h = statRecords.filter(item => item.timestamp > oneDayAgo)[0];

                        // Records for the "24h-48h Ago" period.
                        const records24hTo48hAgo = statRecords.filter(item =>
                            item.timestamp <= oneDayAgo && item.timestamp > twoDaysAgo);

                        // `oldest24hTo48hAgo`: Earliest record in the "24h-48h Ago" window.
                        // `newest24hTo48hAgo`: Latest record in the "24h-48h Ago" window.
                        // These are used to calculate the net change *within* that specific 24-hour slot.
                        const oldest24hTo48hAgo = records24hTo48hAgo.length > 0 ? records24hTo48hAgo[0] : null;
                        const newest24hTo48hAgo = records24hTo48hAgo.length > 0 ?
                            records24hTo48hAgo[records24hTo48hAgo.length - 1] : null;

                        // Change Calculation:
                        // `changeLast24h`: Net change from the start of the "Last 24h" period to the `newest` record.
                        if (oldestLast24h) {
                            result[statName].changeLast24h = newest.value - oldestLast24h.value;
                        }

                        // `change24hTo48hAgo`: Net change from the start to the end of the "24h-48h Ago" period.
                        if (oldest24hTo48hAgo && newest24hTo48hAgo) {
                            result[statName].change24hTo48hAgo = newest24hTo48hAgo.value - oldest24hTo48hAgo.value;
                        }

                        // `trend`: Difference between the net change in the last 24h and the net change in the 24h before that.
                        // A positive trend means activity is increasing more (or decreasing less) in the most recent 24h
                        // compared to the prior 24h period.
                        result[statName].trend = result[statName].changeLast24h - result[statName].change24hTo48hAgo;
                    }
                });

                return result;
            },

            // 检查脚本更新
            checkForUpdates: function() {
                const updateURL = 'https://raw.githubusercontent.com/1e0n/LinuxDoStatus/master/LDStatus.user.js';
                const updateBtn = LDStatus.vars.updateBtn;

                // 显示正在检查的状态
                updateBtn.textContent = LDStatus.config.icons.LOADING;
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
                                    updateBtn.textContent = LDStatus.config.icons.UPDATE_AVAILABLE;
                                    updateBtn.title = `发现新版本 v${remoteVersion}，点击前往更新页面`;
                                    updateBtn.style.color = 'var(--ld-increase-color)'; // 黄色

                                    // 点击按钮跳转到更新页面
                                    updateBtn.onclick = function() {
                                        window.open(updateURL, '_blank');
                                    };
                                } else {
                                    // 已是最新版本
                                    updateBtn.textContent = LDStatus.config.icons.UP_TO_DATE;
                                    updateBtn.title = '已是最新版本，点击再次检查'; // Updated title for clarity
                                    updateBtn.style.color = 'var(--ld-success-color)'; // 绿色
                                    // Ensure onclick allows re-checking
                                    updateBtn.onclick = LDStatus.events.onUpdateBtnClick; 
                                    // Removed setTimeout to make the "up-to-date" state persistent
                                }
                            } else {
                                // This case means versionMatch failed, treat as an error in parsing response
                                console.warn("LDStatus: Could not parse version from update check response.");
                                LDStatus.data.handleUpdateError(); // Call existing error handler
                            }
                        } else {
                             // HTTP error
                            console.warn(`LDStatus: Update check HTTP error: ${response.status}`);
                            LDStatus.data.handleUpdateError();
                        }
                    },
                    onerror: function(error) { // Network error
                        console.warn("LDStatus: Update check network error.", error);
                        LDStatus.data.handleUpdateError();
                    }
                });
            },

            // 处理更新检查错误
            handleUpdateError: function() {
                const updateBtn = LDStatus.vars.updateBtn;
                updateBtn.textContent = LDStatus.config.icons.ERROR;
                updateBtn.title = '检查更新失败，点击再次检查'; // Updated title for clarity
                updateBtn.style.color = 'var(--ld-fail-color)'; // 红色
                // Ensure onclick allows re-checking
                updateBtn.onclick = LDStatus.events.onUpdateBtnClick;
                // Removed setTimeout to make the error state persistent until user interaction
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
                LDStatus.vars.toggleBtn.textContent = panel.classList.contains('ld-collapsed')
                    ? LDStatus.config.icons.EXPAND
                    : LDStatus.config.icons.COLLAPSE;

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
                    LDStatus.vars.toggleBtn.textContent = LDStatus.config.icons.EXPAND;
                } else {
                    LDStatus.vars.panel.classList.remove('ld-collapsed');
                    LDStatus.vars.toggleBtn.textContent = LDStatus.config.icons.COLLAPSE;
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
