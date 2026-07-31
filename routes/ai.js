const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { authenticate } = require('../middleware/auth');
const Task = require('../models/Task');

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

router.post('/generate-job-description', authenticate, async (req, res) => {
  try {
    const { title, role, experience, jobNature, companyName } = req.body;
    const jobTitle = title || role || 'Job Position';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const prompt = `Generate a concise, professional job description for the position "${jobTitle}".${experience ? ` Minimum experience: ${experience} years.` : ''}${jobNature ? ` Workplace format: ${jobNature}.` : ''}${companyName ? ` Company: ${companyName}.` : ''}

CRITICAL INSTRAINTS:
1. Do NOT include header metadata labels like "Job Title:", "Location:", "Employment Type:", "Experience Level:" at the beginning. Start directly with the Role Summary.
2. Keep the text concise, clear, and well-structured (not overly long).
3. Structure with: Role Summary, Key Responsibilities (3-5 bullet points), and Required Qualifications (3-5 bullet points).
4. Format using HTML tags (<p>, <ul>, <li>, <strong>) suitable for rich-text editors. Do NOT wrap in markdown code blocks.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim().replace(/^```html\n?/, '').replace(/```$/, '');

    res.json({ description: text });
  } catch (error) {
    console.error('Error generating job description with Gemini:', error);
    res.status(500).json({ error: 'Failed to generate job description' });
  }
});

router.post('/generate-job-benefits', authenticate, async (req, res) => {
  try {
    const { title, role, jobNature, companyName } = req.body;
    const jobTitle = title || role || 'Job Position';
    const compName = companyName || 'our company';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const prompt = `Generate a concise, attractive perks and benefits description for an ${jobTitle} position.${jobNature ? ` Workplace format: ${jobNature}.` : ''}

CRITICAL INSTRAINTS:
1. Start with an opening sentence referencing the company name explicitly, e.g.: "At ${compName}, we recognize that our team is the driving force behind our success..."
2. Keep the perks and benefits concise and organized into 3-4 short categories/bullet points (e.g., Compensation & Rewards, Health & Wellness, Work-Life Harmony, Professional Growth).
3. Do NOT make the text overly long. Keep it compact and easy to read.
4. Format using HTML tags (<p>, <ul>, <li>, <strong>) suitable for rich-text editors. Do NOT wrap in markdown code blocks.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim().replace(/^```html\n?/, '').replace(/```$/, '');

    res.json({ benefits: text });
  } catch (error) {
    console.error('Error generating job benefits with Gemini:', error);
    res.status(500).json({ error: 'Failed to generate perks & benefits' });
  }
});

router.post('/transcribe-meeting-audio', authenticate, async (req, res) => {
  try {
    const { audioBase64, mimeType, projectId } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio file data is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured' });
    }

    let existingTasks = [];
    if (projectId) {
      try {
        existingTasks = await Task.find({ project: projectId }).select('title description status priority').lean();
      } catch (err) {
        console.error('Error fetching existing project tasks for AI context:', err);
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const base64Data = audioBase64.replace(/^data:audio\/[a-zA-Z0-9]+;base64,/, '');

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType || 'audio/mp3'
      }
    };

    const existingTasksSummary = existingTasks.length > 0
      ? existingTasks.map(t => `- Title: "${t.title}", Priority: "${t.priority || 'medium'}", Description: "${t.description || ''}"`).join('\n')
      : 'No previous tasks found.';

    const prompt = `Listen carefully to the audio of this project meeting and transcribe its contents accurately.
Analyze the transcript in comparison with the project's existing/previous tasks listed below:

EXISTING PROJECT TASKS:
${existingTasksSummary}

Return your response strictly as a RAW JSON object with the following structure:
{
  "title": "A short descriptive title for this meeting based on the audio",
  "transcript": "Full clean transcript text of the meeting",
  "notesHtml": "<p>Structured meeting notes formatted in HTML (<p>, <ul>, <li>, <strong>) summarizing key discussions.</p>",
  "actionItems": ["Action item 1", "Action item 2"],
  "decisions": ["Decision 1", "Decision 2"],
  "generatedTasks": [
    {
      "title": "New Task Title 1",
      "description": "Detailed task description based on meeting insights and gaps in previous tasks",
      "priority": "medium"
    }
  ]
}

IMPORTANT:
1. Do NOT wrap the JSON output in markdown code blocks like \`\`\`json. Return raw valid JSON string only.
2. Provide 2 to 5 practical, distinct NEW tasks in "generatedTasks" that are NOT duplicates of existing tasks.`;

    const result = await model.generateContent([prompt, filePart]);
    const response = await result.response;
    const responseText = response.text().trim().replace(/^```json\n?/, '').replace(/```$/, '');

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse AI JSON:', responseText);
      parsed = {
        title: 'Meeting Notes & Transcription',
        transcript: responseText,
        notesHtml: `<p>${responseText}</p>`,
        actionItems: [],
        decisions: [],
        generatedTasks: []
      };
    }

    res.json(parsed);
  } catch (error) {
    console.error('Error transcribing audio with Gemini:', error);
    res.status(500).json({ error: 'Failed to transcribe audio and analyze meeting' });
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
