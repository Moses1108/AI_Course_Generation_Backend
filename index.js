// index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
// const config = require('./config');  // Assuming you have a config file for API keys

const app = express();
app.use(cors());
app.use(express.json());

const openaiApiKey = process.env.OPENAI_KEY;
const serpapiApiKey = process.env.SERPAPI_KEY;

const sendRequest = async (endpoint, headers, payload) => {
  for (let i = 0; i < 5; i++) {
    try {
      const response = await axios.post(endpoint, payload, { headers });
      return response.data;
    } catch (error) {
      console.log("Request Error:", error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  throw new Error("Failed to connect after multiple attempts.");
};

const searchImage = async (query) => {
  const params = {
    engine: "google",
    q: query,
    tbm: "isch",
    api_key: serpapiApiKey
  };
  try {
    const response = await axios.get("https://serpapi.com/search", { params });
    if (response.status === 200) {
      const images = response.data.images_results;
      if (images.length > 0) {
        return images[0].original;
      }
    }
  } catch (error) {
    console.log("Image Search Error:", error);
  }
  return null;
};

app.post('/generate-chapters', async (req, res) => {
  const data = req.body;
  const prompt = data.prompt;
  const promptMessage = `Generate a list of chapters and subchapters for a course on ${prompt} in JSON format. Do not include any explanation or code formatting. Format it in this way: {'chapter_name': ['subchapters']}. Please include between 5 and 10 subchapters per chapter. Use this format exactly.`;
  
  const requestPayload = [
    { role: "system", content: promptMessage },
    { role: "user", content: "generate with 4 space indents" }
  ];
  
  const payload = {
    model: "gpt-4",
    messages: requestPayload,
    max_tokens: 4000
  };
  
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${openaiApiKey}`
  };
  
  try {
    const response = await sendRequest("https://api.openai.com/v1/chat/completions", headers, payload);
    const gptResponse = response.choices[0].message.content;
    console.log("Chapters Response:", gptResponse);
    
    const jsonResponse = JSON.parse(gptResponse);
    if (typeof jsonResponse === 'object' && jsonResponse !== null) {
      for (const chapter in jsonResponse) {
        if (!Array.isArray(jsonResponse[chapter])) {
          throw new Error(`Subchapters for ${chapter} are not in a list format`);
        }
      }
    }
    res.json(jsonResponse);
  } catch (error) {
    console.log(`Failed to decode JSON response: ${error}`);
    res.status(500).json({ error: "Failed to decode JSON response from OpenAI" });
  }
});

app.post('/generate-content', async (req, res) => {
  const data = req.body;
  const { chapter_name, subchapter_name, prompt } = data;
  const promptMessage = `Generate the content for a subchapter in a course. The chapter title is ${chapter_name}. The title of the subchapter is ${subchapter_name}. The course is about ${prompt}. Please only include the requested data. Format the content in HTML. Additionally, include suggestions for images where appropriate by wrapping the suggestions in [IMAGE: ...].`;
  
  const requestPayload = [
    { role: "system", content: promptMessage },
    { role: "user", content: "Do not include the chapter title, the subchapter title, or the course title in the data, only the chapter content." }
  ];
  
  const payload = {
    model: "gpt-4",
    messages: requestPayload,
    max_tokens: 4000
  };
  
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${openaiApiKey}`
  };
  
  try {
    const response = await sendRequest("https://api.openai.com/v1/chat/completions", headers, payload);
    let gptResponse = response.choices[0].message.content;
    console.log("Content Response:", gptResponse);
    
    const contentParts = gptResponse.split('[IMAGE:');
    let finalContent = contentParts[0];
    for (const part of contentParts.slice(1)) {
      const [imagePrompt, restOfContent] = part.split(']');
      const imageUrl = await searchImage(imagePrompt.trim());
      if (imageUrl) {
        finalContent += `<img src="${imageUrl}" alt="${imagePrompt.trim()}"/>` + restOfContent;
      } else {
        finalContent += `[IMAGE: ${imagePrompt.trim()}]` + restOfContent;
      }
    }
    
    res.json(finalContent);
  } catch (error) {
    console.log(`Content Generation Error: ${error}`);
    res.status(500).json({ error: "Failed to generate content from OpenAI" });
  }
});

app.post('/dig-deeper', async (req, res) => {
  const data = req.body;
  const { chapter_name, subchapter_name, prompt } = data;
  const promptMessage = `
    Generate a more detailed and comprehensive content for the subchapter '${subchapter_name}' in the chapter '${chapter_name}' of the course on '${prompt}'. 
    Include:
    1. Detailed explanations of key concepts
    2. Examples and case studies
    3. Step-by-step guides
    4. Visual aids such as diagrams or images

    Format the content in HTML and include suggestions for images where appropriate by wrapping the suggestions in [IMAGE: ...].
  `;
  
  const requestPayload = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: promptMessage }
  ];
  
  const payload = {
    model: "gpt-4",
    messages: requestPayload,
    max_tokens: 8000
  };
  
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${openaiApiKey}`
  };
  
  try {
    const response = await sendRequest("https://api.openai.com/v1/chat/completions", headers, payload);
    let gptResponse = response.choices[0].message.content;
    console.log("Detailed Content Response:", gptResponse);
    
    const contentParts = gptResponse.split('[IMAGE:');
    let finalContent = contentParts[0];
    for (const part of contentParts.slice(1)) {
      const [imagePrompt, restOfContent] = part.split(']');
      const imageUrl = await searchImage(imagePrompt.trim());
      if (imageUrl) {
        finalContent += `<img src="${imageUrl}" alt="${imagePrompt.trim()}"/>` + restOfContent;
      } else {
        finalContent += `[IMAGE: ${imagePrompt.trim()}]` + restOfContent;
      }
    }
    
    res.json(finalContent);
  } catch (error) {
    console.log(`Detailed Content Generation Error: ${error}`);
    res.status(500).json({ error: "Failed to generate detailed content from OpenAI" });
  }
});

app.post('/generate-exam', async (req, res) => {
  const data = req.body;
  const { chapter_name, subchapter_name, prompt } = data;
  
  const promptMessage = `
    Generate an exam for the subchapter '${subchapter_name}' in the chapter '${chapter_name}' of the course on '${prompt}'. 
    Include three types of questions:
    1. Selection problems (multiple-choice) - 5 questions
    2. Fill-in-the-blank problems - 5 questions
    3. Entry problems (short answer) - 5 questions

    Format the response as a JSON array with the following structure:
    [
        {
            "type": "selection",
            "question": "question text",
            "options": ["option1", "option2", "option3", "option4"],
            "correct_answer": "option1"
        },
        {
            "type": "fill-in-the-blank",
            "question": "question text with __blank__",
            "correct_answer": "answer"
        },
        {
            "type": "entry",
            "question": "question text",
            "correct_answer": "answer"
        }
    ]
  `;
  
  const requestPayload = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: promptMessage }
  ];
  
  const payload = {
    model: "gpt-4",
    messages: requestPayload,
    max_tokens: 2000
  };
  
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${openaiApiKey}`
  };
  
  try {
    const response = await sendRequest("https://api.openai.com/v1/chat/completions", headers, payload);
    const gptResponse = response.choices[0].message.content;
    console.log("Exam Questions Response:", gptResponse);
    
    const jsonResponse = JSON.parse(gptResponse);
    res.json(jsonResponse);
  } catch (error) {
    console.log(`Failed to decode JSON response: ${error}`);
    res.status(500).json({ error: "Failed to decode JSON response from OpenAI" });
  }
});

app.post('/evaluate-exam', async (req, res) => {
  const data = req.body;
  const { questions, answers: userAnswers } = data;

  const correctAnswers = questions.reduce((acc, question) => {
    acc[question.question] = question.correct_answer;
    return acc;
  }, {});

  const results = questions.reduce((acc, question) => {
    acc[question.question] = userAnswers[question.question] === question.correct_answer;
    return acc;
  }, {});

  const score = Object.values(results).filter(Boolean).length;
  const totalQuestions = questions.length;
  const score5Point = (score / totalQuestions) * 5;

  const explanations = {};
  for (const question of questions) {
    const explanationPrompt = `Explain the correct answer for the following question:\nQuestion: ${question.question}\nCorrect Answer: ${question.correct_answer}`;
    const requestPayload = [
      { role: "system", content: "You are a knowledgeable assistant." },
      { role: "user", content: explanationPrompt }
    ];
    const payload = {
      model: "gpt-4",
      messages: requestPayload,
      max_tokens: 500
    };
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiApiKey}`
    };
    try {
      const response = await sendRequest("https://api.openai.com/v1/chat/completions", headers, payload);
      const explanationResponse = response.choices[0].message.content;
      explanations[question.question] = explanationResponse;
    } catch (error) {
      console.log(`Explanation Generation Error: ${error}`);
      explanations[question.question] = "Failed to generate explanation.";
    }
  }

  res.json({
    results,
    score: Math.round(score5Point * 10) / 10,
    total: totalQuestions,
    explanations
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
