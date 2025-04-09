# LDStatus

LDStatus 是一个油猴脚本，用于在浏览 Linux.do 网站时显示用户的信任级别进度。通过这个脚本，您可以实时查看自己的信任级别进度，而无需频繁切换到 connect.linux.do 页面。

## 功能特点

- **浮动窗口**：在 Linux.do 页面左侧显示一个可拖动的浮动窗口
- **实时数据**：从 connect.linux.do 自动获取信任级别数据
- **清晰展示**：以"目标: 已完成数 / 需要完成数"的形式展示数据
- **折叠功能**：支持窗口折叠为小图标，不影响浏览体验
- **自动刷新**：每两分钟自动刷新数据，保持信息最新
- **可拖动**：支持拖动调整窗口位置，放置在您喜欢的位置
- **直观颜色**：绿色数字表示已达成目标，红色数字表示未达成目标
- **深色主题**：采用深色主题，不刺眼，与 Linux.do 网站风格协调

## 安装方法

### 前提条件

在安装脚本之前，您需要先安装一个用户脚本管理器扩展。推荐使用 Tampermonkey，它支持大多数主流浏览器：

- [Chrome 版 Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox 版 Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Edge 版 Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
- [Safari 版 Tampermonkey](https://apps.apple.com/app/apple-store/id1482490089)

### 方法一：直接安装（推荐）

1. 确保您已经安装了 Tampermonkey 或其他用户脚本管理器
2. 点击以下链接直接安装脚本：
   - [安装 LDStatus 脚本](https://github.com/1e0n/LinuxDoStatus/raw/master/LDStatus.user.js)
3. Tampermonkey 将自动检测并提示您安装脚本
4. 点击"安装"按钮完成安装

### 方法二：手动安装

1. 安装 Tampermonkey 浏览器扩展
2. 访问 [LDStatus.user.js 文件](https://github.com/1e0n/LinuxDoStatus/blob/master/LDStatus.user.js)
3. 点击"Raw"按钮查看原始文件
4. Tampermonkey 应该会自动检测并提示安装
5. 如果没有自动提示，请手动复制文件内容

### 方法三：手动复制粘贴

1. 安装 Tampermonkey 浏览器扩展
2. 点击浏览器工具栏中的 Tampermonkey 图标
3. 选择"添加新脚本"
4. 删除编辑器中的所有默认代码
5. 将 [LDStatus.user.js](https://github.com/1e0n/LinuxDoStatus/blob/master/LDStatus.user.js) 的内容复制并粘贴到编辑器中
6. 点击"文件"菜单，然后选择"保存"

## 使用方法

安装脚本后，访问 [Linux.do](https://linux.do) 网站，脚本将自动运行并在页面左侧显示信任级别浮动窗口。

- **展开/折叠**：点击窗口右上角的箭头按钮可以展开/折叠窗口
- **刷新数据**：点击刷新按钮可以手动刷新数据（脚本也会每两分钟自动刷新）
- **移动窗口**：拖动窗口标题栏可以调整窗口位置
- **查看进度**：绿色数字表示已达成目标，红色数字表示未达成目标
- **变化标识**：当目标完成数有变化时，会显示黄色的⬆（增加）或蓝色的⬇（减少）标识及变化数值，即使刷新后数值没有变化也会保留标识

## 注意事项

- 脚本需要您已经登录 Linux.do 账号
- 如果数据加载失败，请确保您已登录并刷新页面
- 脚本仅在 Linux.do 域名下运行，不会在其他网站上激活

## 更新日志

### v1.3 (2024-06-10)
- 修复帖子界面按钮消失的问题
- 使用更特定的CSS选择器避免与网站原有元素冲突

### v1.2 (2024-06-09)
- 改进目标完成数变化的标识功能，即使刷新后数值没有变化也会保留标识
- 增加变化标识的颜色：黄色表示增加，蓝色表示减少

### v1.1 (2024-06-08)
- 将数据刷新时间从每分钟改为每两分钟
- 添加目标完成数变化的标识功能（⬆表示增加，⬇表示减少）

### v1.0 (2024-06-07)
- 初始版本发布
- 实现基本的信任级别数据获取和显示
- 添加浮动窗口和折叠功能
- 支持自动刷新和手动刷新

## 反馈与贡献

如果您有任何问题、建议或反馈，请在 [GitHub Issues](https://github.com/1e0n/LinuxDoStatus/issues) 上提交。

欢迎通过 Pull Requests 贡献代码改进脚本。
