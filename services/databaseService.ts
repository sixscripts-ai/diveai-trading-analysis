import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { UploadedFile, ChatMessage, AnalysisResult, PredictionResult, TradeTemplate } from '../types';

export interface DatabaseFile extends UploadedFile {
    fileSize?: number;
    uploadDate: string;
    lastAccessed: string;
    createdAt: string;
    updatedAt: string;
}

export interface DatabaseAnalysisResult {
    id: number;
    fileId: string;
    markdownReport: string;
    chartData: any | null; // TODO: Replace with proper ChartData type from types.ts
    suggestedQuestions: string[];
    analysisDate: string;
    processingTimeMs?: number;
    createdAt: string;
    updatedAt: string;
}

export interface DatabaseChatMessage extends ChatMessage {
    id: number;
    fileId: string;
    messageOrder: number;
    timestamp: string;
    createdAt: string;
}

class DatabaseService {
    private db: Pool;
    private static instance: DatabaseService;

    private constructor() {
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL,
        });
        
        // Initialize database schema
        this.initializeDatabase();
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    private async initializeDatabase(): Promise<void> {
        try {
            // Read and execute schema
            const schemaPath = join(process.cwd(), 'database', 'schema.sql');
            const schema = readFileSync(schemaPath, 'utf-8');
            // We need to modify the schema for postgres. This is a temporary solution.
            const postgresSchema = schema
                .replace(/AUTOINCREMENT/g, '')
                .replace(/INTEGER PRIMARY KEY/g, 'SERIAL PRIMARY KEY')
                .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
                .replace(/ON DELETE CASCADE/g, 'ON DELETE CASCADE')
                // SQLite specific triggers are not needed
                .replace(/CREATE TRIGGER[\s\S]*?END;/g, '');


            await this.db.query(postgresSchema);
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Failed to initialize database:', error);
            // Don't throw error if table already exists
            if ((error as any).code !== '42P07') {
                throw error;
            }
        }
    }

    // File operations
    public async insertFile(file: UploadedFile): Promise<void> {
        const query = `
            INSERT INTO files (id, name, type, content, is_binary, file_size)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        const fileSize = Buffer.from(file.content).length;
        await this.db.query(query, [file.id, file.name, file.type, file.content, file.isBinary, fileSize]);
    }

    public async getFile(id: string): Promise<DatabaseFile | null> {
        const query = `
            SELECT id, name, type, content, is_binary as "isBinary", file_size as "fileSize",
                   upload_date as "uploadDate", last_accessed as "lastAccessed",
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM files WHERE id = $1
        `;
        
        const result = await this.db.query(query, [id]);
        if (result.rows.length === 0) return null;
        
        return result.rows[0];
    }

    public async getAllFiles(): Promise<DatabaseFile[]> {
        const query = `
            SELECT id, name, type, content, is_binary as "isBinary", file_size as "fileSize",
                   upload_date as "uploadDate", last_accessed as "lastAccessed",
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM files ORDER BY upload_date DESC
        `;
        
        const result = await this.db.query(query);
        return result.rows;
    }

    public async deleteFile(id: string): Promise<void> {
        await this.db.query('DELETE FROM files WHERE id = $1', [id]);
    }

    public async updateFileLastAccessed(id: string): Promise<void> {
        await this.db.query('UPDATE files SET last_accessed = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    }

    // Analysis results operations
    public async insertAnalysisResult(fileId: string, result: AnalysisResult, processingTimeMs?: number): Promise<number> {
        const query = `
            INSERT INTO analysis_results (file_id, markdown_report, chart_data, suggested_questions, processing_time_ms)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `;
        
        const res = await this.db.query(query, [
            fileId,
            result.markdownReport,
            result.chartData ? JSON.stringify(result.chartData) : null,
            JSON.stringify(result.suggestedQuestions),
            processingTimeMs
        ]);
        
        return res.rows[0].id;
    }

    public async getAnalysisResult(fileId: string): Promise<DatabaseAnalysisResult | null> {
        const query = `
            SELECT id, file_id as "fileId", markdown_report as "markdownReport",
                   chart_data as "chartData", suggested_questions as "suggestedQuestions",
                   analysis_date as "analysisDate", processing_time_ms as "processingTimeMs",
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM analysis_results WHERE file_id = $1 ORDER BY analysis_date DESC LIMIT 1
        `;
        
        const result = await this.db.query(query, [fileId]);
        if (result.rows.length === 0) return null;
        
        const row = result.rows[0];
        return {
            ...row,
            chartData: row.chartData ? JSON.parse(row.chartData) : null,
            suggestedQuestions: JSON.parse(row.suggestedQuestions)
        };
    }

    public async getAllAnalysisResults(): Promise<Record<string, AnalysisResult>> {
        const query = `
            SELECT DISTINCT ON (file_id) file_id as "fileId", markdown_report as "markdownReport",
                   chart_data as "chartData", suggested_questions as "suggestedQuestions"
            FROM analysis_results 
            ORDER BY file_id, analysis_date DESC
        `;
        
        const results = await this.db.query(query);
        const analysisResults: Record<string, AnalysisResult> = {};
        
        results.rows.forEach(result => {
            analysisResults[result.fileId] = {
                markdownReport: result.markdownReport,
                chartData: result.chartData ? JSON.parse(result.chartData) : null,
                suggestedQuestions: JSON.parse(result.suggestedQuestions)
            };
        });
        
        return analysisResults;
    }

    public async deleteAnalysisResults(fileId: string): Promise<void> {
        await this.db.query('DELETE FROM analysis_results WHERE file_id = $1', [fileId]);
    }

    // Chat messages operations
    public async insertChatMessage(fileId: string, message: ChatMessage, order: number): Promise<number> {
        const query = `
            INSERT INTO chat_messages (file_id, role, message_text, message_order)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `;
        
        const res = await this.db.query(query, [fileId, message.role, message.text, order]);
        return res.rows[0].id;
    }

    public async getChatHistory(fileId: string): Promise<ChatMessage[]> {
        const query = `
            SELECT role, message_text as text
            FROM chat_messages 
            WHERE file_id = $1 
            ORDER BY message_order ASC
        `;
        
        const result = await this.db.query(query, [fileId]);
        return result.rows;
    }

    public async getAllChatHistory(): Promise<Record<string, ChatMessage[]>> {
        const query = `
            SELECT file_id as "fileId", role, message_text as text
            FROM chat_messages 
            ORDER BY file_id, message_order ASC
        `;
        
        const results = await this.db.query(query);
        const chatHistory: Record<string, ChatMessage[]> = {};
        
        results.rows.forEach(result => {
            if (!chatHistory[result.fileId]) {
                chatHistory[result.fileId] = [];
            }
            chatHistory[result.fileId].push({
                role: result.role,
                text: result.text
            });
        });
        
        return chatHistory;
    }

    public async setChatHistory(fileId: string, messages: ChatMessage[]): Promise<void> {
        await this.db.query('DELETE FROM chat_messages WHERE file_id = $1', [fileId]);
        
        const query = `
            INSERT INTO chat_messages (file_id, role, message_text, message_order)
            VALUES ($1, $2, $3, $4)
        `;
        
        for (let i = 0; i < messages.length; i++) {
            await this.db.query(query, [fileId, messages[i].role, messages[i].text, i]);
        }
    }

    public async deleteChatHistory(fileId: string): Promise<void> {
        await this.db.query('DELETE FROM chat_messages WHERE file_id = $1', [fileId]);
    }

    // Prediction operations
    public async insertPrediction(prediction: PredictionResult): Promise<number> {
        const query = `
            INSERT INTO predictions (
                file_id, trade_setup, success_probability, risk_level, 
                expected_return, suggested_position_size, confidence_score, 
                reasoning, market_conditions
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `;
        
        const res = await this.db.query(query, [
            prediction.fileId,
            JSON.stringify(prediction.tradeSetup),
            prediction.successProbability,
            prediction.riskLevel,
            prediction.expectedReturn || null,
            prediction.suggestedPositionSize || null,
            prediction.confidenceScore,
            prediction.reasoning,
            prediction.marketConditions ? JSON.stringify(prediction.marketConditions) : null
        ]);
        
        return res.rows[0].id;
    }

    public async getPrediction(id: number): Promise<PredictionResult | null> {
        const query = `
            SELECT 
                id,
                file_id as "fileId",
                trade_setup as "tradeSetup",
                success_probability as "successProbability",
                risk_level as "riskLevel",
                expected_return as "expectedReturn",
                suggested_position_size as "suggestedPositionSize",
                confidence_score as "confidenceScore",
                reasoning,
                market_conditions as "marketConditions",
                prediction_date as "predictionDate"
            FROM predictions WHERE id = $1
        `;
        
        const result = await this.db.query(query, [id]);
        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            ...row,
            tradeSetup: JSON.parse(row.tradeSetup),
            marketConditions: row.marketConditions ? JSON.parse(row.marketConditions) : null,
        };
    }

    public async getAllPredictions(): Promise<PredictionResult[]> {
        const query = `
            SELECT 
                id,
                file_id as "fileId",
                trade_setup as "tradeSetup",
                success_probability as "successProbability",
                risk_level as "riskLevel",
                expected_return as "expectedReturn",
                suggested_position_size as "suggestedPositionSize",
                confidence_score as "confidenceScore",
                reasoning,
                market_conditions as "marketConditions",
                prediction_date as "predictionDate"
            FROM predictions ORDER BY prediction_date DESC
        `;
        
        const result = await this.db.query(query);
        return result.rows.map(row => ({
            ...row,
            tradeSetup: JSON.parse(row.tradeSetup),
            marketConditions: row.marketConditions ? JSON.parse(row.marketConditions) : null,
        }));
    }

    public async getPredictionsByFile(fileId: string): Promise<PredictionResult[]> {
        const query = `
            SELECT 
                id,
                file_id as "fileId",
                trade_setup as "tradeSetup",
                success_probability as "successProbability",
                risk_level as "riskLevel",
                expected_return as "expectedReturn",
                suggested_position_size as "suggestedPositionSize",
                confidence_score as "confidenceScore",
                reasoning,
                market_conditions as "marketConditions",
                prediction_date as "predictionDate"
            FROM predictions WHERE file_id = $1 ORDER BY prediction_date DESC
        `;
        
        const result = await this.db.query(query, [fileId]);
        return result.rows.map(row => ({
            ...row,
            tradeSetup: JSON.parse(row.tradeSetup),
            marketConditions: row.marketConditions ? JSON.parse(row.marketConditions) : null,
        }));
    }

    public async updatePrediction(id: number, updates: Partial<PredictionResult>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];
        let placeholderCount = 1;
        
        if (updates.tradeSetup !== undefined) {
            fields.push(`trade_setup = $${placeholderCount++}`);
            values.push(JSON.stringify(updates.tradeSetup));
        }
        if (updates.successProbability !== undefined) {
            fields.push(`success_probability = $${placeholderCount++}`);
            values.push(updates.successProbability);
        }
        if (updates.riskLevel !== undefined) {
            fields.push(`risk_level = $${placeholderCount++}`);
            values.push(updates.riskLevel);
        }
        if (updates.expectedReturn !== undefined) {
            fields.push(`expected_return = $${placeholderCount++}`);
            values.push(updates.expectedReturn);
        }
        if (updates.suggestedPositionSize !== undefined) {
            fields.push(`suggested_position_size = $${placeholderCount++}`);
            values.push(updates.suggestedPositionSize);
        }
        if (updates.confidenceScore !== undefined) {
            fields.push(`confidence_score = $${placeholderCount++}`);
            values.push(updates.confidenceScore);
        }
        if (updates.reasoning !== undefined) {
            fields.push(`reasoning = $${placeholderCount++}`);
            values.push(updates.reasoning);
        }
        if (updates.marketConditions !== undefined) {
            fields.push(`market_conditions = $${placeholderCount++}`);
            values.push(updates.marketConditions ? JSON.stringify(updates.marketConditions) : null);
        }
        
        if (fields.length === 0) return;
        
        values.push(id);
        const query = `UPDATE predictions SET ${fields.join(', ')} WHERE id = $${placeholderCount}`;
        await this.db.query(query, values);
    }

    public async deletePrediction(id: number): Promise<void> {
        await this.db.query('DELETE FROM predictions WHERE id = $1', [id]);
    }

    public async deletePredictionsByFile(fileId: string): Promise<void> {
        await this.db.query('DELETE FROM predictions WHERE file_id = $1', [fileId]);
    }

    // Template operations
    public async insertTemplate(template: TradeTemplate): Promise<string> {
        const query = `
            INSERT INTO templates (id, name, description, template_data, is_default)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `;
        const res = await this.db.query(query, [
            template.id,
            template.name,
            template.description,
            JSON.stringify(template.template),
            template.isDefault
        ]);
        return res.rows[0].id;
    }

    public async getTemplate(id: string): Promise<TradeTemplate | null> {
        const query = `SELECT id, name, description, template_data as "template", is_default as "isDefault", created_at as "createdAt", updated_at as "updatedAt" FROM templates WHERE id = $1`;
        const result = await this.db.query(query, [id]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            ...row,
            template: JSON.parse(row.template)
        };
    }

    public async getAllTemplates(): Promise<TradeTemplate[]> {
        const query = `SELECT id, name, description, template_data as "template", is_default as "isDefault", created_at as "createdAt", updated_at as "updatedAt" FROM templates ORDER BY created_at`;
        const result = await this.db.query(query);
        return result.rows.map(row => ({
            ...row,
            template: JSON.parse(row.template)
        }));
    }

    public async getDefaultTemplate(): Promise<TradeTemplate | null> {
        const query = `SELECT id, name, description, template_data as "template", is_default as "isDefault", created_at as "createdAt", updated_at as "updatedAt" FROM templates WHERE is_default = true LIMIT 1`;
        const result = await this.db.query(query);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            ...row,
            template: JSON.parse(row.template)
        };
    }

    public async setDefaultTemplate(id: string): Promise<void> {
        await this.db.query('UPDATE templates SET is_default = false');
        await this.db.query('UPDATE templates SET is_default = true WHERE id = $1', [id]);
    }

    public async updateTemplate(id: string, updates: Partial<TradeTemplate>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];
        let placeholderCount = 1;

        if (updates.name !== undefined) {
            fields.push(`name = $${placeholderCount++}`);
            values.push(updates.name);
        }
        if (updates.description !== undefined) {
            fields.push(`description = $${placeholderCount++}`);
            values.push(updates.description);
        }
        if (updates.template !== undefined) {
            fields.push(`template_data = $${placeholderCount++}`);
            values.push(JSON.stringify(updates.template));
        }
        if (updates.isDefault !== undefined) {
            fields.push(`is_default = $${placeholderCount++}`);
            values.push(updates.isDefault);
        }

        if (fields.length === 0) return;

        values.push(id);
        const query = `UPDATE templates SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${placeholderCount}`;
        await this.db.query(query, values);
    }

    public async deleteTemplate(id: string): Promise<void> {
        await this.db.query('DELETE FROM templates WHERE id = $1', [id]);
    }

    // Stats and maintenance
    public async getStats(): Promise<any> {
        const queries = {
            fileCount: 'SELECT COUNT(*) FROM files',
            analysisCount: 'SELECT COUNT(*) FROM analysis_results',
            predictionCount: 'SELECT COUNT(*) FROM predictions',
            templateCount: 'SELECT COUNT(*) FROM templates',
            totalSize: 'SELECT SUM(file_size) FROM files'
        };

        const results = await Promise.all(Object.values(queries).map(q => this.db.query(q)));
        
        return {
            fileCount: parseInt(results[0].rows[0].count, 10),
            analysisCount: parseInt(results[1].rows[0].count, 10),
            predictionCount: parseInt(results[2].rows[0].count, 10),
            templateCount: parseInt(results[3].rows[0].count, 10),
            totalSize: parseInt(results[4].rows[0].sum, 10) || 0
        };
    }

    public async backup(filePath: string): Promise<void> {
        // This is more complex with remote postgres.
        // For now, we will skip implementing this for postgres.
        console.warn('Backup function is not implemented for PostgreSQL driver.');
        return;
    }

    public close(): void {
        this.db.end();
    }
}

export default DatabaseService;