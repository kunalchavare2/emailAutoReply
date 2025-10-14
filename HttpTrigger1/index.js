const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MongoClient } = require('mongodb');

module.exports = async function (context, req) {
  context.log('Email received from Power Automate.');

  const { from, subject, body } = req.body || {};

  // Step 0: Basic validation
  if (!from || !subject || !body) {
    context.res = {
      status: 400,
      body: 'Invalid request — missing email details.',
    };
    return;
  }

  // Step 0.1: Ensure environment variables
  const { GEMINI_API_KEY, MONGODB_URI, DB_NAME, COLLECTION_NAME } = process.env;
  if (!GEMINI_API_KEY || !MONGODB_URI || !DB_NAME || !COLLECTION_NAME) {
    context.res = {
      status: 500,
      body: 'Server configuration error — missing environment variables.',
    };
    return;
  }

  // Initialize Gemini and MongoDB
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Step 1: Generate embedding for the incoming email
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    const embedResult = await embeddingModel.embedContent({
      content: { parts: [{ text: subject + body }] },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: 768, // Match your MongoDB index dimensions
    });

    const queryEmbedding = embedResult.embedding.values;

    // Step 2: Search MongoDB vector index
    const results = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: 'default', // your vector index name
            queryVector: queryEmbedding, // embedding of incoming email
            path: 'embedding',
            numCandidates: 5,
            limit: 1,
            similarity: 'cosine',
          },
        },
        {
          $project: {
            question: 1,
            answer: 1,
            similarity: { $meta: 'vectorSearchScore' }, // ✅ This gives the similarity
          },
        },
      ])
      .toArray();

    console.log(results);

    const topMatch = results.length > 0 ? results[0] : null;
    const confidence = topMatch ? topMatch.similarity : 0;
    console.log(topMatch);

    if (topMatch) {
      if (confidence > 0.75) {
        matchedAnswer = topMatch.answer;
      } else {
        matchedAnswer =
          'Thank you for your email. We’ll review your query and get back to you soon.';
      }
    } else {
      matchedAnswer = 'Thank you for your email. We’ll review your query and get back to you soon.';
    }

    // Step 3: Generate a formal email reply using Gemini
    const formalModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
    You are a professional customer support assistant.
    An email has been received with the following content:
    "${body}"
    A matched answer from the knowledge base is:
    "${matchedAnswer}"
    Please compose a polite and formal reply to the sender, by using the matched answer.
    give properly formatted email reply. 
    Only provide the email body in your response.
    HTML email with proper paragraphs and line breaks.
    It should be concise, polite, and directly address the sender's query.

    example:
    <p>Dear Customer,</p>

<p>Thank you for contacting us regarding your request to change your address.</p>

<p>You can change your delivery address before the order is shipped from the 'Orders' section in your account.</p>

<p>If you require any further assistance or have additional questions, please do not hesitate to contact us.</p>

<p>Sincerely,<br>
Customer Support Team</p>
    `;

    // Ensure input is always valid and iterable
    // const systemMessage = 'You are a professional customer support assistant.';
    // const userMessage = `Incoming email: "${body}"\nMatched answer: "${matchedAnswer}"\nCompose a polite, formal reply.`;

    const formalReply = await formalModel.generateContent(prompt);
    const finalReply = formalReply.response.text();

    // Step 4: Return response to Power Automate
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        matchedAnswer,
        replyMessage: finalReply,
        confidence: confidence.toFixed(2),
      },
    };
  } catch (err) {
    context.log.error('Error processing email:', err);
    context.res = {
      status: 500,
      body: 'Internal server error: ' + err.message,
    };
  } finally {
    await client.close();
  }
};
