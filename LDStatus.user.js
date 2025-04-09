// ==UserScript==
// @name         LDStatus
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  在 Linux.do 页面显示信任级别进度
// @author       You
// @match        https://linux.do/*
// @grant        GM_xmlhttpRequest
// @connect      connect.linux.do
// ==/UserScript==

(function() {
    'use strict';

    // 创建样式
    const style = document.createElement('style');
    style.textContent = `
        #trust-level-panel {
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

        #trust-level-header {
            background-color: #1a202c;
            color: white;
            padding: 8px 10px;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
        }

        #trust-level-content {
            padding: 10px;
            max-height: none;
            overflow-y: visible;
        }

        .trust-level-item {
            margin-bottom: 6px;
            display: flex;
            white-space: nowrap;
            width: 100%;
            justify-content: space-between;
        }

        .trust-level-item .name {
            flex: 0 1 auto;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 60%;
        }

        .trust-level-item .value {
            font-weight: bold;
            flex: 0 0 auto;
            text-align: right;
            min-width: 70px;
        }

        .trust-level-item.success .value {
            color: #68d391;
        }

        .trust-level-item.fail .value {
            color: #fc8181;
        }

        .toggle-btn, .refresh-btn {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 14px;
            margin-left: 5px;
        }

        .collapsed {
            width: 40px !important;
            height: 40px !important;
            min-width: 40px !important;
            max-width: 40px !important;
            border-radius: 8px;
            overflow: hidden;
            transform: none !important;
        }

        .collapsed #trust-level-header {
            justify-content: center;
            width: 40px !important;
            height: 40px !important;
            min-width: 40px !important;
            max-width: 40px !important;
            padding: 0;
            display: flex;
            align-items: center;
        }

        .collapsed #trust-level-content {
            display: none !important;
        }

        .collapsed #trust-level-header div:first-child,
        .collapsed .refresh-btn {
            display: none !important;
        }

        .collapsed .toggle-btn {
            margin: 0;
            font-size: 16px;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
        }

        .loading {
            text-align: center;
            padding: 10px;
            color: #a0aec0;
        }

        .increase {
            color: #ffd700; /* 黄色 */
        }

        .decrease {
            color: #4299e1; /* 蓝色 */
        }
    `;
    document.head.appendChild(style);

    // 创建面板
    const panel = document.createElement('div');
    panel.id = 'trust-level-panel';

    // 创建面板头部
    const header = document.createElement('div');
    header.id = 'trust-level-header';
    header.innerHTML = `
        <div>信任级别进度</div>
        <div>
            <button class="refresh-btn" title="刷新数据">🔄</button>
            <button class="toggle-btn" title="展开/收起">◀</button>
        </div>
    `;

    // 创建内容区域
    const content = document.createElement('div');
    content.id = 'trust-level-content';
    content.innerHTML = '<div class="loading">加载中...</div>';

    // 组装面板
    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);

    // 拖动功能
    let isDragging = false;
    let lastX, lastY;

    header.addEventListener('mousedown', (e) => {
        if (panel.classList.contains('collapsed')) return;

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
    });

    // 展开/收起功能
    const toggleBtn = header.querySelector('.toggle-btn');
    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('collapsed');
        toggleBtn.textContent = panel.classList.contains('collapsed') ? '▶' : '◀';
    });

    // 刷新按钮
    const refreshBtn = header.querySelector('.refresh-btn');
    refreshBtn.addEventListener('click', fetchTrustLevelData);

    // 获取信任级别数据
    function fetchTrustLevelData() {
        content.innerHTML = '<div class="loading">加载中...</div>';

        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://connect.linux.do',
            onload: function(response) {
                if (response.status === 200) {
                    parseTrustLevelData(response.responseText);
                } else {
                    content.innerHTML = '<div class="loading">获取数据失败，请稍后再试</div>';
                }
            },
            onerror: function() {
                content.innerHTML = '<div class="loading">获取数据失败，请稍后再试</div>';
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
            content.innerHTML = '<div class="loading">未找到信任级别数据，请确保已登录</div>';
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
                    changeIndicator = `<span class="increase"> ⬆${diff}</span>`; // 增加标识，黄色
                } else if (diff < 0) {
                    changeIndicator = `<span class="decrease"> ⬇${Math.abs(diff)}</span>`; // 减少标识，蓝色
                }
            }

            html += `
                <div class="trust-level-item ${req.isSuccess ? 'success' : 'fail'}">
                    <span class="name">${name}</span>
                    <span class="value">${current}${changeIndicator} / ${required}</span>
                </div>
            `;
        });

        content.innerHTML = html;
    }

    // 存储上一次获取的数据，用于比较变化
    let previousRequirements = [];

    // 初始加载
    fetchTrustLevelData();

    // 定时刷新（每两分钟）
    setInterval(fetchTrustLevelData, 120000);
})();
