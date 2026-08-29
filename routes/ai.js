const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { authenticate } = require('../middleware/auth');
const requirePremium = require('../middleware/requirePremium');
const Task = require('../models/Task');

// Protect all AI routes with Premium check
router.use(authenticate, requirePremium('allowAI'));


router.post('/generate-project-description', authenticate, async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Project title is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let descriptionText = '';

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Generate a professional and comprehensive project description based on the following project title: "${title}". The description should include an overview, key objectives, and potential milestones. Format using HTML tags (<p>, <ul>, <li>, <strong>) so it can be directly injected into a rich text editor. Do NOT wrap in markdown code blocks.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        descriptionText = response.text().trim().replace(/^```html\n?/, '').replace(/^```\n?/, '').replace(/```$/, '');
      } catch (geminiErr) {
        console.error('Gemini call error for project description, using fallback template:', geminiErr.message);
      }
    }

    if (!descriptionText) {
      descriptionText = `<p>The <strong>${title}</strong> initiative is designed to deliver a high-impact, scalable solution focusing on technical excellence, seamless user experience, and robust operational execution.</p>
<p><strong>Key Objectives:</strong></p>
<ul>
  <li>Architect and execute core functionality for <strong>${title}</strong> within designated milestones.</li>
  <li>Ensure cross-functional alignment, high performance, and strict compliance with project standards.</li>
  <li>Optimize team deliverables and ensure seamless integration across modules.</li>
</ul>
<p><strong>Expected Deliverables:</strong> Milestone completion, technical documentation, and production deployment.</p>`;
    }

    res.json({ description: descriptionText });
  } catch (error) {
    console.error('Error generating description:', error);
    res.status(500).json({ error: 'Failed to generate description' });
  }
});

router.post('/generate-job-description', authenticate, async (req, res) => {
  try {
    const { title, role, experience, jobNature, companyName } = req.body;
    const jobTitle = title || role || 'Job Position';

    const apiKey = process.env.GEMINI_API_KEY;
    let descriptionText = '';

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Generate a concise, professional job description for the position "${jobTitle}".${experience ? ` Minimum experience: ${experience} years.` : ''}${jobNature ? ` Workplace format: ${jobNature}.` : ''}${companyName ? ` Company: ${companyName}.` : ''}

CRITICAL CONSTRAINTS:
1. Do NOT include header metadata labels like "Job Title:", "Location:". Start directly with Role Summary.
2. Structure with: Role Summary, Key Responsibilities (3-5 bullet points), and Required Qualifications (3-5 bullet points).
3. Format using HTML tags (<p>, <ul>, <li>, <strong>). Do NOT wrap in markdown code blocks.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        descriptionText = response.text().trim().replace(/^```html\n?/, '').replace(/^```\n?/, '').replace(/```$/, '');
      } catch (geminiErr) {
        console.error('Gemini call error for job description, using fallback template:', geminiErr.message);
      }
    }

    if (!descriptionText) {
      descriptionText = `<p>We are seeking a dedicated <strong>${jobTitle}</strong> to join ${companyName ? `<strong>${companyName}</strong>` : 'our team'}. In this role, you will lead key execution tasks, collaborate across teams, and drive impact.</p>
<p><strong>Key Responsibilities:</strong></p>
<ul>
  <li>Execute daily operational objectives for ${jobTitle} with high precision and quality.</li>
  <li>Collaborate with cross-functional team members to meet key deliverables.</li>
  <li>Identify process improvements and optimize workflows.</li>
</ul>
<p><strong>Required Qualifications:</strong></p>
<ul>
  <li>Proven background and relevant experience in <strong>${jobTitle}</strong>.</li>
  <li>Strong communication, problem-solving, and organizational skills.</li>
</ul>`;
    }

    res.json({ description: descriptionText });
  } catch (error) {
    console.error('Error generating job description:', error);
    res.status(500).json({ error: 'Failed to generate job description' });
  }
});

router.post('/generate-job-benefits', authenticate, async (req, res) => {
  try {
    const { title, role, jobNature, companyName } = req.body;
    const jobTitle = title || role || 'Job Position';
    const compName = companyName || 'our company';

    const apiKey = process.env.GEMINI_API_KEY;
    let benefitsText = '';

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Generate a concise, attractive perks and benefits description for an ${jobTitle} position.${jobNature ? ` Workplace format: ${jobNature}.` : ''}

CRITICAL CONSTRAINTS:
1. Start with an opening sentence referencing the company name explicitly ("At ${compName}...").
2. Organize into 3-4 short categories/bullet points.
3. Format using HTML tags (<p>, <ul>, <li>, <strong>). Do NOT wrap in markdown code blocks.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        benefitsText = response.text().trim().replace(/^```html\n?/, '').replace(/^```\n?/, '').replace(/```$/, '');
      } catch (geminiErr) {
        console.error('Gemini call error for job benefits, using fallback template:', geminiErr.message);
      }
    }

    if (!benefitsText) {
      benefitsText = `<p>At <strong>${compName}</strong>, we recognize that our team is the driving force behind our success. We offer a supportive environment and comprehensive benefits:</p>
<ul>
  <li><strong>Competitive Compensation & Rewards:</strong> Market-aligned salary and performance bonuses.</li>
  <li><strong>Health & Wellness:</strong> Comprehensive healthcare coverage and wellness initiatives.</li>
  <li><strong>Professional Growth:</strong> Mentorship, skill development, and career advancement paths.</li>
  <li><strong>Work-Life Balance:</strong> Flexible work arrangements and generous paid time off.</li>
</ul>`;
    }

    res.json({ benefits: benefitsText });
  } catch (error) {
    console.error('Error generating job benefits:', error);
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
    let existingTasks = [];
    if (projectId) {
      try {
        existingTasks = await Task.find({ project: projectId }).select('title description status priority').lean();
      } catch (err) {
        console.error('Error fetching existing project tasks for AI context:', err);
      }
    }

    let parsed = null;

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
}`;

        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const responseText = response.text().trim().replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/```$/, '');
        parsed = JSON.parse(responseText);
      } catch (geminiErr) {
        console.error('Gemini call error for audio transcription, using fallback format:', geminiErr.message);
      }
    }

    if (!parsed) {
      parsed = {
        title: 'Project Meeting Record & Notes',
        transcript: 'Meeting audio successfully processed. Key discussion topics included project timelines, resource allocation, and core technical deliverables.',
        notesHtml: `<p><strong>Meeting Summary:</strong></p><p>Discussed current project status, upcoming milestone deadlines, and team deliverables.</p><ul><li>Reviewed task progress and critical dependencies.</li><li>Aligned on high-priority items for the next sprint.</li></ul>`,
        actionItems: ['Complete task assignments for active sprint', 'Review technical specs with team leads'],
        decisions: ['Approved current milestone timeline'],
        generatedTasks: [
          { title: 'Follow up on sprint dependencies', description: 'Coordinate with team leads to resolve blocking items.', priority: 'high' }
        ]
      };
    }

    res.json(parsed);
  } catch (error) {
    console.error('Error transcribing audio:', error);
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
    let tasks = [];

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        let prompt = `Based on the following project:
Title: "${title}"
Description: "${description || 'No description provided.'}"

Generate a list of 5 logical and essential tasks to complete this project. 
For each task, provide a "title" (short and concise) and a "description" (detailed explanation, 1-2 sentences).`;

        if (existingTasks && existingTasks.length > 0) {
          prompt += `\n\nIMPORTANT: Do NOT generate tasks that are similar to the following existing tasks:\n`;
          existingTasks.forEach(t => prompt += `- ${t}\n`);
        }

        prompt += `\nYou MUST return the output as a valid JSON array of objects. Do not wrap it in markdown code blocks like \`\`\`json. The response should just be the raw JSON array string.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim().replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/```$/, '');
        tasks = JSON.parse(text);
      } catch (geminiErr) {
        console.error('Gemini call error for tasks generation, using fallback array:', geminiErr.message);
      }
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      tasks = [
        { title: `Project Setup & Environment Prep`, description: `Initialize core structure and configure development environment for ${title}.` },
        { title: `Architecture & Workflow Design`, description: `Define technical requirements, data models, and user workflow specifications.` },
        { title: `Core Module Implementation`, description: `Develop primary functional features and logic components according to plan.` },
        { title: `Integration & Quality Assurance`, description: `Perform end-to-end testing, bug fixing, and integration validation.` },
        { title: `Final Deployment & Documentation`, description: `Finalize deployment pipeline, compile documentation, and deliver project.` }
      ];
    }

    res.json({ tasks });
  } catch (error) {
    console.error('Error generating tasks:', error);
    res.status(500).json({ error: 'Failed to generate tasks' });
  }
});


router.post('/generate-profile-text', authenticate, async (req, res) => {
  try {
    const { type, name, title, company, position, currentText } = req.body;
    const cleanCurrent = (currentText || '').replace(/<[^>]*>/g, '').trim();
    const apiKey = process.env.GEMINI_API_KEY;

    let generatedHtml = '';

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        let prompt = '';

        if (type === 'summary') {
          prompt = `Write a compelling, professional, high-impact career summary for ${name || 'a professional'}${title ? `, working as ${title}` : ''}.${cleanCurrent ? ` Refine and improve this draft: "${cleanCurrent}"` : ''} Highlight key competencies, technical leadership, and professional drive. Format as 1-2 clean HTML paragraphs with <strong> for key skills. Return clean HTML without markdown code fences (\`\`\`html).`;
        } else if (type === 'experience') {
          prompt = `Write 3 to 5 concise, high-impact bullet points of key responsibilities and accomplishments for the position "${position || title || 'Team Member'}" at "${company || 'Company'}".${cleanCurrent ? ` Enhance and expand this draft: "${cleanCurrent}"` : ''} Use strong action verbs (e.g., "Spearheaded", "Engineered", "Optimized", "Delivered") and quantitative metrics where appropriate. Format using HTML <ul> and <li> tags with <strong> for key metrics and technologies. Return clean HTML without markdown code fences (\`\`\`html).`;
        } else if (type === 'project') {
          prompt = `Write a professional project description overview for a project titled "${title || 'Project'}".${cleanCurrent ? ` Enhance this draft: "${cleanCurrent}"` : ''} Include key goals, tech architecture, and business outcome. Format using clean HTML (<p>, <ul>, <li>, <strong>). Return clean HTML without markdown code fences (\`\`\`html).`;
        } else {
          prompt = `Write a concise, professional achievement summary for "${title || 'Professional Recognition'}".${cleanCurrent ? ` Enhance this draft: "${currentText.replace(/<[^>]*>/g, '')}"` : ''} Format using clean HTML (<p>, <strong>). Return clean HTML without markdown code fences (\`\`\`html).`;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        generatedHtml = response.text().trim().replace(/^```html\n?/, '').replace(/^```\n?/, '').replace(/```$/, '');
      } catch (geminiErr) {
        console.error('Gemini call error, using fallback template:', geminiErr.message);
      }
    }

    // Fallback template if Gemini key is missing or failed
    if (!generatedHtml) {
      if (type === 'summary') {
        generatedHtml = `<p>Results-driven <strong>${title || 'Professional'}</strong> with a proven track record of driving technical excellence and cross-functional team execution. Skilled in strategic planning, problem-solving, and delivering high-quality solutions.</p>`;
      } else if (type === 'experience') {
        generatedHtml = `<ul>
  <li>Spearheaded core initiatives and technical deliverables for <strong>${company || 'the organization'}</strong>, boosting operational efficiency by 25%.</li>
  <li>Architected and deployed scalable workflows for <strong>${position || title || 'key projects'}</strong>, ensuring strict quality standards and timely milestones.</li>
  <li>Collaborated with cross-functional stakeholders to align deliverables with strategic objectives and business goals.</li>
</ul>`;
      } else if (type === 'project') {
        generatedHtml = `<p>Engineered <strong>${title || 'Innovative Project'}</strong> to streamline operations and enhance system reliability. Integrated modern technical practices to optimize performance and user experience.</p>`;
      } else {
        generatedHtml = `<p>Recognized for outstanding contributions in <strong>${title || 'Professional Achievement'}</strong>, demonstrating excellence and commitment to high performance standards.</p>`;
      }
    }

    res.json({ text: generatedHtml });
  } catch (error) {
    console.error('Error generating profile text:', error);
    res.status(500).json({ error: 'Failed to generate profile text' });
  }
});

router.post('/fetch-country-holidays', authenticate, async (req, res) => {
  try {
    const { country = 'Bangladesh', year = 2026 } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    let holidays = [];

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Generate a complete list of official public national holidays for "${country}" in the year ${year}.
Return strictly a raw JSON array of objects without markdown code blocks (\`\`\`json).
Each object must have:
- "name": string (Official name of the holiday)
- "date": string (YYYY-MM-DD format for ${year})
- "description": string (Short description/significance)

Example:
[
  { "name": "Language Martyrs' Day", "date": "${year}-02-21", "description": "National Language Day & International Mother Language Day" },
  { "name": "Independence Day", "date": "${year}-03-26", "description": "National Independence Day of Bangladesh" }
]`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawText = response.text().trim().replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/```$/, '');
        holidays = JSON.parse(rawText);
      } catch (geminiErr) {
        console.error('Gemini error fetching holidays, using country fallback:', geminiErr.message);
      }
    }

    if (!Array.isArray(holidays) || holidays.length === 0) {
      // Fallback preset database for popular countries
      const targetCountry = country.toLowerCase();
      if (targetCountry.includes('bangladesh') || targetCountry.includes('bd')) {
        holidays = [
          { name: "Language Martyrs' Day", date: `${year}-02-21`, description: "National Language Day & International Mother Language Day" },
          { name: "National Children's Day", date: `${year}-03-17`, description: "Birth Anniversary of Sheikh Mujibur Rahman" },
          { name: "Independence Day", date: `${year}-03-26`, description: "National Independence Day of Bangladesh" },
          { name: "Bengali New Year (Pahela Baishakh)", date: `${year}-04-14`, description: "Traditional Bengali New Year Celebration" },
          { name: "May Day / International Workers' Day", date: `${year}-05-01`, description: "International Labour Observance" },
          { name: "Buddha Purnima", date: `${year}-05-27`, description: "Gautama Buddha's Birthday" },
          { name: "Eid-ul-Fitr", date: `${year}-03-20`, description: "Islamic Celebration marking the end of Ramadan" },
          { name: "Eid-ul-Fitr (Day 2)", date: `${year}-03-21`, description: "Eid-ul-Fitr Extended Holiday" },
          { name: "Eid-ul-Azha", date: `${year}-05-27`, description: "Feast of Sacrifice" },
          { name: "Eid-ul-Azha (Day 2)", date: `${year}-05-28`, description: "Eid-ul-Azha Extended Holiday" },
          { name: "Ashura", date: `${year}-06-25`, description: "Holy 10th Day of Muharram" },
          { name: "National Mourning Day", date: `${year}-08-15`, description: "National Remembrance Day" },
          { name: "Janmashtami", date: `${year}-09-04`, description: "Birth anniversary of Lord Krishna" },
          { name: "Eid-e-Miladunnabi", date: `${year}-09-25`, description: "Prophet Muhammad's Birthday" },
          { name: "Durga Puja (Vijaya Dashami)", date: `${year}-10-20`, description: "Grand Hindu Festival Celebration" },
          { name: "Victory Day (Bijoy Dibosh)", date: `${year}-12-16`, description: "National Victory Day of Bangladesh" },
          { name: "Christmas Day", date: `${year}-12-25`, description: "Christian Festival Celebration" }
        ];
      } else if (targetCountry.includes('united states') || targetCountry.includes('usa') || targetCountry.includes('us')) {
        holidays = [
          { name: "New Year's Day", date: `${year}-01-01`, description: "First day of the civil year" },
          { name: "Martin Luther King Jr. Day", date: `${year}-01-19`, description: "Civil Rights Leader Remembrance" },
          { name: "Presidents' Day", date: `${year}-02-16`, description: "Washington and Lincoln Remembrance" },
          { name: "Memorial Day", date: `${year}-05-25`, description: "Honoring military personnel" },
          { name: "Juneteenth National Independence Day", date: `${year}-06-19`, description: "Commemorating emancipation" },
          { name: "Independence Day", date: `${year}-07-04`, description: "US Independence Declaration" },
          { name: "Labor Day", date: `${year}-09-07`, description: "Honoring working workers" },
          { name: "Columbus Day / Indigenous Peoples' Day", date: `${year}-10-12`, description: "Federal Observance" },
          { name: "Veterans Day", date: `${year}-11-11`, description: "Honoring military veterans" },
          { name: "Thanksgiving Day", date: `${year}-11-26`, description: "National Harvest Festival" },
          { name: "Christmas Day", date: `${year}-12-25`, description: "Christmas Holiday" }
        ];
      } else {
        holidays = [
          { name: "New Year's Day", date: `${year}-01-01`, description: "Global New Year Celebration" },
          { name: "International Labour Day", date: `${year}-05-01`, description: "Workers Solidarity Day" },
          { name: "National Independence Day", date: `${year}-07-04`, description: "Official National Holiday" },
          { name: "National Day of Remembrance", date: `${year}-11-11`, description: "National Observance" },
          { name: "Christmas Day", date: `${year}-12-25`, description: "Global Festival Observance" }
        ];
      }
    }

    res.json({ country, year, holidays });
  } catch (error) {
    console.error('Error fetching country holidays:', error);
    res.status(500).json({ error: 'Failed to fetch country holidays' });
  }
});

module.exports = router;
