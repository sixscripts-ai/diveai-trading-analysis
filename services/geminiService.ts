import { GoogleGenAI } from "@google/genai";
import type { UploadedFile, ChatMessage, AnalysisResult, TradeSetup, PredictionResult } from "../types";

// Get API key but don't throw error immediately
const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

// Create a function to get the AI instance with lazy initialization
let aiInstance: GoogleGenAI | null = null;
const getAIInstance = (): GoogleGenAI => {
  if (!aiInstance) {
    if (!API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable not set. Please set it in .env.local");
    }
    aiInstance = new GoogleGenAI({ apiKey: API_KEY });
  }
  return aiInstance;
};

const PROMPT = `
You are an expert trading performance analyst AI. Your name is 'DeepDive'. I will provide you with a user's trading data from a file. Your task is to perform a deep analysis and generate a comprehensive performance report.

Your entire response MUST be a single JSON object. This JSON object should have three top-level keys: "markdownReport", "chartData", and "suggestedQuestions".

1.  **"markdownReport"**: This key's value must be a string containing the full report in Markdown format. The report must be clear, insightful, provide actionable advice, and be structured using the following sections and formatting precisely. Do not add any introductory or concluding paragraphs outside of this structure.

    ## Executive Summary
    - **Total Net PnL:** (Calculate and display)
    - **Total Trades:** (Count of trades)
    - **Win Rate:** (Percentage of winning trades)
    - **Profit Factor:** (Gross Profit / Gross Loss. If no losses, display 'Infinity')
    - **Avg Win / Avg Loss:** (Average PnL of winning trades vs losing trades)
    - **Sharpe Ratio:** (Estimate return over standard deviation. Assume 0% risk-free rate. If not enough data, display 'N/A')
    - **Sortino Ratio:** (Similar to Sharpe, but only for downside deviation. If not enough data, display 'N/A')
    - **Average Holding Time:** (Calculate the average duration of trades if entry/exit times are available. Otherwise, display 'N/A')
    - **Max Win / Loss per Trade:** (Largest single winning trade and largest single losing trade)
    - **Best Day / Worst Day:** (The date with the highest PnL and lowest PnL)
    - **Max Drawdown:** (Estimate the maximum drawdown from the data)
    - **Longest Loss Streak:** (The highest number of consecutive losing trades)

    ## Equity Curve
    (This section in the markdown should ONLY contain the heading. The chart will be rendered by the UI.)

    ## Concentration and Fragility
    - **Top Hour:** (Identify the most profitable hour of the day and how much it contributed)
    - **Worst Hour(s):** (Identify the least profitable hour(s))
    - **Best Instrument:** (The most profitable trading symbol/instrument)
    - **Worst Instrument:** (The least profitable trading symbol/instrument)
    - **Guidance:** (Provide a short analysis on profit concentration. Is it fragile? For example: "WARNING: Profit is heavily concentrated in a single hour window. This is fragile – outside that window you underperform.")

    ## Instrument Performance
    (This section will be rendered as an interactive table by the UI.)

    ## Time of Day (Open Hour)
    - Provide the data as a Markdown table with "Hour", "Net PnL", and "Trade Count" columns, ranked by net profitability (descending).
    - **Guidance:** (Provide a clear recommendation, e.g., "Guidance: Trade only in top hour windows. Avoid or micro-size in negative windows.")

    ## Weekday Performance
    - Provide the data as a Markdown table with "Weekday", "Net PnL", and "Trade Count" columns, ranked by net profitability (descending).
    - **Guidance:** (Provide a clear recommendation, e.g., "Guidance: Skip the consistently negative weekday or restrict to A+ setups with half size.")

    ## Brutally Honest Recommendations
    - Provide a bulleted list of direct, actionable, and brutally honest rules the trader should follow to improve performance. These should be based *directly* on the data analysis from the previous sections.
    - Examples:
    - Stop trading between 15:00 - 15:59 outright. It's a money sink ($-423.20).
    - Time-stop before 00:05 - 00:15. That bucket bleeds ($-587.20).

2.  **"chartData"**: This key's value must be an object with four keys: "timeOfDay", "weekday", "equityCurve", and "instrumentPerformance".
    - **"timeOfDay"**: An array of objects, where each object represents an hour of the day that has trading activity. Each object must have three keys: "hour" (string, e.g., "09:00-09:59"), "pnl" (number), and "tradeCount" (number). Sort this array by PnL in descending order.
    - **"weekday"**: An array of objects for weekday performance. Each object must have three keys: "weekday" (string, e.g., "Monday"), "pnl" (number), and "tradeCount" (number). Sort this array by PnL in descending order.
    - **"equityCurve"**: An array of objects representing the cumulative PnL over time. Each object must have two keys: "tradeNumber" (number, starting from 1) and "cumulativePnl" (number). This array should be ordered by tradeNumber.
    - **"instrumentPerformance"**: An array of objects for each traded instrument. Each object must have five keys: "instrument" (string), "netPnl" (number), "winRate" (number, e.g., 55.5 for 55.5%), "totalTrades" (number), and "profitFactor" (number). Sort this array by netPnl in descending order.

3. **"suggestedQuestions"**: This key's value must be an array of 3-4 strings. Each string should be an insightful, specific follow-up question a user might ask based on the analysis. The questions should be about patterns, specific timeframes, or instruments found in the data.

Do not include any text, notes, or explanations outside of the main JSON object.

Here is the user's trading data:
---
`;

export const analyzeTradingData = async (file: UploadedFile): Promise<AnalysisResult> => {
    try {
        let contents;

        if (file.isBinary) {
            contents = [
                PROMPT,
                {
                    inlineData: {
                        mimeType: file.type,
                        data: file.content,
                    },
                },
            ];
        } else {
            contents = `${PROMPT}\n${file.content}\n---`;
        }

        const response = await getAIInstance().models.generateContent({
            model: 'gemini-2.0-flash-001',
            contents: contents,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        const rawText = response.text?.trim() || "";
        
        try {
            const parsedJson = JSON.parse(rawText);
            const markdownReport = parsedJson.markdownReport || "## Report Not Available\n\nThe AI did not return a valid report.";
            const chartData = parsedJson.chartData || null;
            const suggestedQuestions = parsedJson.suggestedQuestions || [];

            // Basic validation of chart data structure
            if (chartData && (!Array.isArray(chartData.timeOfDay) || !Array.isArray(chartData.weekday) || !Array.isArray(chartData.equityCurve) || !Array.isArray(chartData.instrumentPerformance))) {
                console.warn("AI returned malformed chart data. Discarding.");
                return { markdownReport, chartData: null, suggestedQuestions };
            }

            return { markdownReport, chartData, suggestedQuestions };
        } catch (jsonError) {
            console.error("Failed to parse JSON response from Gemini:", jsonError);
            console.log("Raw response was:", rawText);
            // Fallback: If JSON parsing fails, maybe the AI just returned markdown.
            // We can treat the whole response as the report.
            return {
                markdownReport: `## AI Response Error\n\nThe AI returned a response that could not be processed as valid JSON. The raw response is provided below:\n\n---\n\n${rawText}`,
                chartData: null,
                suggestedQuestions: [],
            };
        }

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get analysis from AI service.");
    }
};

export const continueChatStream = async (
    file: UploadedFile,
    report: string, // This is the markdownReport string
    history: ChatMessage[],
    newMessage: string
): Promise<AsyncGenerator<any>> => {
    try {
        // Create chat with history
        const chat = getAIInstance().chats.create({
            model: 'gemini-2.0-flash-001',
            history: [
                { role: 'user', parts: [{ text: PROMPT + `\n${file.content}\n---` }] },
                { role: 'model', parts: [{ text: report }] },
                ...history.map(msg => ({ 
                    role: msg.role, 
                    parts: [{ text: msg.text }] 
                }))
            ],
        });

        const responseStream = await chat.sendMessageStream({ message: newMessage });
        return responseStream;

    } catch (error) {
        console.error("Error calling Gemini Chat API:", error);
        throw new Error("Failed to get chat response from AI service.");
    }
};

// Enhanced Gemini AI Predictions
const PREDICTION_PROMPT = `
You are an expert trading prediction AI. Your name is 'DeepDive Predictor'. I will provide you with:
1. Historical trading data from a user's trading journal
2. A proposed trade setup

Your task is to analyze the historical performance patterns and predict the outcome of the proposed trade.

Your entire response MUST be a single JSON object with the following structure:
{
    "successProbability": number (0-1, probability of profitable trade),
    "riskLevel": string ("low", "medium", or "high"),
    "expectedReturn": number (estimated return percentage),
    "suggestedPositionSize": number (recommended position size as percentage of account),
    "confidenceScore": number (0-1, confidence in this prediction),
    "reasoning": string (detailed explanation of the prediction),
    "marketConditions": {
        "sentiment": string,
        "volatility": string,
        "trend": string
    },
    "historicalComparison": {
        "similarTrades": number,
        "averageReturn": number,
        "successRate": number
    }
}

Base your prediction on:
- Historical performance patterns from the trading data
- Time of day/week performance
- Instrument-specific performance
- Similar trade setups in the past
- Risk/reward ratios
- Market conditions and trends

Be brutally honest and data-driven. If the historical data suggests poor performance for similar setups, reflect that in your prediction.

Historical Trading Data:
---
`;

export const predictTradeOutcome = async (
    file: UploadedFile,
    tradeSetup: TradeSetup
): Promise<PredictionResult> => {
    try {
        const tradeSetupText = `
PROPOSED TRADE SETUP:
- Symbol: ${tradeSetup.symbol}
- Direction: ${tradeSetup.direction}
- Entry Price: ${tradeSetup.entryPrice}
- Stop Loss: ${tradeSetup.stopLoss || 'Not specified'}
- Take Profit: ${tradeSetup.takeProfit || 'Not specified'}
- Position Size: ${tradeSetup.positionSize}
- Timeframe: ${tradeSetup.timeframe}
- Market Conditions: ${tradeSetup.marketConditions || 'Not specified'}
- Strategy: ${tradeSetup.strategy || 'Not specified'}
- Notes: ${tradeSetup.notes || 'None'}
        `;

        let contents;
        if (file.isBinary) {
            contents = [
                PREDICTION_PROMPT,
                {
                    inlineData: {
                        mimeType: file.type,
                        data: file.content,
                    },
                },
                tradeSetupText
            ];
        } else {
            contents = `${PREDICTION_PROMPT}\n${file.content}\n---\n${tradeSetupText}`;
        }

        const response = await getAIInstance().models.generateContent({
            model: 'gemini-2.0-flash-001',
            contents: contents,
            config: {
                responseMimeType: "application/json",
            }
        });

        const rawText = response.text?.trim() || "";
        
        try {
            const parsedJson = JSON.parse(rawText);
            
            // Validate required fields
            const prediction: PredictionResult = {
                fileId: file.id,
                tradeSetup: tradeSetup,
                successProbability: Math.max(0, Math.min(1, parsedJson.successProbability || 0.5)),
                riskLevel: ['low', 'medium', 'high'].includes(parsedJson.riskLevel) ? parsedJson.riskLevel : 'medium',
                expectedReturn: parsedJson.expectedReturn || 0,
                suggestedPositionSize: parsedJson.suggestedPositionSize || tradeSetup.positionSize,
                confidenceScore: Math.max(0, Math.min(1, parsedJson.confidenceScore || 0.5)),
                reasoning: parsedJson.reasoning || 'No reasoning provided',
                marketConditions: parsedJson.marketConditions || {},
                predictionDate: new Date().toISOString()
            };

            return prediction;
        } catch (jsonError) {
            console.error("Failed to parse prediction JSON response:", jsonError);
            console.log("Raw prediction response was:", rawText);
            
            // Fallback prediction
            return {
                fileId: file.id,
                tradeSetup: tradeSetup,
                successProbability: 0.5,
                riskLevel: 'medium',
                expectedReturn: 0,
                suggestedPositionSize: tradeSetup.positionSize,
                confidenceScore: 0.1,
                reasoning: `AI prediction failed to parse. Raw response: ${rawText}`,
                marketConditions: {},
                predictionDate: new Date().toISOString()
            };
        }

    } catch (error) {
        console.error("Error calling Gemini Prediction API:", error);
        throw new Error("Failed to get prediction from AI service.");
    }
};