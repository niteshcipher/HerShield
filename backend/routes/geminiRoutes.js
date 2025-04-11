import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

// Initialize the Google Generative AI with your API key
const genAI = new GoogleGenerativeAI('AIzaSyBcH3RyylSkyKNVFyI6SHH5ODyvTWmwoxA');

// Create a route to handle chat requests
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    // Get the Gemini model (using the Flash model)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Generate content
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();
    
    res.status(200).json({ response: text });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: 'Failed to process your request' });
  }
});

// Export as a named export
export { router as geminiRoutes };