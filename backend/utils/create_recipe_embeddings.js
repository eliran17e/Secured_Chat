const Recipe = require('../models/Recipe');
const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingFilePath = 'recipeEmbeddings.json';

exports.createRecipeEmbeddings = async () => {
    if (fs.existsSync(embeddingFilePath)) {
        console.log('Embeddings file already exists. Exiting to avoid overwriting.');
        return;
    }

    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const secretRecipes = await Recipe.find({}, 'name ingredients').lean();
        const recipeEmbeddings = [];

        for (const recipe of secretRecipes) {
            const text = `${recipe.name}: ${recipe.ingredients.join(', ')}`;
            const result = await model.embedContent(text);
            recipeEmbeddings.push({
                id: recipe._id,
                embedding: result.embedding.values,
                name: recipe.name,
                ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : []
            });
        }

        fs.writeFileSync(embeddingFilePath, JSON.stringify(recipeEmbeddings, null, 2));
        console.log('Recipe embeddings saved!');
    } catch (error) {
        console.error('Failed to create recipe embeddings:', error);
    }
}