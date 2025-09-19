export interface UploadedFile {
    id: string;
    name: string;
    type: string;
    content: string; // File content as text or base64 encoded string
    isBinary: boolean;
}

export enum FileType {
    CSV = 'csv',
    JSON = 'json',
    Excel = 'excel',
    Sheets = 'sheets',
    PDF = 'pdf',
    SQL = 'sql',
    Other = 'other',
}

export type ChatRole = 'user' | 'model';

export interface ChatMessage { 
    role: ChatRole; 
    text: string; 
}

// Data structures for charts
export interface TimeOfDayData {
    hour: string;
    pnl: number;
    tradeCount: number;
}

export interface WeekdayData {
    weekday: string;
    pnl: number;
    tradeCount: number;
}

export interface EquityCurveDataPoint {
    tradeNumber: number;
    cumulativePnl: number;
}

export interface InstrumentPerformanceData {
    instrument: string;
    netPnl: number;
    winRate: number;
    totalTrades: number;
    profitFactor: number;
}

export interface ChartData {
    timeOfDay: TimeOfDayData[];
    weekday: WeekdayData[];
    equityCurve: EquityCurveDataPoint[];
    instrumentPerformance: InstrumentPerformanceData[];
}

// The comprehensive result from the analysis
export interface AnalysisResult {
    markdownReport: string;
    chartData: ChartData | null;
    suggestedQuestions: string[];
}

// Prediction-related interfaces
export interface TradeSetup {
    symbol: string;
    direction: 'long' | 'short';
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    positionSize: number;
    timeframe: string;
    marketConditions?: {
        weekly?: string;
        daily?: string;
    };
    strategy?: string;
    notes?: string;
}

// Template interface for standardized trade predictions
export interface TradeTemplate {
    id: string;
    name: string;
    description: string;
    template: TradeSetup;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PredictionResult {
    id?: number;
    fileId: string;
    tradeSetup: TradeSetup;
    successProbability: number; // 0-1
    riskLevel: 'low' | 'medium' | 'high';
    expectedReturn?: number;
    suggestedPositionSize?: number;
    confidenceScore: number; // 0-1
    reasoning: string;
    marketConditions?: any;
    predictionDate?: string;
}

export interface PredictionVisualizationData {
    probabilityDistribution: {
        outcome: string;
        probability: number;
        color: string;
    }[];
    riskMetrics: {
        metric: string;
        value: number;
        threshold: number;
        status: 'good' | 'warning' | 'danger';
    }[];
    historicalComparison: {
        similarTrades: number;
        averageReturn: number;
        successRate: number;
    };
}