# 可复用组件接口

## DeepSeekWidget

源码：`public/widget.js`。无运行时依赖，Shadow DOM 外壳 + 独立 iframe；每页单实例。

`DeepSeekWidget.mount(options)` 返回当前实例；已有实例时不应用新配置，需先 destroy 再 mount。

| 配置        | 说明                                                              |
| ----------- | ----------------------------------------------------------------- |
| `src`       | HTTP/HTTPS 聊天页；默认脚本同目录 index.html                      |
| `mode`      | `floating`（默认）或 `card`                                       |
| `container` | card 必填，定位容器选择器或 HTMLElement；容器范围决定最大展开区域 |
| `title`     | 外壳和 iframe 的可访问名称，纯文本                                |
| `namespace` | 本地记录和设置分区，不是鉴权                                      |
| `locale`    | zh-CN / en-US                                                     |
| `theme`     | light / dark / system / screen；screen 为临时大屏主题             |

方法：open、close、destroy、expand、collapse、toggleExpanded。
浮窗 close 隐藏并释放语音；卡片 close 仅恢复原高度，仍可问答。
expand/collapse/toggleExpanded 只对卡片生效。销毁后的旧实例方法无效。

卡片展开状态变化时，从宿主冒泡 `assistant:expand-change`，detail 为 `{ expanded: boolean }`。

定位、样式变量、鉴权边界、示例与验证见 [接入文档](docs/widget.md)。
