/**
 * AI 对话系统主程序
 * 集成多模型API调用、上下文记忆、历史对话管理
 */

/**
 * 统一存储适配层
 * 根据运行环境自动选择存储方式：Web(localStorage) / Electron(IPC) / Mobile(Filesystem)
 */
const StorageAdapter = {
    // 检测运行环境
    isElectron: typeof window.electronAPI !== 'undefined',
    isMobile: typeof window.Capacitor !== 'undefined' || window.isMobileApp === true,

    /**
     * 保存数据
     * @param {string} key - 存储键名
     * @param {*} data - 要存储的数据（会被JSON序列化）
     */
    async save(key, data) {
        const jsonData = JSON.stringify(data);
        try {
            if (this.isElectron) {
                // Electron 环境：通过 IPC 保存到文件
                const allData = await this._loadAllData();
                allData[key] = data;
                await window.electronAPI.saveData(allData);
            } else if (this.isMobile) {
                // Mobile 环境：使用 Capacitor Filesystem
                const allData = await this._loadAllData();
                allData[key] = data;
                await window.MobileAPI.saveFile('chat-data.json', JSON.stringify(allData));
            } else {
                // Web 环境：使用 localStorage
                localStorage.setItem(key, jsonData);
            }
        } catch (e) {
            console.error('保存数据失败:', key, e);
            // 降级到 localStorage
            try {
                localStorage.setItem(key, jsonData);
            } catch (le) {
                console.error('localStorage 保存也失败:', le);
            }
        }
    },

    /**
     * 加载数据
     * @param {string} key - 存储键名
     * @returns {*} 解析后的数据，失败返回 null
     */
    async load(key) {
        try {
            if (this.isElectron) {
                // Electron 环境：从文件加载
                const allData = await this._loadAllData();
                return allData[key] || null;
            } else if (this.isMobile) {
                // Mobile 环境：从 Capacitor Filesystem 加载
                const allData = await this._loadAllData();
                return allData[key] || null;
            } else {
                // Web 环境：从 localStorage 加载
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            }
        } catch (e) {
            console.error('加载数据失败:', key, e);
            // 降级到 localStorage
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (le) {
                console.error('localStorage 加载也失败:', le);
                return null;
            }
        }
    },

    /**
     * 加载所有数据（内部方法）
     */
    async _loadAllData() {
        try {
            if (this.isElectron) {
                const result = await window.electronAPI.loadData();
                return (result && result.success && result.data) ? result.data : {};
            } else if (this.isMobile) {
                const data = await window.MobileAPI.readFile('chat-data.json');
                return data ? JSON.parse(data) : {};
            }
        } catch (e) {
            console.error('加载全部数据失败:', e);
        }
        return {};
    },

    /**
     * 同步保存数据（兼容旧代码）
     * 注意：Electron/Mobile 环境下仍会异步执行
     */
    saveSync(key, data) {
        const jsonData = JSON.stringify(data);
        // 先保存到 localStorage 作为缓存
        try {
            localStorage.setItem(key, jsonData);
        } catch (e) {
            // 忽略
        }
        // 异步保存到持久化存储
        this.save(key, data).catch(e => console.error('异步保存失败:', e));
    },

    /**
     * 同步加载数据（兼容旧代码，优先从 localStorage 读取）
     */
    loadSync(key) {
        try {
            const data = localStorage.getItem(key);
            if (!data) return null;
            // 尝试 JSON 解析，失败则返回原始字符串
            try {
                return JSON.parse(data);
            } catch {
                return data;
            }
        } catch (e) {
            console.error('同步加载失败:', e);
            return null;
        }
    },

    /**
     * 初始化：从持久化存储同步数据到 localStorage
     */
    async init() {
        if (this.isElectron || this.isMobile) {
            try {
                const allData = await this._loadAllData();
                if (allData && Object.keys(allData).length > 0) {
                    // 将持久化数据同步到 localStorage
                    for (const [key, value] of Object.entries(allData)) {
                        try {
                            localStorage.setItem(key, JSON.stringify(value));
                        } catch (e) {
                            // 忽略单项失败
                        }
                    }
                    console.log('已从持久化存储恢复数据');
                    return true;
                }
            } catch (e) {
                console.error('初始化存储失败:', e);
            }
        }
        return false;
    },

    /**
     * 获取数据存储路径
     */
    async getDataPath() {
        if (this.isElectron && window.electronAPI?.getDataPath) {
            return await window.electronAPI.getDataPath();
        } else if (this.isMobile) {
            return '应用私有目录/Documents';
        }
        return '浏览器本地存储';
    }
};

/**
 * 图片存储（跨平台）
 * Web: IndexedDB | Electron: 文件系统 IPC | Mobile: Capacitor Filesystem
 * 避免 base64 图片数据超过 localStorage 配额
 */
const ImageStore = {
    // 内存缓存，供渲染时同步读取
    _cache: new Map(),
    // IndexedDB（仅 Web 端使用）
    _db: null,

    async init() {
        if (StorageAdapter.isElectron || StorageAdapter.isMobile) {
            // Electron/Mobile: 文件 API 已就绪，无需额外初始化
        } else {
            // Web: 初始化 IndexedDB
            await this._initIDB();
        }
    },

    async save(id, dataUrl) {
        this._cache.set(id, dataUrl);
        if (StorageAdapter.isElectron) {
            await window.electronAPI.saveImage(id, dataUrl);
        } else if (StorageAdapter.isMobile) {
            const base64 = dataUrl.split(',')[1];
            await window.MobileAPI.saveFile(`images/${id}.png`, base64);
        } else {
            await this._saveIDB(id, dataUrl);
        }
    },

    async load(id) {
        if (this._cache.has(id)) return this._cache.get(id);
        let data = null;
        if (StorageAdapter.isElectron) {
            const result = await window.electronAPI.loadImage(id);
            data = result?.data || null;
        } else if (StorageAdapter.isMobile) {
            const base64 = await window.MobileAPI.readFile(`images/${id}.png`);
            data = base64 ? `data:image/png;base64,${base64}` : null;
        } else {
            data = await this._loadIDB(id);
        }
        if (data) this._cache.set(id, data);
        return data;
    },

    getSync(id) {
        return this._cache.get(id) || null;
    },

    async preloadAll(chatHistory) {
        const ids = [];
        for (const chatId in chatHistory) {
            for (const msg of chatHistory[chatId].messages || []) {
                if (msg.imageId) ids.push(msg.imageId);
            }
        }
        if (ids.length === 0) return;

        if (StorageAdapter.isElectron) {
            const result = await window.electronAPI.loadAllImages(ids);
            if (result?.data) {
                for (const [id, data] of Object.entries(result.data)) {
                    this._cache.set(id, data);
                }
            }
        } else if (StorageAdapter.isMobile) {
            for (const id of ids) {
                const base64 = await window.MobileAPI.readFile(`images/${id}.png`);
                if (base64) this._cache.set(id, `data:image/png;base64,${base64}`);
            }
        } else {
            await this._preloadIDB(ids);
        }
    },

    // === IndexedDB 方法（仅 Web 端） ===
    async _initIDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ai_chat_images', 1);
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore('images');
            };
            request.onsuccess = (e) => {
                this._db = e.target.result;
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    },

    async _saveIDB(id, data) {
        if (!this._db) return;
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction('images', 'readwrite');
            tx.objectStore('images').put(data, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async _loadIDB(id) {
        if (!this._db) return null;
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction('images', 'readonly');
            const request = tx.objectStore('images').get(id);
            request.onsuccess = () => {
                if (request.result) this._cache.set(id, request.result);
                resolve(request.result || null);
            };
            request.onerror = () => reject(request.error);
        });
    },

    async _preloadIDB(ids) {
        if (!this._db) return;
        const tx = this._db.transaction('images', 'readonly');
        const store = tx.objectStore('images');
        const promises = ids.map(id => new Promise((resolve) => {
            const req = store.get(id);
            req.onsuccess = () => {
                if (req.result) this._cache.set(id, req.result);
                resolve();
            };
            req.onerror = () => resolve();
        }));
        await Promise.all(promises);
    }
};

// 应用状态管理
const AppState = {
    // 当前对话ID
    currentChatId: null,
    // 当前对话消息列表
    messages: [],
    // 所有对话历史
    chatHistory: {},
    // 长期记忆
    longTermMemory: [],
    // API配置
    apiConfig: {},
    // 记忆配置
    memoryConfig: {},
    // 自定义模型列表
    customModels: [],
    // 正在生成响应的对话Map (chatId -> AbortController)
    generatingChats: new Map(),
    // 是否是新对话（尚未保存到历史）
    isNewChat: true,
    // 是否启用联网搜索
    enableSearch: false,
    // 当前上传的图片数据
    currentImage: null,
    // DeepSeek 思考模式配置
    deepSeekThinking: {
        enabled: true,
        reasoningEffort: 'high'
    },
    // 用户头像配置：type 为 'emoji' 或 'image'
    userAvatar: {
        type: 'emoji',
        value: '👤'
    },
    // 多选模式状态
    selectMode: false,
    selectedChats: new Set()
};

// 工作流状态管理（每个对话独立状态）
const WorkflowStateMap = new Map();

/**
 * 获取模型的默认参数（temperature, top_p）
 * @param {string} model - 模型名称
 * @param {boolean} thinking - 是否启用思考模式
 * @returns {object} 模型参数
 */
function getModelParams(model, thinking = false) {
    const params = MODEL_CONFIG.modelParams?.[model];
    if (params) {
        // 思考模式下，mimo-v2.5-pro 和 mimo-v2.5 不支持自定义 temperature
        if (thinking && (model === 'mimo-v2.5-pro' || model === 'mimo-v2.5')) {
            return { top_p: params.top_p };
        }
        return { temperature: params.temperature, top_p: params.top_p };
    }
    // 默认参数
    return { temperature: 0.7, top_p: 1.0 };
}

/**
 * 检查指定provider的API Key是否已配置
 * @param {string} provider - 提供商名称 (deepseek/mimo/image)
 * @returns {boolean}
 */
function hasApiKey(provider) {
    const config = AppState.apiConfig[provider];
    return config?.apiKey && config.apiKey.trim() !== '';
}

/**
 * 检查是否有任意一个API Key已配置
 * @returns {boolean}
 */
function hasAnyApiKey() {
    return hasApiKey('deepseek') || hasApiKey('mimo') || hasApiKey('image');
}

/**
 * 获取指定步骤可用的模型列表（根据已配置的Key）
 * @param {string} stepType - 步骤类型 (intent/image/search/generate/answer)
 * @returns {Array} 可用模型列表
 */
function getAvailableModels(stepType) {
    const models = {
        intent: [
            { value: 'deepseek-v4-flash', provider: 'deepseek' },
            { value: 'deepseek-v4-pro', provider: 'deepseek' },
            { value: 'mimo-v2.5-pro', provider: 'mimo' },
            { value: 'mimo-v2.5', provider: 'mimo' },
            { value: 'mimo-v2-pro', provider: 'mimo' },
            { value: 'mimo-v2-omni', provider: 'mimo' }
        ],
        image: [
            { value: 'mimo-v2.5', provider: 'mimo' },
            { value: 'mimo-v2-omni', provider: 'mimo' }
        ],
        search: [
            { value: 'mimo-v2.5-pro', provider: 'mimo' },
            { value: 'mimo-v2.5', provider: 'mimo' },
            { value: 'mimo-v2-pro', provider: 'mimo' },
            { value: 'mimo-v2-omni', provider: 'mimo' }
        ],
        generate: [
            { value: 'gpt-image-2', provider: 'image' }
        ],
        answer: [
            { value: 'deepseek-v4-flash', provider: 'deepseek' },
            { value: 'deepseek-v4-pro', provider: 'deepseek' },
            { value: 'mimo-v2.5-pro', provider: 'mimo' },
            { value: 'mimo-v2.5', provider: 'mimo' },
            { value: 'mimo-v2-pro', provider: 'mimo' },
            { value: 'mimo-v2-omni', provider: 'mimo' }
        ]
    };
    return (models[stepType] || []).filter(m => hasApiKey(m.provider));
}

/**
 * 检查指定步骤是否有可用的模型
 * @param {string} stepType - 步骤类型
 * @returns {boolean}
 */
function hasAvailableModel(stepType) {
    return getAvailableModels(stepType).length > 0;
}

/**
 * 获取指定步骤的默认模型（第一个可用的）
 * @param {string} stepType - 步骤类型
 * @returns {string|null} 模型名称
 */
function getDefaultModel(stepType) {
    const available = getAvailableModels(stepType);
    return available.length > 0 ? available[0].value : null;
}

/**
 * 测试API连接
 * @param {string} provider - 提供商名称 (mimo/deepseek/image)
 */
async function testApiConnection(provider) {
    const resultEl = document.getElementById(`${provider}TestResult`);
    const btnEl = document.getElementById(`test${provider.charAt(0).toUpperCase() + provider.slice(1)}Btn`);

    if (!resultEl || !btnEl) return;

    // 获取当前输入的Key和Endpoint
    const keyInput = document.getElementById(`${provider}Key`);
    const endpointInput = document.getElementById(`${provider}Endpoint`);

    const apiKey = keyInput?.value?.trim();
    const endpoint = endpointInput?.value?.trim();

    if (!apiKey) {
        resultEl.textContent = '请先输入 API Key';
        resultEl.className = 'test-result error';
        return;
    }

    // 禁用按钮，显示测试中
    btnEl.disabled = true;
    btnEl.textContent = '测试中...';
    resultEl.textContent = '';
    resultEl.className = 'test-result';

    const startTime = Date.now();

    try {
        let testEndpoint = endpoint;
        let requestBody;
        let headers = { 'Content-Type': 'application/json' };

        if (provider === 'mimo') {
            testEndpoint = testEndpoint || 'https://api.xiaomimimo.com/v1/chat/completions';
            headers['api-key'] = apiKey;
            requestBody = {
                model: 'mimo-v2.5',
                messages: [{ role: 'user', content: 'hi' }],
                max_tokens: 10,
                stream: false
            };
        } else if (provider === 'deepseek') {
            testEndpoint = testEndpoint || 'https://api.deepseek.com/chat/completions';
            headers['Authorization'] = `Bearer ${apiKey}`;
            requestBody = {
                model: 'deepseek-v4-flash',
                messages: [{ role: 'user', content: 'hi' }],
                max_tokens: 10,
                stream: false
            };
        } else if (provider === 'image') {
            testEndpoint = testEndpoint || 'https://zz.imzr.top/v1/images/generations';
            headers['Authorization'] = `Bearer ${apiKey}`;
            requestBody = {
                model: 'gpt-image-2',
                prompt: 'test',
                n: 1,
                size: '256x256',
                response_format: 'url'
            };
        }

        const response = await fetch(testEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        if (response.ok) {
            resultEl.textContent = `连接成功 (${duration}秒)`;
            resultEl.className = 'test-result success';
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
            resultEl.textContent = `连接失败: ${errorMsg}`;
            resultEl.className = 'test-result error';
        }
    } catch (error) {
        resultEl.textContent = `连接失败: ${error.message}`;
        resultEl.className = 'test-result error';
    } finally {
        btnEl.disabled = false;
        btnEl.textContent = '测速';
    }
}

/**
 * 获取指定对话的工作流状态（从活跃工作流初始化）
 */
function getWorkflowState(chatId) {
    if (!WorkflowStateMap.has(chatId)) {
        const activeWorkflow = getActiveWorkflow();
        const steps = activeWorkflow ? activeWorkflow.steps.map(s => ({
            id: s.stepType,
            name: WORKFLOW_STEP_TYPES[s.stepType]?.name || s.stepType,
            status: 'pending'
        })) : [];
        WorkflowStateMap.set(chatId, {
            isRunning: false,
            currentStep: null,
            steps: steps,
            results: {
                intent: null,
                imageDescription: null,
                searchResults: null,
                searchLinks: [],
                generatedImage: null,
                finalAnswer: null,
                disabledSteps: []
            }
        });
    }
    return WorkflowStateMap.get(chatId);
}

/**
 * 重置指定对话的工作流状态
 */
function resetWorkflowState(chatId) {
    const state = getWorkflowState(chatId);
    // 从活跃工作流重新初始化步骤列表
    const activeWorkflow = getActiveWorkflow();
    if (activeWorkflow) {
        state.steps = activeWorkflow.steps.map(s => ({
            id: s.stepType,
            name: WORKFLOW_STEP_TYPES[s.stepType]?.name || s.stepType,
            status: 'pending'
        }));
    } else {
        state.steps.forEach(step => step.status = 'pending');
    }
    state.results = {
        intent: null,
        imageDescription: null,
        searchResults: null,
        searchLinks: [],
        generatedImage: null,
        finalAnswer: null,
        disabledSteps: []
    };
}

// DOM元素引用
const DOM = {
    sidebar: document.getElementById('sidebar'),
    historyList: document.getElementById('historyList'),
    chatContainer: document.getElementById('chatContainer'),
    chatMessages: document.getElementById('chatMessages'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    charCount: document.getElementById('charCount'),
    contextInfo: document.getElementById('contextInfo'),
    settingsModal: document.getElementById('settingsModal'),
    memoryModal: document.getElementById('memoryModal'),
    memoryItems: document.getElementById('memoryItems'),
    currentMessageCount: document.getElementById('currentMessageCount'),
    longTermMemoryCount: document.getElementById('longTermMemoryCount'),
    // 图片上传相关
    uploadBtn: document.getElementById('uploadBtn'),
    imageInput: document.getElementById('imageInput'),
    imagePreviewContainer: document.getElementById('imagePreviewContainer'),
    imagePreview: document.getElementById('imagePreview'),
    removeImageBtn: document.getElementById('removeImageBtn'),
    // PC 端按钮
    memoryBtn: document.getElementById('memoryBtn'),
    // 工作流状态
    workflowStatus: document.getElementById('workflowStatus'),
    workflowStep: document.getElementById('workflowStep'),
    workflowModel: document.getElementById('workflowModel'),
    workflowProgress: document.getElementById('workflowProgress'),
    // 确认弹窗
    confirmOverlay: document.getElementById('confirmOverlay'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmOkBtn: document.getElementById('confirmOkBtn'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn')
};

/**
 * 显示自定义确认弹窗
 * @param {string} message - 确认消息
 * @returns {Promise<boolean>} 用户是否确认
 */
function showConfirm(message) {
    return new Promise((resolve) => {
        DOM.confirmMessage.textContent = message;
        DOM.confirmOverlay.style.display = 'flex';

        const handleOk = () => {
            DOM.confirmOverlay.style.display = 'none';
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            DOM.confirmOverlay.style.display = 'none';
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            DOM.confirmOkBtn.removeEventListener('click', handleOk);
            DOM.confirmCancelBtn.removeEventListener('click', handleCancel);
        };

        DOM.confirmOkBtn.addEventListener('click', handleOk);
        DOM.confirmCancelBtn.addEventListener('click', handleCancel);
    });
}

/**
 * 应用初始化
 */
async function initApp() {
    // 从持久化存储恢复数据（Electron/Mobile 环境）
    await StorageAdapter.init();
    // 初始化 IndexedDB 图片存储
    await ImageStore.init();

    loadTheme(); // 加载主题设置
    loadSettings();
    migrateOldWorkflowConfig(); // 迁移旧版工作流配置
    loadWorkflowSettings();
    loadChatHistory();
    // 预加载已保存的生成图片到内存缓存
    await ImageStore.preloadAll(AppState.chatHistory);
    loadLongTermMemory();
    initNewChat();
    bindEventListeners();
    renderHistoryList();
    updateContextInfo();

    // 移动端简化 placeholder
    if (window.innerWidth <= 768) {
        DOM.messageInput.placeholder = '输入消息...';
    }
    // 初始化存储设置面板
    initStorageSettings();

    // 显示 Electron 专属元素
    if (StorageAdapter.isElectron) {
        document.querySelectorAll('.electron-only').forEach(el => {
            el.style.display = 'block';
        });
    }

    console.log('AI对话系统初始化完成');
}

/**
 * 加载设置
 */
function loadSettings() {
    // 加载API配置
    const savedApiConfig = StorageAdapter.loadSync(APP_CONFIG.storagePrefix + 'api_config');
    if (savedApiConfig) {
        AppState.apiConfig = savedApiConfig;
    } else {
        AppState.apiConfig = JSON.parse(JSON.stringify(DEFAULT_API_CONFIG));
    }

    // 加载记忆配置
    const savedMemoryConfig = StorageAdapter.loadSync(APP_CONFIG.storagePrefix + 'memory_config');
    if (savedMemoryConfig) {
        AppState.memoryConfig = savedMemoryConfig;
    } else {
        AppState.memoryConfig = JSON.parse(JSON.stringify(MEMORY_CONFIG));
    }

    // 加载用户头像配置
    const savedAvatar = StorageAdapter.loadSync(APP_CONFIG.storagePrefix + 'user_avatar');
    if (savedAvatar) {
        AppState.userAvatar = savedAvatar;
    }

    // 填充设置表单
    fillSettingsForm();
}

/**
 * 加载工作流设置（新系统：从多工作流存储中加载活跃工作流）
 */
function loadWorkflowSettings() {
    const activeWorkflow = getActiveWorkflow();
    if (activeWorkflow) {
        AppState.workflowConfig = {
            steps: {}
        };
        activeWorkflow.steps.forEach(s => {
            AppState.workflowConfig.steps[s.stepType] = { enabled: s.enabled, ...s.config };
        });
        AppState.workflowStepsEnabled = {};
        activeWorkflow.steps.forEach(s => {
            AppState.workflowStepsEnabled[s.stepType] = s.enabled;
        });
    } else {
        AppState.workflowConfig = getDefaultWorkflowConfig();
    }
}

/**
 * 填充设置表单
 */
function fillSettingsForm() {
    // API配置
    document.getElementById('mimoKey').value = AppState.apiConfig.mimo?.apiKey || '';
    document.getElementById('mimoEndpoint').value = AppState.apiConfig.mimo?.endpoint || '';
    document.getElementById('deepseekKey').value = AppState.apiConfig.deepseek?.apiKey || '';
    document.getElementById('deepseekEndpoint').value = AppState.apiConfig.deepseek?.endpoint || '';
    // GPT-Image 配置
    document.getElementById('imageKey').value = AppState.apiConfig.image?.apiKey || '';
    document.getElementById('imageEndpoint').value = AppState.apiConfig.image?.endpoint || '';

    // 记忆配置
    document.getElementById('maxContextMessages').value = AppState.memoryConfig.maxContextMessages || 50;
    document.getElementById('summaryThreshold').value = AppState.memoryConfig.summaryThreshold || 30;
    document.getElementById('enableLongTermMemory').checked = AppState.memoryConfig.enableLongTermMemory !== false;
    document.getElementById('autoSummarize').checked = AppState.memoryConfig.autoSummarize !== false;

    // 头像设置面板
    updateAvatarPanel();
}

/**
 * 加载对话历史
 */
function loadChatHistory() {
    const savedHistory = StorageAdapter.loadSync(APP_CONFIG.storagePrefix + 'chat_history');
    if (savedHistory) {
        AppState.chatHistory = savedHistory;
    }
}

/**
 * 加载长期记忆
 */
function loadLongTermMemory() {
    const savedMemory = StorageAdapter.loadSync(APP_CONFIG.storagePrefix + 'long_term_memory');
    if (savedMemory) {
        AppState.longTermMemory = savedMemory;
    }
}

/**
 * 保存对话历史到本地存储
 */
function saveChatHistory() {
    StorageAdapter.saveSync(
        APP_CONFIG.storagePrefix + 'chat_history',
        AppState.chatHistory
    );
}

// 防抖保存定时器
let _saveChatHistoryTimer = null;

/**
 * 防抖保存对话历史（用于频繁更新场景）
 * @param {number} delay - 延迟毫秒数
 */
function saveChatHistoryDebounced(delay = 300) {
    if (_saveChatHistoryTimer) {
        clearTimeout(_saveChatHistoryTimer);
    }
    _saveChatHistoryTimer = setTimeout(() => {
        saveChatHistory();
        _saveChatHistoryTimer = null;
    }, delay);
}

/**
 * 保存长期记忆到本地存储
 */
function saveLongTermMemory() {
    StorageAdapter.saveSync(
        APP_CONFIG.storagePrefix + 'long_term_memory',
        AppState.longTermMemory
    );
}

/**
 * 初始化新对话
 * 注意：不在这里创建历史记录，只有当用户发送第一条消息时才创建
 */
function initNewChat() {
    const chatId = 'chat_' + Date.now();
    AppState.currentChatId = chatId;
    AppState.messages = [];
    // 标记为新对话，尚未保存到历史
    AppState.isNewChat = true;

    renderChatMessages();
    renderHistoryList();
    updateContextInfo();
}

/**
 * 绑定事件监听器
 */
function bindEventListeners() {
    // 发送消息（使用onclick统一管理，避免重复绑定）
    DOM.sendBtn.onclick = handleSendMessage;
    DOM.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // 输入框自动调整高度
    DOM.messageInput.addEventListener('input', () => {
        autoResizeTextarea();
        updateCharCount();
    });

    // 输入框粘贴图片支持
    DOM.messageInput.addEventListener('paste', handlePasteImage);

    // 新建对话（移动端自动关闭侧边栏）
    document.getElementById('newChatBtn').addEventListener('click', () => {
        initNewChat();
        closeSidebar();
    });

    // 多选模式
    document.getElementById('selectModeBtn')?.addEventListener('click', () => {
        toggleSelectMode();
    });

    // 清空所有对话
    document.getElementById('clearAllBtn')?.addEventListener('click', () => {
        clearAllChats();
    });

    // 全选
    document.getElementById('selectAllBtn')?.addEventListener('click', () => {
        toggleSelectAll();
    });

    // 删除选中
    document.getElementById('deleteSelectedBtn')?.addEventListener('click', () => {
        deleteSelectedChats();
    });

    // 取消多选
    document.getElementById('cancelSelectBtn')?.addEventListener('click', () => {
        AppState.selectMode = false;
        AppState.selectedChats.clear();
        renderHistoryList();
    });

    // 工作流管理
    document.getElementById('workflowManagerBtn')?.addEventListener('click', () => {
        toggleWorkflowManager();
    });
    document.getElementById('closeWorkflowManagerBtn')?.addEventListener('click', () => {
        closeWorkflowManager();
    });
    document.getElementById('createWorkflowBtn')?.addEventListener('click', () => {
        showWorkflowEditorView(null);
    });
    document.getElementById('backToListBtn')?.addEventListener('click', () => {
        showWorkflowListView();
    });
    document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
        showWorkflowListView();
    });
    document.getElementById('saveWorkflowBtn')?.addEventListener('click', () => {
        saveWorkflowEditor();
    });

    // 关闭侧边栏
    document.getElementById('closeSidebarBtn')?.addEventListener('click', closeSidebar);
    document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);

    // 切换侧边栏
    document.getElementById('toggleSidebarBtn').addEventListener('click', toggleSidebar);

    // 打开设置模态框
    document.getElementById('settingsBtn').addEventListener('click', () => openModal('settingsModal'));

    // 打开记忆模态框（PC 端）
    document.getElementById('memoryBtn').addEventListener('click', () => {
        renderMemoryModal();
        openModal('memoryModal');
    });
    // 打开记忆模态框（移动端）
    // 主题切换
    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

    // 图片上传
    DOM.uploadBtn.addEventListener('click', () => DOM.imageInput.click());
    DOM.imageInput.addEventListener('change', handleImageUpload);
    DOM.removeImageBtn.addEventListener('click', removeImage);

    // 关闭模态框
    document.getElementById('closeSettingsBtn').addEventListener('click', () => closeModal('settingsModal'));
    document.getElementById('closeMemoryBtn').addEventListener('click', () => closeModal('memoryModal'));

    // 点击模态框外部关闭
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });

    // 设置选项卡切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.dataset.tab;
            switchTab(tabId);
        });
    });

    // 保存API配置
    document.getElementById('saveApiBtn').addEventListener('click', saveApiConfig);

    // 保存记忆配置
    document.getElementById('saveMemoryBtn').addEventListener('click', saveMemoryConfig);

    // 头像设置
    document.getElementById('saveAvatarBtn').addEventListener('click', saveAvatarConfig);
    document.getElementById('avatarUploadBtn').addEventListener('click', () => {
        document.getElementById('avatarFileInput').click();
    });
    document.getElementById('avatarFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            AppState.userAvatar = { type: 'image', value: ev.target.result };
            updateAvatarPanel();
        };
        reader.readAsDataURL(file);
    });
    document.getElementById('avatarResetBtn').addEventListener('click', () => {
        AppState.userAvatar = { type: 'emoji', value: '👤' };
        updateAvatarPanel();
    });
    // 预设头像点击选择
    document.querySelectorAll('#avatarGrid .avatar-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const emoji = opt.getAttribute('data-emoji');
            AppState.userAvatar = { type: 'emoji', value: emoji };
            updateAvatarPanel();
        });
    });

    // 存储设置
    document.getElementById('changeStoragePathBtn')?.addEventListener('click', changeStoragePath);
    document.getElementById('exportAllDataBtn')?.addEventListener('click', exportAllData);
    document.getElementById('importAllDataBtn')?.addEventListener('click', importAllData);
    document.getElementById('clearAllDataBtn')?.addEventListener('click', clearAllData);

    // 清除记忆
    document.getElementById('clearMemoryBtn').addEventListener('click', clearAllMemory);

    // 导出记忆
    document.getElementById('exportMemoryBtn').addEventListener('click', exportMemory);
}

/**
 * 处理发送消息
 */
async function handleSendMessage() {
    // 如果当前对话正在生成，不允许发送新消息
    if (isCurrentChatGenerating()) {
        showToast('当前对话正在生成中，请等待完成', 'warning');
        return;
    }

    const content = DOM.messageInput.value.trim();
    const hasImage = AppState.currentImage !== null;

    // 验证消息（有图片时可以没有文字）
    if (!content && !hasImage) return;
    if (content.length > UI_CONFIG.maxMessageLength) {
        showToast(ERROR_MESSAGES.messageTooLong, 'error');
        return;
    }

    // 检查API密钥（至少配置一个Key）
    if (!hasAnyApiKey()) {
        showToast('请先配置至少一个 API Key（DeepSeek、MiMo 或图片生成）', 'error');
        openModal('settingsModal');
        return;
    }

    // 构建消息内容
    let messageContent;
    let imageForDisplay = null;
    // 保存图片数据用于工作流（在清除前保存）
    let imageDataForWorkflow = null;

    if (hasImage) {
        // 多模态消息：包含图片和文本
        messageContent = [
            {
                type: 'image_url',
                image_url: {
                    url: AppState.currentImage.base64
                }
            }
        ];
        if (content) {
            messageContent.push({
                type: 'text',
                text: content
            });
        }
        // 保存图片用于显示和工作流
        imageForDisplay = AppState.currentImage.base64;
        imageDataForWorkflow = AppState.currentImage.base64;
    } else {
        messageContent = content;
    }

    // 添加用户消息
    const userMessage = {
        role: 'user',
        content: messageContent,
        timestamp: new Date().toISOString(),
        image: imageForDisplay
    };
    AppState.messages.push(userMessage);

    // 清除已上传的图片
    if (hasImage) {
        removeImage();
    }

    // 如果是新对话且是第一条消息，才创建历史记录
    if (AppState.isNewChat && AppState.messages.length === 1) {
        // 生成对话标题（优先使用文字，没有文字则使用"[图片]"）
        const title = content ? content.substring(0, 20) + (content.length > 20 ? '...' : '') : '[图片]';
        AppState.chatHistory[AppState.currentChatId] = {
            id: AppState.currentChatId,
            title: title,
            messages: AppState.messages,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        AppState.isNewChat = false;
        saveChatHistory();
        renderHistoryList();
    } else if (!AppState.isNewChat && AppState.messages.length === 1) {
        // 更新对话标题
        const title = content ? content.substring(0, 20) + (content.length > 20 ? '...' : '') : '[图片]';
        AppState.chatHistory[AppState.currentChatId].title = title;
        renderHistoryList();
    }

    // 清空输入框
    DOM.messageInput.value = '';
    autoResizeTextarea();
    updateCharCount();

    // 渲染用户消息
    renderChatMessages();

    // 确保滚动到底部
    scrollToBottom();

    // 执行工作流（传递保存的图片数据）
    await executeWorkflow(content, hasImage, AppState.currentChatId, imageDataForWorkflow);
}

/**
 * 执行完整的工作流（数据驱动版本）
 * @param {string} userInput - 用户输入的文本
 * @param {boolean} hasImage - 是否有图片
 * @param {string} chatId - 对话ID
 * @param {string|null} imageData - 图片base64数据
 */
async function executeWorkflow(userInput, hasImage, chatId, imageData = null) {
    const activeWorkflow = getActiveWorkflow();
    if (!activeWorkflow || activeWorkflow.steps.length === 0) {
        console.log('[Workflow] 没有可用的工作流，直接回答');
        await generateDirectAnswer(userInput, chatId);
        return;
    }

    const workflowState = getWorkflowState(chatId);
    workflowState.isRunning = true;
    resetWorkflowState(chatId);
    updateWorkflowUI('start', null, chatId);

    const chatMessages = AppState.chatHistory[chatId]?.messages || AppState.messages;
    const isCurrentChat = chatId === AppState.currentChatId;

    // 添加加载消息
    const loadingMessage = {
        role: 'assistant',
        content: '内容正在生成中',
        timestamp: new Date().toISOString(),
        isLoading: true
    };
    chatMessages.push(loadingMessage);
    if (isCurrentChat) {
        renderChatMessages();
        scrollToBottom();
    }

    workflowState.results.disabledSteps = [];

    // 拓扑排序：基于 connections 确定执行顺序
    const steps = activeWorkflow.steps;
    const connections = activeWorkflow.connections || [];
    const stepCount = steps.length;

    // 计算入度
    const inDegree = new Array(stepCount).fill(0);
    const successors = new Array(stepCount).fill(null).map(() => []);
    connections.forEach(conn => {
        if (conn.from < stepCount && conn.to < stepCount) {
            inDegree[conn.to]++;
            successors[conn.from].push(conn.to);
        }
    });

    // 如果没有连线，使用默认的顺序连线
    if (connections.length === 0 && stepCount > 1) {
        for (let i = 0; i < stepCount - 1; i++) {
            successors[i].push(i + 1);
            inDegree[i + 1]++;
        }
    }

    // 已执行完成的步骤集合
    const completed = new Set();
    // 跳过的步骤集合（跳过也算"完成"，让后续步骤可以执行）
    const skipped = new Set();

    const context = { userInput, hasImage, imageData, chatId, chatMessages, isCurrentChat };

    try {
        // 拓扑排序执行
        let iterations = 0;
        const maxIterations = stepCount * 2; // 防止无限循环

        while (completed.size + skipped.size < stepCount && iterations < maxIterations) {
            iterations++;

            // 找到所有入度为 0 且未执行的步骤
            const ready = [];
            for (let i = 0; i < stepCount; i++) {
                if (!completed.has(i) && !skipped.has(i) && inDegree[i] === 0) {
                    ready.push(i);
                }
            }

            if (ready.length === 0) {
                console.warn('[Workflow] 存在循环依赖或无法执行的步骤');
                break;
            }

            // 并行执行所有就绪的步骤
            await Promise.all(ready.map(async (stepIndex) => {
                const step = steps[stepIndex];
                const stepType = step.stepType;
                const stepTypeDef = WORKFLOW_STEP_TYPES[stepType];

                if (!stepTypeDef) {
                    console.warn(`[Workflow] 未知步骤类型: ${stepType}，跳过`);
                    skipped.add(stepIndex);
                    return;
                }

                // 检查步骤是否启用
                if (!step.enabled) {
                    updateWorkflowUI(stepType, 'skipped', chatId);
                    workflowState.results.disabledSteps.push(stepTypeDef.name);
                    skipped.add(stepIndex);
                    return;
                }

                // 检查模型是否有效
                if (!step.config.model || !MODEL_CONFIG.providers[step.config.model]) {
                    updateWorkflowUI(stepType, 'skipped', chatId);
                    workflowState.results.disabledSteps.push(`${stepTypeDef.name}（模型配置无效）`);
                    skipped.add(stepIndex);
                    return;
                }

                // 检查 API Key 可用性
                const provider = MODEL_CONFIG.providers[step.config.model];
                if (!hasApiKey(provider)) {
                    updateWorkflowUI(stepType, 'skipped', chatId);
                    workflowState.results.disabledSteps.push(`${stepTypeDef.name}（${provider} Key未配置）`);
                    skipped.add(stepIndex);
                    return;
                }

                // 特殊条件检查
                if (stepType === 'image' && (!hasImage || !imageData)) {
                    updateWorkflowUI(stepType, 'skipped', chatId);
                    skipped.add(stepIndex);
                    return;
                }
                if (stepType === 'search' && workflowState.results.intent && !workflowState.results.intent.needSearch) {
                    updateWorkflowUI(stepType, 'skipped', chatId);
                    skipped.add(stepIndex);
                    return;
                }
                if (stepType === 'generate' && workflowState.results.intent && !workflowState.results.intent.needImageGeneration) {
                    updateWorkflowUI(stepType, 'skipped', chatId);
                    skipped.add(stepIndex);
                    return;
                }

                // 执行步骤
                updateWorkflowUI(stepType, 'running', chatId);
                try {
                    await executeStepHandler(stepType, step.config, workflowState, context);
                    updateWorkflowUI(stepType, 'done', chatId);
                    completed.add(stepIndex);
                } catch (error) {
                    console.error(`[Workflow] 步骤 ${stepType} 失败:`, error);
                    updateWorkflowUI(stepType, 'skipped', chatId);
                    skipped.add(stepIndex);
                }
            }));

            // 更新入度：已执行/跳过的步骤的后继节点入度减 1
            for (const idx of [...completed, ...skipped]) {
                successors[idx].forEach(succ => {
                    inDegree[succ]--;
                });
            }
        }

        // 图片生成成功后直接返回
        if (workflowState.results.generatedImage) {
            const loadingIdx = chatMessages.findIndex(m => m.isLoading);
            if (loadingIdx !== -1) chatMessages.splice(loadingIdx, 1);
            if (isCurrentChat) renderChatMessages();
            if (AppState.chatHistory[chatId]) {
                AppState.chatHistory[chatId].updatedAt = new Date().toISOString();
                saveChatHistory();
            }
            workflowState.isRunning = false;
            updateWorkflowUI('complete', null, chatId);
            return;
        }

    } catch (error) {
        console.error('[Workflow] 工作流执行失败:', error);
        if (hasApiKey('deepseek')) {
            await generateDirectAnswer(userInput, chatId);
        } else {
            const lastMsg = chatMessages[chatMessages.length - 1];
            if (lastMsg) {
                lastMsg.content = '工作流执行失败';
                lastMsg.isLoading = false;
            }
            if (isCurrentChat) renderChatMessages();
        }
    } finally {
        workflowState.isRunning = false;
        updateWorkflowUI('complete', null, chatId);
    }
}

/**
 * 步骤处理函数注册表
 */
const STEP_HANDLERS = {
    intent: executeIntentStep,
    image: executeImageStep,
    search: executeSearchStep,
    generate: executeGenerateStep,
    answer: executeAnswerStep
};

/**
 * 执行单个步骤处理函数
 */
async function executeStepHandler(stepType, stepConfig, workflowState, context) {
    const handler = STEP_HANDLERS[stepType];
    if (!handler) throw new Error(`No handler for step type: ${stepType}`);
    await handler(stepConfig, workflowState, context);
}

/**
 * 意图识别步骤处理
 */
async function executeIntentStep(stepConfig, workflowState, context) {
    // 临时替换全局配置
    const origModels = { ...WORKFLOW_MODELS.intentAnalysis };
    WORKFLOW_MODELS.intentAnalysis.model = stepConfig.model;
    WORKFLOW_MODELS.intentAnalysis.provider = MODEL_CONFIG.providers[stepConfig.model] || 'deepseek';
    WORKFLOW_MODELS.intentAnalysis.thinking = stepConfig.thinking || false;
    WORKFLOW_MODELS.intentAnalysis.reasoningEffort = stepConfig.reasoningEffort;
    WORKFLOW_MODELS.intentAnalysis.maxTokens = stepConfig.maxTokens;

    try {
        const result = await analyzeIntentWithDeepSeek(context.userInput);
        console.log('[Workflow] 意图识别结果:', result);
        workflowState.results.intent = result;
    } catch (error) {
        console.error('[Workflow] 意图识别失败:', error);
        workflowState.results.intent = {
            intent: 'question', needSearch: false, needImageGeneration: false,
            imagePrompt: '', keywords: [], summary: context.userInput
        };
    } finally {
        Object.assign(WORKFLOW_MODELS.intentAnalysis, origModels);
    }
}

/**
 * 图片识别步骤处理
 */
async function executeImageStep(stepConfig, workflowState, context) {
    const origModels = { ...WORKFLOW_MODELS.imageRecognition };
    WORKFLOW_MODELS.imageRecognition.model = stepConfig.model;
    WORKFLOW_MODELS.imageRecognition.maxTokens = stepConfig.maxTokens;

    try {
        const result = await recognizeImageWithMiMo(context.imageData);
        workflowState.results.imageDescription = result;
    } catch (error) {
        console.error('[Workflow] 图片识别失败:', error);
        workflowState.results.imageDescription = null;
    } finally {
        Object.assign(WORKFLOW_MODELS.imageRecognition, origModels);
    }
}

/**
 * 联网搜索步骤处理
 */
async function executeSearchStep(stepConfig, workflowState, context) {
    const origModels = { ...WORKFLOW_MODELS.webSearch };
    WORKFLOW_MODELS.webSearch.model = stepConfig.model;
    WORKFLOW_MODELS.webSearch.maxTokens = stepConfig.maxTokens;

    try {
        const keywords = workflowState.results.intent?.keywords || [];
        const searchData = await searchWithMiMoPro(keywords);
        workflowState.results.searchResults = searchData.content;
        workflowState.results.searchLinks = searchData.searchResults;
    } catch (error) {
        console.error('[Workflow] 联网搜索失败:', error);
        workflowState.results.searchResults = null;
        workflowState.results.searchLinks = [];
    } finally {
        Object.assign(WORKFLOW_MODELS.webSearch, origModels);
    }
}

/**
 * 图片生成步骤处理
 */
async function executeGenerateStep(stepConfig, workflowState, context) {
    try {
        const imagePrompt = workflowState.results.intent?.imagePrompt || context.userInput;
        console.log('[Workflow] 图片生成提示词:', imagePrompt);
        const result = await generateImageWithGPT(imagePrompt, context.chatId);
        workflowState.results.generatedImage = result;
    } catch (error) {
        console.error('[Workflow] 图片生成失败:', error);
        workflowState.results.generatedImage = null;
    }
}

/**
 * 大模型输出步骤处理
 */
async function executeAnswerStep(stepConfig, workflowState, context) {
    const origModels = { ...WORKFLOW_MODELS.finalAnswer };
    WORKFLOW_MODELS.finalAnswer.model = stepConfig.model;
    WORKFLOW_MODELS.finalAnswer.provider = MODEL_CONFIG.providers[stepConfig.model] || 'deepseek';
    WORKFLOW_MODELS.finalAnswer.thinking = stepConfig.thinking !== false;
    WORKFLOW_MODELS.finalAnswer.reasoningEffort = stepConfig.reasoningEffort;

    try {
        await generateFinalAnswer(context.userInput, context.chatId);
    } finally {
        Object.assign(WORKFLOW_MODELS.finalAnswer, origModels);
    }
}

/**
 * 进行意图识别
 */
async function analyzeIntentWithDeepSeek(userInput) {
    const intentConfig = WORKFLOW_MODELS.intentAnalysis;
    const isMiMo = intentConfig.model.startsWith('mimo-');

    // 根据模型选择配置
    const config = isMiMo ? AppState.apiConfig.mimo : AppState.apiConfig.deepseek;

    const contextMessages = [
        { role: 'system', content: WORKFLOW_SYSTEM_PROMPTS.intentAnalysis },
        { role: 'user', content: userInput }
    ];

    // 获取模型参数（思考模式下mimo-v2.5-pro和mimo-v2.5不支持自定义temperature）
    const isThinking = intentConfig.thinking === true;
    const modelParams = getModelParams(intentConfig.model, isThinking);

    const requestBody = {
        model: intentConfig.model,
        messages: contextMessages,
        stream: false,
        ...modelParams
    };

    // 小米模型使用 max_completion_tokens，DeepSeek使用 max_tokens
    // 意图识别只需要输出简短的JSON，MiMo模型使用512足够
    const maxTokens = isMiMo ? 512 : Math.max(intentConfig.maxTokens || 1024, 1024);
    if (isMiMo) {
        requestBody.max_completion_tokens = maxTokens;
    } else {
        requestBody.max_tokens = maxTokens;
    }

    // 根据配置决定是否启用深度思考
    // 小米模型开启深度思考时，需要从 reasoning_content 提取结果
    if (intentConfig.thinking) {
        if (isMiMo) {
            // 小米模型不使用 reasoning_effort
            requestBody.thinking = { type: 'enabled' };
        } else {
            requestBody.thinking = { type: 'enabled', reasoning_effort: intentConfig.reasoningEffort || 'high' };
        }
    }

    console.log('[Workflow] 意图识别请求参数:', {
        model: requestBody.model,
        max_tokens: requestBody.max_tokens || requestBody.max_completion_tokens,
        temperature: requestBody.temperature,
        top_p: requestBody.top_p,
        thinking: requestBody.thinking || '未启用',
        thinkingConfig: intentConfig.thinking
    });

    // 根据模型设置请求头
    const headers = { 'Content-Type': 'application/json' };
    if (isMiMo) {
        headers['api-key'] = config.apiKey;
    } else {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`意图识别请求失败: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Workflow] 意图识别完整响应:', JSON.stringify(data, null, 2));

    // 尝试从多个位置获取内容
    let content = data.choices?.[0]?.message?.content || '';
    const reasoningContent = data.choices?.[0]?.message?.reasoning_content || '';

    // 如果 content 为空，使用 reasoning_content
    if (!content && reasoningContent) {
        console.log('[Workflow] content 为空，从 reasoning_content 提取');
        content = reasoningContent;
    }

    console.log('[Workflow] 意图识别原始返回:', content);

    // 如果内容为空，使用关键词分析
    if (!content || content.trim() === '') {
        console.warn('[Workflow] 意图识别返回空内容，使用关键词分析');
        return analyzeIntentByKeywords(userInput);
    }

    // 解析JSON结果
    try {
        // 尝试提取JSON内容（支持纯JSON、Markdown代码块、文本中的JSON）
        let jsonStr = content;

        // 1. 尝试匹配 Markdown 代码块中的 JSON
        const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        } else {
            // 2. 尝试匹配纯 JSON 对象
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
        }

        const result = JSON.parse(jsonStr);
        console.log('[Workflow] 意图解析成功:', result);
        return result;
    } catch (e) {
        // JSON解析失败，尝试从 reasoning_content 中提取关键信息
        console.warn('[Workflow] JSON解析失败，尝试从思考过程提取意图');
        return extractIntentFromReasoning(content, userInput);
    }
}

/**
 * 从模型思考过程中提取意图信息
 * 小米模型深度思考时，JSON可能在思考过程中被分析，但最终content为空
 */
function extractIntentFromReasoning(reasoningText, userInput) {
    const text = reasoningText.toLowerCase();

    // 从思考过程中提取意图判断
    let intent = 'question';
    let needSearch = false;
    let needImageGeneration = false;

    // 分析意图类型
    if (text.includes('"intent"') && text.includes('"search"')) {
        intent = 'search';
        needSearch = true;
    } else if (text.includes('search') && (text.includes('true') || text.includes('是的'))) {
        intent = 'search';
        needSearch = true;
    } else if (text.includes('需要搜索') || text.includes('need search')) {
        needSearch = true;
        intent = 'search';
    }

    // 检查是否需要搜索（更广泛的匹配）
    if (!needSearch) {
        const searchIndicators = ['搜索', '查询', '查找', '最新', '最近', '新闻', '更新日志',
            'search', 'query', 'latest', 'news', 'update', 'changelog'];
        needSearch = searchIndicators.some(kw => userInput.toLowerCase().includes(kw));
        if (needSearch) intent = 'search';
    }

    // 检查是否需要生成图片
    if (text.includes('图片') && (text.includes('不需要') || text.includes('false'))) {
        needImageGeneration = false;
    }

    // 提取关键词
    const words = userInput.split(/[\s,，。！？、]+/).filter(w => w.length > 1);
    const keywords = words.slice(0, 5);

    const result = {
        intent,
        needSearch,
        needImageGeneration,
        imagePrompt: '',
        keywords,
        summary: userInput
    };

    console.log('[Workflow] 从思考过程提取的意图:', result);
    return result;
}

/**
 * 通过关键词分析用户意图（降级方案）
 */
function analyzeIntentByKeywords(userInput) {
    const input = userInput.toLowerCase();

    // 搜索关键词
    const searchKeywords = ['搜索', '查询', '查找', '最新', '最近', '新闻', '今日', '今天',
        '天气', '股价', '价格', '汇率', '比赛', '赛事', '更新', '日志', '版本',
        'search', 'query', 'latest', 'news', 'update', 'changelog'];

    // 图片生成关键词
    const imageKeywords = ['画', '生成图片', '绘制', '做一张图', '画一个', '创建图片',
        '图片生成', '生成一张', '画一幅', 'draw', 'generate image'];

    // 技术关键词
    const techKeywords = ['代码', '编程', '开发', 'api', 'bug', '错误', '函数', '变量',
        'python', 'javascript', 'java', 'html', 'css', 'react', 'vue',
        'code', 'programming', 'developer', 'function', 'variable'];

    // 判断是否需要搜索
    const needSearch = searchKeywords.some(kw => input.includes(kw));

    // 判断是否需要生成图片
    const needImageGeneration = imageKeywords.some(kw => input.includes(kw));

    // 判断意图类型
    let intent = 'question';
    if (needImageGeneration) {
        intent = 'image_generation';
    } else if (techKeywords.some(kw => input.includes(kw))) {
        intent = 'technical';
    } else if (input.startsWith('你好') || input.startsWith('hi') || input.startsWith('hello')) {
        intent = 'simple_chat';
    }

    // 提取关键词
    const words = userInput.split(/[\s,，。！？、]+/).filter(w => w.length > 1);
    const keywords = words.slice(0, 5);

    const result = {
        intent,
        needSearch,
        needImageGeneration,
        imagePrompt: needImageGeneration ? userInput : '',
        keywords,
        summary: userInput
    };

    console.log('[Workflow] 关键词分析结果:', result);
    return result;
}

/**
 * 使用MiMo进行图片识别
 * @param {string} imageData - 图片的base64数据
 */
async function recognizeImageWithMiMo(imageData) {
    const config = AppState.apiConfig.mimo;

    if (!imageData) {
        throw new Error('没有可用的图片数据');
    }

    const contextMessages = [
        { role: 'system', content: WORKFLOW_SYSTEM_PROMPTS.imageRecognition },
        {
            role: 'user',
            content: [
                { type: 'text', text: '请描述这张图片' },
                { type: 'image_url', image_url: { url: imageData } }
            ]
        }
    ];

    // 获取模型参数（思考模式禁用，不需要特殊处理）
    const modelParams = getModelParams(WORKFLOW_MODELS.imageRecognition.model, false);

    const requestBody = {
        model: WORKFLOW_MODELS.imageRecognition.model,
        messages: contextMessages,
        max_tokens: WORKFLOW_MODELS.imageRecognition.maxTokens || 1024,
        stream: false,
        ...modelParams,
        thinking: { type: 'disabled' }
    };

    const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': config.apiKey
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`图片识别请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * 使用MiMo Pro进行联网搜索
 * @returns {Object} 包含 content 和 searchResults 的对象
 */
async function searchWithMiMoPro(keywords) {
    const config = AppState.apiConfig.mimo;
    const query = keywords.join(' ');

    if (!query) {
        throw new Error('没有可用的搜索关键词');
    }

    const contextMessages = [
        { role: 'system', content: '搜索并总结以下内容的相关信息' },
        { role: 'user', content: query }
    ];

    // 获取模型参数（思考模式禁用，不需要特殊处理）
    const modelParams = getModelParams(WORKFLOW_MODELS.webSearch.model, false);

    const requestBody = {
        model: WORKFLOW_MODELS.webSearch.model,
        messages: contextMessages,
        max_tokens: WORKFLOW_MODELS.webSearch.maxTokens || 2048,
        stream: false,
        ...modelParams,
        thinking: { type: 'disabled' },
        tools: [
            {
                type: 'web_search',
                max_keyword: WORKFLOW_MODELS.webSearch.maxKeyword || 3,
                force_search: true,
                limit: WORKFLOW_MODELS.webSearch.limit || 5,
                user_location: {
                    type: 'approximate',
                    country: 'China'
                }
            }
        ]
    };

    const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': config.apiKey
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`联网搜索请求失败: ${response.status}`);
    }

    const data = await response.json();

    // 提取搜索结果链接（从 annotations 字段）
    let searchResults = [];
    try {
        const annotations = data.choices?.[0]?.message?.annotations;
        if (Array.isArray(annotations)) {
            const limit = WORKFLOW_MODELS.webSearch.limit || 5;
            searchResults = annotations
                .filter(a => a.type === 'url_citation' && a.url)
                .slice(0, limit)  // 限制返回数量
                .map(a => ({
                    title: a.title || '',
                    url: a.url || '',
                    snippet: a.summary || '',
                    siteName: a.site_name || '',
                    publishTime: a.publish_time || '',
                    logoUrl: a.logo_url || ''
                }));
        }
    } catch (e) {
        console.warn('[Search] 提取搜索结果链接失败:', e);
    }

    return {
        content: data.choices[0].message.content,
        searchResults: searchResults
    };
}

/**
 * 使用GPT-Image生成图片
 * @param {string} prompt - 图片描述提示词
 * @param {string} chatId - 对话ID
 * @returns {Promise<string>} 生成的图片base64数据
 */
async function generateImageWithGPT(prompt, chatId) {
    const config = AppState.apiConfig.image;

    if (!config?.apiKey) {
        throw new Error('GPT-Image API Key 未配置');
    }

    const requestBody = {
        model: WORKFLOW_MODELS.generate?.model || 'gpt-image-2',
        prompt: prompt,
        n: 1,
        size: WORKFLOW_MODELS.generate?.size || '1792x1024',
        quality: WORKFLOW_MODELS.generate?.quality || 'hd',
        response_format: 'b64_json'
    };

    const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        let errorMsg = `图片生成请求失败: ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error?.message || errorMsg;
        } catch (e) {
            // 忽略解析错误
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();

    if (data.data && data.data[0]) {
        const imageData = data.data[0].b64_json;
        const dataUrl = `data:image/png;base64,${imageData}`;

        // 使用 ImageStore 存储图片（避免 localStorage 大小限制）
        const imageId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await ImageStore.save(imageId, dataUrl);

        // 将生成的图片添加到消息中（只存储 imageId）
        const chatMessages = AppState.chatHistory[chatId]?.messages || AppState.messages;
        const imageMessage = {
            role: 'assistant',
            content: '已为您生成图片',
            timestamp: new Date().toISOString(),
            imageId: imageId,
            isGeneratedImage: true
        };
        chatMessages.push(imageMessage);

        return imageId;
    }

    throw new Error('未能获取生成的图片');
}

/**
 * 生成最终回答
 */
async function generateFinalAnswer(userInput, chatId) {
    const finalAnswerConfig = WORKFLOW_MODELS.finalAnswer;
    const isMiMo = finalAnswerConfig.model.startsWith('mimo-');
    const config = isMiMo ? AppState.apiConfig.mimo : AppState.apiConfig.deepseek;
    const chatMessages = AppState.chatHistory[chatId]?.messages || AppState.messages;
    const workflowState = getWorkflowState(chatId);

    // 使用数组构建上下文，避免多次字符串拼接
    const contextParts = [`用户问题：${userInput}`];

    if (workflowState.results.imageDescription) {
        contextParts.push(`图片内容：${workflowState.results.imageDescription}`);
    }

    if (workflowState.results.searchResults) {
        contextParts.push(`搜索结果：${workflowState.results.searchResults}`);
    }

    // 添加搜索链接信息
    if (workflowState.results.searchLinks && workflowState.results.searchLinks.length > 0) {
        const linksInfo = workflowState.results.searchLinks
            .map((r, i) => `[${i + 1}] ${r.title} - ${r.url}`)
            .join('\n');
        contextParts.push(`参考来源：\n${linksInfo}`);
    }

    if (workflowState.results.generatedImage) {
        contextParts.push('已为用户生成图片，请在回答中说明。');
    }

    // 添加关闭步骤的信息
    if (workflowState.results.disabledSteps && workflowState.results.disabledSteps.length > 0) {
        contextParts.push(`注意：以下功能已关闭，无法使用：${workflowState.results.disabledSteps.join('、')}。请在回答中告知用户这些功能已关闭，如需使用请前往工作流管理中开启。`);
    }

    if (workflowState.results.intent) {
        contextParts.push(`意图分析：${JSON.stringify(workflowState.results.intent)}`);
    }

    const context = contextParts.join('\n\n');

    // 构建消息上下文（排除最后一条用户消息，因为我们会用增强版本替代）
    const contextMessages = [];
    const messagesToInclude = chatMessages.slice(0, -1); // 排除最后一条用户消息
    const maxContext = MEMORY_CONFIG.maxContextMessages || 50;

    // 预分配数组大小，减少动态扩展
    const startIdx = Math.max(0, messagesToInclude.length - maxContext);
    for (let i = startIdx; i < messagesToInclude.length; i++) {
        const msg = messagesToInclude[i];
        if (msg.role === 'user' || msg.role === 'assistant') {
            let content = msg.content;
            if (Array.isArray(content)) {
                content = content.filter(item => item.type === 'text').map(item => item.text).join('\n');
            }
            if (content) {
                contextMessages.push({ role: msg.role, content });
            }
        }
    }

    // 添加系统提示词和增强的用户消息
    const finalMessages = [
        { role: 'system', content: WORKFLOW_SYSTEM_PROMPTS.finalAnswer },
        ...contextMessages,
        { role: 'user', content: context }
    ];

    // 获取模型参数（思考模式下mimo-v2.5-pro和mimo-v2.5不支持自定义temperature）
    const isThinking = finalAnswerConfig.thinking !== false;
    const modelParams = getModelParams(finalAnswerConfig.model, isThinking);

    const requestBody = {
        model: finalAnswerConfig.model,
        messages: finalMessages,
        stream: true,
        ...modelParams
    };

    // 小米模型使用 max_completion_tokens，DeepSeek使用 max_tokens
    const maxTokens = finalAnswerConfig.maxTokens || 4096;
    if (isMiMo) {
        requestBody.max_completion_tokens = maxTokens;
    } else {
        requestBody.max_tokens = maxTokens;
    }

    // 深度思考设置
    if (isThinking) {
        if (isMiMo) {
            requestBody.thinking = { type: 'enabled' };
        } else {
            requestBody.thinking = { type: 'enabled', reasoning_effort: finalAnswerConfig.reasoningEffort || 'medium' };
        }
    }

    console.log('[Workflow] 最终回答请求参数:', {
        model: requestBody.model,
        temperature: requestBody.temperature,
        top_p: requestBody.top_p,
        reasoningEffort: requestBody.thinking?.reasoning_effort,
        finalAnswerConfig: WORKFLOW_MODELS.finalAnswer
    });

    // 获取搜索链接
    const searchLinks = workflowState.results.searchLinks || [];

    // 使用流式响应处理
    await streamResponse(requestBody, config, chatId, searchLinks);
}

/**
 * 降级处理：直接使用DeepSeek回答
 */
async function generateDirectAnswer(userInput, chatId) {
    console.log('[Workflow] 降级到直接回答模式');

    const chatMessages = AppState.chatHistory[chatId]?.messages || AppState.messages;
    const config = AppState.apiConfig.deepseek;

    // 构建上下文消息
    const contextMessages = [];
    for (const msg of chatMessages.slice(-MEMORY_CONFIG.maxContextMessages)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
            let content = msg.content;
            if (Array.isArray(content)) {
                content = content.filter(item => item.type === 'text').map(item => item.text).join('\n');
            }
            if (content) {
                contextMessages.push({ role: msg.role, content });
            }
        }
    }

    const finalMessages = [
        { role: 'system', content: SYSTEM_PROMPTS.default },
        ...contextMessages
    ];

    // 获取模型参数（思考模式下mimo-v2.5-pro和mimo-v2.5不支持自定义temperature）
    const modelParams = getModelParams(WORKFLOW_MODELS.finalAnswer.model, true);

    const requestBody = {
        model: WORKFLOW_MODELS.finalAnswer.model,
        messages: finalMessages,
        max_tokens: 4096,
        stream: true,
        ...modelParams,
        thinking: { type: 'enabled', reasoning_effort: WORKFLOW_MODELS.finalAnswer.reasoningEffort }
    };

    await streamResponse(requestBody, config, chatId);
}

/**
 * 流式响应处理
 */
async function streamResponse(requestBody, config, chatId, searchLinks = []) {
    const chatMessages = AppState.chatHistory[chatId]?.messages || AppState.messages;
    const isCurrentChat = chatId === AppState.currentChatId;

    // 检查最后一条消息是否是加载消息，如果不是则添加
    let loadingMessage = chatMessages[chatMessages.length - 1];
    if (!loadingMessage || !loadingMessage.isLoading) {
        loadingMessage = {
            role: 'assistant',
            content: '内容正在生成中',
            timestamp: new Date().toISOString(),
            isLoading: true
        };
        chatMessages.push(loadingMessage);
    }
    if (isCurrentChat) {
        renderChatMessages();
    }

    // 创建AbortController
    const abortController = new AbortController();
    AppState.generatingChats.set(chatId, abortController);
    if (isCurrentChat) {
        updateSendButton();
    }

    let isUserAborted = false;
    abortController.signal.addEventListener('abort', () => {
        if (!abortController._isTimeout) {
            isUserAborted = true;
        }
    });

    try {
        // 创建带超时的AbortSignal
        const timeoutId = setTimeout(() => {
            abortController._isTimeout = true;
            abortController.abort();
        }, 120000);

        // 根据模型设置请求头
        const headers = { 'Content-Type': 'application/json' };
        if (requestBody.model?.startsWith('mimo-')) {
            headers['api-key'] = config.apiKey;
        } else {
            headers['Authorization'] = `Bearer ${config.apiKey}`;
        }

        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: abortController.signal
        }).finally(() => clearTimeout(timeoutId));

        if (!response.ok) {
            let errorMsg = `API请求失败: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error?.message || errorMsg;
            } catch (e) {
                // 忽略解析错误
            }
            throw new Error(errorMsg);
        }

        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';
        let reasoningContent = '';
        let buffer = '';
        let hasReceivedData = false;
        let hasReceivedFirstContent = false;
        let lastDataTime = Date.now();

        // UI更新节流控制
        const throttleMs = typeof STREAM_THROTTLE_MS !== 'undefined' ? STREAM_THROTTLE_MS : 50;
        let lastUpdateTime = 0;
        let updatePending = false;

        /**
         * 节流更新UI
         */
        const throttledUpdate = () => {
            const now = Date.now();
            if (now - lastUpdateTime >= throttleMs) {
                updateLastMessageContent(chatMessages);
                lastUpdateTime = now;
                updatePending = false;
            } else if (!updatePending) {
                updatePending = true;
                setTimeout(() => {
                    updateLastMessageContent(chatMessages);
                    lastUpdateTime = Date.now();
                    updatePending = false;
                }, throttleMs - (now - lastUpdateTime));
            }
        };

        // 流式读取超时检测
        const streamStartTime = Date.now();
        const streamTimeoutCheck = setInterval(() => {
            const now = Date.now();
            if ((!hasReceivedData && now - streamStartTime > 60000) ||
                (hasReceivedData && now - lastDataTime > 30000)) {
                console.warn('流式响应超时');
                abortController._isTimeout = true;
                reader.cancel();
                clearInterval(streamTimeoutCheck);
            }
        }, 5000);

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                hasReceivedData = true;
                lastDataTime = Date.now();

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;

                    if (trimmedLine.startsWith('data:')) {
                        const data = trimmedLine.slice(5).trim();
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta;
                            if (delta) {
                                // 收到第一个有效内容时，标记流式输出开始
                                if (!hasReceivedFirstContent && (delta.reasoning_content || delta.content)) {
                                    hasReceivedFirstContent = true;
                                    chatMessages[chatMessages.length - 1].isStreaming = true;
                                }
                                if (delta.reasoning_content) {
                                    reasoningContent += delta.reasoning_content;
                                    chatMessages[chatMessages.length - 1].reasoning_content = reasoningContent;
                                    if (isCurrentChat) {
                                        throttledUpdate();
                                    }
                                }
                                if (delta.content) {
                                    assistantContent += delta.content;
                                    chatMessages[chatMessages.length - 1].content = assistantContent;
                                    if (isCurrentChat) {
                                        throttledUpdate();
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('解析SSE数据失败:', data, e);
                        }
                    }
                }
            }
        } finally {
            clearInterval(streamTimeoutCheck);
            // 确保最后一次更新被执行
            if (updatePending && isCurrentChat) {
                updateLastMessageContent(chatMessages);
            }
        }

        // 处理缓冲区中剩余的数据
        if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine && trimmedLine.startsWith('data:')) {
                    const data = trimmedLine.slice(5).trim();
                    if (data !== '[DONE]') {
                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta;
                            if (delta) {
                                if (delta.reasoning_content) {
                                    reasoningContent += delta.reasoning_content;
                                }
                                if (delta.content) {
                                    assistantContent += delta.content;
                                }
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
            if (assistantContent || reasoningContent) {
                chatMessages[chatMessages.length - 1].content = assistantContent;
                chatMessages[chatMessages.length - 1].reasoning_content = reasoningContent;
                if (isCurrentChat) {
                    updateLastMessageContent(chatMessages);
                }
            }
        }

        // 更新最终内容
        chatMessages[chatMessages.length - 1].content = assistantContent || '抱歉，未能获取到响应内容';
        chatMessages[chatMessages.length - 1].reasoning_content = reasoningContent;
        chatMessages[chatMessages.length - 1].isLoading = false;
        chatMessages[chatMessages.length - 1].isStreaming = false;
        chatMessages[chatMessages.length - 1].timestamp = new Date().toISOString();

        // 计算深度思考用时
        const streamEndTime = Date.now();
        const thinkingDuration = ((streamEndTime - streamStartTime) / 1000).toFixed(1);
        chatMessages[chatMessages.length - 1].thinkingDuration = thinkingDuration;

        // 将搜索链接添加到深度思考内容中
        if (searchLinks && searchLinks.length > 0) {
            const linksInfo = searchLinks.map((link, i) => {
                const title = link.title || '未知来源';
                const site = link.siteName ? ` (${link.siteName})` : '';
                const url = link.url || '';
                return `[${i + 1}] ${title}${site} - ${url}`;
            }).join('\n');

            const searchSection = '\n\n---\n' + '**参考来源：**\n' + linksInfo;

            // 添加到reasoning_content
            if (chatMessages[chatMessages.length - 1].reasoning_content) {
                chatMessages[chatMessages.length - 1].reasoning_content += searchSection;
            } else {
                chatMessages[chatMessages.length - 1].reasoning_content = searchSection;
            }
        }

        if (isCurrentChat) {
            renderChatMessages();
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            if (isUserAborted) {
                chatMessages[chatMessages.length - 1].content = '已停止生成';
            } else {
                chatMessages[chatMessages.length - 1].content = '请求超时，请重试';
            }
        } else {
            chatMessages[chatMessages.length - 1].content = `错误: ${error.message}`;
        }
        chatMessages[chatMessages.length - 1].isLoading = false;
        if (isCurrentChat) {
            renderChatMessages();
        }
    } finally {
        // 保存对话到历史
        if (AppState.chatHistory[chatId]) {
            AppState.chatHistory[chatId].updatedAt = new Date().toISOString();
            saveChatHistory();
        }
        AppState.generatingChats.delete(chatId);

        // 检查当前对话是否是正在响应的对话（可能是用户切换回来的）
        const isNowCurrentChat = chatId === AppState.currentChatId;
        if (isNowCurrentChat) {
            renderChatMessages();
            updateSendButton();
        }
    }
}

/**
 * 更新工作流状态UI（动态版本，从活跃工作流读取信息）
 */
function updateWorkflowUI(step, status, chatId) {
    const workflowState = chatId ? getWorkflowState(chatId) : null;

    // 更新步骤状态
    if (workflowState) {
        const stepIndex = workflowState.steps.findIndex(s => s.id === step);
        if (stepIndex >= 0) {
            workflowState.steps[stepIndex].status = status;
        }
    }

    // 只有当前对话才更新UI显示
    if (chatId && chatId !== AppState.currentChatId) return;

    const statusEl = DOM.workflowStatus;
    const stepEl = DOM.workflowStep;
    const progressEl = DOM.workflowProgress;
    const modelEl = DOM.workflowModel;

    if (!statusEl) return;

    statusEl.style.display = 'flex';

    // 更新进度条
    if (workflowState) {
        const completedSteps = workflowState.steps.filter(s =>
            s.status === 'done' || s.status === 'skipped'
        ).length;
        const progress = (completedSteps / workflowState.steps.length) * 100;
        progressEl.style.width = `${progress}%`;
    }

    // 从活跃工作流获取步骤信息
    const activeWorkflow = getActiveWorkflow();
    const stepDef = activeWorkflow?.steps.find(s => s.stepType === step);
    const stepTypeName = WORKFLOW_STEP_TYPES[step]?.name || step;
    const modelDisplay = stepDef ? (MODEL_CONFIG.displayNames[stepDef.config.model] || stepDef.config.model) : '';

    if (step === 'start') {
        stepEl.innerHTML = `
            <span class="step-icon">🔄</span>
            <span class="step-text">准备中...</span>
        `;
        modelEl.textContent = '';
    } else if (step === 'complete') {
        stepEl.innerHTML = `
            <span class="step-icon">✅</span>
            <span class="step-text">回答完成</span>
        `;
        modelEl.textContent = '';
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    } else {
        const icon = status === 'running' ? '🔄' : status === 'done' ? '✅' : '⏭️';
        const statusText = status === 'skipped' ? '已跳过' : `正在${stepTypeName}...`;

        stepEl.innerHTML = `
            <span class="step-icon">${icon}</span>
            <span class="step-text">${statusText}</span>
        `;

        if (status === 'running') {
            modelEl.textContent = modelDisplay;
        } else {
            modelEl.textContent = '';
        }
    }
}

/**
 * 获取相关长期记忆
 */
function getRelevantMemories() {
    // 简单实现：返回最近的记忆
    // 实际应用中可以使用向量相似度等更复杂的方法
    return AppState.longTermMemory
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5);
}

/**
 * 检查并生成上下文摘要
 */
function checkAndSummarizeContext() {
    if (!AppState.memoryConfig.autoSummarize) return;

    const threshold = AppState.memoryConfig.summaryThreshold || 30;
    if (AppState.messages.length >= threshold) {
        generateContextSummary();
    }

    // 使用增强记忆系统提取重要信息
    if (typeof memoryManager !== 'undefined' && memoryManager.constructor.name === 'MemoryManager') {
        try {
            memoryManager.extractFromConversation(AppState.messages);
        } catch (error) {
            console.error('[Memory] 提取记忆失败:', error);
        }
    }
}

/**
 * 生成上下文摘要并保存到长期记忆
 */
function generateContextSummary() {
    // 提取重要信息
    const recentMessages = AppState.messages.slice(-10);
    const importantTopics = extractImportantTopics(recentMessages);

    if (importantTopics.length > 0) {
        const memory = {
            id: 'memory_' + Date.now(),
            content: importantTopics.join('；'),
            timestamp: new Date().toISOString(),
            chatId: AppState.currentChatId
        };

        AppState.longTermMemory.push(memory);

        // 限制长期记忆数量
        const maxMemories = AppState.memoryConfig.maxLongTermMemories || 100;
        if (AppState.longTermMemory.length > maxMemories) {
            AppState.longTermMemory = AppState.longTermMemory.slice(-maxMemories);
        }

        saveLongTermMemory();
    }
}

/**
 * 提取重要话题
 */
function extractImportantTopics(messages) {
    const topics = [];

    messages.forEach(msg => {
        if (msg.role === 'user' && msg.content.length > 20) {
            // 提取用户问题的核心内容
            const summary = msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '');
            topics.push(summary);
        }
    });

    return topics.slice(0, 3); // 最多返回3个话题
}

/**
 * 保存当前对话
 */
function saveCurrentChat() {
    if (AppState.currentChatId && AppState.chatHistory[AppState.currentChatId]) {
        AppState.chatHistory[AppState.currentChatId].messages = AppState.messages;
        AppState.chatHistory[AppState.currentChatId].updatedAt = new Date().toISOString();
        saveChatHistory();
    }
    updateContextInfo();
}

/**
 * 渲染聊天消息
 */
function renderChatMessages() {
    // 移除欢迎消息（如果有消息的话）
    const welcomeMsg = DOM.chatMessages.querySelector('.welcome-message');
    if (welcomeMsg && AppState.messages.length > 0) {
        welcomeMsg.remove();
    }

    // 如果没有消息，显示欢迎消息
    if (AppState.messages.length === 0) {
        DOM.chatMessages.innerHTML = `
            <div class="welcome-message">
                <h1>AI 对话系统</h1>
                <p>集成多个AI模型，支持上下文记忆和历史对话管理</p>
                <div class="feature-tags">
                    <span class="tag">MiMo</span>
                    <span class="tag">DeepSeek</span>
                    <span class="tag">GPT-5.2~5.5</span>
                    <span class="tag">图像生成</span>
                    <span class="tag">上下文记忆</span>
                </div>
            </div>
        `;
        return;
    }

    // 渲染所有消息
    DOM.chatMessages.innerHTML = AppState.messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        // 用户头像：支持自定义图片或emoji
        const userAvatar = AppState.userAvatar || { type: 'image', value: 'logo.png' };
        const avatar = isUser
            ? (userAvatar.type === 'image'
                ? `<img src="${userAvatar.value}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`
                : userAvatar.value)
            : `<img src="logo.png" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
        const roleName = isUser ? '' : 'AI';
        const time = formatTime(msg.timestamp);

        let content = '';
        if (msg.isLoading && !msg.isStreaming) {
            content = '<div class="message-generating">内容正在生成中</div>';
        } else if (isUser && msg.image) {
            // 用户消息包含图片
            const textContent = Array.isArray(msg.content)
                ? msg.content.find(c => c.type === 'text')?.text || ''
                : msg.content;
            content = `<img src="${msg.image}" class="user-image" alt="用户上传的图片">`;
            if (textContent) {
                content += `<p>${escapeHtml(textContent)}</p>`;
            }
        } else {
            // 渲染Markdown内容
            const textContent = Array.isArray(msg.content)
                ? msg.content.find(c => c.type === 'text')?.text || ''
                : msg.content;
            // 如果有思考内容，先渲染思考区域（始终展开）
            if (msg.reasoning_content) {
                content = renderThinkingBlock(msg.reasoning_content, msg.thinkingDuration, true);
            }
            // 如果有生成的图片，渲染图片和下载按钮
            const genImage = msg.generatedImage || (msg.imageId ? ImageStore.getSync(msg.imageId) : null);
            if (genImage) {
                content += `<div class="image-wrapper">`;
                content += `<img src="${genImage}" class="generated-image" alt="AI生成的图片">`;
                content += `<button class="btn-download-image" data-index="${index}" title="下载图片"><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></button>`;
                content += `</div>`;
            }
            // 过滤旧消息中残留的"图像生成完成"文字
            const filteredText = textContent === '图像生成完成' ? '' : textContent;
            content += renderMarkdown(filteredText);
        }

        return `
            <div class="message ${msg.role}" data-index="${index}">
                <div class="message-avatar">${avatar}</div>
                <div class="message-content">
                    <div class="message-header">
                        ${roleName ? `<span class="message-role">${roleName}</span>` : ''}
                    </div>
                    <div class="message-body">${content}
                        <div class="message-footer">
                            <div class="message-actions">
                                <button class="btn-message-action btn-copy" data-index="${index}" title="复制">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </button>
                                <button class="btn-message-action btn-delete" data-index="${index}" title="删除">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                            <span class="message-time">${time}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // 绑定消息操作按钮事件
    bindMessageActions();

    // 滚动到底部
    scrollToBottom();
}

/**
 * 仅更新最后一条消息的内容（用于流式响应，避免页面抖动）
 * @param {Array} messages - 消息数组引用
 */
function updateLastMessageContent(messages) {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    // 找到最后一条AI消息的内容容器
    const messageElements = DOM.chatMessages.querySelectorAll('.message.assistant');
    const lastMessageEl = messageElements[messageElements.length - 1];
    if (!lastMessageEl) return;

    const messageBody = lastMessageEl.querySelector('.message-body');
    if (!messageBody) return;

    // 更新内容：先渲染思考区域，再渲染正文
    const textContent = Array.isArray(lastMsg.content)
        ? lastMsg.content.find(c => c.type === 'text')?.text || ''
        : lastMsg.content;
    let html = '';
    // 检查是否有实际内容（思考内容或对话内容）
    const hasRealContent = lastMsg.reasoning_content || (lastMsg.content && lastMsg.content !== '内容正在生成中');
    if (lastMsg.isLoading && !hasRealContent) {
        // 没有实际内容时显示loading提示
        html = '<div class="message-generating">内容正在生成中</div>';
    } else {
        if (lastMsg.reasoning_content) {
            // 深度思考内容始终展开
            html = renderThinkingBlock(lastMsg.reasoning_content, lastMsg.thinkingDuration, true);
        }
        // 只渲染有效的文本内容，不渲染loading占位文本
        const validText = textContent === '内容正在生成中' ? '' : textContent;
        if (validText) {
            html += renderMarkdown(validText);
        }
    }

    // 找到或创建内容容器（保留 message-footer）
    let contentEl = messageBody.querySelector('.message-content-inner');
    if (!contentEl) {
        // 创建内容容器，将现有内容移入其中
        contentEl = document.createElement('div');
        contentEl.className = 'message-content-inner';
        // 将 message-footer 之前的节点移入内容容器
        const footer = messageBody.querySelector('.message-footer');
        while (messageBody.firstChild && messageBody.firstChild !== footer) {
            contentEl.appendChild(messageBody.firstChild);
        }
        // 在 footer 之前插入内容容器
        if (footer) {
            messageBody.insertBefore(contentEl, footer);
        } else {
            messageBody.appendChild(contentEl);
        }
    }

    // 只有内容变化时才更新DOM
    if (contentEl.innerHTML !== html) {
        contentEl.innerHTML = html;
        // 使用requestAnimationFrame优化滚动
        requestAnimationFrame(() => scrollToBottom());
    }
}

/**
 * 绑定消息操作按钮事件
 */
function bindMessageActions() {
    // 复制按钮
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(btn.dataset.index);
            copyMessageContent(index, btn);
        });
    });

    // 删除按钮
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(btn.dataset.index);
            deleteMessage(index);
        });
    });

    // 下载图片按钮
    document.querySelectorAll('.btn-download-image').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(btn.dataset.index);
            downloadGeneratedImage(index);
        });
    });
}

/**
 * 复制消息内容
 */
function copyMessageContent(index, btn) {
    const msg = AppState.messages[index];
    if (!msg) return;

    // 提取文本内容
    let textContent = '';
    if (Array.isArray(msg.content)) {
        const textPart = msg.content.find(c => c.type === 'text');
        textContent = textPart ? textPart.text : '';
    } else {
        textContent = msg.content || '';
    }

    // 显示复制成功状态
    const showCopied = () => {
        btn.classList.add('copied');
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;

        // 2秒后恢复原状
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            `;
        }, 2000);
    };

    // 复制到剪贴板
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textContent).then(() => {
            showCopied();
        }).catch(() => {
            fallbackCopy(textContent, showCopied);
        });
    } else {
        fallbackCopy(textContent, showCopied);
    }
}

/**
 * 备用复制方案
 */
function fallbackCopy(text, onSuccess) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        onSuccess();
    } catch (err) {
        showToast('复制失败', 'error');
    }
    document.body.removeChild(textarea);
}

/**
 * 删除单条消息
 */
async function deleteMessage(index) {
    if (AppState.messages.length <= 1) {
        showToast('至少需要保留一条消息', 'error');
        return;
    }

    // 使用自定义确认弹窗
    const confirmed = await showConfirm('确定要删除这条消息吗？');
    if (!confirmed) {
        return;
    }

    AppState.messages.splice(index, 1);
    saveCurrentChat();
    renderChatMessages();
}

/**
 * 下载AI生成的图片
 * @param {number} index - 消息索引
 */
function downloadGeneratedImage(index) {
    const msg = AppState.messages[index];
    if (!msg) return;

    const imageUrl = msg.generatedImage || (msg.imageId ? ImageStore.getSync(msg.imageId) : null);
    if (!imageUrl) return;
    const fileName = `ai-image-${Date.now()}.png`;

    if (imageUrl.startsWith('data:')) {
        // base64 data URL：直接创建下载链接
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        // 普通 URL：fetch 转 blob 后下载
        fetch(imageUrl)
            .then(res => res.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            })
            .catch(() => showToast('下载失败', 'error'));
    }
}

/**
 * 渲染Markdown内容 - 自实现版本，不依赖外部库
 */
function renderMarkdown(content) {
    if (!content) return '';

    // 临时存储代码块
    const codeBlocks = [];
    let html = content;

    // 先提取代码块 (```)，避免转义
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const index = codeBlocks.length;
        codeBlocks.push({ lang, code: escapeHtml(code.trim()) });
        return `__CODE_BLOCK_${index}__`;
    });

    // 提取行内代码 (`)
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const index = inlineCodes.length;
        inlineCodes.push(escapeHtml(code));
        return `__INLINE_CODE_${index}__`;
    });

    // 转义HTML特殊字符
    html = escapeHtml(html);

    // 标题 (###### h6 到 # h1)
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // 粗体 (**)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 斜体 (*)
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // 删除线 (~~)
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // 链接 [text](url)
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // 图片 ![alt](url)
    html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;">');

    // 引用 (>)
    html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    // 水平线 (---)
    html = html.replace(/^---$/gm, '<hr>');

    // 无序列表 (- 或 *)
    html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // 有序列表 (1. 2. etc)
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    // 用<ol>包裹连续的<li>（避免与无序列表混合）
    html = html.replace(/(?<!<\/ul>)(<li>.*<\/li>\n?)+/g, function(match) {
        // 检查是否已经被<ul>包裹
        if (match.startsWith('<ul>')) return match;
        return '<ol>' + match + '</ol>';
    });

    // 表格
    html = renderTable(html);

    // 段落 - 将连续的非HTML行包装在<p>标签中
    html = html.replace(/^(?!<[a-z]|__CODE|__INLINE|$)(.+)$/gm, '<p>$1</p>');

    // 恢复代码块（带语言标识、语法高亮、复制、下载和折叠功能）
    codeBlocks.forEach((block, index) => {
        const langClass = block.lang ? ` language-${block.lang}` : '';
        const langLabel = block.lang || 'code';
        const codeId = `code-block-${Date.now()}-${index}`;
        const containerId = `code-container-${Date.now()}-${index}`;
        // 应用语法高亮
        const highlightedCode = highlightCode(block.code, block.lang);
        const codeBlockHtml = `
            <div class="code-block-container" id="${containerId}">
                <div class="code-block-header">
                    <span class="code-block-lang">${escapeHtml(langLabel)}</span>
                    <div class="code-block-actions">
                        <button class="code-block-btn" onclick="toggleCodeBlock('${containerId}')" title="折叠/展开代码">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                            <span>折叠</span>
                        </button>
                        <button class="code-block-btn" onclick="copyCodeBlock('${codeId}')" title="复制代码">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>复制</span>
                        </button>
                        <button class="code-block-btn" onclick="downloadCodeBlock('${codeId}', '${escapeHtml(langLabel)}')" title="下载代码">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>下载</span>
                        </button>
                    </div>
                </div>
                <pre class="code-block-pre"><code id="${codeId}" class="${langClass}">${highlightedCode}</code></pre>
            </div>
        `;
        html = html.replace(`__CODE_BLOCK_${index}__`, codeBlockHtml);
    });

    // 恢复行内代码
    inlineCodes.forEach((code, index) => {
        html = html.replace(`__INLINE_CODE_${index}__`, `<code>${code}</code>`);
    });

    // 清理多余的空行
    html = html.replace(/\n{3,}/g, '\n\n');

    return html;
}

/**
 * 折叠/展开代码块
 * @param {string} containerId - 代码块容器ID
 */
function toggleCodeBlock(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const isCollapsed = container.classList.toggle('collapsed');
    const btn = container.querySelector('.code-block-btn');
    const pre = container.querySelector('.code-block-pre');

    if (btn) {
        if (isCollapsed) {
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                <span>展开</span>
            `;
        } else {
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span>折叠</span>
            `;
        }
    }
}

/**
 * 复制代码块内容
 * @param {string} codeId - 代码块元素ID
 */
function copyCodeBlock(codeId) {
    const codeElement = document.getElementById(codeId);
    if (!codeElement) return;

    const code = codeElement.textContent;
    navigator.clipboard.writeText(code).then(() => {
        // 更新按钮状态
        const btn = codeElement.closest('.code-block-container').querySelector('.code-block-btn');
        if (btn) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>已复制</span>
            `;
            btn.classList.add('copied');
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.remove('copied');
            }, 2000);
        }
        showToast('代码已复制到剪贴板', 'success');
    }).catch(err => {
        console.error('复制失败:', err);
        showToast('复制失败', 'error');
    });
}

/**
 * 下载代码块内容
 * @param {string} codeId - 代码块元素ID
 * @param {string} lang - 代码语言
 */
function downloadCodeBlock(codeId, lang) {
    const codeElement = document.getElementById(codeId);
    if (!codeElement) return;

    const code = codeElement.textContent;
    const extensions = {
        'javascript': '.js', 'js': '.js', 'typescript': '.ts', 'ts': '.ts',
        'python': '.py', 'py': '.py', 'java': '.java', 'c': '.c', 'cpp': '.cpp',
        'csharp': '.cs', 'cs': '.cs', 'go': '.go', 'rust': '.rs', 'ruby': '.rb',
        'php': '.php', 'swift': '.swift', 'kotlin': '.kt', 'scala': '.scala',
        'html': '.html', 'htm': '.htm', 'css': '.css', 'scss': '.scss', 'sass': '.sass',
        'less': '.less', 'xml': '.xml', 'json': '.json', 'yaml': '.yml', 'yml': '.yml',
        'sql': '.sql', 'shell': '.sh', 'bash': '.sh', 'powershell': '.ps1',
        'markdown': '.md', 'md': '.md', 'dockerfile': '.dockerfile',
        'makefile': '.makefile', 'toml': '.toml', 'ini': '.ini', 'cfg': '.cfg'
    };
    const ext = extensions[lang.toLowerCase()] || '.txt';
    const filename = `code${ext}`;

    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`代码已下载为 ${filename}`, 'success');
}

/**
 * 代码语法高亮
 * @param {string} code - 已转义HTML的代码
 * @param {string} lang - 语言类型
 * @returns {string} 高亮后的HTML
 */
/**
 * 应用语法规则到代码
 * @param {string} code - 代码内容
 * @param {Array} rules - 高亮规则数组
 * @returns {string} 高亮后的HTML
 */
function applyHighlightRules(code, rules) {
    let result = code;
    const placeholders = [];
    let placeholderIndex = 0;

    // 先处理需要自定义替换的规则
    rules.forEach(rule => {
        if (rule.replacer) {
            result = result.replace(rule.pattern, (...args) => {
                const replacement = rule.replacer(...args);
                const placeholder = `__HLJS_${placeholderIndex++}__`;
                placeholders.push({ placeholder, replacement });
                return placeholder;
            });
        }
    });

    // 再处理简单的className规则
    rules.forEach(rule => {
        if (rule.className) {
            result = result.replace(rule.pattern, (match, content) => {
                if (!content) return match;
                const placeholder = `__HLJS_${placeholderIndex++}__`;
                placeholders.push({ placeholder, replacement: `<span class="${rule.className}">${content}</span>` });
                return match.replace(content, placeholder);
            });
        }
    });

    // 恢复占位符
    placeholders.forEach(({ placeholder, replacement }) => {
        result = result.replace(placeholder, replacement);
    });

    return result;
}

/**
 * 获取JavaScript高亮规则
 */
function getJavaScriptRules() {
    return [
        { pattern: /(\/\/.*$)/gm, className: 'hljs-comment' },
        { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'hljs-comment' },
        { pattern: /(`(?:[^`\\]|\\.)*`)/g, className: 'hljs-string' },
        { pattern: /('(?:[^'\\]|\\.)*')/g, className: 'hljs-string' },
        { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'hljs-string' },
        { pattern: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|try|catch|finally|throw|async|await|yield|typeof|instanceof|in|of|void|delete|with|debugger|null|undefined|true|false|NaN|Infinity)\b/g, className: 'hljs-keyword' },
        { pattern: /\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, className: 'hljs-number' },
        { pattern: /\b([A-Z][a-zA-Z0-9]*)\b/g, className: 'hljs-class' },
        { pattern: /(\w+)(?=\s*\()/g, className: 'hljs-function' }
    ];
}

/**
 * 获取CSS高亮规则
 */
function getCSSRules() {
    return [
        { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'hljs-comment' },
        { pattern: /(\/\/.*$)/gm, className: 'hljs-comment' },
        { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'hljs-string' },
        { pattern: /('(?:[^'\\]|\\.)*')/g, className: 'hljs-string' },
        { pattern: /(#[0-9a-fA-F]{3,8})\b/g, className: 'hljs-number' },
        { pattern: /\b(\d+\.?\d*(?:px|em|rem|%|vh|vw|deg|s|ms)?)\b/g, className: 'hljs-number' },
        { pattern: /(@[\w-]+|:[\w-]+(?:\(.*?\))?)/g, className: 'hljs-keyword' },
        { pattern: /([\w-]+)(?=\s*\{)/g, className: 'hljs-selector' },
        { pattern: /([\w-]+)(?=\s*:)/g, className: 'hljs-attr' }
    ];
}

/**
 * 获取HTML高亮规则
 */
function getHTMLRules() {
    return [
        { pattern: /(&lt;!--[\s\S]*?--&gt;)/g, className: 'hljs-comment' },
        { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'hljs-string' },
        { pattern: /('(?:[^"\\]|\\.)*')/g, className: 'hljs-string' },
        { pattern: /(&lt;\/?)([\w-]+)/g, replacer: (match, bracket, tag) => `${bracket}<span class="hljs-tag">${tag}</span>` },
        { pattern: /\b([\w-]+)(?==)/g, className: 'hljs-attr' }
    ];
}

/**
 * 代码语法高亮（支持HTML中嵌套CSS和JavaScript）
 * @param {string} code - 已转义HTML的代码
 * @param {string} lang - 语言类型
 * @returns {string} 高亮后的HTML
 */
function highlightCode(code, lang) {
    if (!lang) return code;

    const language = lang.toLowerCase();

    // HTML语言支持嵌套的CSS和JavaScript高亮
    if (['html', 'htm', 'xml', 'svg'].includes(language)) {
        // 提取<style>标签内容
        const styleBlocks = [];
        let processedCode = code.replace(/(&lt;style[\s\S]*?&gt;)([\s\S]*?)(&lt;\/style&gt;)/gi, (match, openTag, cssContent, closeTag) => {
            const index = styleBlocks.length;
            styleBlocks.push(cssContent);
            return `${openTag}__STYLE_BLOCK_${index}__${closeTag}`;
        });

        // 提取<script>标签内容
        const scriptBlocks = [];
        processedCode = processedCode.replace(/(&lt;script[\s\S]*?&gt;)([\s\S]*?)(&lt;\/script&gt;)/gi, (match, openTag, jsContent, closeTag) => {
            const index = scriptBlocks.length;
            scriptBlocks.push(jsContent);
            return `${openTag}__SCRIPT_BLOCK_${index}__${closeTag}`;
        });

        // 高亮HTML部分
        let result = applyHighlightRules(processedCode, getHTMLRules());

        // 高亮CSS部分并恢复
        styleBlocks.forEach((cssContent, index) => {
            const highlightedCSS = applyHighlightRules(cssContent, getCSSRules());
            result = result.replace(`__STYLE_BLOCK_${index}__`, highlightedCSS);
        });

        // 高亮JavaScript部分并恢复
        scriptBlocks.forEach((jsContent, index) => {
            const highlightedJS = applyHighlightRules(jsContent, getJavaScriptRules());
            result = result.replace(`__SCRIPT_BLOCK_${index}__`, highlightedJS);
        });

        return result;
    }

    // 其他语言使用各自的规则
    let rules = [];

    // JavaScript/TypeScript
    if (['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'].includes(language)) {
        rules = getJavaScriptRules();
    }
    // Python
    else if (['python', 'py'].includes(language)) {
        rules = [
            { pattern: /(#.*$)/gm, className: 'hljs-comment' },
            { pattern: /("""[\s\S]*?"""|'''[\s\S]*?''')/g, className: 'hljs-string' },
            { pattern: /('(?:[^'\\]|\\.)*')/g, className: 'hljs-string' },
            { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'hljs-string' },
            { pattern: /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|and|or|not|in|is|True|False|None|self|global|nonlocal|async|await|print)\b/g, className: 'hljs-keyword' },
            { pattern: /\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, className: 'hljs-number' },
            { pattern: /\b([A-Z][a-zA-Z0-9]*)\b/g, className: 'hljs-class' },
            { pattern: /(\w+)(?=\s*\()/g, className: 'hljs-function' }
        ];
    }
    // Java/C/C++/C#/Go/Rust/Swift/Kotlin
    else if (['java', 'c', 'cpp', 'csharp', 'cs', 'go', 'golang', 'rust', 'swift', 'kotlin', 'kt'].includes(language)) {
        rules = [
            { pattern: /(\/\/.*$)/gm, className: 'hljs-comment' },
            { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'hljs-comment' },
            { pattern: /('(?:[^'\\]|\\.)*')/g, className: 'hljs-string' },
            { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'hljs-string' },
            { pattern: /\b(public|private|protected|static|final|abstract|class|interface|extends|implements|return|if|else|for|while|do|switch|case|break|continue|new|this|super|try|catch|finally|throw|throws|import|package|void|int|long|float|double|boolean|char|byte|short|string|true|false|null|var|let|const|func|fn|def|val|mut|struct|enum|mod|use|pub|impl|trait|match|loop|move|async|await|type)\b/g, className: 'hljs-keyword' },
            { pattern: /\b(\d+\.?\d*(?:e[+-]?\d+)?[fFlLuU]?)\b/gi, className: 'hljs-number' },
            { pattern: /\b([A-Z][a-zA-Z0-9]*)\b/g, className: 'hljs-class' },
            { pattern: /(\w+)(?=\s*\()/g, className: 'hljs-function' }
        ];
    }
    // CSS/SCSS/SASS/LESS
    else if (['css', 'scss', 'sass', 'less'].includes(language)) {
        rules = getCSSRules();
    }
    // SQL
    else if (['sql', 'mysql', 'postgresql', 'sqlite'].includes(language)) {
        rules = [
            { pattern: /(--.*$)/gm, className: 'hljs-comment' },
            { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'hljs-comment' },
            { pattern: /('(?:[^'\\]|\\.)*')/g, className: 'hljs-string' },
            { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'hljs-string' },
            { pattern: /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|VIEW|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|AS|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|BEGIN|COMMIT|ROLLBACK|GRANT|REVOKE|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|DEFAULT|AUTO_INCREMENT|SERIAL|TRUE|FALSE|NULLS|ASC|DESC)\b/gi, className: 'hljs-keyword' },
            { pattern: /\b(\d+\.?\d*)\b/g, className: 'hljs-number' }
        ];
    }
    // Shell/Bash
    else if (['shell', 'bash', 'sh', 'zsh', 'powershell', 'ps1'].includes(language)) {
        rules = [
            { pattern: /(#.*$)/gm, className: 'hljs-comment' },
            { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'hljs-string' },
            { pattern: /('(?:[^"\\]|\\.)*')/g, className: 'hljs-string' },
            { pattern: /(\$[\w{}]+)/g, className: 'hljs-variable' },
            { pattern: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|local|export|source|alias|unalias|cd|ls|grep|sed|awk|find|echo|printf|read|test|true|false|sudo|apt|yum|brew|git|docker|npm|pip)\b/g, className: 'hljs-keyword' },
            { pattern: /\b(\d+)\b/g, className: 'hljs-number' }
        ];
    }
    // JSON
    else if (['json'].includes(language)) {
        rules = [
            { pattern: /("(?:[^"\\]|\\.)*")(?=\s*:)/g, className: 'hljs-attr' },
            { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'hljs-string' },
            { pattern: /\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, className: 'hljs-number' },
            { pattern: /\b(true|false|null)\b/g, className: 'hljs-keyword' }
        ];
    }
    // YAML
    else if (['yaml', 'yml'].includes(language)) {
        rules = [
            { pattern: /(#.*$)/gm, className: 'hljs-comment' },
            { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'hljs-string' },
            { pattern: /('(?:[^"\\]|\\.)*')/g, className: 'hljs-string' },
            { pattern: /^([\w-]+)(?=:)/gm, className: 'hljs-attr' },
            { pattern: /\b(\d+\.?\d*)\b/g, className: 'hljs-number' },
            { pattern: /\b(true|false|null|yes|no)\b/gi, className: 'hljs-keyword' }
        ];
    }
    // PHP
    else if (['php'].includes(language)) {
        rules = [
            { pattern: /(\/\/.*$)/gm, className: 'hljs-comment' },
            { pattern: /(#.*$)/gm, className: 'hljs-comment' },
            { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'hljs-comment' },
            { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'hljs-string' },
            { pattern: /('(?:[^"\\]|\\.)*')/g, className: 'hljs-string' },
            { pattern: /(\$[\w]+)/g, className: 'hljs-variable' },
            { pattern: /\b(function|class|if|else|elseif|for|foreach|while|do|switch|case|break|continue|return|new|this|self|static|public|private|protected|abstract|final|interface|extends|implements|use|namespace|try|catch|finally|throw|echo|print|array|list|true|false|null|empty|isset|unset|include|require|include_once|require_once)\b/g, className: 'hljs-keyword' },
            { pattern: /\b(\d+\.?\d*)\b/g, className: 'hljs-number' },
            { pattern: /\b([A-Z][a-zA-Z0-9]*)\b/g, className: 'hljs-class' },
            { pattern: /(\w+)(?=\s*\()/g, className: 'hljs-function' }
        ];
    }
    // Ruby
    else if (['ruby', 'rb'].includes(language)) {
        rules = [
            { pattern: /(#.*$)/gm, className: 'hljs-comment' },
            { pattern: /=begin[\s\S]*?=end/g, className: 'hljs-comment' },
            { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'hljs-string' },
            { pattern: /('(?:[^"\\]|\\.)*')/g, className: 'hljs-string' },
            { pattern: /(:[\w]+)/g, className: 'hljs-symbol' },
            { pattern: /\b(def|end|if|elsif|else|unless|while|until|for|do|class|module|begin|rescue|ensure|raise|return|yield|self|nil|true|false|and|or|not|in|case|when|then|break|next|redo|retry|super|include|require|attr_reader|attr_writer|attr_accessor|private|protected|public)\b/g, className: 'hljs-keyword' },
            { pattern: /\b(\d+\.?\d*)\b/g, className: 'hljs-number' },
            { pattern: /\b([A-Z][a-zA-Z0-9]*)\b/g, className: 'hljs-class' },
            { pattern: /(\w+)(?=\s*\()/g, className: 'hljs-function' }
        ];
    }
    // 通用规则（其他语言）
    else {
        rules = [
            { pattern: /(\/\/.*$)/gm, className: 'hljs-comment' },
            { pattern: /(#.*$)/gm, className: 'hljs-comment' },
            { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'hljs-comment' },
            { pattern: /("(?:[^"\\]|\\.)*")/g, className: 'hljs-string' },
            { pattern: /('(?:[^"\\]|\\.)*')/g, className: 'hljs-string' },
            { pattern: /\b(\d+\.?\d*)\b/g, className: 'hljs-number' }
        ];
    }

    return applyHighlightRules(code, rules);
}

/**
 * 转义HTML特殊字符
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 渲染表格
 */
function renderTable(html) {
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    let result = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 检测表格开始
        if (line.includes('|') && line.startsWith('|') && line.endsWith('|')) {
            if (!inTable) {
                inTable = true;
                tableHtml = '<table>';
                // 表头
                const cells = line.split('|').filter(c => c.trim());
                tableHtml += '<thead><tr>';
                cells.forEach(cell => {
                    tableHtml += `<th>${cell.trim()}</th>`;
                });
                tableHtml += '</tr></thead><tbody>';
            } else if (line.match(/^\|[\s\-|]+\|$/)) {
                // 分隔行，跳过
                continue;
            } else {
                // 表格内容行
                const cells = line.split('|').filter(c => c.trim());
                tableHtml += '<tr>';
                cells.forEach(cell => {
                    tableHtml += `<td>${cell.trim()}</td>`;
                });
                tableHtml += '</tr>';
            }
        } else {
            if (inTable) {
                tableHtml += '</tbody></table>';
                result.push(tableHtml);
                inTable = false;
                tableHtml = '';
            }
            result.push(lines[i]);
        }
    }

    if (inTable) {
        tableHtml += '</tbody></table>';
        result.push(tableHtml);
    }

    return result.join('\n');
}

/**
 * 渲染思考内容折叠块
 * @param {string} reasoningContent - DeepSeek 模型的思维链内容
 * @returns {string} HTML 字符串
 */
function renderThinkingBlock(reasoningContent, duration, expanded = false) {
    if (!reasoningContent) return '';
    // 清理多余空行，保留段落间的单个换行
    const cleanedContent = reasoningContent.replace(/\n{2,}/g, '\n').trim();
    const durationText = duration ? ` (用时${duration}秒)` : '';
    const expandedClass = expanded ? ' expanded' : '';
    return `
        <div class="thinking-content${expandedClass}" onclick="this.classList.toggle('expanded')">
            <div class="thinking-header">
                <div class="thinking-header-left">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                    <span>深度思考过程</span>
                    <span class="thinking-duration">${durationText}</span>
                </div>
                <svg class="thinking-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
            <div class="thinking-body">
                <div class="thinking-text">${renderMarkdown(cleanedContent)}</div>
            </div>
        </div>
    `;
}

/**
 * 渲染历史对话列表
 */
function renderHistoryList() {
    const historyArray = Object.values(AppState.chatHistory)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    DOM.historyList.innerHTML = historyArray.map(chat => {
        const isActive = chat.id === AppState.currentChatId;
        const isSelected = AppState.selectedChats.has(chat.id);
        const time = formatDate(chat.updatedAt);

        return `
            <div class="history-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}" data-chat-id="${chat.id}">
                ${AppState.selectMode ? `<div class="history-item-checkbox ${isSelected ? 'checked' : ''}" data-chat-id="${chat.id}"></div>` : ''}
                <div class="history-item-content">
                    <div class="history-item-title">${chat.title}</div>
                    <div class="history-item-time">${time}</div>
                </div>
                ${!AppState.selectMode ? `
                <button class="history-item-delete" data-chat-id="${chat.id}" title="删除对话">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>` : ''}
            </div>
        `;
    }).join('');

    // 绑定历史项点击事件
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (AppState.selectMode) {
                // 多选模式：切换选中状态
                const chatId = item.dataset.chatId;
                toggleChatSelection(chatId);
            } else if (!e.target.closest('.history-item-delete')) {
                const chatId = item.dataset.chatId;
                loadChat(chatId);
            }
        });
    });

    // 绑定删除按钮事件
    document.querySelectorAll('.history-item-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const chatId = btn.dataset.chatId;
            deleteChat(chatId);
        });
    });

    // 更新多选操作栏显示
    updateSelectActions();
}

/**
 * 切换对话选中状态
 */
function toggleChatSelection(chatId) {
    if (AppState.selectedChats.has(chatId)) {
        AppState.selectedChats.delete(chatId);
    } else {
        AppState.selectedChats.add(chatId);
    }
    renderHistoryList();
}

/**
 * 进入/退出多选模式
 */
function toggleSelectMode() {
    AppState.selectMode = !AppState.selectMode;
    if (!AppState.selectMode) {
        AppState.selectedChats.clear();
    }
    renderHistoryList();
}

/**
 * 全选/取消全选
 */
function toggleSelectAll() {
    const historyArray = Object.values(AppState.chatHistory);
    if (AppState.selectedChats.size === historyArray.length) {
        // 已全选，取消全选
        AppState.selectedChats.clear();
    } else {
        // 全选
        historyArray.forEach(chat => AppState.selectedChats.add(chat.id));
    }
    renderHistoryList();
}

/**
 * 删除选中的对话
 */
function deleteSelectedChats() {
    if (AppState.selectedChats.size === 0) {
        showToast('请先选择要删除的对话', 'warning');
        return;
    }

    const count = AppState.selectedChats.size;
    if (confirm(`确定要删除选中的 ${count} 个对话吗？`)) {
        AppState.selectedChats.forEach(chatId => {
            delete AppState.chatHistory[chatId];
            // 如果删除的是当前对话，重置为新对话
            if (chatId === AppState.currentChatId) {
                initNewChat();
            }
        });

        AppState.selectedChats.clear();
        AppState.selectMode = false;
        saveChatHistory();
        renderHistoryList();
        showToast(`已删除 ${count} 个对话`, 'success');
    }
}

/**
 * 清空所有对话
 */
function clearAllChats() {
    const count = Object.keys(AppState.chatHistory).length;
    if (count === 0) {
        showToast('没有可删除的对话', 'warning');
        return;
    }

    if (confirm(`确定要清空所有 ${count} 个对话吗？此操作不可恢复！`)) {
        AppState.chatHistory = {};
        saveChatHistory();
        initNewChat();
        renderHistoryList();
        showToast('已清空所有对话', 'success');
    }
}

/**
 * 更新多选操作栏显示
 */
function updateSelectActions() {
    const selectActions = document.getElementById('selectActions');
    if (selectActions) {
        selectActions.style.display = AppState.selectMode ? 'flex' : 'none';
    }

    // 更新全选按钮文本
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
        const historyArray = Object.values(AppState.chatHistory);
        selectAllBtn.textContent = AppState.selectedChats.size === historyArray.length ? '取消全选' : '全选';
    }

    // 更新删除按钮状态
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = AppState.selectedChats.size === 0;
        deleteSelectedBtn.textContent = AppState.selectedChats.size > 0 ? `删除选中 (${AppState.selectedChats.size})` : '删除选中';
    }
}

/**
 * 加载对话
 */
function loadChat(chatId) {
    if (AppState.chatHistory[chatId]) {
        AppState.currentChatId = chatId;
        AppState.messages = AppState.chatHistory[chatId].messages || [];
        // 加载已有对话，不是新对话
        AppState.isNewChat = false;

        renderChatMessages();
        renderHistoryList();
        updateContextInfo();

        // 更新工作流状态显示
        syncWorkflowUIForCurrentChat();

        // 加载对话后滚动到底部
        scrollToBottom();

        // 移动端自动关闭侧边栏
        if (window.innerWidth <= 768) {
            closeSidebar();
        }
    }
}

// 工作流UI同步定时器
let _workflowSyncTimer = null;
// 上次更新的进度值（避免重复更新导致动画抖动）
let _lastSyncedProgress = -1;
let _lastSyncedStepId = '';

/**
 * 同步当前对话的工作流状态到UI
 * 切换对话时调用：有任务运行则显示进度，无任务则隐藏
 */
function syncWorkflowUIForCurrentChat() {
    const chatId = AppState.currentChatId;
    const workflowState = getWorkflowState(chatId);
    const statusEl = DOM.workflowStatus;

    if (!statusEl) return;

    // 清除之前的同步定时器
    if (_workflowSyncTimer) {
        clearInterval(_workflowSyncTimer);
        _workflowSyncTimer = null;
    }
    _lastSyncedProgress = -1;
    _lastSyncedStepId = '';

    // 检查当前对话是否有工作流在运行
    if (workflowState.isRunning) {
        // 立即更新一次UI
        updateWorkflowUIForChat(chatId);

        // 启动定时器，每300ms检查一次进度更新（降低频率避免动画抖动）
        _workflowSyncTimer = setInterval(() => {
            const currentState = getWorkflowState(chatId);
            if (chatId !== AppState.currentChatId) {
                // 切换到其他对话，停止定时器
                clearInterval(_workflowSyncTimer);
                _workflowSyncTimer = null;
                return;
            }
            if (!currentState.isRunning) {
                // 工作流刚结束，显示完成状态
                clearInterval(_workflowSyncTimer);
                _workflowSyncTimer = null;
                showWorkflowComplete(chatId);
                return;
            }
            updateWorkflowUIForChat(chatId);
        }, 300);
    } else {
        // 没有工作流在运行，隐藏状态栏（不显示完成状态）
        statusEl.style.display = 'none';
    }

    // 更新发送按钮状态
    updateSendButton();
}

/**
 * 显示工作流完成状态
 */
function showWorkflowComplete(chatId) {
    if (chatId !== AppState.currentChatId) return;

    const statusEl = DOM.workflowStatus;
    const stepEl = DOM.workflowStep;
    const progressEl = DOM.workflowProgress;
    const modelEl = DOM.workflowModel;

    if (!statusEl) return;

    statusEl.style.display = 'flex';
    progressEl.style.width = '100%';
    stepEl.innerHTML = `
        <span class="step-icon">✅</span>
        <span class="step-text">回答完成</span>
    `;
    modelEl.textContent = '';

    // 3秒后隐藏状态栏
    setTimeout(() => {
        if (chatId === AppState.currentChatId) {
            statusEl.style.display = 'none';
        }
    }, 3000);
}

/**
 * 更新指定对话的工作流UI（内部函数）
 */
function updateWorkflowUIForChat(chatId) {
    const workflowState = getWorkflowState(chatId);
    const statusEl = DOM.workflowStatus;
    const stepEl = DOM.workflowStep;
    const progressEl = DOM.workflowProgress;
    const modelEl = DOM.workflowModel;

    if (!statusEl) return;

    statusEl.style.display = 'flex';

    // 计算已完成步骤数
    const completedSteps = workflowState.steps.filter(s =>
        s.status === 'done' || s.status === 'skipped'
    ).length;
    const progress = (completedSteps / workflowState.steps.length) * 100;

    // 只在进度变化时更新进度条（避免动画抖动）
    if (progress !== _lastSyncedProgress) {
        progressEl.style.width = `${progress}%`;
        _lastSyncedProgress = progress;
    }

    // 找到当前正在执行的步骤
    const runningStep = workflowState.steps.find(s => s.status === 'running');
    if (runningStep) {
        // 只在步骤变化时更新文本（避免频繁DOM操作）
        if (runningStep.id !== _lastSyncedStepId) {
            const activeWorkflow = getActiveWorkflow();
            const stepDef = activeWorkflow?.steps.find(s => s.stepType === runningStep.id);
            const stepTypeName = WORKFLOW_STEP_TYPES[runningStep.id]?.name || runningStep.id;
            const modelDisplay = stepDef ? (MODEL_CONFIG.displayNames[stepDef.config.model] || stepDef.config.model) : '';
            stepEl.innerHTML = `
                <span class="step-icon">🔄</span>
                <span class="step-text">正在${stepTypeName}...</span>
            `;
            modelEl.textContent = modelDisplay;
            _lastSyncedStepId = runningStep.id;
        }
    } else if (_lastSyncedStepId !== 'init') {
        // 刚启动，显示准备状态
        stepEl.innerHTML = `
            <span class="step-icon">🔄</span>
            <span class="step-text">准备中...</span>
        `;
        modelEl.textContent = '';
        _lastSyncedStepId = 'init';
    }
}

/**
 * 删除对话
 */
function deleteChat(chatId) {
    if (confirm('确定要删除这个对话吗？')) {
        delete AppState.chatHistory[chatId];
        saveChatHistory();

        // 如果删除的是当前对话，创建新对话
        if (chatId === AppState.currentChatId) {
            initNewChat();
        } else {
            renderHistoryList();
        }

        showToast(ERROR_MESSAGES.deleteSuccess, 'success');
    }
}

/**
 * 保存API配置
 */
function saveApiConfig() {
    AppState.apiConfig = {
        mimo: {
            ...DEFAULT_API_CONFIG.mimo,
            apiKey: document.getElementById('mimoKey').value.trim(),
            endpoint: document.getElementById('mimoEndpoint').value.trim() || DEFAULT_API_CONFIG.mimo.endpoint
        },
        deepseek: {
            ...DEFAULT_API_CONFIG.deepseek,
            apiKey: document.getElementById('deepseekKey').value.trim(),
            endpoint: document.getElementById('deepseekEndpoint').value.trim() || DEFAULT_API_CONFIG.deepseek.endpoint
        },
        image: {
            ...DEFAULT_API_CONFIG.image,
            apiKey: document.getElementById('imageKey').value.trim(),
            endpoint: document.getElementById('imageEndpoint').value.trim() || DEFAULT_API_CONFIG.image.endpoint
        }
    };

    StorageAdapter.saveSync(
        APP_CONFIG.storagePrefix + 'api_config',
        AppState.apiConfig
    );

    showToast(ERROR_MESSAGES.saveSuccess, 'success');
}

/**
 * 保存记忆配置
 */
function saveMemoryConfig() {
    AppState.memoryConfig = {
        maxContextMessages: parseInt(document.getElementById('maxContextMessages').value) || 50,
        summaryThreshold: parseInt(document.getElementById('summaryThreshold').value) || 30,
        enableLongTermMemory: document.getElementById('enableLongTermMemory').checked,
        autoSummarize: document.getElementById('autoSummarize').checked,
        maxLongTermMemories: 100
    };

    StorageAdapter.saveSync(
        APP_CONFIG.storagePrefix + 'memory_config',
        AppState.memoryConfig
    );

    showToast(ERROR_MESSAGES.saveSuccess, 'success');
}

/**
 * 清除所有记忆
 */
function clearAllMemory() {
    if (confirm('确定要清除所有长期记忆吗？此操作不可撤销。')) {
        AppState.longTermMemory = [];
        saveLongTermMemory();
        renderMemoryModal();
        showToast('所有记忆已清除', 'success');
    }
}

/**
 * 渲染记忆模态框
 */
function renderMemoryModal() {
    DOM.currentMessageCount.textContent = AppState.messages.length;
    DOM.longTermMemoryCount.textContent = AppState.longTermMemory.length;

    DOM.memoryItems.innerHTML = AppState.longTermMemory
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map(memory => `
            <div class="memory-item">
                <button class="memory-item-delete" data-memory-id="${memory.id}" title="删除记忆">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                ${memory.content}
                <div class="memory-item-time">${formatDate(memory.timestamp)}</div>
            </div>
        `
        ).join('');

    // 绑定删除事件
    document.querySelectorAll('.memory-item-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const memoryId = btn.dataset.memoryId;
            deleteMemory(memoryId);
        });
    });
}

/**
 * 删除单条记忆
 */
function deleteMemory(memoryId) {
    AppState.longTermMemory = AppState.longTermMemory.filter(m => m.id !== memoryId);
    saveLongTermMemory();
    renderMemoryModal();
    showToast(ERROR_MESSAGES.deleteSuccess, 'success');
}

/**
 * 导出记忆
 */
function exportMemory() {
    const data = {
        exportDate: new Date().toISOString(),
        memories: AppState.longTermMemory,
        chatHistory: AppState.chatHistory
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_chat_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('导出成功', 'success');
}

/**
 * 切换侧边栏显示
 */
function toggleSidebar() {
    if (window.innerWidth <= 768) {
        const isActive = DOM.sidebar.classList.toggle('active');
        // 同步遮罩层状态
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.classList.toggle('active', isActive);
        }
    } else {
        DOM.sidebar.classList.toggle('collapsed');
    }
}

/**
 * 关闭侧边栏（移动端）
 */
function closeSidebar() {
    DOM.sidebar.classList.remove('active');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

/**
 * 关闭移动端下拉菜单
 */
/**
 * 保存用户头像配置
 */
function saveAvatarConfig() {
    StorageAdapter.saveSync(
        APP_CONFIG.storagePrefix + 'user_avatar',
        AppState.userAvatar
    );
    // 重新渲染消息以更新头像显示
    renderChatMessages();
    showToast(ERROR_MESSAGES.saveSuccess, 'success');
}

/**
 * 更新头像设置面板的预览和选中状态
 */
function updateAvatarPanel() {
    const preview = document.getElementById('avatarPreview');
    if (!preview) return;

    // 更新预览
    if (AppState.userAvatar.type === 'image') {
        preview.innerHTML = `<img src="${AppState.userAvatar.value}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
        preview.innerHTML = AppState.userAvatar.value;
    }

    // 更新预设头像选中状态
    document.querySelectorAll('#avatarGrid .avatar-option').forEach(opt => {
        const emoji = opt.getAttribute('data-emoji');
        opt.classList.toggle('active',
            AppState.userAvatar.type === 'emoji' && AppState.userAvatar.value === emoji
        );
    });
}

/**
 * 切换主题（亮色/暗色）
 */
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    StorageAdapter.saveSync(APP_CONFIG.storagePrefix + 'theme', newTheme);

    showToast(newTheme === 'light' ? '已切换到亮色主题' : '已切换到暗色主题', 'info');
}

/**
 * 加载主题设置
 */
function loadTheme() {
    const savedTheme = StorageAdapter.loadSync(APP_CONFIG.storagePrefix + 'theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
}

/**
 * 初始化存储设置面板
 */
async function initStorageSettings() {
    // 更新存储路径显示
    const storagePathInput = document.getElementById('storagePath');
    if (storagePathInput) {
        const dataPath = await StorageAdapter.getDataPath();
        storagePathInput.value = dataPath;
    }

    // 更新数据统计
    updateStorageStats();
}

/**
 * 更新存储统计数据
 */
function updateStorageStats() {
    const chatCountEl = document.getElementById('chatCountStat');
    const memoryCountEl = document.getElementById('memoryCountStat');

    if (chatCountEl) {
        chatCountEl.textContent = Object.keys(AppState.chatHistory).length;
    }
    if (memoryCountEl) {
        memoryCountEl.textContent = AppState.longTermMemory.length;
    }
}

/**
 * 更改存储目录（仅 Electron）
 */
async function changeStoragePath() {
    if (!StorageAdapter.isElectron) {
        showToast('网页版和手机版不支持更改存储目录', 'info');
        return;
    }

    try {
        const result = await window.electronAPI.selectDirectory();
        if (result && result.success && result.path) {
            const storagePathInput = document.getElementById('storagePath');
            if (storagePathInput) {
                storagePathInput.value = result.path;
            }
            showToast('存储目录已更改，重启应用后生效', 'success');
        }
    } catch (error) {
        console.error('选择目录失败:', error);
        showToast('选择目录失败', 'error');
    }
}

/**
 * 导出所有数据
 */
async function exportAllData() {
    const data = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        chatHistory: AppState.chatHistory,
        longTermMemory: AppState.longTermMemory,
        apiConfig: AppState.apiConfig,
        memoryConfig: AppState.memoryConfig,
        customModels: AppState.customModels,
        deepSeekThinking: AppState.deepSeekThinking
    };

    const jsonStr = JSON.stringify(data, null, 2);

    if (StorageAdapter.isElectron) {
        // Electron: 使用系统保存对话框
        try {
            await window.electronAPI.exportData(data);
            showToast('数据导出成功', 'success');
        } catch (error) {
            showToast('导出失败', 'error');
        }
    } else if (StorageAdapter.isMobile) {
        // Mobile: 使用 Capacitor Filesystem
        try {
            const success = await window.MobileAPI.saveFile('ai-chat-backup.json', jsonStr);
            if (success) {
                showToast('数据已保存到 Documents 目录', 'success');
            } else {
                showToast('保存失败，请检查存储权限', 'error');
            }
        } catch (error) {
            console.error('导出数据失败:', error);
            showToast('导出失败: ' + (error.message || '未知错误'), 'error');
        }
    } else {
        // Web: 下载 JSON 文件
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-chat-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('数据导出成功', 'success');
    }
}

/**
 * 导入数据
 */
async function importAllData() {
    if (StorageAdapter.isElectron) {
        // Electron: 使用系统打开对话框
        try {
            const result = await window.electronAPI.importData();
            if (result && result.success && result.data) {
                await applyImportedData(result.data);
            }
        } catch (error) {
            showToast('导入失败', 'error');
        }
    } else if (StorageAdapter.isMobile) {
        // Mobile: 从 Documents 读取
        try {
            const data = await window.MobileAPI.readFile('ai-chat-backup.json');
            if (data) {
                // 处理可能的 base64 编码
                let jsonStr = data;
                if (typeof data === 'string' && !data.startsWith('{')) {
                    // 可能是 base64 编码，尝试解码
                    try {
                        jsonStr = atob(data);
                    } catch (e) {
                        // 不是 base64，直接使用
                        jsonStr = data;
                    }
                }
                await applyImportedData(JSON.parse(jsonStr));
            } else {
                showToast('未找到备份文件，请先导出数据', 'info');
            }
        } catch (error) {
            console.error('导入数据失败:', error);
            showToast('导入失败: ' + (error.message || '文件格式错误'), 'error');
        }
    } else {
        // Web: 使用文件选择器
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                await applyImportedData(data);
            } catch (error) {
                showToast('文件格式错误', 'error');
            }
        };
        input.click();
    }
}

/**
 * 应用导入的数据
 */
async function applyImportedData(data) {
    if (!data || !data.version) {
        showToast('无效的备份文件', 'error');
        return;
    }

    if (!confirm('导入数据将覆盖当前所有数据，确定继续吗？')) {
        return;
    }

    // 恢复数据
    if (data.chatHistory) AppState.chatHistory = data.chatHistory;
    if (data.longTermMemory) AppState.longTermMemory = data.longTermMemory;
    if (data.apiConfig) AppState.apiConfig = data.apiConfig;
    if (data.memoryConfig) AppState.memoryConfig = data.memoryConfig;
    if (data.customModels) AppState.customModels = data.customModels;
    if (data.deepSeekThinking) AppState.deepSeekThinking = data.deepSeekThinking;

    // 保存到本地存储
    saveChatHistory();
    saveLongTermMemory();
    StorageAdapter.saveSync(APP_CONFIG.storagePrefix + 'api_config', AppState.apiConfig);
    StorageAdapter.saveSync(APP_CONFIG.storagePrefix + 'memory_config', AppState.memoryConfig);
    StorageAdapter.saveSync(APP_CONFIG.storagePrefix + 'custom_models', AppState.customModels);
    StorageAdapter.saveSync(APP_CONFIG.storagePrefix + 'deepseek_thinking', AppState.deepSeekThinking);

    // 刷新界面
    loadSettings();
    renderHistoryList();
    updateStorageStats();

    showToast('数据导入成功', 'success');
}

/**
 * 清除所有数据
 */
async function clearAllData() {
    if (!confirm('确定要清除所有数据吗？此操作不可撤销！')) {
        return;
    }
    if (!confirm('再次确认：这将删除所有对话记录、设置和记忆数据。')) {
        return;
    }

    // 清除状态
    AppState.chatHistory = {};
    AppState.longTermMemory = [];
    AppState.apiConfig = JSON.parse(JSON.stringify(DEFAULT_API_CONFIG));
    AppState.memoryConfig = JSON.parse(JSON.stringify(MEMORY_CONFIG));
    AppState.customModels = [];
    AppState.deepSeekThinking = {
        enabled: DEEPSEEK_THINKING_CONFIG.enabled,
        reasoningEffort: DEEPSEEK_THINKING_CONFIG.reasoningEffort
    };

    // 清除本地存储
    localStorage.clear();

    // 重新初始化
    initNewChat();
    loadSettings();
    renderHistoryList();
    updateStorageStats();

    showToast('所有数据已清除', 'success');
}

/**
 * 处理粘贴图片
 */
function handlePasteImage(e) {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items;
    if (!items) return;

    // 查找剪贴板中的图片
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
            e.preventDefault();

            const file = item.getAsFile();
            if (!file) continue;

            // 检查文件大小（限制10MB）
            if (file.size > 10 * 1024 * 1024) {
                showToast('图片大小不能超过10MB', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = function(event) {
                const base64Data = event.target.result;

                // 保存图片数据
                AppState.currentImage = {
                    base64: base64Data,
                    mimeType: file.type
                };

                // 显示预览
                DOM.imagePreview.src = base64Data;
                DOM.imagePreviewContainer.style.display = 'block';

                showToast('图片已粘贴', 'success');
            };
            reader.readAsDataURL(file);

            return;
        }
    }
}

/**
 * 处理图片上传
 */
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件', 'error');
        return;
    }

    // 检查文件大小（限制10MB）
    if (file.size > 10 * 1024 * 1024) {
        showToast('图片大小不能超过10MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const base64Data = event.target.result;

        // 保存图片数据
        AppState.currentImage = {
            base64: base64Data,
            mimeType: file.type
        };

        // 显示预览
        DOM.imagePreview.src = base64Data;
        DOM.imagePreviewContainer.style.display = 'block';
    };
    reader.readAsDataURL(file);

    // 清空input以允许重复上传同一文件
    e.target.value = '';
}

/**
 * 移除已上传的图片
 */
function removeImage() {
    AppState.currentImage = null;
    DOM.imagePreview.src = '';
    DOM.imagePreviewContainer.style.display = 'none';
}

/**
 * 打开模态框
 */
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

/**
 * 关闭模态框
 */
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

/**
 * 切换深度思考和推理强度选项的显示/隐藏
 * @param {string} step - 步骤名称 (intent/answer)
 * @param {string} model - 选择的模型
 */
function toggleThinkingOptions(step, model) {
    const isMiMo = model.startsWith('mimo-');
    const thinkingRow = document.getElementById(`${step}ThinkingRow`);
    const reasoningRow = document.getElementById(`${step}ReasoningRow`);

    if (thinkingRow) {
        // 深度思考选项：所有模型都支持
        thinkingRow.style.display = 'flex';
    }

    if (reasoningRow) {
        // 推理强度选项：只有DeepSeek支持
        reasoningRow.style.display = isMiMo ? 'none' : 'flex';
    }
}

/**
 * 切换工作流管理界面
 */
function toggleWorkflowManager() {
    const workflowManager = document.getElementById('workflowManager');
    const chatContainer = document.getElementById('chatContainer');
    const inputArea = document.querySelector('.input-area');

    if (workflowManager.style.display === 'none') {
        workflowManager.style.display = 'flex';
        chatContainer.style.display = 'none';
        inputArea.style.display = 'none';
        showWorkflowListView();
        closeSidebar();
    } else {
        closeWorkflowManager();
    }
}

/**
 * 关闭工作流管理界面
 */
function closeWorkflowManager() {
    const workflowManager = document.getElementById('workflowManager');
    const chatContainer = document.getElementById('chatContainer');
    const inputArea = document.querySelector('.input-area');

    workflowManager.style.display = 'none';
    chatContainer.style.display = '';
    inputArea.style.display = '';
}

/**
 * 显示工作流列表视图
 */
function showWorkflowListView() {
    document.getElementById('workflowListView').style.display = '';
    document.getElementById('workflowEditorView').style.display = 'none';
    renderWorkflowList();
}

/**
 * 显示工作流编辑器视图
 * @param {string|null} workflowId - 工作流ID，null表示新建
 * @param {boolean} readOnly - 是否只读模式（查看官方工作流）
 */
function showWorkflowEditorView(workflowId, readOnly = false) {
    document.getElementById('workflowListView').style.display = 'none';
    document.getElementById('workflowEditorView').style.display = '';
    initWorkflowEditor(workflowId, readOnly);
}

/**
 * 渲染工作流列表
 */
function renderWorkflowList() {
    const data = loadAllWorkflows();
    const officialList = document.getElementById('officialWorkflowList');
    const userList = document.getElementById('userWorkflowList');

    // 渲染官方工作流
    const officialWorkflows = data.workflows.filter(w => w.isOfficial);
    officialList.innerHTML = officialWorkflows.map(wf => renderWorkflowCard(wf, data.activeWorkflowId)).join('');

    // 渲染用户工作流
    const userWorkflows = data.workflows.filter(w => !w.isOfficial);
    if (userWorkflows.length === 0) {
        userList.innerHTML = '<div class="workflow-empty-hint">暂无自定义工作流，点击上方按钮新建</div>';
    } else {
        userList.innerHTML = userWorkflows.map(wf => renderWorkflowCard(wf, data.activeWorkflowId)).join('');
    }
}

/**
 * 渲染单个工作流卡片
 */
function renderWorkflowCard(workflow, activeId) {
    const isActive = workflow.id === activeId;
    const stepCount = workflow.steps.length;
    const stepNames = workflow.steps.map(s => WORKFLOW_STEP_TYPES[s.stepType]?.name || s.stepType).join(' → ');

    let actionsHtml = '';
    if (workflow.isOfficial) {
        actionsHtml = `
            <div class="workflow-card-actions">
                <button class="btn-workflow-view" onclick="event.stopPropagation(); showWorkflowEditorView('${workflow.id}', true)">查看</button>
            </div>`;
    } else {
        actionsHtml = `
            <div class="workflow-card-actions">
                <button class="btn-workflow-edit" onclick="event.stopPropagation(); showWorkflowEditorView('${workflow.id}')">编辑</button>
                <button class="btn-workflow-delete" onclick="event.stopPropagation(); handleDeleteWorkflow('${workflow.id}')">删除</button>
            </div>`;
    }

    return `
        <div class="workflow-card ${isActive ? 'active' : ''}" onclick="handleSelectWorkflow('${workflow.id}')">
            <div class="workflow-card-radio"></div>
            <div class="workflow-card-info">
                <div class="workflow-card-name">${escapeHtml(workflow.name)}</div>
                <div class="workflow-card-desc" title="${escapeHtml(stepNames)}">${escapeHtml(workflow.description || stepNames)}</div>
            </div>
            <div class="workflow-card-meta">
                <span class="workflow-card-steps">${stepCount}步</span>
                ${workflow.isOfficial ? '<span class="workflow-card-lock" title="官方工作流不可编辑">🔒</span>' : ''}
            </div>
            ${actionsHtml}
        </div>`;
}

/**
 * 选择工作流（切换激活状态）
 */
function handleSelectWorkflow(workflowId) {
    if (setActiveWorkflow(workflowId)) {
        renderWorkflowList();
        showToast('已切换工作流', 'success');
    }
}

/**
 * 删除用户工作流
 */
function handleDeleteWorkflow(workflowId) {
    if (!confirm('确定要删除这个工作流吗？')) return;
    if (deleteUserWorkflow(workflowId)) {
        renderWorkflowList();
        showToast('工作流已删除', 'success');
    }
}

/**
 * 加载工作流配置
 */
function loadWorkflowConfig() {
    const config = AppState.workflowConfig || getDefaultWorkflowConfig();

    // 更新模型选项（根据已配置的Key过滤）
    updateModelOptions('intent', 'stepIntentModel');
    updateModelOptions('image', 'stepImageModel');
    updateModelOptions('search', 'stepSearchModel');
    updateModelOptions('generate', 'stepGenerateModel');
    updateModelOptions('answer', 'stepAnswerModel');

    // 步骤启用状态（检查是否有可用模型）
    const intentEnabled = document.getElementById('stepIntentEnabled');
    const imageEnabled = document.getElementById('stepImageEnabled');
    const searchEnabled = document.getElementById('stepSearchEnabled');
    const generateEnabled = document.getElementById('stepGenerateEnabled');

    intentEnabled.checked = config.steps.intent.enabled && hasAvailableModel('intent');
    intentEnabled.disabled = !hasAvailableModel('intent');

    imageEnabled.checked = config.steps.image.enabled && hasAvailableModel('image');
    imageEnabled.disabled = !hasAvailableModel('image');

    searchEnabled.checked = config.steps.search.enabled && hasAvailableModel('search');
    searchEnabled.disabled = !hasAvailableModel('search');

    generateEnabled.checked = config.steps.generate.enabled && hasAvailableModel('generate');
    generateEnabled.disabled = !hasAvailableModel('generate');

    // 意图识别配置
    const intentModel = document.getElementById('stepIntentModel');
    intentModel.value = hasAvailableModel('intent') ? (getAvailableModels('intent').find(m => m.value === config.steps.intent.model)?.value || getDefaultModel('intent')) : '';
    intentModel.disabled = !hasAvailableModel('intent');
    document.getElementById('stepIntentThinking').value = config.steps.intent.thinking.toString();
    document.getElementById('stepIntentReasoning').value = config.steps.intent.reasoningEffort || 'medium';
    document.getElementById('stepIntentMaxTokens').value = config.steps.intent.maxTokens || 512;
    toggleThinkingOptions('intent', intentModel.value);

    // 图片识别配置
    const imageModel = document.getElementById('stepImageModel');
    imageModel.value = hasAvailableModel('image') ? getDefaultModel('image') : '';
    imageModel.disabled = !hasAvailableModel('image');
    document.getElementById('stepImageMaxTokens').value = config.steps.image.maxTokens || 1024;

    // 联网搜索配置
    const searchModel = document.getElementById('stepSearchModel');
    searchModel.value = hasAvailableModel('search') ? getDefaultModel('search') : '';
    searchModel.disabled = !hasAvailableModel('search');
    document.getElementById('stepSearchLimit').value = config.steps.search.limit;
    document.getElementById('stepSearchMaxKeyword').value = config.steps.search.maxKeyword || 3;
    document.getElementById('stepSearchMaxTokens').value = config.steps.search.maxTokens || 2048;

    // 图片生成配置
    const generateModel = document.getElementById('stepGenerateModel');
    generateModel.value = hasAvailableModel('generate') ? getDefaultModel('generate') : '';
    generateModel.disabled = !hasAvailableModel('generate');
    document.getElementById('stepGenerateSize').value = config.steps.generate.size;
    document.getElementById('stepGenerateQuality').value = config.steps.generate.quality || 'hd';

    // 生成回答配置
    const answerModel = document.getElementById('stepAnswerModel');
    answerModel.value = hasAvailableModel('answer') ? (getAvailableModels('answer').find(m => m.value === config.steps.answer.model)?.value || getDefaultModel('answer')) : '';
    answerModel.disabled = !hasAvailableModel('answer');
    document.getElementById('stepAnswerThinking').value = config.steps.answer.thinking !== false ? 'true' : 'false';
    document.getElementById('stepAnswerReasoning').value = config.steps.answer.reasoningEffort || 'medium';
    document.getElementById('stepAnswerMaxTokens').value = config.steps.answer.maxTokens || 4096;
    toggleThinkingOptions('answer', answerModel.value);

    // 提示词
    document.getElementById('promptIntent').value = config.prompts.intent;
    document.getElementById('promptImage').value = config.prompts.image;
    document.getElementById('promptAnswer').value = config.prompts.answer;
}

/**
 * 更新模型选择下拉框的选项（根据已配置的Key过滤）
 * @param {string} stepType - 步骤类型
 * @param {string} selectId - select元素的ID
 */
function updateModelOptions(stepType, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const availableModels = getAvailableModels(stepType);
    const allModels = select.querySelectorAll('option');

    allModels.forEach(option => {
        const isAvailable = availableModels.some(m => m.value === option.value);
        option.disabled = !isAvailable;
        option.style.display = isAvailable ? '' : 'none';
    });

    // 如果当前选中的模型不可用，选择第一个可用的
    if (availableModels.length > 0 && !availableModels.some(m => m.value === select.value)) {
        select.value = availableModels[0].value;
    }
}

// ============ 工作流多实例管理 ============

/**
 * 生成唯一ID
 */
function generateWorkflowId() {
    return 'wf_user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * 加载所有工作流数据
 * @returns {{ activeWorkflowId: string, workflows: Array }}
 */
function loadAllWorkflows() {
    const data = StorageAdapter.loadSync(APP_CONFIG.storagePrefix + 'workflows');
    if (data && data.workflows && data.workflows.length > 0) {
        // 同步官方工作流的最新定义（确保 connections、position 等字段更新）
        const officialWorkflows = getOfficialWorkflows();
        data.workflows = data.workflows.map(wf => {
            if (wf.isOfficial) {
                const latest = officialWorkflows.find(o => o.id === wf.id);
                if (latest) return latest;
            }
            return wf;
        });
        // 确保有默认的官方工作流
        officialWorkflows.forEach(official => {
            if (!data.workflows.find(w => w.id === official.id)) {
                data.workflows.unshift(official);
            }
        });
        return data;
    }
    // 首次加载，初始化官方工作流
    const initial = { activeWorkflowId: 'wf_official_default', workflows: getOfficialWorkflows() };
    saveAllWorkflows(initial);
    return initial;
}

/**
 * 保存所有工作流数据
 */
function saveAllWorkflows(data) {
    StorageAdapter.saveSync(APP_CONFIG.storagePrefix + 'workflows', data);
}

/**
 * 获取当前激活的工作流
 * @returns {Object|null}
 */
function getActiveWorkflow() {
    const data = loadAllWorkflows();
    return data.workflows.find(w => w.id === data.activeWorkflowId) || data.workflows[0] || null;
}

/**
 * 设置激活的工作流
 */
function setActiveWorkflow(workflowId) {
    const data = loadAllWorkflows();
    if (!data.workflows.find(w => w.id === workflowId)) return false;
    data.activeWorkflowId = workflowId;
    saveAllWorkflows(data);
    return true;
}

/**
 * 创建用户自定义工作流
 * @returns {Object} 创建的工作流对象
 */
function createUserWorkflow(name, description, steps, connections) {
    const data = loadAllWorkflows();
    const workflow = {
        id: generateWorkflowId(),
        name: name || '自定义工作流',
        description: description || '',
        isOfficial: false,
        steps: steps || [{ stepType: 'answer', enabled: true, config: { ...WORKFLOW_STEP_TYPES.answer.defaultConfig } }],
        connections: connections || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    data.workflows.push(workflow);
    saveAllWorkflows(data);
    return workflow;
}

/**
 * 更新用户工作流
 */
function updateUserWorkflow(id, updates) {
    const data = loadAllWorkflows();
    const index = data.workflows.findIndex(w => w.id === id);
    if (index === -1 || data.workflows[index].isOfficial) return false;
    Object.assign(data.workflows[index], updates, { updatedAt: new Date().toISOString() });
    saveAllWorkflows(data);
    return true;
}

/**
 * 删除用户工作流
 */
function deleteUserWorkflow(id) {
    const data = loadAllWorkflows();
    const wf = data.workflows.find(w => w.id === id);
    if (!wf || wf.isOfficial) return false;
    data.workflows = data.workflows.filter(w => w.id !== id);
    // 如果删除的是当前激活的工作流，切换到默认
    if (data.activeWorkflowId === id) {
        data.activeWorkflowId = 'wf_official_default';
    }
    saveAllWorkflows(data);
    return true;
}

/**
 * 迁移旧版工作流配置到新系统
 */
function migrateOldWorkflowConfig() {
    const newKey = APP_CONFIG.storagePrefix + 'workflows';
    const existing = StorageAdapter.loadSync(newKey);
    if (existing && existing.workflows && existing.workflows.length > 0) {
        return; // 已经迁移过
    }

    const oldConfig = StorageAdapter.loadSync(APP_CONFIG.storagePrefix + 'workflow_config');
    const officialWorkflows = getOfficialWorkflows();

    if (oldConfig && oldConfig.steps) {
        // 将旧配置转换为用户工作流
        const migratedWorkflow = {
            id: 'wf_user_migrated',
            name: '迁移的工作流配置',
            description: '从旧版本配置自动迁移',
            isOfficial: false,
            steps: [
                { stepType: 'intent',    enabled: oldConfig.steps.intent?.enabled !== false,    config: { model: oldConfig.steps.intent?.model || 'deepseek-v4-flash', thinking: oldConfig.steps.intent?.thinking || false, reasoningEffort: oldConfig.steps.intent?.reasoningEffort || 'medium', maxTokens: oldConfig.steps.intent?.maxTokens || 512 } },
                { stepType: 'image',     enabled: oldConfig.steps.image?.enabled !== false,     config: { model: oldConfig.steps.image?.model || 'mimo-v2.5', maxTokens: oldConfig.steps.image?.maxTokens || 1024 } },
                { stepType: 'search',    enabled: oldConfig.steps.search?.enabled !== false,    config: { model: oldConfig.steps.search?.model || 'mimo-v2.5-pro', limit: oldConfig.steps.search?.limit || 5, maxKeyword: oldConfig.steps.search?.maxKeyword || 3, maxTokens: oldConfig.steps.search?.maxTokens || 2048 } },
                { stepType: 'generate',  enabled: oldConfig.steps.generate?.enabled !== false,  config: { model: oldConfig.steps.generate?.model || 'gpt-image-2', size: oldConfig.steps.generate?.size || '1792x1024', quality: oldConfig.steps.generate?.quality || 'hd' } },
                { stepType: 'answer',    enabled: true, config: { model: oldConfig.steps.answer?.model || 'deepseek-v4-flash', thinking: oldConfig.steps.answer?.thinking !== false, reasoningEffort: oldConfig.steps.answer?.reasoningEffort || 'medium', maxTokens: oldConfig.steps.answer?.maxTokens || 4096 } }
            ],
            connections: [
                { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 4 },
                { from: 0, to: 3 }, { from: 3, to: 4 }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        saveAllWorkflows({
            activeWorkflowId: 'wf_user_migrated',
            workflows: [...officialWorkflows, migratedWorkflow]
        });
    } else {
        // 无旧配置，初始化官方工作流
        saveAllWorkflows({
            activeWorkflowId: 'wf_official_default',
            workflows: officialWorkflows
        });
    }
}

// ============ 节点连线式工作流编辑器 ============

// 编辑器临时状态
let editorWorkflow = null;
let editorIsNew = false;
let editorReadOnly = false;
let selectedNodeIndex = null;
// 连线绘制状态
let drawingConnection = null; // { fromIndex, fromPort, startX, startY }
// 节点拖拽状态
let draggingNode = null; // { index, offsetX, offsetY }

/**
 * 初始化工作流编辑器
 */
function initWorkflowEditor(workflowId, readOnly = false) {
    editorReadOnly = readOnly;
    selectedNodeIndex = null;
    drawingConnection = null;
    draggingNode = null;

    if (workflowId) {
        const data = loadAllWorkflows();
        const wf = data.workflows.find(w => w.id === workflowId);
        if (!wf) { showWorkflowListView(); return; }
        editorWorkflow = JSON.parse(JSON.stringify(wf));
        // 确保有 connections 和 position
        if (!editorWorkflow.connections) editorWorkflow.connections = [];
        editorWorkflow.steps.forEach((s, i) => {
            if (!s.position) s.position = autoLayoutPosition(i, editorWorkflow.steps.length);
        });
        editorIsNew = false;
        document.getElementById('editorTitle').textContent = readOnly ? '查看工作流' : '编辑工作流';
    } else {
        editorWorkflow = {
            id: null, name: '', description: '', isOfficial: false,
            steps: [{ stepType: 'answer', enabled: true, config: { ...WORKFLOW_STEP_TYPES.answer.defaultConfig }, position: { x: 400, y: 150 } }],
            connections: []
        };
        editorIsNew = true;
        document.getElementById('editorTitle').textContent = '新建工作流';
    }

    const nameInput = document.getElementById('workflowName');
    const descInput = document.getElementById('workflowDesc');
    nameInput.value = editorWorkflow.name;
    descInput.value = editorWorkflow.description || '';
    nameInput.disabled = readOnly;
    descInput.disabled = readOnly;

    document.getElementById('saveWorkflowBtn').style.display = readOnly ? 'none' : '';
    document.getElementById('cancelEditBtn').textContent = readOnly ? '返回' : '取消';

    // 隐藏右侧配置面板（只读模式下隐藏可用步骤）
    const sidebar = document.getElementById('workflowSidebar');
    if (sidebar) {
        const availPanel = document.getElementById('availableStepsPanel')?.parentElement;
        const configPanel = document.getElementById('nodeConfigPanel');
        if (availPanel) availPanel.style.display = readOnly ? 'none' : '';
        if (configPanel) configPanel.style.display = 'none';
    }

    renderCanvas();
    renderAvailableSteps();
    if (!readOnly) initCanvasEvents();
}

/**
 * 自动布局位置计算
 */
function autoLayoutPosition(index, total) {
    const startX = 80;
    const startY = 60;
    const gapX = 260;
    const gapY = 160;
    const cols = Math.max(2, Math.ceil(Math.sqrt(total)));
    const col = index % cols;
    const row = Math.floor(index / cols);
    return { x: startX + col * gapX, y: startY + row * gapY };
}

/**
 * 渲染画布（节点 + 连线）
 */
function renderCanvas() {
    const nodesContainer = document.getElementById('workflowNodes');
    const svgContainer = document.getElementById('workflowConnections');
    if (!nodesContainer || !svgContainer || !editorWorkflow) return;

    // 渲染节点
    nodesContainer.innerHTML = editorWorkflow.steps.map((step, index) => {
        const st = WORKFLOW_STEP_TYPES[step.stepType];
        if (!st) return '';
        const pos = step.position || { x: 80, y: 60 };
        const isSelected = selectedNodeIndex === index;
        const modelDisplay = MODEL_CONFIG.displayNames[step.config.model] || step.config.model;

        return `<div class="workflow-node ${isSelected ? 'selected' : ''} ${!step.enabled ? 'disabled' : ''}"
                     data-node-index="${index}"
                     style="left:${pos.x}px; top:${pos.y}px;">
            <div class="node-header" data-drag-handle="${index}">
                <span class="node-icon">${st.icon}</span>
                <span class="node-title">${st.name}</span>
                ${!editorReadOnly ? `<button class="btn-node-remove" onclick="event.stopPropagation(); removeEditorStep(${index})" title="移除">&times;</button>` : ''}
            </div>
            <div class="node-body">
                <div class="node-model">${modelDisplay}</div>
                <div class="node-actions">
                    <button class="btn-node-toggle ${step.enabled ? 'active' : ''}" onclick="event.stopPropagation(); toggleEditorStepEnabled(${index}, !editorWorkflow.steps[${index}].enabled); renderCanvas();">
                        ${step.enabled ? '启用' : '禁用'}
                    </button>
                    <button class="btn-node-config" onclick="event.stopPropagation(); selectNode(${index})">配置</button>
                </div>
            </div>
            <div class="node-ports">
                <div class="node-port port-in" data-port="in" data-node="${index}" title="输入端口">
                    <span class="port-label">入</span>
                </div>
                <div class="node-port port-out" data-port="out" data-node="${index}" title="出发端口">
                    <span class="port-label">出</span>
                </div>
            </div>
        </div>`;
    }).join('');

    // 渲染连线
    renderConnections();
}

/**
 * 渲染 SVG 连线
 */
function renderConnections() {
    const svg = document.getElementById('workflowConnections');
    if (!svg || !editorWorkflow) return;

    let paths = '';
    const connections = editorWorkflow.connections || [];

    connections.forEach((conn, i) => {
        const fromStep = editorWorkflow.steps[conn.from];
        const toStep = editorWorkflow.steps[conn.to];
        if (!fromStep || !toStep) return;

        const fromPos = fromStep.position || { x: 80, y: 60 };
        const toPos = toStep.position || { x: 80, y: 60 };

        // 出发端口在节点右侧，输入端口在节点左侧
        const startX = fromPos.x + 200; // 节点宽度
        const startY = fromPos.y + 85;  // 端口位置
        const endX = toPos.x;
        const endY = toPos.y + 85;

        const midX = (startX + endX) / 2;
        const d = `M${startX},${startY} C${midX},${startY} ${midX},${endY} ${endX},${endY}`;

        // 透明宽线用于点击检测
        paths += `<path d="${d}" data-conn-index="${i}" fill="none" stroke="transparent" stroke-width="12"
                        style="cursor: ${editorReadOnly ? 'default' : 'pointer'}; pointer-events: stroke;"/>`;
        // 可见连线
        paths += `<path class="connection-path" d="${d}" data-conn-index="${i}" fill="none"
                        stroke="var(--border-color)" stroke-width="2" pointer-events="none"/>`;
    });

    // 临时连线（绘制中）
    if (drawingConnection) {
        const { startX, startY, endX, endY } = drawingConnection;
        const midX = (startX + endX) / 2;
        const d = `M${startX},${startY} C${midX},${startY} ${midX},${endY} ${endX},${endY}`;
        paths += `<path class="temp-path" d="${d}"/>`;
    }

    svg.innerHTML = paths;
}

/**
 * 初始化画布事件（使用事件委托，只绑定一次）
 */
function initCanvasEvents() {
    const canvas = document.getElementById('workflowCanvas');
    if (!canvas || canvas._eventsInitialized) return;
    canvas._eventsInitialized = true;

    // 鼠标按下：开始拖拽节点或绘制连线
    canvas.addEventListener('mousedown', (e) => {
        if (editorReadOnly) return;

        // 检查是否点击端口
        const port = e.target.closest('.node-port');
        if (port) {
            const nodeIndex = parseInt(port.dataset.node);
            const portType = port.dataset.port;
            if (portType === 'out') {
                const step = editorWorkflow.steps[nodeIndex];
                const pos = step.position;
                const canvasRect = canvas.getBoundingClientRect();
                drawingConnection = {
                    fromIndex: nodeIndex,
                    startX: pos.x + 200,
                    startY: pos.y + 85,
                    endX: e.clientX - canvasRect.left + canvas.scrollLeft,
                    endY: e.clientY - canvasRect.top + canvas.scrollTop
                };
                e.preventDefault();
                return;
            }
        }

        // 检查是否拖拽节点
        const dragHandle = e.target.closest('[data-drag-handle]');
        if (dragHandle) {
            const index = parseInt(dragHandle.dataset.dragHandle);
            const node = editorWorkflow.steps[index];
            const canvasRect = canvas.getBoundingClientRect();
            draggingNode = {
                index,
                offsetX: e.clientX - canvasRect.left + canvas.scrollLeft - (node.position?.x || 0),
                offsetY: e.clientY - canvasRect.top + canvas.scrollTop - (node.position?.y || 0)
            };
            e.preventDefault();
        }
    });

    // 鼠标移动
    canvas.addEventListener('mousemove', (e) => {
        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left + canvas.scrollLeft;
        const mouseY = e.clientY - canvasRect.top + canvas.scrollTop;

        if (drawingConnection) {
            drawingConnection.endX = mouseX;
            drawingConnection.endY = mouseY;
            renderConnections();
            return;
        }

        if (draggingNode) {
            const node = editorWorkflow.steps[draggingNode.index];
            if (node) {
                node.position = {
                    x: Math.max(0, mouseX - draggingNode.offsetX),
                    y: Math.max(0, mouseY - draggingNode.offsetY)
                };
                // 直接更新 DOM 位置，不重新渲染整个画布
                const nodeEl = document.querySelector(`.workflow-node[data-node-index="${draggingNode.index}"]`);
                if (nodeEl) {
                    nodeEl.style.left = node.position.x + 'px';
                    nodeEl.style.top = node.position.y + 'px';
                }
                renderConnections();
            }
            return;
        }
    });

    // 鼠标释放
    canvas.addEventListener('mouseup', (e) => {
        if (drawingConnection) {
            // 检查是否释放在目标节点上（整个节点卡片，不限于端口）
            const targetNode = e.target.closest('.workflow-node');
            if (targetNode) {
                const toIndex = parseInt(targetNode.dataset.nodeIndex);
                if (toIndex !== drawingConnection.fromIndex) {
                    const exists = editorWorkflow.connections.some(
                        c => c.from === drawingConnection.fromIndex && c.to === toIndex
                    );
                    if (!exists) {
                        editorWorkflow.connections.push({ from: drawingConnection.fromIndex, to: toIndex });
                    }
                }
            }
            drawingConnection = null;
            renderConnections();
            return;
        }

        if (draggingNode) {
            draggingNode = null;
            return;
        }
    });

    // 点击事件处理
    canvas.addEventListener('click', (e) => {
        // 点击连线（SVG path）
        const target = e.target;
        if (target.tagName === 'path' && target.dataset.connIndex !== undefined && !editorReadOnly) {
            const connIndex = parseInt(target.dataset.connIndex);
            removeConnection(connIndex);
            return;
        }

        // 点击画布空白处取消选中
        if (!e.target.closest('.workflow-node')) {
            selectedNodeIndex = null;
            const configPanel = document.getElementById('nodeConfigPanel');
            if (configPanel) configPanel.style.display = 'none';
            document.querySelectorAll('.workflow-node.selected').forEach(el => el.classList.remove('selected'));
        }
    });

    // 连线 hover 效果
    canvas.addEventListener('mouseover', (e) => {
        const target = e.target;
        if (target.tagName === 'path' && target.dataset.connIndex !== undefined) {
            const connIndex = target.dataset.connIndex;
            const visiblePath = canvas.querySelector(`.connection-path[data-conn-index="${connIndex}"]`);
            if (visiblePath) {
                visiblePath.setAttribute('stroke', '#e74c3c');
                visiblePath.setAttribute('stroke-width', '3');
            }
        }
    });

    canvas.addEventListener('mouseout', (e) => {
        const target = e.target;
        if (target.tagName === 'path' && target.dataset.connIndex !== undefined) {
            const connIndex = target.dataset.connIndex;
            const visiblePath = canvas.querySelector(`.connection-path[data-conn-index="${connIndex}"]`);
            if (visiblePath) {
                visiblePath.setAttribute('stroke', 'var(--border-color)');
                visiblePath.setAttribute('stroke-width', '2');
            }
        }
    });

    // 鼠标离开画布时取消操作
    canvas.addEventListener('mouseleave', () => {
        if (drawingConnection) {
            drawingConnection = null;
            renderConnections();
        }
        if (draggingNode) {
            draggingNode = null;
        }
    });
}

/**
 * 选中节点（显示配置）
 */
function selectNode(index) {
    selectedNodeIndex = index;
    // 更新选中样式
    document.querySelectorAll('.workflow-node').forEach(el => {
        el.classList.toggle('selected', parseInt(el.dataset.nodeIndex) === index);
    });
    renderNodeConfig(index);
}

/**
 * 渲染节点配置面板
 */
function renderNodeConfig(index) {
    const configPanel = document.getElementById('nodeConfigPanel');
    const configContent = document.getElementById('nodeConfigContent');
    if (!configPanel || !configContent || !editorWorkflow) return;

    const step = editorWorkflow.steps[index];
    if (!step) return;

    configPanel.style.display = '';
    const st = WORKFLOW_STEP_TYPES[step.stepType];
    const ro = editorReadOnly ? 'disabled' : '';

    configContent.innerHTML = `
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">${st.icon} ${st.name}</div>
        ${renderNodeConfigFields(step.stepType, step.config, index, ro)}
    `;
}

/**
 * 渲染节点配置字段
 */
function renderNodeConfigFields(stepType, config, index, ro) {
    const models = getAvailableModelsForStepType(stepType);
    let html = `<div class="config-row">
        <label>模型</label>
        <select ${ro} onchange="updateEditorStepConfig(${index}, 'model', this.value); renderNodeConfig(${index});">
            ${models.map(m => `<option value="${m.value}" ${config.model === m.value ? 'selected' : ''}>${m.label}</option>`).join('')}
        </select>
    </div>`;

    if (stepType === 'intent' || stepType === 'answer') {
        const isMiMo = config.model && config.model.startsWith('mimo');
        if (!isMiMo) {
            html += `<div class="config-row"><label>深度思考</label>
                <select ${ro} onchange="updateEditorStepConfig(${index}, 'thinking', this.value==='true')">
                    <option value="false" ${!config.thinking?'selected':''}>关闭</option>
                    <option value="true" ${config.thinking?'selected':''}>开启</option>
                </select></div>
            <div class="config-row"><label>推理强度</label>
                <select ${ro} onchange="updateEditorStepConfig(${index}, 'reasoningEffort', this.value)">
                    <option value="low" ${config.reasoningEffort==='low'?'selected':''}>低</option>
                    <option value="medium" ${config.reasoningEffort==='medium'?'selected':''}>中</option>
                    <option value="high" ${config.reasoningEffort==='high'?'selected':''}>高</option>
                </select></div>`;
        }
    }

    if (stepType !== 'generate') {
        const maxTokens = config.maxTokens || WORKFLOW_STEP_TYPES[stepType].defaultConfig.maxTokens || 1024;
        html += `<div class="config-row"><label>最大Token</label>
            <input type="number" value="${maxTokens}" min="256" max="16384" step="256" ${ro}
                   onchange="updateEditorStepConfig(${index}, 'maxTokens', parseInt(this.value))"></div>`;
    }

    if (stepType === 'search') {
        html += `<div class="config-row"><label>最大结果</label>
            <input type="number" value="${config.limit||5}" min="1" max="15" ${ro}
                   onchange="updateEditorStepConfig(${index}, 'limit', parseInt(this.value))"></div>
        <div class="config-row"><label>最大关键词</label>
            <input type="number" value="${config.maxKeyword||3}" min="1" max="5" ${ro}
                   onchange="updateEditorStepConfig(${index}, 'maxKeyword', parseInt(this.value))"></div>`;
    }

    if (stepType === 'generate') {
        html += `<div class="config-row"><label>图片尺寸</label>
            <select ${ro} onchange="updateEditorStepConfig(${index}, 'size', this.value)">
                <option value="1024x1024" ${config.size==='1024x1024'?'selected':''}>1024x1024</option>
                <option value="1792x1024" ${config.size==='1792x1024'?'selected':''}>1792x1024</option>
                <option value="1024x1792" ${config.size==='1024x1792'?'selected':''}>1024x1792</option>
            </select></div>
        <div class="config-row"><label>图片质量</label>
            <select ${ro} onchange="updateEditorStepConfig(${index}, 'quality', this.value)">
                <option value="standard" ${config.quality==='standard'?'selected':''}>标准</option>
                <option value="hd" ${config.quality==='hd'?'selected':''}>高清</option>
            </select></div>`;
    }

    return html;
}

/**
 * 获取指定步骤类型可用的模型列表
 */
function getAvailableModelsForStepType(stepType) {
    const typeMap = { intent: 'intent', image: 'image', search: 'search', generate: 'generate', answer: 'answer' };
    const mappedType = typeMap[stepType] || stepType;
    const models = getAvailableModels(mappedType);
    if (models.length === 0) {
        const defaultModel = WORKFLOW_STEP_TYPES[stepType]?.defaultConfig.model;
        return [{ value: defaultModel, label: MODEL_CONFIG.displayNames[defaultModel] || defaultModel }];
    }
    return models.map(m => ({ value: m.value, label: MODEL_CONFIG.displayNames[m.value] || m.value }));
}

/**
 * 切换步骤启用状态
 */
function toggleEditorStepEnabled(index, enabled) {
    if (!editorWorkflow || !editorWorkflow.steps[index]) return;
    editorWorkflow.steps[index].enabled = enabled;
}

/**
 * 更新步骤配置
 */
function updateEditorStepConfig(index, key, value) {
    if (!editorWorkflow || !editorWorkflow.steps[index]) return;
    editorWorkflow.steps[index].config[key] = value;
    if (key === 'model') {
        // 只更新节点显示，不重新渲染整个画布
        const nodeEl = document.querySelector(`.workflow-node[data-node-index="${index}"]`);
        if (nodeEl) {
            const modelEl = nodeEl.querySelector('.node-model');
            if (modelEl) modelEl.textContent = MODEL_CONFIG.displayNames[value] || value;
        }
    }
}

/**
 * 移除节点及相关连线
 */
function removeEditorStep(index) {
    if (!editorWorkflow) return;
    editorWorkflow.steps.splice(index, 1);
    // 更新连线索引
    editorWorkflow.connections = editorWorkflow.connections
        .filter(c => c.from !== index && c.to !== index)
        .map(c => ({
            from: c.from > index ? c.from - 1 : c.from,
            to: c.to > index ? c.to - 1 : c.to
        }));
    // 更新选中节点索引
    if (selectedNodeIndex === index) {
        selectedNodeIndex = null;
        const configPanel = document.getElementById('nodeConfigPanel');
        if (configPanel) configPanel.style.display = 'none';
    } else if (selectedNodeIndex > index) {
        selectedNodeIndex--;
    }
    renderCanvas();
    renderAvailableSteps();
}

/**
 * 添加节点到画布（允许同类型多个节点）
 */
function addEditorStep(stepType) {
    if (!editorWorkflow) return;
    const pos = autoLayoutPosition(editorWorkflow.steps.length, editorWorkflow.steps.length + 1);
    editorWorkflow.steps.push({
        stepType, enabled: true,
        config: { ...WORKFLOW_STEP_TYPES[stepType].defaultConfig },
        position: pos
    });
    renderCanvas();
}

/**
 * 删除连线
 */
function removeConnection(index) {
    if (!editorWorkflow || editorReadOnly) return;
    editorWorkflow.connections.splice(index, 1);
    renderConnections();
}

/**
 * 渲染可用步骤面板（允许添加多个同类型节点）
 */
function renderAvailableSteps() {
    const container = document.getElementById('availableStepsPanel');
    if (!container) return;
    container.innerHTML = Object.values(WORKFLOW_STEP_TYPES).map(st => {
        return `<button class="btn-add-step" onclick="addEditorStep('${st.id}')">
            ${st.icon} ${st.name}
        </button>`;
    }).join('');
}

/**
 * 保存工作流编辑
 */
function saveWorkflowEditor() {
    if (!editorWorkflow) return;
    const name = document.getElementById('workflowName').value.trim();
    if (!name) { showToast('请输入工作流名称', 'error'); return; }
    if (editorWorkflow.steps.length === 0) { showToast('请至少添加一个步骤', 'error'); return; }
    if (!editorWorkflow.steps.some(s => s.stepType === 'answer')) {
        showToast('工作流必须包含"大模型输出"步骤', 'error'); return;
    }

    editorWorkflow.name = name;
    editorWorkflow.description = document.getElementById('workflowDesc').value.trim();

    if (editorIsNew) {
        const created = createUserWorkflow(editorWorkflow.name, editorWorkflow.description, editorWorkflow.steps, editorWorkflow.connections);
        setActiveWorkflow(created.id);
        // 新建后切换为编辑模式，不关闭编辑器
        editorWorkflow.id = created.id;
        editorIsNew = false;
        document.getElementById('editorTitle').textContent = '编辑工作流';
        showToast('工作流已创建', 'success');
    } else {
        updateUserWorkflow(editorWorkflow.id, {
            name: editorWorkflow.name,
            description: editorWorkflow.description,
            steps: editorWorkflow.steps,
            connections: editorWorkflow.connections
        });
        showToast('工作流已保存', 'success');
    }
}

/**
 * 获取默认工作流配置
 */
function getDefaultWorkflowConfig() {
    return {
        steps: {
            intent: {
                enabled: true,
                model: 'deepseek-v4-flash',
                thinking: false,
                reasoningEffort: 'medium',
                maxTokens: 512
            },
            image: {
                enabled: true,
                model: 'mimo-v2.5',
                maxTokens: 1024
            },
            search: {
                enabled: true,
                model: 'mimo-v2.5-pro',
                limit: 5,
                maxKeyword: 3,
                maxTokens: 2048
            },
            generate: {
                enabled: true,
                model: 'gpt-image-2',
                size: '1792x1024',
                quality: 'hd'
            },
            answer: {
                enabled: true,
                model: 'deepseek-v4-flash',
                thinking: true,
                reasoningEffort: 'medium',
                maxTokens: 4096
            }
        },
        prompts: {
            intent: WORKFLOW_SYSTEM_PROMPTS.intentAnalysis,
            image: WORKFLOW_SYSTEM_PROMPTS.imageRecognition,
            answer: WORKFLOW_SYSTEM_PROMPTS.finalAnswer
        }
    };
}

/**
 * 保存工作流配置
 */
function saveWorkflowConfig() {
    const config = {
        steps: {
            intent: {
                enabled: document.getElementById('stepIntentEnabled').checked,
                model: document.getElementById('stepIntentModel').value,
                thinking: document.getElementById('stepIntentThinking').value === 'true',
                reasoningEffort: document.getElementById('stepIntentReasoning').value,
                maxTokens: parseInt(document.getElementById('stepIntentMaxTokens').value)
            },
            image: {
                enabled: document.getElementById('stepImageEnabled').checked,
                model: document.getElementById('stepImageModel').value,
                maxTokens: parseInt(document.getElementById('stepImageMaxTokens').value)
            },
            search: {
                enabled: document.getElementById('stepSearchEnabled').checked,
                model: document.getElementById('stepSearchModel').value,
                limit: parseInt(document.getElementById('stepSearchLimit').value),
                maxKeyword: parseInt(document.getElementById('stepSearchMaxKeyword').value),
                maxTokens: parseInt(document.getElementById('stepSearchMaxTokens').value)
            },
            generate: {
                enabled: document.getElementById('stepGenerateEnabled').checked,
                model: document.getElementById('stepGenerateModel').value,
                size: document.getElementById('stepGenerateSize').value,
                quality: document.getElementById('stepGenerateQuality').value
            },
            answer: {
                enabled: true,
                model: document.getElementById('stepAnswerModel').value,
                thinking: document.getElementById('stepAnswerThinking').value === 'true',
                reasoningEffort: document.getElementById('stepAnswerReasoning').value,
                maxTokens: parseInt(document.getElementById('stepAnswerMaxTokens').value)
            }
        },
        prompts: {
            intent: document.getElementById('promptIntent').value,
            image: document.getElementById('promptImage').value,
            answer: document.getElementById('promptAnswer').value
        }
    };

    AppState.workflowConfig = config;
    StorageAdapter.saveSync(APP_CONFIG.storagePrefix + 'workflow_config', config);
    applyWorkflowConfig(config);
    showToast('工作流配置已保存', 'success');
}

/**
 * 重置工作流配置
 */
function resetWorkflowConfig() {
    if (confirm('确定要恢复默认工作流配置吗？')) {
        const config = getDefaultWorkflowConfig();
        AppState.workflowConfig = config;
        StorageAdapter.saveSync(APP_CONFIG.storagePrefix + 'workflow_config', config);
        loadWorkflowConfig();
        applyWorkflowConfig(config);
        showToast('已恢复默认配置', 'success');
    }
}

/**
 * 应用工作流配置
 */
function applyWorkflowConfig(config) {
    // 更新意图识别配置
    WORKFLOW_MODELS.intentAnalysis.model = config.steps.intent.model;
    WORKFLOW_MODELS.intentAnalysis.thinking = config.steps.intent.thinking;
    WORKFLOW_MODELS.intentAnalysis.reasoningEffort = config.steps.intent.reasoningEffort;
    WORKFLOW_MODELS.intentAnalysis.maxTokens = config.steps.intent.maxTokens;

    // 更新图片识别配置
    WORKFLOW_MODELS.imageRecognition.model = config.steps.image.model;
    WORKFLOW_MODELS.imageRecognition.maxTokens = config.steps.image.maxTokens;

    // 更新联网搜索配置
    WORKFLOW_MODELS.webSearch.model = config.steps.search.model;
    WORKFLOW_MODELS.webSearch.maxTokens = config.steps.search.maxTokens;
    WORKFLOW_MODELS.webSearch.maxKeyword = config.steps.search.maxKeyword;
    WORKFLOW_MODELS.webSearch.limit = config.steps.search.limit;

    // 更新图片生成配置
    WORKFLOW_MODELS.generate = {
        model: config.steps.generate.model,
        size: config.steps.generate.size,
        quality: config.steps.generate.quality
    };

    // 更新生成回答配置
    WORKFLOW_MODELS.finalAnswer.model = config.steps.answer.model;
    WORKFLOW_MODELS.finalAnswer.thinking = config.steps.answer.thinking;
    WORKFLOW_MODELS.finalAnswer.reasoningEffort = config.steps.answer.reasoningEffort;
    WORKFLOW_MODELS.finalAnswer.maxTokens = config.steps.answer.maxTokens;

    // 更新提示词
    WORKFLOW_SYSTEM_PROMPTS.intentAnalysis = config.prompts.intent;
    WORKFLOW_SYSTEM_PROMPTS.imageRecognition = config.prompts.image;
    WORKFLOW_SYSTEM_PROMPTS.finalAnswer = config.prompts.answer;

    // 保存步骤启用状态到 AppState
    AppState.workflowStepsEnabled = {
        intent: config.steps.intent.enabled,
        image: config.steps.image.enabled,
        search: config.steps.search.enabled,
        generate: config.steps.generate.enabled
    };
}

/**
 * 切换设置选项卡
 */
function switchTab(tabId) {
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // 更新面板显示
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === tabId + 'Panel');
    });
}

/**
 * 自动调整文本框高度
 */
function autoResizeTextarea() {
    const textarea = DOM.messageInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px';
}

/**
 * 更新字符计数
 */
function updateCharCount() {
    const count = DOM.messageInput.value.length;
    DOM.charCount.textContent = `${count} 字符`;
}

/**
 * 更新上下文信息
 */
function updateContextInfo() {
    const messageCount = AppState.messages.length;
    DOM.contextInfo.textContent = `上下文: ${messageCount} 条消息`;
}

/**
 * 检查指定对话是否正在生成
 */
function isChatGenerating(chatId) {
    return AppState.generatingChats.has(chatId);
}

/**
 * 获取当前对话是否正在生成
 */
function isCurrentChatGenerating() {
    return AppState.currentChatId && isChatGenerating(AppState.currentChatId);
}

/**
 * 更新发送按钮状态
 */
function updateSendButton() {
    if (isCurrentChatGenerating()) {
        DOM.sendBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="6" width="12" height="12" rx="2"></rect>
            </svg>
        `;
        DOM.sendBtn.title = '停止生成';
        DOM.sendBtn.onclick = () => {
            const controller = AppState.generatingChats.get(AppState.currentChatId);
            if (controller) {
                controller.abort();
            }
        };
    } else {
        DOM.sendBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
        `;
        DOM.sendBtn.title = '发送消息';
        DOM.sendBtn.onclick = handleSendMessage;
    }
}

/**
 * 滚动到底部（节流版本）
 */
let _scrollTimer = null;
function scrollToBottom() {
    if (!UI_CONFIG.autoScroll) return;

    // 取消之前的延迟滚动
    if (_scrollTimer) {
        clearTimeout(_scrollTimer);
    }

    // 使用requestAnimationFrame确保DOM已更新
    requestAnimationFrame(() => {
        DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
    });

    // 延迟滚动一次，确保内容完全渲染
    _scrollTimer = setTimeout(() => {
        DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
        _scrollTimer = null;
    }, 100);
}

/**
 * 显示Toast通知
 */
function showToast(message, type = 'info') {
    // 移除现有Toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // 创建新Toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // 显示动画
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, UI_CONFIG.toastDuration);
}

/**
 * 格式化时间
 */
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 格式化日期
 */
function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // 今天内
    if (diff < 86400000 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 本周内
    if (diff < 604800000) {
        const days = ['日', '一', '二', '三', '四', '五', '六'];
        return `周${days[date.getDay()]}`;
    }

    // 更早
    return date.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric'
    });
}

// 初始化应用
document.addEventListener('DOMContentLoaded', initApp);

// ============ 智能体相关工具函数 ============

/**
 * 获取记忆统计
 */
function getMemoryStats() {
    if (typeof memoryManager === 'undefined') {
        return { available: false };
    }

    return {
        available: true,
        ...memoryManager.getStats()
    };
}

/**
 * 搜索记忆
 */
function searchMemory(query, limit = 5) {
    if (typeof memoryManager === 'undefined') {
        return [];
    }

    return memoryManager.getRelevant(query, limit);
}

/**
 * 清空所有记忆
 */
function clearAllMemories() {
    if (typeof memoryManager !== 'undefined') {
        memoryManager.clearAll();
    }

    // 同时清空原有的长期记忆
    AppState.longTermMemory = [];
    saveLongTermMemory();

    showToast('所有记忆已清空', 'info');
}

/**
 * 导出记忆数据
 */
function exportMemories() {
    if (typeof memoryManager === 'undefined') {
        return null;
    }

    return memoryManager.exportAll();
}

/**
 * 导入记忆数据
 */
function importMemories(data) {
    if (typeof memoryManager === 'undefined') {
        return false;
    }

    try {
        memoryManager.importAll(data);
        showToast('记忆数据导入成功', 'info');
        return true;
    } catch (error) {
        console.error('[Memory] 导入记忆失败:', error);
        showToast('记忆数据导入失败', 'error');
        return false;
    }
}

// 将工具函数暴露到全局
window.getMemoryStats = getMemoryStats;
window.searchMemory = searchMemory;
window.clearAllMemories = clearAllMemories;
window.exportMemories = exportMemories;
window.importMemories = importMemories;
