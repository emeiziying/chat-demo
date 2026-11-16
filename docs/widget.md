# 业务系统浮窗接入

构建后将 `dist/` 全部部署到业务系统的 `/assistant/` 路径，访问
`/assistant/widget-demo.html` 体验。原 `/assistant/index.html` 保持独立聊天模式。
无需增加生产依赖，也不需要业务系统使用 React。

## 最小接入

在业务系统顶层布局中引入脚本，只挂载一次：

```html
<script src="/assistant/widget.js"></script>
<script>
  const assistant = DeepSeekWidget.mount({
    src: '/assistant/index.html',
    title: '智能助手',
    namespace: 'tenant-001:user-123',
    locale: 'zh-CN',
    theme: 'system',
  })
</script>
```

`src` 默认取 `widget.js` 同目录的 `index.html`，仅接受 HTTP/HTTPS。
`title` 使用纯文本；`locale` 支持 `zh-CN` / `en-US`；`theme` 支持
`light` / `dark` / `system` / `screen`。前三者控制聊天内容，外层窗口保持浅色；
`screen` 同时提供大屏深色外壳与会话主题，详见下方大屏卡片模式。
不传语言和主题时沿用聊天页设置。脚本应在 body 存在后执行。

`namespace` 可选，支持 1–128 位字母、数字、`_ . : @ -`。业务系统应使用稳定且不含敏感信息的
租户/用户标识，身份确认后再挂载。它同时隔离 IndexedDB 和 localStorage；
未传时沿用原 `chat-demo` 存储。**命名空间只是本地数据分区，不是权限控制。**
同一来源的脚本仍能访问这些数据；真实用户权限必须由业务后端验证。

```js
assistant.open() // 第一次打开才加载 iframe
assistant.close() // 最小化，保留 iframe、草稿与进行中的文字生成
assistant.destroy() // 卸载 iframe 与监听器，停止其请求和麦克风；不会删除已保存记录
```

重复 `mount()` 返回当前实例，不会重复创建窗口；要更换配置或账号，先 `destroy()`，
再使用新用户的 namespace 重新 `mount()`。组件卸载时调用 `destroy()`。
最小化会取消录音、取消转写、停止朗读，重新打开时不自动恢复麦克风。
宿主标题栏、启动按钮支持键盘操作；焦点位于宿主浮窗控件时按 Escape 可最小化。
手机宽度下聊天窗口铺满页面。

## 与独立页面的差异

iframe 使用 `?mode=embed&parentOrigin=...&namespace=...` 进入嵌入模式，
不在初始化时强制弹出 API Key 设置。首次发送、上传、录音时仍会检查 Key，
也可以从历史会话抽屉底部的设置入口填写。
原有聊天、历史记录、附件和语音服务复用。窄窗口采用现有抽屉布局；
桌面鼠标操作保留输入框，手机触控录音显示频谱。

父子页面只接受来自指定 origin 和窗口的消息：

| 消息                   | 方向          | 内容                      |
| ---------------------- | ------------- | ------------------------- |
| `assistant:ready`      | 聊天页 → 宿主 | 通知桥接监听器已就绪      |
| `assistant:init`       | 宿主 → 聊天页 | `locale`、`theme`         |
| `assistant:visibility` | 宿主 → 聊天页 | `visible`，隐藏时释放语音 |

没有通过消息传递 API Key、自动注入业务上下文或执行宿主操作的能力。

## API 与登录接入边界

默认沿用 DeepSeek API Key 直连，Key 保存在当前 namespace 的 localStorage。
这适用于个人使用或各用户提供自己的 Key。**不要把公司共享 Key 写进接入脚本。**
此 fork 没有添加服务端、SSO 或服务端会话同步，也没有真实业务系统的登录配置。

接入企业登录时，需要业务后端提供代理，校验业务登录态和文件归属，保管上游 Key。
可以用构建期变量指定 API 根地址：

```sh
CHAT_API_ORIGIN=https://business.example.com/assistant-api pnpm build
```

前端还需要配套调整 `src/services/api/client.ts`、`src/services/api/speech.ts` 和
`ensureApiKey()`，使用业务鉴权方式。仅设置根地址不会自动实现 SSO。
代理应覆盖 `/anthropic/v1/messages`、`/anthropic/v1/files`、`/v1/tools/asr`、
`/v1/tools/tts` 等原项目请求，并及时转发 SSE 和音频流。

## 部署注意

- 推荐同源 HTTPS 部署，避免第三方存储限制，并支持麦克风。
- iframe 已声明 `allow="microphone"`。跨源部署时，宿主 Permissions Policy
  仍须允许该来源使用麦克风；聊天页 CSP `frame-ancestors` 也须允许业务系统嵌入。
- 宿主 CSP 的 `script-src`、`frame-src` 需允许脚本及聊天页来源。
  加载器目前动态创建 Shadow DOM 内联样式；禁止内联样式的站点需先适配 nonce 或样式资源。
- 本地聊天记录仍只在当前浏览器内，清理站点数据会删除记录，不会删除远端已上传文件。
- 嵌入页面保留原语音的 HTTPS、授权和浏览器支持要求。

## 验收

运行 `pnpm type`、`pnpm lint`、`pnpm build`；部署构建产物后验证：
懒加载、反复展开收起、草稿保留、历史抽屉、命名空间隔离、桌面/手机布局、卸载重挂载。
没有真实 Key 时可验证界面和桥接；ASR/TTS、真实文件解析与模型回答需要有效 Key 联调。

### 可重复的浏览器回归

`tests/widget-smoke.js` 为 Playwright CLI 的 `run-code` 脚本，固定针对本机 8090
静态服务，不调用真实模型服务；请在独立测试浏览器上下文运行。需要单独可用的
`@playwright/cli`（未增加项目依赖）。

```sh
pnpm build
python3 -m http.server 8090 --bind 127.0.0.1 --directory dist
# 另一个终端
mkdir -p output/playwright
npx --package @playwright/cli playwright-cli -s=widget open http://127.0.0.1:8090/widget-demo.html
npx --package @playwright/cli playwright-cli -s=widget run-code --filename tests/widget-smoke.js
```

截图保存到 `output/playwright/`。真实手机软键盘、麦克风和远端 ASR/TTS 仍需实机/有效 Key 验证。

## 大屏卡片模式

访问构建后的 `screen-demo.html`，查看示例能源大屏。页面使用模拟业务数据；
聊天默认仍需用户自己的 API Key，演示页不会假装已接入园区数据。

卡片模式直接显示输入区，没有悬浮启动按钮。点击右上角展开后，底部与宽度不变，
向上扩展到宿主容器顶部；恢复时回到原卡片高度。全过程不移动、不重建 iframe。

```html
<!-- 容器覆盖从光伏卡片顶部到助手卡片底部的完整右侧栏范围。 -->
<aside id="screen-assistant" class="screen-right-column">
  <section class="solar-card">光伏系统</section>
  <section class="carbon-card">能碳系统</section>
  <div class="assistant-placeholder" aria-hidden="true"></div>
</aside>
<script src="/assistant/widget.js"></script>
<script>
  const assistant = DeepSeekWidget.mount({
    src: '/assistant/index.html',
    container: '#screen-assistant', // 也可传 HTMLElement
    mode: 'card',
    theme: 'screen',
    title: 'AI智能体',
    namespace: 'tenant-001:user-123',
    locale: 'zh-CN',
  })
</script>
```

以下为 1920×1080 设计画布的布局示例，尺寸由宿主按实际设计调整：

```css
.screen-right-column {
  position: absolute;
  top: 100px;
  right: 20px;
  bottom: 20px;
  width: 420px;
  display: grid;
  grid-template-rows: 360px 275px 285px;
  gap: 20px;
  isolation: isolate;
  --assistant-card-height: 285px;
}
```

`container` 必须存在且具有 `position: relative / absolute / fixed`，其顶部就是展开的对齐线。
**不要只传底部 285px 小卡片的容器**，否则展开也只能填满这张小卡片。
容器内保留底部占位，防止覆盖展示的助手影响原有卡片布局。宿主不要对其设置裁切展开区的
`overflow: hidden`，也不要在其上放置更高层级、会遮住助手的卡片。

大屏使用 `transform: scale()` 时，将此容器放入同一个缩放画布。组件使用设计坐标，
不把浏览器视口像素混入大屏坐标；响应式变更容器高度后，展开仍自动对齐其顶部。
卡片模式不会套用普通浮窗在小屏上的全屏行为。

### 外部控制

```js
assistant.expand() // 向上展开到容器顶部
assistant.collapse() // 恢复小卡片
assistant.toggleExpanded() // 切换
assistant.open() // 确保可见，不改变展开状态
assistant.close() // card 模式下等同 collapse，不隐藏聊天
assistant.destroy() // 卸载

document
  .querySelector('#screen-assistant')
  .addEventListener('assistant:expand-change', (event) => console.log(event.detail.expanded))
```

事件从 widget 宿主冒泡到容器，携带 `{ expanded: boolean }`，只在状态实际变化时触发。
卡片恢复后仍可直接问答，所以恢复操作不会停止录音或文字生成；销毁会释放 iframe 资源。
如宿主页面整体被隐藏或切换业务账号，请调用 `destroy()`，需要时重新挂载。

### 会话窗口样式

`theme: 'screen'` 为临时的深蓝青色主题，不覆盖用户保存的 light/dark/system 偏好。
普通页面与普通浮窗保持原样。`presentation=card` 会压缩导航、输入区和消息间距，
隐藏底部提示，保留历史抽屉和设置。只改变可用高度，不在展开时放大字号。

样式分为两层：

1. 外壳由 `public/widget.js` 的 Shadow DOM 控制，可在宿主容器设置以下变量：

   ```css
   .screen-right-column {
     --assistant-card-height: 285px;
     --assistant-surface: #102d40f5;
     --assistant-border: #69c6e847;
     --assistant-text: #eaf6ff;
     --assistant-accent: #35c6b4;
   }
   ```

2. iframe 内的聊天样式由 `src/embed/embed.css` 定义。`--chat-surface`、
   `--chat-input-bg`、`--chat-text`、`--chat-text-secondary`、`--chat-border`、
   `--chat-accent`、`--chat-user-bubble`、`--chat-assistant-bubble`、`--chat-radius`
   映射到现有主题别名；组件通过 CSS Modules 中的 `data-presentation='card'`
   调整布局。修改这些源样式后重新构建。宿主 CSS 变量不会自动穿过 iframe。

用户消息为蓝色气泡，助手消息为浅透明气泡；代码、表格保留内部横向滚动，
消息区内部纵向滚动，输入区固定在聊天窗口底部。设置面板在小卡片内滚动，
无需先展开才能访问。

大屏验证脚本：

```sh
npx --package @playwright/cli playwright-cli -s=screen open http://127.0.0.1:8090/screen-demo.html
npx --package @playwright/cli playwright-cli -s=screen run-code --filename tests/screen-smoke.js
```

该脚本使用独立本地命名空间与假 Key，拦截所有上游请求，以本地 SSE 验证问答链路；
截图保存在 `output/playwright/screen-card.png` 和 `screen-expanded.png`。
