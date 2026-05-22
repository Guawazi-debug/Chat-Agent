/**
 * 增强记忆系统
 * 支持语义搜索、记忆提取整合、记忆关联
 */

/**
 * 记忆项类
 */
class MemoryItem {
    constructor(content, metadata = {}) {
        this.id = this.generateId();
        this.content = content;
        this.metadata = {
            timestamp: Date.now(),
            source: metadata.source || 'user',       // user, ai, system
            type: metadata.type || 'fact',            // fact, preference, task, context
            importance: metadata.importance || 0.5,   // 0-1
            tags: metadata.tags || [],
            relations: metadata.relations || [],       // 关联的其他记忆ID
            accessCount: 0,
            lastAccessed: null
        };
        this.embedding = null;  // 语义向量
    }

    generateId() {
        return 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 访问记忆
     */
    access() {
        this.metadata.accessCount++;
        this.metadata.lastAccessed = Date.now();
    }
}

/**
 * 语义记忆类
 * 支持语义搜索的长期记忆存储
 */
class SemanticMemory {
    constructor() {
        this.memories = new Map();      // ID -> MemoryItem
        this.index = new Map();         // 倒排索引: word -> Set<ID>
        this.maxMemories = 1000;        // 最大记忆数量
        this.embeddingCache = new Map(); // 嵌入缓存
    }

    /**
     * 添加记忆
     */
    add(memory) {
        if (!(memory instanceof MemoryItem)) {
            memory = new MemoryItem(memory);
        }

        // 检查是否超过限制
        if (this.memories.size >= this.maxMemories) {
            this.evictLeastImportant();
        }

        // 生成嵌入向量
        memory.embedding = this.generateEmbedding(memory.content);

        // 添加到索引
        this.addToIndex(memory);

        // 存储记忆
        this.memories.set(memory.id, memory);

        return memory;
    }

    /**
     * 获取记忆
     */
    get(id) {
        const memory = this.memories.get(id);
        if (memory) {
            memory.access();
        }
        return memory;
    }

    /**
     * 删除记忆
     */
    remove(id) {
        const memory = this.memories.get(id);
        if (!memory) return false;

        // 从索引中移除
        this.removeFromIndex(memory);

        // 从存储中移除
        this.memories.delete(id);

        return true;
    }

    /**
     * 语义搜索
     */
    search(query, limit = 5, threshold = 0.3) {
        const queryEmbedding = this.generateEmbedding(query);
        const results = [];

        // 计算相似度
        for (const [id, memory] of this.memories) {
            const similarity = this.calculateSimilarity(queryEmbedding, memory.embedding);

            if (similarity >= threshold) {
                results.push({
                    memory: memory,
                    similarity: similarity,
                    score: this.calculateScore(memory, similarity)
                });
            }
        }

        // 按综合分数排序
        results.sort((a, b) => b.score - a.score);

        // 返回前N个结果
        return results.slice(0, limit).map(r => r.memory);
    }

    /**
     * 关键词搜索
     */
    searchByKeyword(keyword, limit = 5) {
        const results = [];
        const lowerKeyword = keyword.toLowerCase();

        for (const [id, memory] of this.memories) {
            if (memory.content.toLowerCase().includes(lowerKeyword)) {
                results.push(memory);
            }
        }

        // 按重要性排序
        results.sort((a, b) => b.metadata.importance - a.metadata.importance);

        return results.slice(0, limit);
    }

    /**
     * 按标签搜索
     */
    searchByTag(tag, limit = 5) {
        const results = [];

        for (const [id, memory] of this.memories) {
            if (memory.metadata.tags.includes(tag)) {
                results.push(memory);
            }
        }

        results.sort((a, b) => b.metadata.importance - a.metadata.importance);

        return results.slice(0, limit);
    }

    /**
     * 添加到索引
     */
    addToIndex(memory) {
        const words = this.tokenize(memory.content);

        for (const word of words) {
            if (!this.index.has(word)) {
                this.index.set(word, new Set());
            }
            this.index.get(word).add(memory.id);
        }
    }

    /**
     * 从索引移除
     */
    removeFromIndex(memory) {
        const words = this.tokenize(memory.content);

        for (const word of words) {
            const ids = this.index.get(word);
            if (ids) {
                ids.delete(memory.id);
                if (ids.size === 0) {
                    this.index.delete(word);
                }
            }
        }
    }

    /**
     * 分词
     */
    tokenize(text) {
        // 简单的分词实现
        const words = new Set();

        // 英文单词
        const englishWords = text.match(/[a-zA-Z]+/g) || [];
        englishWords.forEach(w => words.add(w.toLowerCase()));

        // 中文字符（单字）
        const chineseChars = text.match(/[一-龥]/g) || [];
        chineseChars.forEach(c => words.add(c));

        // 中文词组（简单2-gram）
        for (let i = 0; i < chineseChars.length - 1; i++) {
            words.add(chineseChars[i] + chineseChars[i + 1]);
        }

        return words;
    }

    /**
     * 生成嵌入向量
     * 使用简化的TF-IDF方法
     */
    generateEmbedding(text) {
        // 检查缓存
        const cacheKey = text.substring(0, 100); // 使用前100字符作为缓存键
        if (this.embeddingCache.has(cacheKey)) {
            return this.embeddingCache.get(cacheKey);
        }

        const words = this.tokenize(text);
        const embedding = new Map();

        // 计算词频
        for (const word of words) {
            embedding.set(word, (embedding.get(word) || 0) + 1);
        }

        // 归一化
        const values = Array.from(embedding.values());
        const magnitude = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));

        if (magnitude > 0) {
            for (const [word, count] of embedding) {
                embedding.set(word, count / magnitude);
            }
        }

        // 缓存结果
        this.embeddingCache.set(cacheKey, embedding);

        return embedding;
    }

    /**
     * 计算相似度（余弦相似度）
     */
    calculateSimilarity(embedding1, embedding2) {
        if (!embedding1 || !embedding2) return 0;

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        // 计算点积
        for (const [word, value1] of embedding1) {
            const value2 = embedding2.get(word);
            if (value2 !== undefined) {
                dotProduct += value1 * value2;
            }
        }

        // 计算范数
        for (const value of embedding1.values()) {
            norm1 += value * value;
        }
        for (const value of embedding2.values()) {
            norm2 += value * value;
        }

        norm1 = Math.sqrt(norm1);
        norm2 = Math.sqrt(norm2);

        if (norm1 === 0 || norm2 === 0) return 0;

        return dotProduct / (norm1 * norm2);
    }

    /**
     * 计算综合分数
     */
    calculateScore(memory, similarity) {
        const importance = memory.metadata.importance;
        const recency = this.calculateRecency(memory);
        const frequency = Math.min(memory.metadata.accessCount / 10, 1);

        // 综合分数：相似度 * 0.4 + 重要性 * 0.3 + 时效性 * 0.2 + 频率 * 0.1
        return similarity * 0.4 + importance * 0.3 + recency * 0.2 + frequency * 0.1;
    }

    /**
     * 计算时效性
     */
    calculateRecency(memory) {
        const age = Date.now() - memory.metadata.timestamp;
        const day = 24 * 60 * 60 * 1000;

        // 1天内=1, 7天内=0.8, 30天内=0.5, 更久=0.3
        if (age < day) return 1;
        if (age < 7 * day) return 0.8;
        if (age < 30 * day) return 0.5;
        return 0.3;
    }

    /**
     * 淘汰最不重要的记忆
     */
    evictLeastImportant() {
        let minScore = Infinity;
        let minId = null;

        for (const [id, memory] of this.memories) {
            const score = memory.metadata.importance * (1 / (memory.metadata.accessCount + 1));
            if (score < minScore) {
                minScore = score;
                minId = id;
            }
        }

        if (minId) {
            this.remove(minId);
        }
    }

    /**
     * 关联记忆
     */
    relate(id1, id2) {
        const memory1 = this.memories.get(id1);
        const memory2 = this.memories.get(id2);

        if (memory1 && memory2) {
            if (!memory1.metadata.relations.includes(id2)) {
                memory1.metadata.relations.push(id2);
            }
            if (!memory2.metadata.relations.includes(id1)) {
                memory2.metadata.relations.push(id1);
            }
            return true;
        }

        return false;
    }

    /**
     * 获取关联记忆
     */
    getRelated(id, limit = 5) {
        const memory = this.memories.get(id);
        if (!memory) return [];

        const related = [];
        for (const relatedId of memory.metadata.relations) {
            const relatedMemory = this.memories.get(relatedId);
            if (relatedMemory) {
                related.push(relatedMemory);
            }
        }

        return related.slice(0, limit);
    }

    /**
     * 获取所有记忆
     */
    getAll() {
        return Array.from(this.memories.values());
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const memories = this.getAll();
        const types = {};
        const sources = {};

        for (const memory of memories) {
            types[memory.metadata.type] = (types[memory.metadata.type] || 0) + 1;
            sources[memory.metadata.source] = (sources[memory.metadata.source] || 0) + 1;
        }

        return {
            total: memories.length,
            maxCapacity: this.maxMemories,
            types: types,
            sources: sources,
            indexSize: this.index.size
        };
    }

    /**
     * 导出为JSON
     */
    toJSON() {
        return {
            memories: Array.from(this.memories.entries()),
            index: Array.from(this.index.entries()).map(([word, ids]) => [word, Array.from(ids)])
        };
    }

    /**
     * 从JSON导入
     */
    fromJSON(data) {
        if (data.memories) {
            this.memories = new Map(data.memories);
        }
        if (data.index) {
            this.index = new Map(data.index.map(([word, ids]) => [word, new Set(ids)]));
        }
    }
}

/**
 * 记忆管理器
 * 整合短期、长期和工作记忆
 */
class MemoryManager {
    constructor() {
        this.shortTerm = [];                // 短期记忆（当前对话）
        this.longTerm = new SemanticMemory(); // 长期记忆（语义索引）
        this.working = {};                  // 工作记忆（当前任务上下文）
        this.maxShortTerm = 50;             // 短期记忆最大数量
        this.consolidationThreshold = 10;   // 巩固阈值
    }

    /**
     * 初始化
     */
    async init() {
        // 从localStorage加载长期记忆
        this.loadLongTermMemory();
        console.log('[Memory] 记忆管理器初始化完成');
    }

    /**
     * 添加短期记忆
     */
    addShortTerm(content, metadata = {}) {
        const memory = new MemoryItem(content, {
            ...metadata,
            source: metadata.source || 'conversation'
        });

        this.shortTerm.push(memory);

        // 检查是否需要巩固
        if (this.shortTerm.length >= this.consolidationThreshold) {
            this.consolidate();
        }

        // 限制短期记忆数量
        if (this.shortTerm.length > this.maxShortTerm) {
            this.shortTerm = this.shortTerm.slice(-this.maxShortTerm);
        }

        return memory;
    }

    /**
     * 添加长期记忆
     */
    addLongTerm(content, metadata = {}) {
        const memory = new MemoryItem(content, {
            ...metadata,
            importance: metadata.importance || 0.7
        });

        this.longTerm.add(memory);
        this.saveLongTermMemory();

        return memory;
    }

    /**
     * 设置工作记忆
     */
    setWorking(key, value) {
        this.working[key] = value;
    }

    /**
     * 获取工作记忆
     */
    getWorking(key) {
        return this.working[key];
    }

    /**
     * 清空工作记忆
     */
    clearWorking() {
        this.working = {};
    }

    /**
     * 搜索相关记忆
     */
    getRelevant(query, limit = 5) {
        // 先搜索长期记忆
        const longTermResults = this.longTerm.search(query, limit);

        // 再搜索短期记忆
        const shortTermResults = this.shortTerm.filter(memory =>
            memory.content.toLowerCase().includes(query.toLowerCase())
        ).slice(0, limit);

        // 合并结果，长期记忆优先
        const combined = [...longTermResults];
        for (const st of shortTermResults) {
            if (!combined.some(lt => lt.id === st.id)) {
                combined.push(st);
            }
        }

        return combined.slice(0, limit);
    }

    /**
     * 从对话中提取重要信息
     */
    async extractFromConversation(messages) {
        const importantMessages = [];

        for (const msg of messages) {
            if (msg.role === 'user') {
                // 提取用户的重要信息
                const importance = this.calculateImportance(msg.content);
                if (importance > 0.5) {
                    importantMessages.push({
                        content: msg.content,
                        importance: importance,
                        type: this.detectContentType(msg.content)
                    });
                }
            }
        }

        // 添加到长期记忆
        for (const msg of importantMessages) {
            this.addLongTerm(msg.content, {
                importance: msg.importance,
                type: msg.type,
                source: 'user'
            });
        }

        return importantMessages;
    }

    /**
     * 计算消息重要性
     */
    calculateImportance(content) {
        let importance = 0.5;

        // 长度因素
        if (content.length > 100) importance += 0.1;
        if (content.length > 300) importance += 0.1;

        // 关键词因素
        const importantKeywords = [
            '重要', '关键', '必须', '需要', '记住',
            'important', 'critical', 'must', 'remember'
        ];

        for (const keyword of importantKeywords) {
            if (content.toLowerCase().includes(keyword)) {
                importance += 0.1;
                break;
            }
        }

        // 问题因素
        if (content.includes('?') || content.includes('？')) {
            importance += 0.1;
        }

        return Math.min(importance, 1);
    }

    /**
     * 检测内容类型
     */
    detectContentType(content) {
        const patterns = [
            { pattern: /喜欢|偏好|习惯|prefer/i, type: 'preference' },
            { pattern: /任务|计划|要做|todo/i, type: 'task' },
            { pattern: /是|等于|表示|means/i, type: 'fact' },
            { pattern: /在|位于|位置|location/i, type: 'context' }
        ];

        for (const { pattern, type } of patterns) {
            if (pattern.test(content)) {
                return type;
            }
        }

        return 'fact';
    }

    /**
     * 巩固记忆（短期 -> 长期）
     */
    consolidate() {
        // 提取重要的短期记忆
        const importantMemories = this.shortTerm.filter(memory =>
            memory.metadata.importance > 0.6
        );

        // 添加到长期记忆
        for (const memory of importantMemories) {
            this.longTerm.add(memory);
        }

        // 清空已巩固的短期记忆
        this.shortTerm = this.shortTerm.filter(memory =>
            memory.metadata.importance <= 0.6
        );

        // 保存长期记忆
        this.saveLongTermMemory();

        console.log(`[Memory] 巩固了 ${importantMemories.length} 条记忆到长期存储`);
    }

    /**
     * 生成上下文摘要
     */
    generateContextSummary(messages, maxLength = 500) {
        if (!messages || messages.length === 0) return '';

        // 提取关键信息
        const keyPoints = [];

        for (const msg of messages.slice(-10)) { // 最近10条消息
            if (msg.role === 'user' && msg.content.length > 20) {
                keyPoints.push(msg.content.substring(0, 100));
            }
        }

        if (keyPoints.length === 0) return '';

        // 生成摘要
        const summary = '最近对话关键点：\n' +
            keyPoints.map((point, i) => `${i + 1}. ${point}`).join('\n');

        return summary.substring(0, maxLength);
    }

    /**
     * 保存长期记忆到localStorage
     */
    saveLongTermMemory() {
        try {
            const data = this.longTerm.toJSON();
            localStorage.setItem('ai_chat_long_term_memory_v2', JSON.stringify(data));
        } catch (e) {
            console.error('[Memory] 保存长期记忆失败:', e);
        }
    }

    /**
     * 从localStorage加载长期记忆
     */
    loadLongTermMemory() {
        try {
            const data = localStorage.getItem('ai_chat_long_term_memory_v2');
            if (data) {
                const parsed = JSON.parse(data);
                this.longTerm.fromJSON(parsed);
                console.log(`[Memory] 加载了 ${this.longTerm.memories.size} 条长期记忆`);
            }
        } catch (e) {
            console.error('[Memory] 加载长期记忆失败:', e);
        }
    }

    /**
     * 清空所有记忆
     */
    clearAll() {
        this.shortTerm = [];
        this.longTerm = new SemanticMemory();
        this.working = {};
        localStorage.removeItem('ai_chat_long_term_memory_v2');
        console.log('[Memory] 已清空所有记忆');
    }

    /**
     * 获取记忆统计
     */
    getStats() {
        return {
            shortTerm: this.shortTerm.length,
            longTerm: this.longTerm.getStats(),
            working: Object.keys(this.working).length
        };
    }

    /**
     * 导出所有记忆
     */
    exportAll() {
        return {
            shortTerm: this.shortTerm,
            longTerm: this.longTerm.getAll(),
            working: this.working,
            exportTime: new Date().toISOString()
        };
    }

    /**
     * 导入记忆
     */
    importAll(data) {
        if (data.shortTerm) {
            this.shortTerm = data.shortTerm;
        }
        if (data.longTerm) {
            for (const memory of data.longTerm) {
                this.longTerm.add(memory);
            }
        }
        if (data.working) {
            this.working = data.working;
        }
        this.saveLongTermMemory();
    }
}

// 创建全局记忆管理器实例
const memoryManager = new MemoryManager();

// 导出到window
window.MemoryItem = MemoryItem;
window.SemanticMemory = SemanticMemory;
window.MemoryManager = MemoryManager;
window.memoryManager = memoryManager;
