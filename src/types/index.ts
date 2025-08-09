export interface Conversation {

  id: string; // e.g., '1234567890@s.whatsapp.net'

  name: string;

  unreadCount: number;

  lastMessage: {

    text: string;

    timestamp: number;

  };

  avatar: string;

  /** Agent currently assigned to this conversation */

  assignedAgentId?: string;

}


export interface Message {

  id: string; // from Baileys

  chatId: string;

  fromMe: boolean;

  text: string;

  timestamp: number;

  senderName?: string;

}


export interface AgentRule {

  id: string;

  trigger: {

    type: 'keywords'; // Future-proof for more trigger types

    value: string; // Comma-separated keywords

  };

  responses: string[];

  knowledgeFileIds?: string[];

}


export type AgentStatus = 'active' | 'paused' | 'errored' | 'disconnected';


export type AIProvider = 'openai' | 'gemini' | 'anthropic';


export interface AISettings {

  provider: AIProvider;

  apiKey?: string; // optional override, otherwise use env

  knowledgeFileIds: string[];

  systemPrompt: string;

  maxLen: number; // approximate max character or token length

  temperature: number; // 0-1 creativity

}


export type AgentMode = 'rule' | 'ai';


export interface Agent {

  id: string;

  name: string;

  description: string;

  mode: AgentMode;

  rules: AgentRule[];

  fallbackResponse: string;

  aiSettings?: AISettings;

  /** Real-time connection / health status */

  status?: AgentStatus;

}


export interface Stats {

  sent: number;

  received: number;

  activeAgents: number;

  errors: number;

}


export interface KnowledgeFile {

  id:string;

  fileName: string;

  fileType: string;

  size: number; // in bytes

  content: string; // extracted text

  createdAt: number;

}


export interface LogEntry {

  id: string;

  timestamp: number;

  user: string;

  action: string;

  details: string;

  type: 'info' | 'warning' | 'error' | 'success';

}



// --- Dashboard Specific Types ---

export interface TimeSeriesDataPoint {
  date: string;
  Sent?: number;
  Received?: number;
}

export interface ErrorBreakdownPoint {
  name: string;
  value: number;
  fill: string;
}

export interface StatCardData {
  value: number;
  change: string;
  changeType: 'increase' | 'decrease' | 'neutral';
}

export interface DashboardData {
  stats: {
    sent: StatCardData;
    received: StatCardData;
    activeAgents: StatCardData;
    errors: StatCardData;
  };
  messageTrend: TimeSeriesDataPoint[];
  errorBreakdown: ErrorBreakdownPoint[];
  recentErrors: LogEntry[];
}

// ==========================================
// EXTENSIÓN MULTIUSUARIO - AGREGAR AL FINAL
// ==========================================

export interface User {
  id: string;
  name: string;
  email?: string;
  createdAt: number;
  isActive: boolean;
  whatsappStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  /** Agentes asignados a este usuario */
  assignedAgentIds?: string[];
  /** Configuraciones específicas del usuario */
  settings?: {
    timezone?: string;
    language?: string;
    notifications?: boolean;
  };
}

export interface MultiUserWhatsAppState {
  [userId: string]: {
    sock: any | null;
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    qr: string | null;
    account: { id: string; name: string } | null;
    lastDisconnect: { reason: string; date: string } | null;
    /** Stats específicas de este usuario */
    stats?: Stats;
  };
}

// Extender las interfaces existentes para soporte multiusuario
export interface UserConversation extends Conversation {
  /** Usuario propietario de esta conversación */
  userId: string;
}

export interface UserMessage extends Message {
  /** Usuario propietario de este mensaje */
  userId: string;
}

export interface UserAgent extends Agent {
  /** Usuario propietario de este agente */
  userId: string;
  /** Si está compartido entre usuarios */
  isShared?: boolean;
}

export interface UserKnowledgeFile extends KnowledgeFile {
  /** Usuario propietario del archivo */
  userId: string;
  /** Si está compartido entre usuarios */
  isShared?: boolean;
}

export interface UserStats extends Stats {
  /** Usuario específico */
  userId: string;
  /** Estadísticas por agente */
  agentStats?: { [agentId: string]: Stats };
}

export interface UserLogEntry extends LogEntry {
  /** Usuario que generó esta entrada */
  userId: string;
}

// Dashboard multiusuario
export interface MultiUserDashboardData {
  /** Stats globales del sistema */
  globalStats: DashboardData;
  /** Stats por usuario */
  userStats: { [userId: string]: DashboardData };
  /** Usuarios activos */
  activeUsers: User[];
}
