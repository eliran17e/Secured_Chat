const fs = require('fs');
const path = require('path');
const Recipe = require('../models/Recipe');

const seedFilePath = path.join(__dirname, '..', 'data', 'secretRecipes.json');

exports.seedRecipes = async () => {
  try {
    const existingCount = await Recipe.countDocuments();
    if (existingCount > 0) {
      console.log(`Recipes already seeded (${existingCount} found). Skipping.`);
      return;
    }

    if (!fs.existsSync(seedFilePath)) {
      console.warn(`Recipe seed file not found at ${seedFilePath}. DLP will have no protected corpus.`);
      return;
    }

    const recipes = JSON.parse(fs.readFileSync(seedFilePath, 'utf8'));
    await Recipe.insertMany(recipes);
    console.log(`Seeded ${recipes.length} secret recipes.`);
  } catch (err) {
    console.error('Failed to seed recipes:', err?.message || err);
  }
};
