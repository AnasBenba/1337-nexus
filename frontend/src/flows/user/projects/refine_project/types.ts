export type RefineJobStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';

export type SuggestionField = 'title' | 'description' | 'content';

export type SuggestionStatus = 'pending' | 'applied' | 'dismissed';

export interface Suggestion {
  id: string;
  field: SuggestionField;
  section_label: string;
  severity: string;
  title: string;
  original_excerpt: string;
  suggested_text: string;
  rationale: string;
  status: SuggestionStatus;
  applied_at?: string | null;
}

export interface CritiqueSummary {
  executive_assessment: string;
  strengths: string[];
}

export interface RefineStatusResponse {
  job_id: string;
  status: RefineJobStatus;
  error_message?: string | null;
  summary?: CritiqueSummary | null;
  suggestions: Suggestion[];
  critique_created_at?: string | null;
  version_token?: string | null;
  is_stale: boolean;
}

export interface RefineResponse {
  job_id: string;
  status: string;
  base_hash: string;
  message: string;
}

export interface ApplySuggestionResponse {
  suggestion_id: string;
  status: string;
  new_version_token: string;
  applied_field: string;
  message: string;
}

export interface DismissSuggestionResponse {
  suggestion_id: string;
  status: string;
}

export type ModalState =
  | 'A' // Start overlay
  | 'B' // Submitting
  | 'C' // Queued / Processing (3-step progress)
  | 'D' // Results (Assessment, Strengths, Suggestions)
  | 'E' // Applying
  | 'F' // Applied
  | 'G' // Stale
  | 'H' // Conflict
  | 'I' // Failed
  | 'J' // Empty
  | 'K'; // Mobile simulation
