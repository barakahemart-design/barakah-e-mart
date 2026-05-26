export interface CodingSnippet {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
}

export interface MetricRating {
  readability: number;
  security: number;
  efficiency: number;
  maintainability: number;
  complexity: number;
}

export interface CodeAnnotation {
  lineStart: number;
  lineEnd: number;
  title: string;
  text: string;
}

export interface CodeBug {
  severity: "info" | "warning" | "critical";
  message: string;
  line?: number;
}

export interface AnalysisResponse {
  rating: MetricRating;
  complexityExplanation: string;
  explanations: CodeAnnotation[];
  bugs: CodeBug[];
  optimizedCode: string;
  improvements: string[];
  fallback?: boolean;
  error?: string;
}

export interface ConversionResponse {
  convertedCode: string;
  explanation: string;
  fallback?: boolean;
  error?: string;
}

export interface ChatMessage {
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface CodeTheme {
  id: string;
  name: string;
  bg: string;
  text: string;
  lineNum: string;
  keyword: string;
  string: string;
  comment: string;
  number: string;
  cursor: string;
}
