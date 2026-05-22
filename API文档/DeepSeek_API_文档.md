# DeepSeek API 完整文档

> 来源：https://api-docs.deepseek.com/zh-cn/
> 整理日期：2026-05-07

---

## 目录

1. [概述与快速开始](#1-概述与快速开始)
2. [模型与价格](#2-模型与价格)
3. [Token 用量计算](#3-token-用量计算)
4. [限速策略](#4-限速策略)
5. [错误码](#5-错误码)
6. [API 参考 — 对话补全](#6-api-参考--对话补全)
7. [API 参考 — 模型列表](#7-api-参考--模型列表)
8. [思考模式](#8-思考模式)
9. [多轮对话](#9-多轮对话)
10. [对话前缀续写（Beta）](#10-对话前缀续写beta)
11. [FIM 补全（Beta）](#11-fim-补全beta)
12. [JSON Output](#12-json-output)
13. [Tool Calls（函数调用）](#13-tool-calls函数调用)
14. [上下文硬盘缓存](#14-上下文硬盘缓存)
15. [Anthropic API 兼容](#15-anthropic-api-兼容)
16. [接入 Agent 工具](#16-接入-agent-工具)
17. [常见问题](#17-常见问题)

---

## 1. 概述与快速开始

DeepSeek API 使用与 **OpenAI / Anthropic 兼容**的 API 格式。通过修改配置，您可以使用 OpenAI / Anthropic SDK 来访问 DeepSeek API，或使用与 OpenAI / Anthropic API 兼容的软件。

### 基本配置

| 参数 | 值 |
|---|---|
| Base URL (OpenAI 格式) | `https://api.deepseek.com` |
| Base URL (Anthropic 格式) | `https://api.deepseek.com/anthropic` |
| API Key | 前往 [DeepSeek Platform](https://platform.deepseek.com) 申请 |
| 认证方式 | Bearer Token（HTTP Authorization Header） |

### 可用模型

| 模型 ID | 说明 |
|---|---|
| `deepseek-v4-flash` | DeepSeek-V4-Flash，支持非思考与思考模式 |
| `deepseek-v4-pro` | DeepSeek-V4-Pro，支持非思考与思考模式 |
| `deepseek-chat` | **将于 2026/07/24 弃用**，对应 deepseek-v4-flash 的非思考模式 |
| `deepseek-reasoner` | **将于 2026/07/24 弃用**，对应 deepseek-v4-flash 的思考模式 |

### 快速调用示例

#### cURL

```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "thinking": {"type": "enabled"},
    "reasoning_effort": "high",
    "stream": false
  }'
```

#### Python（OpenAI SDK）

```python
# pip install openai
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get('DEEPSEEK_API_KEY'),
    base_url="https://api.deepseek.com"
)

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "Hello"},
    ],
    stream=False,
    reasoning_effort="high",
    extra_body={"thinking": {"type": "enabled"}}
)

print(response.choices[0].message.content)
```

#### Node.js（OpenAI SDK）

```javascript
// npm install openai
import OpenAI from "openai";

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
});

async function main() {
    const completion = await openai.chat.completions.create({
        messages: [{ role: "system", content: "You are a helpful assistant." }],
        model: "deepseek-v4-pro",
        thinking: {"type": "enabled"},
        reasoning_effort: "high",
        stream: false,
    });
    console.log(completion.choices[0].message.content);
}
main();
```

---

## 2. 模型与价格

价格以 **百万 tokens** 为单位（人民币）。

### 模型细节对比

| 特性 | deepseek-v4-flash | deepseek-v4-pro |
|---|---|---|
| 模型版本 | DeepSeek-V4-Flash | DeepSeek-V4-Pro |
| 思考模式 | 支持非思考与思考模式（默认） | 支持非思考与思考模式（默认） |
| 上下文长度 | 1M tokens | 1M tokens |
| 最大输出长度 | 384K tokens | 384K tokens |
| JSON Output | 支持 | 支持 |
| Tool Calls | 支持 | 支持 |
| 对话前缀续写（Beta） | 支持 | 支持 |
| FIM 补全（Beta） | 仅非思考模式 | 仅非思考模式 |

### 价格明细

| 项目 | deepseek-v4-flash | deepseek-v4-pro（2.5折优惠） |
|---|---|---|
| 输入（缓存命中）(1) | ¥0.02/百万tokens | ¥0.1/百万tokens |
| 输入（缓存未命中） | ¥1/百万tokens | ¥3/百万tokens（原价 ¥12） |
| 输出 | ¥2/百万tokens | ¥6/百万tokens（原价 ¥24） |

> (1) 全系列模型，输入缓存命中的价格已降至首发价格的 1/10，自北京时间 2026/4/26 20:15 起生效。
>
> (2) deepseek-v4-pro 当前 2.5 折优惠，延长至北京时间 2026/05/31 23:59。

### 扣费规则

- 扣减费用 = token 消耗量 × 模型单价
- 费用直接从充值余额或赠送余额中扣减
- 充值余额与赠送余额同时存在时，**优先扣减赠送余额**
- 充值余额**永久有效**，赠送余额有效期见账单页面

---

## 3. Token 用量计算

Token 是模型表示自然语言文本的基本单位，也是计费单元。

### 换算比例

- **1 个英文字符 ≈ 0.3 个 token**
- **1 个中文字符 ≈ 0.6 个 token**

> 不同模型的分词不同，实际 token 数以模型返回的 `usage` 字段为准。

### 离线计算

可通过 `deepseek_tokenizer.zip` 中的代码运行 tokenizer 进行离线计算。

---

## 4. 限速策略

- DeepSeek API 根据负载情况**动态限制用户并发量**
- 达到并发上限时，立即返回 **HTTP 429**
- 请求等待调度期间：
  - 非流式请求：持续返回空行
  - 流式请求：持续返回 SSE keep-alive 注释（`: keep-alive`）
- 这些内容不影响 JSON body 的解析
- **10 分钟**后请求仍未开始推理，服务器将关闭连接

---

## 5. 错误码

| 错误码 | 描述 | 原因与解决方法 |
|---|---|---|
| **400** | 格式错误 | 请求体格式错误，请根据错误信息修改请求体 |
| **401** | 认证失败 | API key 错误，请检查或重新创建 API key |
| **402** | 余额不足 | 请确认账户余额并前往充值页面充值 |
| **422** | 参数错误 | 请求体参数错误，请根据错误信息修改相关参数 |
| **429** | 请求速率达到上限 | 请求速率（TPM 或 RPM）达到上限，请合理规划请求速率 |
| **500** | 服务器故障 | 服务器内部故障，请等待后重试；若持续存在请联系技术支持 |
| **503** | 服务器繁忙 | 服务器负载过高，请稍后重试 |

---

## 6. API 参考 — 对话补全

```
POST /chat/completions
```

根据输入的上下文，让模型补全对话内容。

### 请求参数（Request Body）

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `messages` | object[] | 是 | 对话消息列表，至少 1 条 |
| `model` | string | 是 | 模型 ID：`deepseek-v4-flash`、`deepseek-v4-pro` |
| `thinking` | object | 否 | 控制思考模式开关 |
| `thinking.type` | string | 否 | `enabled`（默认）或 `disabled` |
| `reasoning_effort` | string | 否 | 推理强度：`high`（默认）或 `max` |
| `max_tokens` | integer | 否 | 限制模型生成的最大 token 数 |
| `response_format` | object | 否 | 输出格式，设为 `{"type": "json_object"}` 启用 JSON 模式 |
| `stop` | string / string[] | 否 | 停止生成的字符串，最多 16 个 |
| `stream` | boolean | 否 | 是否以 SSE 流式发送，默认 false |
| `stream_options` | object | 否 | 流式输出选项（仅 stream=true 时生效） |
| `stream_options.include_usage` | boolean | 否 | 是否在流式消息最后返回 usage 统计 |
| `temperature` | number | 否 | 采样温度，0~2，默认 1。思考模式下不生效 |
| `top_p` | number | 否 | 核采样概率，≤1，默认 1。思考模式下不生效 |
| `tools` | object[] | 否 | 可调用的工具列表（仅支持 function），最多 128 个 |
| `tool_choice` | string/object | 否 | 工具调用策略：`none`/`auto`/`required`/指定函数 |
| `logprobs` | boolean | 否 | 是否返回输出 token 的对数概率 |
| `top_logprobs` | integer | 否 | 每个位置返回概率 top N 的 token（0~20） |
| `user_id` | string | 否 | 自定义用户 ID，用于内容安全审查和 KVCache 隔离 |

#### 消息类型（messages）

**System 消息：**
```json
{"role": "system", "content": "你是一个有帮助的助手", "name": "可选名称"}
```

**User 消息：**
```json
{"role": "user", "content": "你好", "name": "可选名称"}
```

**Assistant 消息：**
```json
{
  "role": "assistant",
  "content": "回复内容",
  "reasoning_content": "思维链内容（思考模式）",
  "prefix": false
}
```

**Tool 消息：**
```json
{"role": "tool", "content": "工具返回结果", "tool_call_id": "call_xxx"}
```

### 响应格式

#### 非流式响应

```json
{
  "id": "930c60df-bf64-41c9-a88e-3ec75f81e00e",
  "object": "chat.completion",
  "created": 1705651092,
  "model": "deepseek-v4-pro",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?",
        "reasoning_content": "思维链内容（仅思考模式）",
        "tool_calls": null
      },
      "finish_reason": "stop",
      "logprobs": null
    }
  ],
  "usage": {
    "prompt_tokens": 16,
    "completion_tokens": 10,
    "total_tokens": 26,
    "prompt_cache_hit_tokens": 0,
    "prompt_cache_miss_tokens": 16,
    "completion_tokens_details": {
      "reasoning_tokens": 0
    }
  }
}
```

#### 流式响应

流式输出以 SSE 格式返回，每个 chunk 结构如下：

```
data: {"id":"xxx","choices":[{"index":0,"delta":{"content":"Hello","role":"assistant"},"finish_reason":null}],"model":"deepseek-v4-pro","object":"chat.completion.chunk"}
data: {"id":"xxx","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}],"model":"deepseek-v4-pro","object":"chat.completion.chunk"}
...
data: {"id":"xxx","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"completion_tokens":9,"prompt_tokens":17,"total_tokens":26}}
data: [DONE]
```

### finish_reason 枚举值

| 值 | 说明 |
|---|---|
| `stop` | 模型自然停止生成，或遇到 stop 序列 |
| `length` | 输出达到模型上下文长度限制或 max_tokens 限制 |
| `content_filter` | 输出内容触发过滤策略被过滤 |
| `tool_calls` | 模型请求调用工具 |
| `insufficient_system_resource` | 系统推理资源不足，生成被打断 |

---

## 7. API 参考 — 模型列表

```
GET /models
```

列出可用的模型列表。

### 响应示例

```json
{
  "object": "list",
  "data": [
    {"id": "deepseek-v4-flash", "object": "model", "owned_by": "deepseek"},
    {"id": "deepseek-v4-pro", "object": "model", "owned_by": "deepseek"}
  ]
}
```

---

## 8. 思考模式

DeepSeek 模型支持思考模式：在输出最终回答之前，模型会先输出一段**思维链内容**（reasoning_content），以提升最终答案的准确性。

### 思考模式开关与思考强度

| 功能 | OpenAI 格式 | Anthropic 格式 |
|---|---|---|
| 思考模式开关 | `{"thinking": {"type": "enabled/disabled"}}` | — |
| 思考强度控制 | `{"reasoning_effort": "high/max"}` | `{"output_config": {"effort": "high/max"}}` |

- 默认思考开关为 `enabled`
- 普通请求默认 effort 为 `high`；复杂 Agent 类请求（如 Claude Code、OpenCode）自动设置为 `max`
- 兼容映射：`low`/`medium` → `high`，`xhigh` → `max`

### 使用注意事项

- 思考模式**不支持** `temperature`、`top_p`、`presence_penalty`、`frequency_penalty` 参数（设置不会报错，但不会生效）
- 思维链内容通过 `reasoning_content` 参数返回，与 `content` 同级
- 使用 OpenAI SDK 时，`thinking` 参数需传入 `extra_body`：

```python
response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    reasoning_effort="high",
    extra_body={"thinking": {"type": "enabled"}}
)
```

### 多轮对话中的 reasoning_content 处理

- **无工具调用时**：两个 user 消息之间，assistant 的 `reasoning_content` 无需参与上下文拼接，传入 API 会被忽略
- **有工具调用时**：两个 user 消息之间，assistant 的 `reasoning_content` **必须**参与上下文拼接，在后续所有轮次中必须回传给 API

### 思考模式下的工具调用示例

```python
import os
import json
from openai import OpenAI
from datetime import datetime

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather of a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "The city name"},
                    "date": {"type": "string", "description": "Date in YYYY-mm-dd"},
                },
                "required": ["location", "date"]
            },
        }
    },
]

client = OpenAI(
    api_key=os.environ.get('DEEPSEEK_API_KEY'),
    base_url="https://api.deepseek.com"
)

messages = [{"role": "user", "content": "How's the weather in Hangzhou tomorrow?"}]

while True:
    response = client.chat.completions.create(
        model='deepseek-v4-pro',
        messages=messages,
        tools=tools,
        reasoning_effort="high",
        extra_body={"thinking": {"type": "enabled"}},
    )
    # 直接 append 整个 message 对象，包含 reasoning_content
    messages.append(response.choices[0].message)

    if response.choices[0].message.tool_calls is None:
        break

    # 处理工具调用...
```

---

## 9. 多轮对话

DeepSeek `/chat/completions` API 是**无状态 API**，服务端不记录用户请求的上下文。用户在每次请求时，需将之前所有对话历史拼接好后传递给 API。

### 示例代码

```python
from openai import OpenAI

client = OpenAI(api_key="<DeepSeek API Key>", base_url="https://api.deepseek.com")

# Round 1
messages = [{"role": "user", "content": "What's the highest mountain in the world?"}]
response = client.chat.completions.create(model="deepseek-v4-pro", messages=messages)
messages.append(response.choices[0].message)

# Round 2
messages.append({"role": "user", "content": "What is the second?"})
response = client.chat.completions.create(model="deepseek-v4-pro", messages=messages)
messages.append(response.choices[0].message)
```

### 上下文拼接规则

第二轮请求时传递给 API 的 messages：

```json
[
    {"role": "user", "content": "What's the highest mountain in the world?"},
    {"role": "assistant", "content": "The highest mountain in the world is Mount Everest."},
    {"role": "user", "content": "What is the second?"}
]
```

---

## 10. 对话前缀续写（Beta）

对话前缀续写沿用 Chat Completion API，用户提供 assistant 开头的消息来让模型补全其余内容。

### 注意事项

- messages 列表里最后一条消息的 role 必须为 `assistant`，并设置 `prefix` 参数为 `True`
- 需设置 `base_url="https://api.deepseek.com/beta"` 来开启 Beta 功能

### 示例代码

```python
from openai import OpenAI

client = OpenAI(
    api_key="<your api key>",
    base_url="https://api.deepseek.com/beta",
)

messages = [
    {"role": "user", "content": "Please write quick sort code"},
    {"role": "assistant", "content": "```python\n", "prefix": True}
]

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    stop=["```"],
)

print(response.choices[0].message.content)
```

---

## 11. FIM 补全（Beta）

FIM（Fill In the Middle）补全：用户提供前缀和后缀（可选），模型补全中间的内容。常用于内容续写、代码补全等场景。

### 注意事项

- 模型最大补全长度为 **4K tokens**
- 需设置 `base_url="https://api.deepseek.com/beta"` 来开启 Beta 功能

### 示例代码

```python
from openai import OpenAI

client = OpenAI(
    api_key="<your api key>",
    base_url="https://api.deepseek.com/beta",
)

response = client.completions.create(
    model="deepseek-v4-pro",
    prompt="def fib(a):",
    suffix="    return fib(a-1) + fib(a-2)",
    max_tokens=128
)

print(response.choices[0].text)
```

---

## 12. JSON Output

确保模型输出合法的 JSON 字符串，便于后续逻辑解析。

### 使用方法

1. 设置 `response_format` 参数为 `{"type": "json_object"}`
2. 用户传入的 system 或 user prompt 中**必须含有 "json" 字样**，并给出希望模型输出的 JSON 格式样例
3. 合理设置 `max_tokens`，防止 JSON 被中途截断

### 示例代码

```python
import json
from openai import OpenAI

client = OpenAI(
    api_key="<your api key>",
    base_url="https://api.deepseek.com",
)

system_prompt = """The user will provide some exam text. Please parse the "question" and "answer" and output them in JSON format.
EXAMPLE INPUT: Which is the highest mountain in the world? Mount Everest.
EXAMPLE JSON OUTPUT:
{
    "question": "Which is the highest mountain in the world?",
    "answer": "Mount Everest"
}"""

user_prompt = "Which is the longest river in the world? The Nile River."
messages = [
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": user_prompt}
]

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    response_format={'type': 'json_object'}
)

print(json.loads(response.choices[0].message.content))
# 输出: {"question": "Which is the longest river in the world?", "answer": "The Nile River"}
```

---

## 13. Tool Calls（函数调用）

Tool Calls 让模型能够调用外部工具来增强自身能力。

### 非思考模式示例

```python
from openai import OpenAI

client = OpenAI(
    api_key="<your api key>",
    base_url="https://api.deepseek.com",
)

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather of a location, the user should supply a location first.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    }
                },
                "required": ["location"]
            },
        }
    },
]

messages = [{"role": "user", "content": "How's the weather in Hangzhou, Zhejiang?"}]

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    tools=tools
)

message = response.choices[0].message
tool = message.tool_calls[0]
print(f"Function: {tool.function.name}, Args: {tool.function.arguments}")

# 模型本身不执行具体函数，需用户自行调用后将结果传回
messages.append(message)
messages.append({"role": "tool", "tool_call_id": tool.id, "content": "24°C"})

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=messages,
    tools=tools
)
print(response.choices[0].message.content)
```

### 思考模式下的工具调用

从 DeepSeek-V3.2 开始，API 支持思考模式下的工具调用。**关键区别**：进行了工具调用的轮次，在后续所有请求中**必须完整回传 `reasoning_content`** 给 API。

### Strict 模式（Beta）

在 strict 模式下，模型输出的 Function 调用会严格遵循 JSON Schema 格式要求。

**使用条件：**
1. 设置 `base_url="https://api.deepseek.com/beta"`
2. 所有 function 均需设置 `strict` 属性为 `true`

```json
{
    "type": "function",
    "function": {
        "name": "get_weather",
        "strict": true,
        "description": "Get weather of a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "The city name"}
            },
            "required": ["location"],
            "additionalProperties": false
        }
    }
}
```

**Strict 模式支持的 JSON Schema 类型：**

| 类型 | 支持的参数 | 不支持的参数 |
|---|---|---|
| `object` | properties, required, additionalProperties(false) | — |
| `string` | pattern, format (email/hostname/ipv4/ipv6/uuid) | minLength, maxLength |
| `number`/`integer` | const, default, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf | — |
| `array` | items | minItems, maxItems |
| `enum` | 枚举值约束 | — |
| `anyOf` | 多 schema 匹配 | — |
| `$ref` / `$def` | 模块化引用、递归结构 | — |

---

## 14. 上下文硬盘缓存

DeepSeek API 的上下文硬盘缓存技术**对所有用户默认开启**，无需修改代码即可享用。

### 缓存机制

- 每个请求都会触发硬盘缓存的构建
- 后续请求与之前请求在前缀上存在重复时，重复部分从缓存中拉取，计入"缓存命中"

### 缓存前缀落盘时机

1. **请求结束位置落盘**：每次请求的用户输入结束位置与模型输出结束位置，各产生一个缓存前缀单元
2. **公共前缀检测落盘**：系统检测到多次请求之间存在公共前缀时，将公共前缀作为独立缓存前缀单元落盘
3. **按固定 token 间隔落盘**：在长输入或长输出中，以一定 token 数量为间隔截取缓存前缀单元

### 缓存命中示例

**例一：多轮对话**

```
请求1: messages: [system: "你是一位助手", user: "中国首都是哪里？"]
请求2: messages: [system: "你是一位助手", user: "中国首都是哪里？", assistant: "北京", user: "美国首都是哪里？"]
```

→ 请求2 能完整复用请求1 的缓存前缀单元，命中缓存。

**例二：长文本问答**

```
请求1: [system + user: "<财报内容>\n请总结关键信息"]
请求2: [system + user: "<财报内容>\n请分析盈利情况"]    → 不命中（A+C 不能匹配 A+B）
请求3: [system + user: "<财报内容>\n请分析收入与支出"]  → 命中公共前缀 A 的缓存
```

### 查看缓存命中情况

在 API 返回的 `usage` 字段中：

```json
{
  "prompt_cache_hit_tokens": 100,
  "prompt_cache_miss_tokens": 50
}
```

### 其他说明

- 缓存系统是"尽力而为"，**不保证 100% 缓存命中**
- 缓存构建耗时为秒级
- 缓存不再使用后会自动清空，一般为几小时到几天
- 硬盘缓存不影响输出随机性，输出仍受 `temperature` 等参数影响

---

## 15. Anthropic API 兼容

DeepSeek API 支持 Anthropic API 格式，`base_url` 为 `https://api.deepseek.com/anthropic`。

### 接入 Claude Code

DeepSeek 可直接作为 Claude Code 的后端模型使用，详见 Agent 工具接入指南。

### 通过 Anthropic SDK 调用

```bash
pip install anthropic
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
export ANTHROPIC_API_KEY=${YOUR_API_KEY}
```

```python
import anthropic

client = anthropic.Anthropic()
message = client.messages.create(
    model="deepseek-v4-pro",
    max_tokens=1000,
    system="You are a helpful assistant.",
    messages=[
        {
            "role": "user",
            "content": [{"type": "text", "text": "Hi, how are you?"}]
        }
    ]
)
print(message.content)
```

> **注意**：传入不支持的模型名时，API 后端会自动映射到 `deepseek-v4-flash`。

### Anthropic API 兼容性细节

**HTTP Header：**

| 字段 | 支持状态 |
|---|---|
| `anthropic-beta` | 忽略 |
| `anthropic-version` | 忽略 |
| `x-api-key` | 完全支持 |

**Simple Fields：**

| 字段 | 支持状态 |
|---|---|
| `model` | 使用 DeepSeek 模型名 |
| `max_tokens` | 完全支持 |
| `stop_sequences` | 完全支持 |
| `stream` | 完全支持 |
| `system` | 完全支持 |
| `temperature` | 完全支持（范围 0.0~2.0） |
| `thinking` | 支持（budget_tokens 被忽略） |
| `output_config` | 仅支持 effort |
| `top_p` | 完全支持 |
| `container`, `mcp_servers`, `metadata`, `service_tier`, `top_k` | 忽略 |

**Tools 字段：**

| 字段 | 支持状态 |
|---|---|
| `tools.name` | 完全支持 |
| `tools.input_schema` | 完全支持 |
| `tools.description` | 完全支持 |
| `tools.cache_control` | 忽略 |
| `tool_choice` (none/auto/any/tool) | 支持（disable_parallel_tool_use 被忽略） |

**Message Content 类型：**

| 类型 | 支持状态 |
|---|---|
| `text` | 完全支持 |
| `thinking` | 支持 |
| `tool_use` | 完全支持 |
| `tool_result` | 完全支持 |
| `image` / `document` / `search_result` / `redacted_thinking` / `server_tool_use` / `web_search_tool_result` / `code_execution_tool_result` / `mcp_tool_use` / `mcp_tool_result` / `container_upload` | 不支持 |

---

## 16. 接入 Agent 工具

DeepSeek API 已接入多种主流 AI Agent 与编程助手工具：

- **Claude Code**
- **GitHub Copilot**
- **OpenCode**

无需编写代码即可将 DeepSeek 作为后端模型使用。

---

## 17. 常见问题

### 账号问题

**Q：账号无法登录，提示"已被临时停用"？**
A：账号因可能违反平台使用规范触发了停用规则。可填写「账号停用申诉」表单，审核用时约 3 个工作日。

**Q：邮箱无法注册？**
A：当前邮箱域名暂不在支持列表中，建议使用 Gmail、Outlook、Hotmail、Yahoo 等国际通用邮箱注册。

**Q：如何注销账号？**
A：路径：「个人信息」→「注销」。注意：会连同 chat 平台一同注销，所有对话记录将被永久清空，未消费余额视为自愿放弃。

### 实名认证

- 个人与企业实名认证在权益和功能上目前没有区别
- 个人认证可变更为企业认证：「充值」→「对公汇款」→「企业实名认证」→「去变更」
- 企业认证**不可**变更为个人认证

### 财务问题

**Q：如何充值？**
A：在线充值（支付宝/微信）或对公汇款（仅企业用户）。

**Q：余额是否会过期？**
A：充值余额永久有效。赠送余额有效期见「账单」页面。

**Q：如何申请发票？**
A：访问「账单」页面 → 「发票管理」。企业用户发票抬头需与实名认证信息一致，开票周期约 7 个工作日。

**Q：是否可以退款？**
A：未消费金额支持退款。在线支付在「账单」→「退款管理」自助操作；企业对公转账需填写工单。

### API 调用问题

**Q：并发限制是多少？**
A：当前没有硬性并发上限。系统总负载较高时，动态限流模型可能导致 503 或 429 错误。暂不支持针对单个账号提高并发上限。

**Q：为什么 API 返回比网页端慢？**
A：网页端默认使用流式输出（stream=true），API 默认使用非流式输出（stream=false）。开启 stream 模式可提升交互性。

**Q：调用 API 时持续返回空行？**
A：为保持 TCP 连接不超时，等待调度期间会返回空行（非流式）或 SSE keep-alive 注释（流式）。自行解析 HTTP 响应时需注意处理。

**Q：是否支持 LangChain？**
A：支持。LangChain 支持 OpenAI API 接口，DeepSeek API 与之兼容。

**Q：如何离线计算 Tokens 用量？**
A：使用 `deepseek_tokenizer.zip` 中的 tokenizer 代码。

---

## 附录：联系方式

- 技术支持邮箱：api-service@deepseek.com
- 服务条款：https://cdn.deepseek.com/policies/zh-CN/deepseek-open-platform-terms-of-service.html
- 许可证：MIT
- 平台地址：https://platform.deepseek.com
