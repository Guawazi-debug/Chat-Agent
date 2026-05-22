/**
 * AI chat application configuration.
 */

const APP_CONFIG = {
    appName: 'AI 对话系统',
    version: '1.1.0',
    storagePrefix: 'ai_chat_',
    defaultTheme: 'dark'
};

const DEFAULT_API_CONFIG = {
    mimo: {
        name: 'MiMo',
        provider: 'xiaomi',
        endpoint: 'https://api.xiaomimimo.com/v1/chat/completions',
        apiKey: (typeof API_SECRETS !== 'undefined' && API_SECRETS.mimo) || '',
        models: [
            'mimo-v2.5-pro',
            'mimo-v2.5',
            'mimo-v2-pro',
            'mimo-v2-omni'
        ],
        headers: {
            'Content-Type': 'application/json'
        }
    },
    deepseek: {
        name: 'DeepSeek',
        provider: 'deepseek',
        endpoint: 'https://api.deepseek.com/chat/completions',
        apiKey: (typeof API_SECRETS !== 'undefined' && API_SECRETS.deepseek) || '',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        headers: {
            'Content-Type': 'application/json'
        }
    },
    image: {
        name: 'GPT-Image-2',
        provider: 'openai',
        endpoint: 'https://zz.imzr.top/v1/images/generations',
        apiKey: '',
        models: ['gpt-image-2'],
        headers: {
            'Content-Type': 'application/json'
        }
    }
};

const MODEL_CONFIG = {
    displayNames: {
        'mimo-v2.5-pro': 'MiMo v2.5 Pro',
        'mimo-v2.5': 'MiMo v2.5',
        'mimo-v2-pro': 'MiMo v2 Pro',
        'mimo-v2-omni': 'MiMo v2 Omni',
        'mimo-v2-flash': 'MiMo v2 Flash',
        'deepseek-v4-flash': 'DeepSeek V4 Flash',
        'deepseek-v4-pro': 'DeepSeek V4 Pro',
        'gpt-image-2': 'GPT-Image-2'
    },
    providers: {
        'mimo-v2.5-pro': 'mimo',
        'mimo-v2.5': 'mimo',
        'mimo-v2-pro': 'mimo',
        'mimo-v2-omni': 'mimo',
        'mimo-v2-flash': 'mimo',
        'deepseek-v4-flash': 'deepseek',
        'deepseek-v4-pro': 'deepseek',
        'gpt-image-2': 'image'
    },
    // MiMo模型参数配置（思考模式下temperature会被强制设为1.0）
    modelParams: {
        'mimo-v2.5-pro': { temperature: 1.0, top_p: 0.95, temperatureRange: [0, 1.5], topPRange: [0.01, 1.0] },
        'mimo-v2.5': { temperature: 1.0, top_p: 0.95, temperatureRange: [0, 1.5], topPRange: [0.01, 1.0] },
        'mimo-v2-pro': { temperature: 1.0, top_p: 0.95, temperatureRange: [0, 1.5], topPRange: [0.01, 1.0] },
        'mimo-v2-omni': { temperature: 1.0, top_p: 0.95, temperatureRange: [0, 1.5], topPRange: [0.01, 1.0] },
        'mimo-v2-flash': { temperature: 0.3, top_p: 0.95, temperatureRange: [0, 1.5], topPRange: [0.01, 1.0] },
        'deepseek-v4-flash': { temperature: 0.7, top_p: 1.0 },
        'deepseek-v4-pro': { temperature: 0.7, top_p: 1.0 }
    },
    defaultParams: {
        temperature: 0.7,
        max_tokens: 4096,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
    }
};

const MEMORY_CONFIG = {
    maxContextMessages: 50,
    summaryThreshold: 30,
    enableLongTermMemory: true,
    autoSummarize: true,
    maxLongTermMemories: 100,
    relevanceThreshold: 0.5
};

const UI_CONFIG = {
    animationDelay: 100,
    typingSpeed: 20,
    toastDuration: 3000,
    maxMessageLength: 10000,
    autoScroll: true
};

const DEEPSEEK_THINKING_CONFIG = {
    enabled: true,
    reasoningEffort: 'high',
    displayMode: 'collapsible'
};

const ERROR_MESSAGES = {
    apiError: 'API 请求失败，请检查网络连接和 API 配置',
    apiKeyMissing: '请先配置 API 密钥',
    messageTooLong: '消息内容过长，请缩短消息',
    networkError: '网络连接错误，请检查网络设置',
    rateLimitError: '请求过于频繁，请稍后再试',
    unknownError: '发生未知错误，请重试',
    saveSuccess: '设置已保存',
    saveError: '保存设置失败',
    deleteSuccess: '已删除',
    deleteError: '删除失败'
};

const SYSTEM_PROMPTS = {
    default: `你是一个集成的全能智能体，具备以下能力：
- 智能意图识别：自动分析用户需求
- 图片理解：识别和分析图片内容
- 联网搜索：获取实时信息
- 深度思考：复杂问题推理分析
- 多领域问答：技术、商业、生活、学习等

回答要求：
1. 默认使用中文回答。
2. 禁止使用任何表情符号（如emoji）。
3. 回答要准确、完整、有条理。
4. 先给结论，再给关键依据和可执行建议。
5. 优先使用结构化表达，例如要点、步骤、表格或行动清单。
6. 对不确定信息要明确说明假设、限制和需要补充的数据，不编造事实。
7. 如果用户的问题含糊，先基于合理假设回答，并指出需要确认的关键点。
8. 涉及技术问题时，代码示例要简洁、可运行，并使用 Markdown 代码块。
9. 涉及商业问题时，关注目标、成本、风险、收益和落地路径。`,

    coder: `你是一个专业的软件工程顾问，是全能智能体的技术模块。默认使用中文回答，提供清晰、可维护、低风险的技术建议。

回答要求：
1. 禁止使用任何表情符号。
2. 先说明推荐方案和取舍，再给实现步骤。
3. 代码示例要简洁、可运行，并使用 Markdown 代码块。
4. 优先考虑可维护性、安全性、性能、兼容性和交付风险。
5. 不确定时说明假设，不随意引入新依赖。
6. 对线上项目要提醒测试、回滚、监控和配置风险。`,

    reasoner: `你是一个擅长逻辑推理和决策支持的分析引擎，是全能智能体的推理模块。默认使用中文回答，适合战略分析、方案评估、风险判断和复杂问题拆解。

回答要求：
1. 禁止使用任何表情符号。
2. 先给结论或建议方向，再展开分析。
3. 用清晰的框架拆解问题，例如目标、约束、选项、收益、风险、执行步骤。
4. 区分事实、假设和推论。
5. 对复杂问题给出优先级和下一步行动。
6. 不展示冗长推理链，只输出用户可用的分析摘要和判断依据。`
};

const WORKFLOW_PROMPTS = {
    userSegments: {
        executive: {
            label: '企业管理者/决策者',
            prompt: `当前用户更像企业管理者或决策者。回答要突出战略价值、业务影响、投入产出、风险控制、关键决策点和执行优先级。避免陷入过细执行细节，必要时给出管理层摘要。`
        },
        product: {
            label: '产品/运营负责人',
            prompt: `当前用户更像产品、运营或增长负责人。回答要围绕用户价值、场景拆解、需求优先级、增长指标、转化路径、实验方案和落地节奏。建议尽量能转化为 PRD、运营方案或行动清单。`
        },
        technical: {
            label: '技术/研发人员',
            prompt: `当前用户更像技术或研发人员。回答要关注架构可行性、实现路径、接口边界、数据结构、安全性、性能、测试和维护成本。涉及代码时保持简洁、准确、可执行。`
        },
        sales: {
            label: '销售/商务人员',
            prompt: `当前用户更像销售、商务或客户成功人员。回答要关注客户痛点、价值主张、异议处理、成交路径、沟通话术、方案包装和后续跟进。表达要专业可信，避免夸大承诺。`
        },
        general: {
            label: '通用用户',
            prompt: `当前用户身份不明确。回答要先满足当前问题，并在必要时补充面向不同角色的选项或追问关键背景。`
        }
    },
    intents: {
        strategy: {
            label: '战略/商业决策',
            prompt: `用户意图偏战略或商业决策。请优先输出：结论、核心判断、关键依据、机会与风险、推荐路径、近期行动。`
        },
        planning: {
            label: '方案/计划制定',
            prompt: `用户意图偏方案或计划制定。请优先输出：目标、约束、阶段拆解、负责人/资源、时间线、里程碑、验收指标。`
        },
        analysis: {
            label: '分析/诊断',
            prompt: `用户意图偏分析诊断。请优先输出：现象归纳、可能原因、验证方法、优先级、建议动作和需要补充的数据。`
        },
        writing: {
            label: '文案/商务表达',
            prompt: `用户意图偏文案或商务表达。请优先输出可直接使用的版本，并说明适用场景、语气和可替换变量。`
        },
        technical: {
            label: '技术实现',
            prompt: `用户意图偏技术实现。请优先输出技术方案、关键步骤、接口/数据设计、风险点、测试方法和必要代码示例。`
        },
        support: {
            label: '操作/问题支持',
            prompt: `用户意图偏操作支持或问题排查。请优先输出最可能原因、排查步骤、修复方案、验证方式和避免复发建议。`
        },
        general: {
            label: '通用问答',
            prompt: `用户意图较通用。请直接回答问题，保持结构清晰，并在必要时给出后续可选方向。`
        }
    },
    responsePolicy: `工作流要求：
1. 先识别用户意图和可能用户群体，再选择最匹配的回答框架。
2. 不要在回答中机械声明“我识别到你的身份/意图”，除非这有助于澄清问题。
3. 输出要像成熟商业对话系统：专业、简洁、有判断、有下一步。
4. 对信息不足的问题，先给可用答案，再列出需要确认的 2-4 个关键问题。
5. 涉及商业建议时，默认补充风险、成本、收益或衡量指标。`
};

window.APP_CONFIG = APP_CONFIG;
window.DEFAULT_API_CONFIG = DEFAULT_API_CONFIG;
window.MODEL_CONFIG = MODEL_CONFIG;
window.MEMORY_CONFIG = MEMORY_CONFIG;
window.UI_CONFIG = UI_CONFIG;
window.DEEPSEEK_THINKING_CONFIG = DEEPSEEK_THINKING_CONFIG;
window.ERROR_MESSAGES = ERROR_MESSAGES;
window.SYSTEM_PROMPTS = SYSTEM_PROMPTS;
window.WORKFLOW_PROMPTS = WORKFLOW_PROMPTS;

// ============ 统一工作流配置 ============

// 工作流模型配置
const WORKFLOW_MODELS = {
    // 意图识别阶段使用的模型
    intentAnalysis: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        thinking: false,  // 意图识别不需要深度思考，关闭以提高速度
        maxTokens: 1024   // 意图识别需要足够的token输出JSON
    },
    // 图片识别阶段使用的模型
    imageRecognition: {
        provider: 'mimo',
        model: 'mimo-v2.5',
        stream: false,
        maxTokens: 1024
    },
    // 联网搜索阶段使用的模型
    webSearch: {
        provider: 'mimo',
        model: 'mimo-v2.5-pro',
        stream: false,
        tools: true,
        maxTokens: 2048
    },
    // 最终回答阶段使用的模型
    finalAnswer: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        thinking: true,
        reasoningEffort: 'medium'  // 中等推理强度，平衡速度和质量
    }
};

// 流式响应UI更新节流间隔（毫秒）
const STREAM_THROTTLE_MS = 30;

// 工作流提示词
const WORKFLOW_SYSTEM_PROMPTS = {
    // 意图识别提示词
    intentAnalysis: `你是一个意图识别专家。分析用户的输入，判断以下几点：

1. **意图类型**：
   - simple_chat: 简单聊天/问候
   - question: 需要回答的问题
   - search: 需要搜索/查询的信息
   - task: 需要执行的任务
   - creative: 创意/写作需求
   - technical: 技术/编程问题
   - image_generation: 生成图片/画图/绘图需求

2. **是否需要搜索**：判断是否需要联网搜索获取最新信息

3. **是否需要生成图片**：判断用户是否想要生成图片（关键词：画、生成图片、绘制、做一张图、画一个、创建图片、图片生成等）

4. **关键信息提取**：提取用户问题的核心关键词

请以JSON格式返回：
{
    "intent": "意图类型",
    "needSearch": true/false,
    "needImageGeneration": true/false,
    "imagePrompt": "如果需要生成图片，提取图片描述提示词",
    "keywords": ["关键词1", "关键词2"],
    "summary": "一句话概括用户需求"
}`,

    // 图片识别提示词
    imageRecognition: `请详细描述这张图片的内容，包括：
1. 图片的主要内容和场景
2. 图片中的文字（如果有）
3. 图片的关键细节
4. 与用户问题相关的任何信息

返回结构化的描述，供后续分析使用。`,

    // 搜索结果分析提示词
    searchAnalysis: `基于搜索结果，提取与用户问题最相关的信息。要求：
1. 筛选最相关的结果
2. 提取关键信息
3. 整理成结构化的参考资料`,

    // 最终回答提示词
    finalAnswer: `你是一个集成的全能智能体，正在基于以下信息回答用户问题：
1. 用户的原始问题
2. 图片识别结果（如果有）
3. 联网搜索结果（如果有）
4. 意图分析结果

回答要求：
- 禁止使用任何表情符号（如emoji）
- 使用中文回答
- 准确、完整、有条理
- 如果有图片，结合图片内容回答
- 如果有搜索结果，引用可靠来源
- 先给结论，再给依据和建议
- 保持专业、简洁的语气`
};

// 工作流步骤超时配置
const WORKFLOW_TIMEOUT = {
    intent: 30000,    // 30秒
    image: 60000,     // 60秒
    search: 45000,    // 45秒
    answer: 120000    // 2分钟
};

window.WORKFLOW_MODELS = WORKFLOW_MODELS;
window.WORKFLOW_SYSTEM_PROMPTS = WORKFLOW_SYSTEM_PROMPTS;
window.WORKFLOW_TIMEOUT = WORKFLOW_TIMEOUT;
window.STREAM_THROTTLE_MS = STREAM_THROTTLE_MS;
