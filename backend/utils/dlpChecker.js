const fs = require('fs');
const config = require('../config/config');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0, normA = 0.0, normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

exports.hasLeak = async (message, threshold = null) => {
    // Use provided threshold or default from config
    const actualThreshold = threshold !== null ? threshold : config.security.dlp.threshold;
    try {
        // Load recipe embeddings from JSON file
        const recipeEmbeddings = JSON.parse(fs.readFileSync('recipeEmbeddings.json', 'utf8'));
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

        // Get embedding for the incoming message
        const result = await model.embedContent(message);
        const messageEmbedding = result?.embedding?.values || [];
        if (!Array.isArray(messageEmbedding) || messageEmbedding.length === 0) {
            throw new Error('Failed to obtain embedding for message');
        }
      
        // Compare message embedding to each recipe embedding
        for (const recipe of recipeEmbeddings) {
            const similarity = cosineSimilarity(messageEmbedding, recipe.embedding);
            if (similarity > actualThreshold) {
                return true; // Potential leak detected
            }
        }
        return false; // No leak detected
    } catch (err) {
        console.error('DLP check failed:', err?.message || err);
        return false; // Fail-safe: do not block on errors
    }
};