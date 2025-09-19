import { TradeTemplate, TradeSetup } from '../types';
import DatabaseClient from './databaseClient';

export class TemplateService {
    private static instance: TemplateService;
    private dbClient: DatabaseClient;

    private constructor() {
        this.dbClient = DatabaseClient.getInstance();
        // Initialize templates, but don't block construction
        this.initializeDefaultTemplates().catch(err => {
            console.error('Failed to initialize templates:', err);
        });
    }

    public static getInstance(): TemplateService {
        if (!TemplateService.instance) {
            TemplateService.instance = new TemplateService();
        }
        return TemplateService.instance;
    }

    private async initializeDefaultTemplates(): Promise<void> {
        try {
            // Check if default templates already exist in database
            const existingDefault = await this.dbClient.getDefaultTemplate();
            if (existingDefault) {
                return; // Templates already initialized
            }

            // Default standardized template
            const defaultTemplate: TradeTemplate = {
                id: 'default-standard',
                name: 'Standard Trade Template',
                description: 'Standardized trade prediction template with all required fields',
                isDefault: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                template: {
                    symbol: '',
                    direction: 'long',
                    entryPrice: 0,
                    stopLoss: 0,
                    takeProfit: 0,
                    positionSize: 0,
                    timeframe: '15m',
                    marketConditions: {
                        weekly: '',
                        daily: ''
                    },
                    strategy: '',
                    notes: ''
                }
            };

            // Example filled template from the user's request
            const exampleTemplate: TradeTemplate = {
                id: 'example-eurusd',
                name: 'EURUSD Turtle Soup Example',
                description: 'Example template showing a complete EURUSD turtle soup trade setup',
                isDefault: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                template: {
                    symbol: 'EURUSD',
                    direction: 'long',
                    entryPrice: 1.17450,
                    stopLoss: 1.17300,
                    takeProfit: 1.18150,
                    positionSize: 0.50,
                    timeframe: '15m',
                    marketConditions: {
                        weekly: 'bullish',
                        daily: 'bullish'
                    },
                    strategy: 'turtle soup',
                    notes: 'Judas swing at daily order block that made the most recent high, also a weekly high being set at the same time. Entering on former distribution zone, targeting liquidity from yesterday\'s Asian range and central bank dealer range where there\'s an imbalance above.'
                }
            };

            // Save templates to database
            await this.dbClient.saveTemplate(defaultTemplate);
            await this.dbClient.saveTemplate(exampleTemplate);
        } catch (error) {
            console.warn('Failed to initialize default templates:', error);
        }
    }

    public async getDefaultTemplate(): Promise<TradeTemplate> {
        const defaultTemplate = await this.dbClient.getDefaultTemplate();
        if (!defaultTemplate) {
            // Return a fallback default template
            return {
                id: 'fallback-default',
                name: 'Default Template',
                description: 'Fallback default template',
                isDefault: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                template: {
                    symbol: '',
                    direction: 'long',
                    entryPrice: 0,
                    stopLoss: 0,
                    takeProfit: 0,
                    positionSize: 0,
                    timeframe: '15m',
                    marketConditions: {
                        weekly: '',
                        daily: ''
                    },
                    strategy: '',
                    notes: ''
                }
            };
        }
        return defaultTemplate;
    }

    public async getAllTemplates(): Promise<TradeTemplate[]> {
        try {
            return await this.dbClient.getAllTemplates();
        } catch (error) {
            console.warn('Failed to load templates from database:', error);
            return [await this.getDefaultTemplate()];
        }
    }

    public async getTemplate(id: string): Promise<TradeTemplate | undefined> {
        try {
            const template = await this.dbClient.getTemplate(id);
            return template || undefined;
        } catch (error) {
            console.warn('Failed to load template:', error);
            return undefined;
        }
    }

    public async saveTemplate(template: TradeTemplate): Promise<void> {
        template.updatedAt = new Date().toISOString();
        try {
            await this.dbClient.saveTemplate(template);
        } catch (error) {
            console.warn('Failed to save template:', error);
            throw error;
        }
    }

    public async deleteTemplate(id: string): Promise<boolean> {
        try {
            await this.dbClient.deleteTemplate(id);
            return true;
        } catch (error) {
            console.warn('Failed to delete template:', error);
            return false;
        }
    }

    public createTemplateFromSetup(name: string, description: string, setup: TradeSetup): TradeTemplate {
        const template: TradeTemplate = {
            id: `custom-${Date.now()}`,
            name,
            description,
            template: { ...setup },
            isDefault: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.saveTemplate(template);
        return template;
    }

    public getFormattedTemplate(template: TradeTemplate): string {
        const setup = template.template;
        return `Symbol: ${setup.symbol}
Direction: ${setup.direction}
Entry Price: ${setup.entryPrice}
Stop Loss: ${setup.stopLoss || 'Not set'}
Take Profit: ${setup.takeProfit || 'Not set'}
Position Size: ${setup.positionSize}
Time Frame: ${setup.timeframe}
Market Conditions: weekly ${setup.marketConditions?.weekly || 'Not specified'}, daily ${setup.marketConditions?.daily || 'Not specified'}
Strategy: ${setup.strategy || 'Not specified'}
Notes: ${setup.notes || 'No notes provided'}`;
    }

    public parseTemplateString(templateString: string): Partial<TradeSetup> {
        const lines = templateString.split('\n');
        const setup: Partial<TradeSetup> = {};

        lines.forEach(line => {
            const [key, ...valueParts] = line.split(':');
            const value = valueParts.join(':').trim();

            switch (key.toLowerCase().trim()) {
                case 'symbol':
                    setup.symbol = value;
                    break;
                case 'direction':
                    setup.direction = value.toLowerCase() === 'long' ? 'long' : 'short';
                    break;
                case 'entry price':
                    setup.entryPrice = parseFloat(value) || 0;
                    break;
                case 'stop loss':
                    if (value !== 'Not set') {
                        setup.stopLoss = parseFloat(value) || undefined;
                    }
                    break;
                case 'take profit':
                    if (value !== 'Not set') {
                        setup.takeProfit = parseFloat(value) || undefined;
                    }
                    break;
                case 'position size':
                    setup.positionSize = parseFloat(value) || 0;
                    break;
                case 'time frame':
                    setup.timeframe = value;
                    break;
                case 'market conditions':
                    const conditions = value.split(',');
                    setup.marketConditions = {};
                    conditions.forEach(condition => {
                        const trimmed = condition.trim();
                        if (trimmed.startsWith('weekly ')) {
                            setup.marketConditions!.weekly = trimmed.replace('weekly ', '');
                        } else if (trimmed.startsWith('daily ')) {
                            setup.marketConditions!.daily = trimmed.replace('daily ', '');
                        }
                    });
                    break;
                case 'strategy':
                    if (value !== 'Not specified') {
                        setup.strategy = value;
                    }
                    break;
                case 'notes':
                    if (value !== 'No notes provided') {
                        setup.notes = value;
                    }
                    break;
            }
        });

        return setup;
    }
}

export default TemplateService;