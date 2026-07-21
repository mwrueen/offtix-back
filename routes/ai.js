const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { authenticate } = require('../middleware/auth');

router.post('/generate-project-description', authenticate, async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Project title is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const prompt = `Generate a professional and comprehensive project description based on the following project title: "${title}". The description should include an overview, key objectives, and potential milestones. It should be formatted nicely using HTML tags like <p>, <ul>, <li>, <strong> so it can be directly injected into a rich text editor.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ description: text });
  } catch (error) {
    console.error('Error generating description with Gemini:', error);
    res.status(500).json({ error: 'Failed to generate description' });
  }
});

router.post('/generate-tasks', authenticate, async (req, res) => {
  try {
    const { title, description, existingTasks = [] } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Project title is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    let prompt = `Based on the following project:
Title: "${title}"
Description: "${description || 'No description provided.'}"

Generate a list of 5 logical and essential tasks to complete this project. 
For each task, provide a "title" (short and concise) and a "description" (detailed explanation, 1-2 sentences).`;

    if (existingTasks && existingTasks.length > 0) {
      prompt += `\n\nIMPORTANT: Do NOT generate tasks that are similar to the following existing tasks:\n`;
      existingTasks.forEach(t => prompt += `- ${t}\n`);
    }

    prompt += `\nYou MUST return the output as a valid JSON array of objects. Do not wrap it in markdown code blocks like \`\`\`json. The response should just be the raw JSON array string.
Example format:
[
  { "title": "Task 1", "description": "Description 1" },
  { "title": "Task 2", "description": "Description 2" }
]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim().replace(/^```json\n?/, '').replace(/```$/, '');
    
    let tasks = [];
    try {
      tasks = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse AI JSON:', text);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    res.json({ tasks });
  } catch (error) {
    console.error('Error generating tasks with Gemini:', error);
    res.status(500).json({ error: 'Failed to generate tasks' });
  }
});

module.exports = router;
