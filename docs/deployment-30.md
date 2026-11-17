# Chat 应用在 30 环境部署与业务大屏接入使用说明

> 适用项目：`emeiziying/chat-demo`，默认分支 `feature/floating-widget`。
> 本说明按已实现的卡片、浮窗、共享主题和本地会话能力编写，代码基线为 `c1da8a7`。
> 文中的 **30 环境**指独立承载 Chat 静态应用的环境，不代表已经确认了它的实际 IP、端口或域名。以下 `10.0.0.30:8080`、`screen.example.com` 均为示例，部署前须替换。本文不表示已部署到真实 30 环境。

## 1. 推荐接入方式

**Chat 独立部署在 30 环境，业务系统通过自己的 Nginx 转发 Chat 页面，浏览器统一访问业务域名。**

```text
用户浏览器： https://screen.example.com
  │
  ├─ /                         → 现有业务大屏
  │
  ├─ /assistant/widget.js      ┐
  ├─ /assistant/screen-theme.css│ 业务 Nginx → 30 环境 :8080
  └─ /assistant/index.html     ┘                 → Chat 静态文件

  /assistant-api/* → API 上游
                     ├─ 当前可用方式：透传 DeepSeek，用户填写自己的 Key
                     └─ 企业接入方式：业务后端校验登录和权限，再调用模型服务（需开发）
```

这样可以保持 Chat 与业务系统独立发布，同时让 iframe、脚本、CSS 和 API 请求在浏览器侧保持同源。浏览器不必直接访问 30 环境的内网地址，也不必处理 HTTPS 大屏嵌入 HTTP 页面的问题。

### 地址和目录示例

| 项目                | 示例                                        | 由谁提供   |
| ------------------- | ------------------------------------------- | ---------- |
| 业务系统 HTTPS 域名 | `https://screen.example.com`                | 业务系统   |
| 30 环境静态服务     | `http://10.0.0.30:8080/`                    | 运维       |
| 30 环境部署目录     | `/srv/www/chat-demo/`                       | 运维       |
| Chat 对外路径       | `https://screen.example.com/assistant/`     | 业务 Nginx |
| API 对外路径        | `https://screen.example.com/assistant-api/` | 业务 Nginx |
| 大屏挂载容器        | `#screen-right-column`                      | 业务前端   |

`10.0.0.30` 只是示例 IP；如果“30 环境”对应其他地址，使用实际地址即可。

## 2. 当前能力与接入边界

| 能力                             | 当前状态                                        |
| -------------------------------- | ----------------------------------------------- |
| 独立聊天页面                     | 已实现                                          |
| 网页右下角浮窗                   | 已实现                                          |
| 大屏内嵌小卡片，点击向上展开     | 已实现                                          |
| 毛玻璃、业务卡片共用配色         | 已实现                                          |
| 语音、附件和流式回答             | 前端已实现，需有效 API Key 和支持相应接口的服务 |
| 本地历史与设置按 namespace 分区  | 已实现                                          |
| 业务系统单点登录、用户权限验证   | 未实现，需对接业务后端                          |
| 公司共享模型 Key 托管            | 未实现，需业务后端保管                          |
| 服务端会话同步                   | 未实现                                          |
| 自动获取当前电站、设备或页面数据 | 未实现，业务数据接入需另外设计与开发            |
| 自动部署到 30 环境               | 未实现；现有 Actions 只自动发布 GitHub Pages    |

**仅配置 Nginx 或传入用户 namespace，不会自动获得业务登录态、业务数据权限或 SSO。**

## 3. 在 30 环境部署 Chat

### 3.1 获取代码和构建

在构建机安装项目所需 Node.js 和 pnpm。现有 Actions 使用 Node.js 24、pnpm 10.33.4，可采用相同版本。

```bash
git clone --branch feature/floating-widget https://github.com/emeiziying/chat-demo.git
cd chat-demo
pnpm install --frozen-lockfile
pnpm type
pnpm lint
CHAT_API_ORIGIN=/assistant-api pnpm build
```

`CHAT_API_ORIGIN` 是**构建时参数**。这里的 `/assistant-api` 会在浏览器中解析到业务系统当前域名：

```text
https://screen.example.com/assistant-api/anthropic/v1/messages
```

构建后再修改服务器环境变量，不会改变已生成的前端文件；需要重新构建。请勿在该变量或构建文件中填写模型 Key。

### 3.2 部署构建产物

将 `dist/` **内的全部文件和目录**部署到 30 环境的 `/srv/www/chat-demo/`：

```text
/srv/www/chat-demo/
├── index.html
├── widget.js
├── screen-theme.css
├── widget-demo.html
├── screen-demo.html
├── LICENSE
└── static/
    ├── js/
    ├── css/
    └── media/
```

应完整发布，不能只复制 `index.html` 或 `widget.js`。建议用版本目录加软链接或部署系统的原子切换能力，避免 HTML 和带 hash 的资源在更新中途不匹配。保留上一个版本，便于回滚。

### 3.3 30 环境 Nginx 配置

以下 `server` 放在 Nginx 的 `http` 上下文中，例如已被主配置包含的站点配置文件。假定全局已包含 `mime.types`。

```nginx
server {
    listen 8080;
    server_name _;

    root /srv/www/chat-demo;
    index index.html;

    location / {
        # 本项目无需把未知路径回退到 index.html；缺失资源应返回 404
        try_files $uri $uri/ =404;

        add_header Cache-Control "no-cache" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Content-Security-Policy "frame-ancestors 'self'" always;
    }
}
```

该示例面向**业务网关同源转发**：浏览器最终看到的是业务系统域名，因此 SAMEORIGIN 和 `'self'` 与此接入方式一致。30 环境只需向业务网关开放所需端口；如果环境要求内部链路也使用 TLS，按该环境的证书和域名规范改为 HTTPS 服务。

在 30 环境验证并重载：

```bash
sudo nginx -t
sudo nginx -s reload
curl -I http://127.0.0.1:8080/index.html
curl -I http://127.0.0.1:8080/widget.js
curl -I http://127.0.0.1:8080/screen-theme.css
```

再从业务 Nginx 所在服务器检查 `http://实际30地址:端口/` 是否可达。

## 4. 业务系统 Nginx 配置

保留业务系统原来的 HTTPS、证书和页面配置，在现有 HTTPS `server` 中加入以下路径。

### 4.1 转发 Chat 前端

```nginx
location = /assistant {
    return 301 /assistant/;
}

location ^~ /assistant/ {
    # 示例地址；替换为实际 30 环境服务地址
    proxy_pass http://10.0.0.30:8080/;

    proxy_http_version 1.1;
    proxy_set_header Host $proxy_host;
    proxy_set_header Connection "";
}
```

`proxy_pass` 末尾的 `/` 必须保留，它会把 `/assistant/` 前缀替换掉：

| 浏览器请求               | 30 环境收到的请求 |
| ------------------------ | ----------------- |
| `/assistant/index.html`  | `/index.html`     |
| `/assistant/widget.js`   | `/widget.js`      |
| `/assistant/static/js/…` | `/static/js/…`    |

### 4.2 当前版本可用的 API 透传

以下配置与当前“用户填写自己的 DeepSeek Key”方式兼容，不需要先开发业务代理。

```nginx
location ^~ /assistant-api/ {
    proxy_pass https://api.deepseek.com/;

    proxy_http_version 1.1;
    proxy_set_header Host api.deepseek.com;
    proxy_set_header Connection "";

    # 外部模型服务不需要业务系统的登录 Cookie
    proxy_set_header Cookie "";

    proxy_ssl_server_name on;
    proxy_ssl_name api.deepseek.com;
    proxy_ssl_verify on;
    # Debian / Ubuntu 示例；其他系统替换为实际 CA 文件路径
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;

    client_max_body_size 80m;
    proxy_buffering off;
    proxy_cache off;
    proxy_request_buffering off;
    proxy_connect_timeout 10s;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
}
```

用户的 `x-api-key` / `Authorization` 请求头由 Nginx 正常转发。不在 Nginx 配置中写入公司共享 Key。

`80m` 是上传请求体的 Nginx 上限，给 multipart 留出余量，不会取消 Chat 前端和上游服务本身的文件限制。`proxy_buffering off` 用于让 SSE 回答和 TTS 音频及时转发；如果前面还有网关或负载均衡，也要检查该层是否缓冲或过早超时。

### 4.3 企业业务代理接入

如果后续由业务后端统一管理 Key、登录和权限，将 API location 的上游改为实际业务代理，示例如下；`10.0.0.20:3000` 同样只是示例。

```nginx
location ^~ /assistant-api/ {
    proxy_pass http://10.0.0.20:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";

    # 同源业务代理可按业务认证方案接收登录 Cookie；不要沿用外部上游的 Cookie 清空配置
    client_max_body_size 80m;
    proxy_buffering off;
    proxy_cache off;
    proxy_request_buffering off;
    proxy_connect_timeout 10s;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
}
```

业务代理需要明确实现或适配以下协议：

- `/anthropic/v1/messages`：聊天与 SSE。
- `/anthropic/v1/files` 及所需文件操作路径：附件上传与文件引用。
- `/v1/tools/asr`：语音识别。
- `/v1/tools/tts`：流式语音合成。
- `/models`：如果仍保留当前 API Key 校验流程。

**此时还要修改 Chat 的 `ensureApiKey()`、`src/services/api/client.ts` 和 `src/services/api/speech.ts`，改为业务认证方式。** 当前版本仍会检查用户 Key；仅替换 `proxy_pass` 不会取消这个检查。

业务后端负责验证真实用户身份、租户权限、附件归属、配额以及模型 Key。namespace 不能替代这些校验。

### 4.4 网关策略检查

- 页面通过 HTTPS 访问；iframe 已设置 `allow="microphone"`，仍须用户授权麦克风。
- 如果业务系统设置了 `Permissions-Policy`，确认允许同源麦克风。
- 业务页面 CSP 需允许同源脚本、CSS、iframe 和对应 API 连接。
- 不得有另一层 `X-Frame-Options: DENY` 或 `frame-ancestors 'none'` 阻止 Chat 嵌入。
- 加载器当前动态创建 Shadow DOM 内联样式，演示接入还包含内联脚本；严格 CSP 项目应把初始化脚本外置，并为加载器样式设计 nonce 或外部样式适配，不能假定现有代码已兼容严格禁止内联的策略。

修改配置后执行 `nginx -t`，通过后再重载。本文没有连接真实环境执行该操作。

## 5. 在业务大屏内挂载卡片

### 5.1 准备完整的右侧栏容器

容器必须覆盖**从光伏卡片顶部到助手小卡片底部**的整个区域。组件展开时填满这个容器。

```html
<aside id="screen-right-column" class="screen-right-column">
  <section class="business-card">光伏系统</section>
  <section class="business-card">能碳系统</section>
  <div class="assistant-placeholder" aria-hidden="true"></div>
</aside>
```

不要仅把底部小卡片作为 container，否则“展开”只能填满那张小卡片。底部保留占位，助手覆盖展示时不会挤压其他卡片。

下面是独立验证用的布局示例。正式业务大屏可复用已有右侧栏布局，只要保证容器有定位和明确的可用高度。

```css
.screen-right-column {
  position: relative;
  width: clamp(320px, 22vw, 480px);
  height: calc(100dvh - 120px);
  min-height: 650px;
  display: grid;
  grid-template-rows:
    minmax(180px, 1.15fr)
    minmax(130px, 0.85fr)
    var(--assistant-card-height);
  gap: 16px;
  isolation: isolate;
  --assistant-card-height: clamp(240px, 28dvh, 320px);
}

.business-card {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 14px 20px;
  border: 1px solid var(--screen-panel-border);
  border-radius: 12px;
  background: var(--screen-panel-background);
  box-shadow: var(--screen-panel-shadow);
  color: var(--screen-text);
}

@media (max-width: 767px) {
  .screen-right-column {
    width: 100%;
    height: auto;
    min-height: 0;
    grid-template-rows: auto auto var(--assistant-card-height);
    --assistant-card-height: 320px;
  }
}
```

### 5.2 加载资源并挂载

在业务页中加载同源资源，确保容器与脚本已经就绪后调用：

```html
<link rel="stylesheet" href="/assistant/screen-theme.css" />
<script src="/assistant/widget.js"></script>
<script>
  const assistant = DeepSeekWidget.mount({
    src: '/assistant/index.html',
    container: '#screen-right-column',
    mode: 'card',
    theme: 'screen',
    title: 'AI智能体',
    namespace: 'tenant-001:user-123',
    locale: 'zh-CN',
  })
</script>
```

业务系统应在登录身份确定后，用稳定、非敏感的租户与用户标识生成 namespace。上例只是占位值，不应让所有真实用户共用它。

| 参数        | 用法与限制                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------ |
| `src`       | Chat 的 HTTP/HTTPS 页面 URL；这里固定为业务域名下的路径                                    |
| `container` | `card` 必填，支持选择器或 HTMLElement；元素必须已存在，且具有 relative/absolute/fixed 定位 |
| `mode`      | `card` 为直接展示卡片；`floating` 为右下角启动按钮和浮窗，默认 floating                    |
| `theme`     | `screen` 为大屏主题；另支持 light、dark、system                                            |
| `title`     | 标题纯文本，同时用于可访问名称                                                             |
| `namespace` | 1–128 位字母、数字、`_ . : @ -`；仅用于本地记录与设置分区                                  |
| `locale`    | `zh-CN` 或 `en-US`                                                                         |

每个页面当前只有一个实例。重复 mount 返回现有实例，不会应用新的参数；切换用户或配置时先 destroy，再 mount。

### 5.3 展开与生命周期

组件标题栏已自带展开、恢复按钮。业务系统也可以调用：

```js
assistant.expand() // 向上展开到 container 顶部
assistant.collapse() // 恢复原卡片高度
assistant.toggleExpanded() // 切换状态
assistant.open() // 确保可见，不改变卡片展开状态
assistant.close() // card 中等同 collapse，仍保留直接问答
assistant.destroy() // 卸载 iframe 和监听器

const container = document.querySelector('#screen-right-column')
container.addEventListener('assistant:expand-change', (event) => {
  console.log('是否展开：', event.detail.expanded)
})
```

- 展开只改变外壳高度，宽度和底边保持不变，不移动或重建 iframe。
- 卡片恢复后仍可问答，因此不会停止正在进行的录音或文字生成。
- 普通浮窗的 close 会隐藏窗口、停止录音、取消转写并停止朗读，保留 iframe 和草稿。
- 业务路由卸载、页面模块被隐藏或用户退出时调用 destroy，避免隐藏页面仍录音或播放。
- Vue/React 等 SPA 应在组件挂载、容器存在后初始化，在组件卸载时 destroy；同一组件实例普通重渲染不要重复创建。
- 切换账号时 destroy 旧实例，再用新用户 namespace 挂载。已保存历史不会因为 destroy 自动删除。

## 6. 如何自定义样式

需要区分三层：**宿主大屏、Shadow DOM 外壳、iframe 内部聊天内容**。

| 修改目标                                     | 配置位置                                 | 是否需要重新构建 Chat    |
| -------------------------------------------- | ---------------------------------------- | ------------------------ |
| 小卡片高度、最大展开区域、宽度               | 业务容器 CSS                             | 否                       |
| 外壳底色、边框、模糊、标题颜色               | 宿主 `--assistant-*` / `--screen-*` 变量 | 否                       |
| 业务卡片和会话默认统一配色                   | 源码 `public/screen-theme.css`           | 是，保证 iframe 内也同步 |
| 消息气泡、输入区、正文、代码块配色           | `src/embed/embed.css`、共享调色板        | 是                       |
| 导航高度、消息间距、按钮尺寸                 | 相应组件 CSS Module 的 card 规则         | 是                       |
| 运行时从宿主注入任意 CSS、气泡颜色或主题对象 | 当前没有此接口                           | 需另外开发               |

### 6.1 只调整业务大屏中的外壳

在业务页面自己的 CSS 中覆盖容器变量即可：

```css
#screen-right-column {
  --assistant-card-height: 300px;
  --assistant-blur: 18px;
  --assistant-surface: linear-gradient(125deg, rgba(41, 81, 106, 0.67), rgba(22, 51, 67, 0.93));
  --assistant-border: rgba(105, 169, 203, 0.44);
  --assistant-title: #a9ddff;
  --assistant-text: #e6f4ff;
  --assistant-accent: #168eff;
  --assistant-fallback-surface: #1b3b50;
}
```

| 变量                           | 控制内容                                         |
| ------------------------------ | ------------------------------------------------ |
| `--assistant-card-height`      | 小卡片高度；展开高度仍由 container 决定          |
| `--assistant-surface`          | 外壳底色或渐变；应保留透明度才能看见模糊后的背景 |
| `--assistant-blur`             | 高斯模糊半径；`0px` 可关闭模糊                   |
| `--assistant-border`           | 外框描边                                         |
| `--assistant-title`            | 标题文字颜色                                     |
| `--assistant-text`             | 外层标题栏的基础文字色，不是 iframe 内正文色     |
| `--assistant-accent`           | 外壳指示点强调色，不是 iframe 内按钮色           |
| `--assistant-fallback-surface` | 浏览器不支持背景模糊时的底色                     |

外壳阴影和标题栏分隔线分别读取 `--screen-panel-shadow`、`--screen-panel-divider`。渐变、描边和阴影应与旁边业务卡片共用同一组变量，避免颜色相近但仍有差异。

### 6.2 让业务卡片和 Chat 共用一套调色板

源码中的 `public/screen-theme.css` 定义默认值：

```css
:root {
  --screen-panel-background: linear-gradient(125deg, #29516aab, #163343ed);
  --screen-panel-border: #69a9cb70;
  --screen-panel-shadow: inset 0 0 16px #62b8f012;
  --screen-panel-divider: #9bb8c52e;
  --screen-panel-title: #a9ddff;
  --screen-text: #e6f4ff;
  --screen-text-secondary: #a9becd;
  --screen-accent: #168eff;
  --screen-input-background: rgba(13, 34, 48, 0.42);
  --screen-bubble-background: rgba(179, 210, 226, 0.08);
}
```

业务卡片用这些变量渲染，Chat 外壳也优先读取同名变量；iframe 中的聊天主题在构建时引入同一个文件。

统一改色的流程：

1. 修改源码 `public/screen-theme.css`。
2. 必要时修改 `src/embed/embed.css` 中的内部主题映射。
3. 重新执行 `CHAT_API_ORIGIN=/assistant-api pnpm build`。
4. 将完整 dist 发布到 30 环境；业务页面继续加载 `/assistant/screen-theme.css`。
5. 对比小卡片、展开、设置、消息和输入区的渲染效果。

**不能只在线上替换外置 screen-theme.css，就假定 iframe 内颜色也会一起变化。** iframe 使用的主题已经打包进带 hash 的 CSS 资源，需要重新构建并完整发布。

### 6.3 调整消息、输入框和间距

会话内部主题在 `src/embed/embed.css`，示例：

```css
html[data-chat-theme='screen'] body {
  --chat-surface: transparent;
  --chat-input-bg: var(--screen-input-background);
  --chat-text: var(--screen-text);
  --chat-text-secondary: var(--screen-text-secondary);
  --chat-border: var(--screen-panel-border);
  --chat-accent: var(--screen-accent);
  --chat-user-bubble: #096da7;
  --chat-assistant-bubble: var(--screen-bubble-background);
  --chat-radius: 12px;
}
```

该示例应修改在 Chat 源码中，而不是粘贴进业务宿主 CSS。布局规则分别位于：

- `src/components/chatInput/ChatInput.module.css`：输入区、按钮、附件卡片。
- `src/components/messages/UserMessage.module.css`：用户消息。
- `src/components/messages/AssistantMessage.module.css`：助手消息。
- `src/components/messages/MessageList.module.css`：消息区滚动和间距。
- `src/components/session/*`：导航、欢迎页和会话输入区布局。

使用现有 `html[data-presentation='card']` 范围限定卡片专用布局，避免影响独立页和普通浮窗。业务页面的 `.message`、`textarea` 等选择器不能穿过 iframe；不要依赖运行时查询 Shadow DOM 内部节点来改样式。

毛玻璃在宿主外壳上实现；iframe 页面底色必须透明。不要对整个聊天窗口使用 `filter: blur()`，那会把文字和控件一起模糊。

## 7. 会话数据、账号与 API Key

- 会话、消息、已发送附件原件存 IndexedDB；Key 和设置存 localStorage；未发送草稿存当前页面内存。
- 推荐同源代理下，存储归属为业务系统域名，不是 30 环境内网 IP。
- 同一个 namespace、同一来源和浏览器配置下会访问同一分区；换设备、浏览器或来源不会自动同步。
- 如果多个业务系统使用不同域名，即使都代理到同一套 30 静态文件，本地历史也不会自动共享。
- namespace 只做本地分区，同源脚本仍能访问这些数据；真实访问权限要由服务端验证。
- 当前模式首次发送、上传或录音前会检查 API Key。可从历史抽屉底部进入设置。
- 退出登录时销毁 Chat；是否删除本地历史由业务产品策略另行决定，不应把 namespace 当作保密边界。

## 8. 如必须直接跨域访问 30 环境

也可以让浏览器直接加载 `https://chat30.example.com/widget.js` 和对应 iframe，但需要额外配置：

| 项目     | 要点                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------- |
| HTTPS    | 30 对外需提供浏览器信任的 HTTPS；HTTPS 业务页不能嵌入 HTTP iframe                                   |
| 允许嵌入 | 30 响应 CSP `frame-ancestors` 应明确允许业务域名；不能同时用 SAMEORIGIN 阻止跨域嵌入                |
| 宿主策略 | 业务 CSP 允许 Chat 域名的脚本、CSS和 iframe；麦克风策略需允许该 iframe 来源                         |
| API 地址 | `/assistant-api` 此时解析到 Chat 域名，需要在 30 配 API 路径，或改为绝对 API URL 并适配 CORS 与鉴权 |
| 存储     | 记录归 Chat 来源；第三方存储限制、浏览器分区行为需要实际验证                                        |
| 登录     | 跨域 Cookie、SameSite、凭据传递需单独设计；当前代码没有自动的跨域 SSO                               |

共享静态服务不等于共享登录或共享会话。没有明确跨域需求时，优先使用本文的业务网关同源转发方案。

## 9. 上线验收清单

| 检查项                                                             | 预期结果                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| `/assistant/index.html`、`widget.js`、`screen-theme.css`、静态资源 | 200，JS/CSS 类型正确，无缺失资源                       |
| 浏览器地址与 iframe src                                            | 使用业务域名，不意外跳到内网 IP 或 GitHub Pages        |
| API 网络请求                                                       | 发往业务域名 `/assistant-api/`，路径转发正确           |
| 首次无 Key                                                         | 操作时进入设置，不出现假回答或假登录                   |
| 小卡片问答                                                         | 输入与发送可用，消息逐步显示                           |
| 展开与恢复                                                         | 顶部对齐光伏卡片，宽度与底边不变，草稿和回答保留       |
| 路由卸载与账号切换                                                 | 旧实例销毁，使用新 namespace；无隐藏麦克风或朗读       |
| 样式                                                               | 卡片与助手渐变、描边、阴影、标题一致；消息与输入可读   |
| 毛玻璃                                                             | 后景模糊，正文清晰；不支持时有可读底色                 |
| 表格、代码、附件                                                   | 不撑破列宽，长内容内部滚动                             |
| 附件上传                                                           | 正常完成或显示明确失败；无 Nginx 413                   |
| 语音                                                               | HTTPS、用户授权、麦克风设备及上游 ASR/TTS 均可用       |
| 多尺寸                                                             | 桌面、短屏、平板、手机无横向页面溢出，卡片和输入可访问 |
| 更新与回滚                                                         | 完整产物版本一致，重新验证缓存，回滚后资源仍可用       |

真实模型问答、附件解析与语音必须使用有效服务验收。仅静态页面打开成功，不代表 API、业务权限或真实设备已验收。

## 10. 常见问题

| 现象                        | 优先检查                                                                        |
| --------------------------- | ------------------------------------------------------------------------------- |
| 白屏、JS 报 404             | dist 是否完整；proxy_pass 尾部斜杠；mime.types；业务网关是否误把资源回退成 HTML |
| iframe 被拒绝               | CSP frame-ancestors、X-Frame-Options、宿主 frame-src；是否误用直接跨域方案      |
| 输入后仍要求 API Key        | 当前代码的正常行为；业务后端 SSO 尚未适配                                       |
| 回答攒到最后一次显示        | Nginx、前置网关或后端是否缓冲 SSE                                               |
| 上传返回 413                | 当前请求经过的各层网关 client_max_body_size                                     |
| 展开范围只有一张小卡片      | container 选错，应挂到整列容器                                                  |
| 卡片飘到页面角落            | container 不存在或没有定位；是否重复挂载                                        |
| 改宿主颜色后气泡没变        | iframe 隔离；内部主题需改源码、重新构建                                         |
| 替换 theme.css 后仍有旧配色 | iframe 使用打包资源；需完整构建发布，并检查浏览器缓存                           |
| 麦克风不可用                | HTTPS、安全上下文、用户授权、设备、Permissions Policy 与 iframe allow           |
| 换账号后仍看到旧记录        | namespace 是否真正按用户切换；是否先 destroy 旧实例                             |
| 30 更新了但业务页仍是旧版   | 业务网关指向地址、缓存、发布目录软链接及完整资源版本                            |

## 11. 参考入口

- [项目源码与接入文档](https://github.com/emeiziying/chat-demo/tree/feature/floating-widget)
- [固定代码基线：组件接口](https://github.com/emeiziying/chat-demo/blob/c1da8a78781dfcd48793ee6cf46077db5042e41a/COMPONENTS.md)
- [大屏卡片在线演示](https://emeiziying.github.io/chat-demo/screen-demo.html)
- [普通浮窗在线演示](https://emeiziying.github.io/chat-demo/widget-demo.html)
- [Nginx proxy_pass：路径替换](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass)
- [Nginx proxy_buffering：流式响应缓冲](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering)
- [Nginx root：静态目录映射](https://nginx.org/en/docs/http/ngx_http_core_module.html#root)
