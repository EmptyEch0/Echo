export interface HealthStatus {
  status: string;
  active_model?: string;
  ollama: {
    status: string;
    models?: string[];
    active_model?: string;
    has_llm?: boolean;
    has_embedding?: boolean;
  };
  total_messages_learned: number;
}

export interface StyleProfile {
  total_messages_learned: number;
  avg_sentence_length: number;
  top_emojis: { emoji: string; count: number }[];
  top_greetings: { greeting: string; count: number }[];
  punctuation_habits: Record<string, number>;
}

export interface SuggestionItem {
  text: string;
  confidence: 'high' | 'medium' | 'learning';
  reason: string;
}

export interface SuggestResponse {
  incoming_message: string;
  suggestions: (string | SuggestionItem)[];
  past_context_used: string[];
}

export interface RewriteResponse {
  original: string;
  rewritten: string;
  mode?: string;
}
