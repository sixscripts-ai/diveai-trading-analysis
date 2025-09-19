import Database from 'better-sqlite3';
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
    private db: Database.Database;
    private static instance: DatabaseService;

    private constructor() {
        // Create database in the project root
        const dbPath = join(process.cwd(), 'deepdive.db');
        this.db = new Database(dbPath);
        
        // Enable foreign keys
        this.db.pragma('foreign_keys = ON');
        
        // Initialize database schema
        this.initializeDatabase();
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    private initializeDatabase(): void {
        try {
            // Read and execute schema
            const schemaPath = join(process.cwd(), 'database', 'schema.sql');
            const schema = readFileSync(schemaPath, 'utf-8');
            this.db.exec(schema);
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    // File operations
    public insertFile(file: UploadedFile): void {
        const stmt = this.db.prepare(`
            INSERT INTO files (id, name, type, content, is_binary, file_size)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const fileSize = new Blob([file.content]).size;
        stmt.run(file.id, file.name, file.type, file.content, file.isBinary ? 1 : 0, fileSize);
    }

    public getFile(id: string): DatabaseFile | null {
        const stmt = this.db.prepare(`
            SELECT id, name, type, content, is_binary as isBinary, file_size as fileSize,
                   upload_date as uploadDate, last_accessed as lastAccessed,
                   created_at as createdAt, updated_at as updatedAt
            FROM files WHERE id = ?
        `);
        
        const result = stmt.get(id) as any;
        if (!result) return null;
        
        return {
            ...result,
            isBinary: Boolean(result.isBinary)
        };
    }

    public getAllFiles(): DatabaseFile[] {
        const stmt = this.db.prepare(`
            SELECT id, name, type, content, is_binary as isBinary, file_size as fileSize,
                   upload_date as uploadDate, last_accessed as lastAccessed,
                   created_at as createdAt, updated_at as updatedAt
            FROM files ORDER BY upload_date DESC
        `);
        
        const results = stmt.all() as any[];
        return results.map(result => ({
            ...result,
            isBinary: Boolean(result.isBinary)
        }));
    }

    public deleteFile(id: string): void {
        const stmt = this.db.prepare('DELETE FROM files WHERE id = ?');
        stmt.run(id);
    }

    public updateFileLastAccessed(id: string): void {
        const stmt = this.db.prepare('UPDATE files SET last_accessed = CURRENT_TIMESTAMP WHERE id = ?');
        stmt.run(id);
    }

    // Analysis results operations
    public insertAnalysisResult(fileId: string, result: AnalysisResult, processingTimeMs?: number): number {
        const stmt = this.db.prepare(`
            INSERT INTO analysis_results (file_id, markdown_report, chart_data, suggested_questions, processing_time_ms)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        const info = stmt.run(
            fileId,
            result.markdownReport,
            result.chartData ? JSON.stringify(result.chartData) : null,
            JSON.stringify(result.suggestedQuestions),
            processingTimeMs
        );
        
        return info.lastInsertRowid as number;
    }

    public getAnalysisResult(fileId: string): DatabaseAnalysisResult | null {
        const stmt = this.db.prepare(`
            SELECT id, file_id as fileId, markdown_report as markdownReport,
                   chart_data as chartData, suggested_questions as suggestedQuestions,
                   analysis_date as analysisDate, processing_time_ms as processingTimeMs,
                   created_at as createdAt, updated_at as updatedAt
            FROM analysis_results WHERE file_id = ? ORDER BY analysis_date DESC LIMIT 1
        `);
        
        const result = stmt.get(fileId) as any;
        if (!result) return null;
        
        return {
            ...result,
            chartData: result.chartData ? JSON.parse(result.chartData) : null,
            suggestedQuestions: JSON.parse(result.suggestedQuestions)
        };
    }

    public getAllAnalysisResults(): Record<string, AnalysisResult> {
        const stmt = this.db.prepare(`
            SELECT DISTINCT file_id as fileId, markdown_report as markdownReport,
                   chart_data as chartData, suggested_questions as suggestedQuestions
            FROM analysis_results 
            WHERE (file_id, analysis_date) IN (
                SELECT file_id, MAX(analysis_date) 
                FROM analysis_results 
                GROUP BY file_id
            )
        `);
        
        const results = stmt.all() as any[];
        const analysisResults: Record<string, AnalysisResult> = {};
        
        results.forEach(result => {
            analysisResults[result.fileId] = {
                markdownReport: result.markdownReport,
                chartData: result.chartData ? JSON.parse(result.chartData) : null,
                suggestedQuestions: JSON.parse(result.suggestedQuestions)
            };
        });
        
        return analysisResults;
    }

    public deleteAnalysisResults(fileId: string): void {
        const stmt = this.db.prepare('DELETE FROM analysis_results WHERE file_id = ?');
        stmt.run(fileId);
    }

    // Chat messages operations
    public insertChatMessage(fileId: string, message: ChatMessage, order: number): number {
        const stmt = this.db.prepare(`
            INSERT INTO chat_messages (file_id, role, message_text, message_order)
            VALUES (?, ?, ?, ?)
        `);
        
        const info = stmt.run(fileId, message.role, message.text, order);
        return info.lastInsertRowid as number;
    }

    public getChatHistory(fileId: string): ChatMessage[] {
        const stmt = this.db.prepare(`
            SELECT role, message_text as text
            FROM chat_messages 
            WHERE file_id = ? 
            ORDER BY message_order ASC
        `);
        
        return stmt.all(fileId) as ChatMessage[];
    }

    public getAllChatHistory(): Record<string, ChatMessage[]> {
        const stmt = this.db.prepare(`
            SELECT file_id as fileId, role, message_text as text
            FROM chat_messages 
            ORDER BY file_id, message_order ASC
        `);
        
        const results = stmt.all() as any[];
        const chatHistory: Record<string, ChatMessage[]> = {};
        
        results.forEach(result => {
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

    public setChatHistory(fileId: string, messages: ChatMessage[]): void {
        // Delete existing messages for this file
        const deleteStmt = this.db.prepare('DELETE FROM chat_messages WHERE file_id = ?');
        deleteStmt.run(fileId);
        
        // Insert new messages
        const insertStmt = this.db.prepare(`
            INSERT INTO chat_messages (file_id, role, message_text, message_order)
            VALUES (?, ?, ?, ?)
        `);
        
        messages.forEach((message, index) => {
            insertStmt.run(fileId, message.role, message.text, index);
        });
    }

    public deleteChatHistory(fileId: string): void {
        const stmt = this.db.prepare('DELETE FROM chat_messages WHERE file_id = ?');
        stmt.run(fileId);
    }

    // Prediction operations
    public insertPrediction(prediction: PredictionResult): number {
        const stmt = this.db.prepare(`
            INSERT INTO predictions (
                file_id, trade_setup, success_probability, risk_level, 
                expected_return, suggested_position_size, confidence_score, 
                reasoning, market_conditions
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            prediction.fileId,
            JSON.stringify(prediction.tradeSetup),
            prediction.successProbability,
            prediction.riskLevel,
            prediction.expectedReturn || null,
            prediction.suggestedPositionSize || null,
            prediction.confidenceScore,
            prediction.reasoning,
            prediction.marketConditions ? JSON.stringify(prediction.marketConditions) : null
        );
        
        return result.lastInsertRowid as number;
    }

    public getPrediction(id: number): PredictionResult | null {
        const stmt = this.db.prepare(`
            SELECT * FROM predictions WHERE id = ?
        `);
        
        const row = stmt.get(id) as any;
        if (!row) return null;
        
        return {
            id: row.id,
            fileId: row.file_id,
            tradeSetup: JSON.parse(row.trade_setup),
            successProbability: row.success_probability,
            riskLevel: row.risk_level,
            expectedReturn: row.expected_return,
            suggestedPositionSize: row.suggested_position_size,
            confidenceScore: row.confidence_score,
            reasoning: row.reasoning,
            marketConditions: row.market_conditions ? JSON.parse(row.market_conditions) : null,
            predictionDate: row.prediction_date
        };
    }

    public getAllPredictions(): PredictionResult[] {
        const stmt = this.db.prepare(`
            SELECT * FROM predictions ORDER BY prediction_date DESC
        `);
        
        const rows = stmt.all() as any[];
        return rows.map(row => ({
            id: row.id,
            fileId: row.file_id,
            tradeSetup: JSON.parse(row.trade_setup),
            successProbability: row.success_probability,
            riskLevel: row.risk_level,
            expectedReturn: row.expected_return,
            suggestedPositionSize: row.suggested_position_size,
            confidenceScore: row.confidence_score,
            reasoning: row.reasoning,
            marketConditions: row.market_conditions ? JSON.parse(row.market_conditions) : null,
            predictionDate: row.prediction_date
        }));
    }

    public getPredictionsByFile(fileId: string): PredictionResult[] {
        const stmt = this.db.prepare(`
            SELECT * FROM predictions WHERE file_id = ? ORDER BY prediction_date DESC
        `);
        
        const rows = stmt.all(fileId) as any[];
        return rows.map(row => ({
            id: row.id,
            fileId: row.file_id,
            tradeSetup: JSON.parse(row.trade_setup),
            successProbability: row.success_probability,
            riskLevel: row.risk_level,
            expectedReturn: row.expected_return,
            suggestedPositionSize: row.suggested_position_size,
            confidenceScore: row.confidence_score,
            reasoning: row.reasoning,
            marketConditions: row.market_conditions ? JSON.parse(row.market_conditions) : null,
            predictionDate: row.prediction_date
        }));
    }

    public updatePrediction(id: number, updates: Partial<PredictionResult>): void {
        const fields = [];
        const values = [];
        
        if (updates.tradeSetup !== undefined) {
            fields.push('trade_setup = ?');
            values.push(JSON.stringify(updates.tradeSetup));
        }
        if (updates.successProbability !== undefined) {
            fields.push('success_probability = ?');
            values.push(updates.successProbability);
        }
        if (updates.riskLevel !== undefined) {
            fields.push('risk_level = ?');
            values.push(updates.riskLevel);
        }
        if (updates.expectedReturn !== undefined) {
            fields.push('expected_return = ?');
            values.push(updates.expectedReturn);
        }
        if (updates.suggestedPositionSize !== undefined) {
            fields.push('suggested_position_size = ?');
            values.push(updates.suggestedPositionSize);
        }
        if (updates.confidenceScore !== undefined) {
            fields.push('confidence_score = ?');
            values.push(updates.confidenceScore);
        }
        if (updates.reasoning !== undefined) {
            fields.push('reasoning = ?');
            values.push(updates.reasoning);
        }
        if (updates.marketConditions !== undefined) {
            fields.push('market_conditions = ?');
            values.push(updates.marketConditions ? JSON.stringify(updates.marketConditions) : null);
        }
        
        if (fields.length === 0) return;
        
        values.push(id);
        const stmt = this.db.prepare(`UPDATE predictions SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);
    }

    public deletePrediction(id: number): void {
        const stmt = this.db.prepare('DELETE FROM predictions WHERE id = ?');
        stmt.run(id);
    }

    public deletePredictionsByFile(fileId: string): void {
        const stmt = this.db.prepare('DELETE FROM predictions WHERE file_id = ?');
        stmt.run(fileId);
    }

    // Utility operations
    public getStats(): { totalFiles: number; totalAnalyses: number; totalMessages: number; dbSize: string } {
        const filesCount = this.db.prepare('SELECT COUNT(*) as count FROM files').get() as any;
        const analysesCount = this.db.prepare('SELECT COUNT(*) as count FROM analysis_results').get() as any;
        const messagesCount = this.db.prepare('SELECT COUNT(*) as count FROM chat_messages').get() as any;
        
        // Get database file size
        const dbPath = join(process.cwd(), 'deepdive.db');
        let dbSize = '0 KB';
        try {
            const fs = require('fs');
            const stats = fs.statSync(dbPath);
            const sizeInBytes = stats.size;
            dbSize = sizeInBytes < 1024 ? `${sizeInBytes} B` :
                     sizeInBytes < 1024 * 1024 ? `${(sizeInBytes / 1024).toFixed(1)} KB` :
                     `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
        } catch (error) {
            console.warn('Could not get database size:', error);
        }
        
        return {
            totalFiles: filesCount.count,
            totalAnalyses: analysesCount.count,
            totalMessages: messagesCount.count,
            dbSize
        };
    }

    public backup(backupPath: string): void {
        this.db.backup(backupPath);
    }

    // Template management methods
    public insertTemplate(template: TradeTemplate): void {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO templates (id, name, description, template_data, is_default, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            template.id,
            template.name,
            template.description,
            JSON.stringify(template.template),
            template.isDefault ? 1 : 0,
            template.createdAt,
            template.updatedAt
        );
    }

    public getTemplate(id: string): TradeTemplate | null {
        const stmt = this.db.prepare(`
            SELECT * FROM templates WHERE id = ?
        `);
        
        const row = stmt.get(id) as any;
        if (!row) return null;

        return {
            id: row.id,
            name: row.name,
            description: row.description,
            template: JSON.parse(row.template_data),
            isDefault: Boolean(row.is_default),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    public getAllTemplates(): TradeTemplate[] {
        const stmt = this.db.prepare(`
            SELECT * FROM templates ORDER BY is_default DESC, name ASC
        `);
        
        const rows = stmt.all() as any[];
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            template: JSON.parse(row.template_data),
            isDefault: Boolean(row.is_default),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    }

    public getDefaultTemplate(): TradeTemplate | null {
        const stmt = this.db.prepare(`
            SELECT * FROM templates WHERE is_default = 1 LIMIT 1
        `);
        
        const row = stmt.get() as any;
        if (!row) return null;

        return {
            id: row.id,
            name: row.name,
            description: row.description,
            template: JSON.parse(row.template_data),
            isDefault: Boolean(row.is_default),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    public updateTemplate(template: TradeTemplate): void {
        const stmt = this.db.prepare(`
            UPDATE templates 
            SET name = ?, description = ?, template_data = ?, is_default = ?, updated_at = ?
            WHERE id = ?
        `);
        
        stmt.run(
            template.name,
            template.description,
            JSON.stringify(template.template),
            template.isDefault ? 1 : 0,
            new Date().toISOString(),
            template.id
        );
    }

    public deleteTemplate(id: string): void {
        const stmt = this.db.prepare(`DELETE FROM templates WHERE id = ? AND is_default = 0`);
        stmt.run(id);
    }

    public close(): void {
        this.db.close();
    }
}

export default DatabaseService;