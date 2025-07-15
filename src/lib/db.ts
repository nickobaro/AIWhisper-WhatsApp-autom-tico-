
import fs from 'fs/promises';
import path from 'path';
import type { Conversation, Message, Agent, Stats, KnowledgeFile, LogEntry } from '@/types';

// NOTE: This is a simple file-based database for demonstration.
// For a production environment, you should use a robust database like PostgreSQL or MongoDB.

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

async function ensureDbFile(filename: string, defaultContent: string) {
    const filepath = path.join(DATA_DIR, filename);
    try {
        await fs.access(filepath);
    } catch {
        await fs.writeFile(filepath, defaultContent, 'utf-8');
    }
}

// Ensure all DB files exist on startup
(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await ensureDbFile('conversations.json', '[]');
    await ensureDbFile('messages.json', '[]');
    await ensureDbFile('agents.json', '[]');
    await ensureDbFile('knowledge.json', '[]');
    await ensureDbFile('logs.json', '[]');
    await ensureDbFile('stats.json', JSON.stringify({ sent: 0, received: 0, activeAgents: 0, errors: 0 }, null, 2));
})();


async function readFile<T>(filename: string): Promise<T> {
    const filepath = path.join(DATA_DIR, filename);
    const data = await fs.readFile(filepath, 'utf-8');
    if (!data || data.trim() === '') {
        // Empty file – reset to sane defaults
        const fallback = defaultForFile<T>(filename);
        await writeFile(filename, fallback);
        return fallback;
    }
    try {
        return JSON.parse(data) as T;
    } catch (err) {
        console.error(`Corrupt JSON in ${filename}, resetting.`, err);
        const fallback = defaultForFile<T>(filename);
        await writeFile(filename, fallback);
        return fallback;
    }
}

function defaultForFile<T>(filename: string): T {
    switch (filename) {
        case 'stats.json':
            return { sent: 0, received: 0, activeAgents: 0, errors: 0 } as unknown as T;
        default:
            return [] as unknown as T;
    }
}

async function writeFile<T>(filename: string, data: T): Promise<void> {
    const filepath = path.join(DATA_DIR, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Conversations ---
export async function getConversations(): Promise<Conversation[]> {
    const convos = await readFile<Conversation[]>('conversations.json');
    // sort by last message timestamp desc
    return convos.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
    const convos = await getConversations();
    return convos.find(c => c.id === id);
}

export async function updateConversation(id: string, update: Partial<Omit<Conversation, 'id'>>) {
    let convos = await getConversations();
    const existingConvo = convos.find(c => c.id === id);
    if (existingConvo) {
        Object.assign(existingConvo, update);
    } else {
        const newConvo: Conversation = {
            id,
            name: update.name || id.split('@')[0],
            unreadCount: update.unreadCount || 0,
            lastMessage: update.lastMessage || { text: '', timestamp: Date.now() },
            avatar: update.avatar || `https://placehold.co/100x100.png?text=${(update.name || id.charAt(0)).toUpperCase()}`,
        };
        convos.push(newConvo);
    }
    await writeFile('conversations.json', convos);
}


// --- Messages ---
export async function getMessages(chatId: string): Promise<Message[]> {
    const messages = await readFile<Message[]>('messages.json');
    return messages.filter(m => m.chatId === chatId);
}

export async function addMessage(message: Message) {
    const messages = await readFile<Message[]>('messages.json');
    messages.push(message);
    await writeFile('messages.json', messages);
}

// --- Stats ---
export async function getStats(): Promise<Stats> {
    const stats = await readFile<Stats>('stats.json');
    const agents = await getAgents();
    stats.activeAgents = agents.filter(a => a.status === 'active').length;
    return stats;
}

export async function incrementStat(key: 'sent' | 'received' | 'errors') {
    const stats = await readFile<Stats>('stats.json');
    stats[key] = (stats[key] || 0) + 1;
    await writeFile('stats.json', stats);
}

// --- Agents ---
export async function getAgents(): Promise<Agent[]> {
    const agents = await readFile<Agent[]>('agents.json');
    // Backward-compat: default missing status to 'active'
    for (const a of agents) {
        if (!a.status) (a as any).status = 'active';
        if (!(a as any).mode) (a as any).mode = 'rule';
    }
    return agents;
}

export async function getAgent(id: string): Promise<Agent | undefined> {
    const agents = await getAgents();
    return agents.find(a => a.id === id);
}

export async function updateAgent(id: string, update: Partial<Omit<Agent, 'id'>>) {
    const agents = await getAgents();
    const existing = agents.find(a => a.id === id);
    
    if (existing) {
        console.log('Updating agent:', id, 'with update:', update);
        
        // Special handling for AI mode updates
        if (update.mode === 'ai') {
            console.log('Updating AI mode agent settings');
            // Ensure aiSettings exists with proper TypeScript handling
            if (!update.aiSettings) {
                update.aiSettings = {
                    provider: 'openai',
                    apiKey: '',
                    systemPrompt: 'You are a helpful assistant.',
                    maxLen: 500,
                    temperature: 0.7,
                    knowledgeFileIds: []
                };
            } else {
                // Create a new aiSettings object with all required fields
                const currentSettings = update.aiSettings;
                update.aiSettings = {
                    provider: currentSettings.provider || 'openai',
                    apiKey: currentSettings.apiKey || '',
                    systemPrompt: currentSettings.systemPrompt !== undefined && currentSettings.systemPrompt !== null ? currentSettings.systemPrompt : 'You are a helpful assistant.',
                    maxLen: currentSettings.maxLen || 500,
                    temperature: currentSettings.temperature || 0.7,
                    knowledgeFileIds: Array.isArray(currentSettings.knowledgeFileIds) ? currentSettings.knowledgeFileIds : [],
                };
            }
            console.log('Processed updated AI settings:', update.aiSettings);
        }
        
        Object.assign(existing, update);
        console.log('Updated agent:', JSON.stringify(existing, null, 2));
        await writeFile('agents.json', agents);
    }
}

export async function deleteAgent(id: string) {
    const agents = await getAgents();
    const updated = agents.filter(a => a.id !== id);
    await writeFile('agents.json', updated);
}

export async function addAgent(agent: Omit<Agent, 'id' | 'mode'> & Partial<Pick<Agent,'mode'>>) {
    const agents = await getAgents();
    
    // Ensure proper structure for AI mode agents
    if (agent.mode === 'ai') {
        console.log('Adding AI mode agent with settings:', agent.aiSettings);
        // Ensure aiSettings exists and has all required fields
        if (!agent.aiSettings) {
            agent.aiSettings = {
                provider: 'openai',
                apiKey: '',
                systemPrompt: 'You are a helpful assistant.',
                maxLen: 500,
                temperature: 0.7,
                knowledgeFileIds: []
            };
        } else {
            // Create a new aiSettings object with all required fields
            const currentSettings = agent.aiSettings;
            agent.aiSettings = {
                provider: currentSettings.provider || 'openai',
                apiKey: currentSettings.apiKey || '',
                systemPrompt: currentSettings.systemPrompt !== undefined && currentSettings.systemPrompt !== null ? currentSettings.systemPrompt : 'You are a helpful assistant.',
                maxLen: currentSettings.maxLen || 500,
                temperature: currentSettings.temperature || 0.7,
                knowledgeFileIds: Array.isArray(currentSettings.knowledgeFileIds) ? currentSettings.knowledgeFileIds : [],
            };
        }
        console.log('Processed AI settings:', agent.aiSettings);
    }
    
    const newAgent: Agent = {
        id: `agent_${Date.now()}`,
        status: 'active',
        mode: agent.mode || 'rule',
        ...agent
    };
    
    console.log('Saving new agent:', JSON.stringify(newAgent, null, 2));
    agents.push(newAgent);
    await writeFile('agents.json', agents);
    return newAgent;
}

// --- Conversation helpers ---
export async function setConversationAssignedAgent(chatId: string, agentId: string) {
    await updateConversation(chatId, { assignedAgentId: agentId });
}

// --- Knowledge Base ---
export async function getKnowledgeFiles(): Promise<KnowledgeFile[]> {
    return await readFile<KnowledgeFile[]>('knowledge.json');
}

export async function getKnowledgeFile(id: string): Promise<KnowledgeFile | undefined> {
    const files = await getKnowledgeFiles();
    return files.find(f => f.id === id);
}

export async function addKnowledgeFile(fileData: Omit<KnowledgeFile, 'id' | 'createdAt'>): Promise<KnowledgeFile> {
    const files = await getKnowledgeFiles();
    const newFile: KnowledgeFile = {
        id: `file_${Date.now()}`,
        createdAt: Date.now(),
        ...fileData
    };
    files.push(newFile);
    await writeFile('knowledge.json', files);
    return newFile;
}

export async function deleteKnowledgeFile(id: string): Promise<void> {
    let files = await getKnowledgeFiles();
    files = files.filter(f => f.id !== id);
    await writeFile('knowledge.json', files);
}

// --- Logs ---
export async function getLogs(): Promise<LogEntry[]> {
    const logs = await readFile<LogEntry[]>('logs.json');
    return logs.sort((a, b) => b.timestamp - a.timestamp);
}

export async function addLog(logData: Omit<LogEntry, 'id' | 'timestamp'>) {
    const logs = await getLogs();
    const newLog: LogEntry = {
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        ...logData,
    };
    const MAX_LOGS = 100;
    const updatedLogs = [newLog, ...logs].slice(0, MAX_LOGS);
    await writeFile('logs.json', updatedLogs);
}
