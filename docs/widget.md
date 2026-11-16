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
`light` / `dark` / `system`，只控制聊天内容，外层窗口保持浅色。
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
