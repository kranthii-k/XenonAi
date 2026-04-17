import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const categories = ["smartphones", "laptops", "headphones"];

// Baseline reviews (neutral to mildly positive)
const generalReviews = [
  "Good product for the price. Works fine.",
  "Display is nice, but it gets hot while gaming.",
  "Camera quality is impressive, especially at night.",
  "Delivery was delayed by two days but otherwise fine.",
  "Overall satisfied with the purchase.",
  "Quality seems okay, not the absolute best, but handles daily tasks.",
  "Battery lasts exactly a day on normal usage."
];

// Trap negative battery templates
const negativeBatteryTemplates = [
  "New update ruined it. Battery drains way too fast now, definitely an issue.",
  "Why is my battery dying in 3 hours? Absolute garbage batch.",
  "Worst battery life. Replacing it immediately.",
  "Overheating and battery issues. Regret buying recently."
];

export function generateSeedData() {
  const reviews = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 10); // Start 10 days ago

  for (const category of categories) {
    const isSmartphone = category === "smartphones";
    
    // Generate 220 reviews per category
    for (let i = 1; i <= 220; i++) {
      let text = "";
      
      // Seeded Trap: Last 50 reviews (i > 170) for Smartphones have 40% negative battery
      if (isSmartphone && i > 170 && Math.random() < 0.40) {
         text = negativeBatteryTemplates[Math.floor(Math.random() * negativeBatteryTemplates.length)];
      } 
      // First 170 only have 5% negative battery
      else if (isSmartphone && i <= 170 && Math.random() < 0.05) {
         text = negativeBatteryTemplates[Math.floor(Math.random() * negativeBatteryTemplates.length)];
      } 
      // General path
      else {
         text = generalReviews[Math.floor(Math.random() * generalReviews.length)];
      }

      reviews.push({
        product_id: category,
        text,
        timestamp: new Date(baseDate.getTime() + (i * 3600000)).toISOString()
      });
    }
  }

  const outDir = path.join(__dirname, '../data/seed');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  // Clean empty run
  fs.writeFileSync(path.join(outDir, 'seed.json'), JSON.stringify(reviews, null, 2));
  console.log(`Seed data generated successfully. Wrote ${reviews.length} total reviews.`);
}

if (require.main === module) {
  generateSeedData();
}
