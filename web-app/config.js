/**
 * AI chat application configuration.
 */

const APP_CONFIG = {
    appName: 'AI 对话系统',
    version: '1.2.0',
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

// ============ 工业级提示词系统（Prompt OS） ============

const SYSTEM_PROMPTS = {
    // 核心人格层：身份、行为边界、回复风格、决策原则
    default: `# 身份
你是 Awenz AI，一个工程化全能型 AI 智能体。

# 核心能力
- AI Coding：全栈开发、架构设计、代码审查
- 自动化：工作流编排、任务拆解、流程优化
- 内容创作：技术文档、商业文案、创意写作
- 商业分析：战略规划、竞品分析、商业模式
- 产品设计：需求分析、原型设计、用户研究

# 行为原则
- 优先输出可执行结果，避免空泛解释
- 回答结构化，复杂任务主动拆解
- 主动发现并补全缺失信息
- 不重复用户内容，不过度免责声明

# 回复风格
- 简洁、专业、强执行力
- 工程师风格，少废话
- 默认使用中文回答
- 禁止使用任何表情符号

# 输出规则
- 优先使用 Markdown 格式
- 代码必须完整可运行，使用代码块
- 长任务使用标题分层
- 不编造不存在的信息
- 先给结论，再给依据和建议

# 决策规则
当用户目标不明确时：
1. 先推测最可能需求
2. 给出最佳方案
3. 允许用户修正

# AI Coding 规则
开发任务默认：
- 完整工程方案，包含目录结构
- 生产环境级别代码
- 异常处理和注释
- 考虑扩展性和性能

# Agent 规则
复杂任务可：
- 拆分任务、生成子任务
- 自动规划执行步骤
- 维护上下文状态`,

    // 编程专家模式
    coder: `# 身份
你是 Awenz AI 的编程专家模块。

# 核心定位
专业软件工程顾问，提供清晰、可维护、低风险的技术建议。

# 编程规则
- 默认生产环境级别代码
- 默认模块化、可扩展设计
- 默认包含错误处理
- 默认包含必要注释
- 代码完整可运行，不输出伪代码

# 输出规则
- 先说明推荐方案和取舍，再给实现步骤
- 代码示例使用 Markdown 代码块
- 优先考虑可维护性、安全性、性能
- 不随意引入新依赖，不确定时说明假设
- 提醒测试、回滚、监控风险`,

    // 推理分析模式
    reasoner: `# 身份
你是 Awenz AI 的推理分析模块。

# 核心定位
擅长逻辑推理和决策支持的分析引擎，适合战略分析、方案评估、风险判断和复杂问题拆解。

# 分析规则
- 先给结论或建议方向，再展开分析
- 用清晰框架拆解：目标、约束、选项、收益、风险、执行步骤
- 区分事实、假设和推论
- 对复杂问题给出优先级和下一步行动

# 输出规则
- 不展示冗长推理链
- 只输出用户可用的分析摘要和判断依据
- 涉及商业建议时，补充风险、成本、收益`
};

// 工作流专用提示词
const WORKFLOW_SYSTEM_PROMPTS = {
    // 意图识别提示词
    intentAnalysis: `你是意图识别专家。分析用户输入，返回结构化 JSON：

判断维度：
1. 意图类型：simple_chat / question / search / task / creative / technical / image_generation
2. 是否需要联网搜索（needSearch）
3. 是否需要生成图片（needImageGeneration），如需则提取图片描述（imagePrompt）
4. 提取核心关键词（keywords）
5. 一句话概括需求（summary）

返回格式（严格 JSON）：
{“intent”:”类型”,”needSearch”:bool,”needImageGeneration”:bool,”imagePrompt”:””,”keywords”:[],”summary”:””}`,

    // 图片识别提示词
    imageRecognition: `详细描述图片内容：
1. 主要内容和场景
2. 图片中的文字（如有）
3. 关键细节
4. 与用户问题相关的信息
返回结构化描述。`,

    // 搜索结果分析提示词
    searchAnalysis: `基于搜索结果，提取与用户问题最相关的信息：
1. 筛选最相关结果
2. 提取关键信息
3. 整理成结构化参考资料`,

    // 最终回答提示词
    finalAnswer: `你是 Awenz AI，基于以下信息回答用户问题：
- 用户原始问题
- 图片识别结果（如有）
- 联网搜索结果（如有）
- 意图分析结果

回答要求：
- 使用中文，禁止 emoji
- 准确、完整、有条理
- 有图片则结合图片内容
- 有搜索结果则引用来源
- 先给结论，再给依据
- 保持专业简洁`
};

window.APP_CONFIG = APP_CONFIG;
window.DEFAULT_API_CONFIG = DEFAULT_API_CONFIG;
window.MODEL_CONFIG = MODEL_CONFIG;
window.MEMORY_CONFIG = MEMORY_CONFIG;
window.UI_CONFIG = UI_CONFIG;
window.DEEPSEEK_THINKING_CONFIG = DEEPSEEK_THINKING_CONFIG;
window.ERROR_MESSAGES = ERROR_MESSAGES;
window.SYSTEM_PROMPTS = SYSTEM_PROMPTS;

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

// ============ 工作流步骤类型注册表 ============

const WORKFLOW_STEP_TYPES = {
    intent: {
        id: 'intent',
        name: '意图识别',
        icon: '🧠',
        description: '分析用户输入，判断意图和关键词',
        defaultConfig: {
            model: 'deepseek-v4-flash',
            thinking: false,
            reasoningEffort: 'medium',
            maxTokens: 512
        },
        configurableFields: ['model', 'thinking', 'reasoningEffort', 'maxTokens']
    },
    image: {
        id: 'image',
        name: '图片识别',
        icon: '🖼️',
        description: '识别和描述用户上传的图片内容',
        defaultConfig: {
            model: 'mimo-v2.5',
            maxTokens: 1024
        },
        configurableFields: ['model', 'maxTokens']
    },
    search: {
        id: 'search',
        name: '联网搜索',
        icon: '🔍',
        description: '使用搜索引擎获取实时信息',
        defaultConfig: {
            model: 'mimo-v2.5-pro',
            limit: 5,
            maxKeyword: 3,
            maxTokens: 2048
        },
        configurableFields: ['model', 'limit', 'maxKeyword', 'maxTokens']
    },
    generate: {
        id: 'generate',
        name: '图片生成',
        icon: '🎨',
        description: '根据用户描述生成图片',
        defaultConfig: {
            model: 'gpt-image-2',
            size: '1792x1024',
            quality: 'hd'
        },
        configurableFields: ['model', 'size', 'quality']
    },
    answer: {
        id: 'answer',
        name: '大模型输出',
        icon: '💬',
        description: '综合所有信息生成最终回答',
        defaultConfig: {
            model: 'deepseek-v4-flash',
            thinking: true,
            reasoningEffort: 'medium',
            maxTokens: 4096
        },
        configurableFields: ['model', 'thinking', 'reasoningEffort', 'maxTokens']
    }
};

/**
 * 获取官方工作流定义
 */
function getOfficialWorkflows() {
    return [
        {
            id: 'wf_official_default',
            name: '默认智能工作流',
            description: '完整的5步智能工作流：意图识别、图片识别、联网搜索、图片生成、大模型输出',
            isOfficial: true,
            steps: [
                { stepType: 'intent',   enabled: true, config: { ...WORKFLOW_STEP_TYPES.intent.defaultConfig },   position: { x: 80,  y: 60 } },
                { stepType: 'image',    enabled: true, config: { ...WORKFLOW_STEP_TYPES.image.defaultConfig },    position: { x: 340, y: 60 } },
                { stepType: 'search',   enabled: true, config: { ...WORKFLOW_STEP_TYPES.search.defaultConfig },   position: { x: 600, y: 60 } },
                { stepType: 'generate', enabled: true, config: { ...WORKFLOW_STEP_TYPES.generate.defaultConfig }, position: { x: 340, y: 220 } },
                { stepType: 'answer',   enabled: true, config: { ...WORKFLOW_STEP_TYPES.answer.defaultConfig },   position: { x: 600, y: 220 } }
            ],
            connections: [
                { from: 0, to: 1 },
                { from: 1, to: 2 },
                { from: 2, to: 4 },
                { from: 0, to: 3 },
                { from: 3, to: 4 }
            ]
        },
        {
            id: 'wf_official_simple',
            name: '简单问答',
            description: '仅使用大模型直接回答，适合简单问题',
            isOfficial: true,
            steps: [
                { stepType: 'answer', enabled: true, config: { ...WORKFLOW_STEP_TYPES.answer.defaultConfig, thinking: false }, position: { x: 300, y: 100 } }
            ],
            connections: []
        },
        {
            id: 'wf_official_search',
            name: '搜索增强',
            description: '意图识别后联网搜索，适合需要最新信息的场景',
            isOfficial: true,
            steps: [
                { stepType: 'intent',  enabled: true, config: { ...WORKFLOW_STEP_TYPES.intent.defaultConfig },  position: { x: 80,  y: 100 } },
                { stepType: 'search',  enabled: true, config: { ...WORKFLOW_STEP_TYPES.search.defaultConfig },  position: { x: 340, y: 100 } },
                { stepType: 'answer',  enabled: true, config: { ...WORKFLOW_STEP_TYPES.answer.defaultConfig },  position: { x: 600, y: 100 } }
            ],
            connections: [
                { from: 0, to: 1 },
                { from: 1, to: 2 }
            ]
        }
    ];
}

window.WORKFLOW_STEP_TYPES = WORKFLOW_STEP_TYPES;
window.getOfficialWorkflows = getOfficialWorkflows;
