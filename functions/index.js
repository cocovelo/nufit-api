console.log('🚀 Starting Firebase Functions...');
// Force rebuild - v2 token creation debug logging

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const { parse } = require('csv-parse');

// Initialize Firebase Admin
admin.initializeApp();
console.log('Firebase Admin SDK initialized.');

const storage = admin.storage();
const db = admin.firestore();

// Initialize Stripe safely: prefer functions.config().stripe.secret_key, then env var fallback.
let stripe = null;
try {
  // functions.config is a function; call it safely to read config values
  let configObj = {};
  try {
    if (typeof functions.config === 'function') {
      configObj = functions.config() || {};
    }
  } catch (cfgErr) {
    configObj = {};
  }

  const stripeKeyFromConfig = (configObj && configObj.stripe && configObj.stripe.secret_key) ? configObj.stripe.secret_key : null;
  const stripeKeyFromEnv = process.env.STRIPE_SECRET || process.env.STRIPE_SECRET_KEY || null;
  const stripeSecret = stripeKeyFromConfig || stripeKeyFromEnv || null;

  if (stripeSecret) {
    stripe = require('stripe')(stripeSecret);
    console.log('Stripe SDK initialized.');
  } else {
    console.warn('Stripe secret not found in functions.config or env; Stripe features disabled.');
  }
} catch (e) {
  console.error('Stripe initialization failed:', e);
}

// Import API routes
const apiRoutes = require('./api-routes');

// Express app for webhook handling
const webhookApp = express();
webhookApp.use(bodyParser.raw({ type: 'application/json' }));

// Express app for public REST API
const apiApp = express();
apiApp.set('trust proxy', 1); // Trust X-Forwarded-For header from Cloud Functions (numeric value for compatibility)
apiApp.use(cors({ origin: true }));
apiApp.use(express.json());
console.log('Express apps created and configured.');

const runtimeOptions = {
  timeoutSeconds: 540,  // ⏱️ 5-minute timeout
  memory: '2GB'
};

const fetch = require('node-fetch');
const firebaseConfig = JSON.parse(process.env.__firebase_config || '{}');
const appId = process.env.__app_id || 'default-app-id'; // Use default-app-id for local testing if __app_id is not set
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

exports.generateShoppingList = functions.https.onRequest(async (req, res) => {
  // --- CORS Setup ---
  // Set CORS headers to allow requests from any origin during development.
  // IMPORTANT: In a production environment, you should restrict 'Access-Control-Allow-Origin'
  // to only your specific frontend domain(s) for security.
  res.set('Access-Control-Allow-Origin', '*');
  // Define allowed HTTP methods for this function.
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  // Define allowed headers for preflight requests.
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS requests. Browsers send these automatically before
  // complex HTTP methods like POST to check CORS policies.
  if (req.method === 'OPTIONS') {
    res.status(204).send(''); // Respond with 204 No Content for successful preflight.
    return; // Exit the function after handling OPTIONS.
  }

  try {
    // --- Input Validation ---
    // Extract `userId` and `nutritionPlanId` from the request body.
    // In a real-world secure application, `userId` would typically be derived from
    // an authenticated Firebase ID Token (e.g., by using Firebase callable functions
    // or by manually verifying the token in an HTTP function). For this example,
    // we assume it's passed directly from the client.
    const { userId, nutritionPlanId } = req.body;

    // Validate that necessary parameters are provided.
    if (!userId || !nutritionPlanId) {
      console.error('[ShopListFn] Validation Error: Missing userId or nutritionPlanId in request body.');
      return res.status(400).json({ error: 'Missing userId or nutritionPlanId in request body. Please provide both.' });
    }

    // --- 1. Collect User's Ingredient Information from Firestore ---
    // The base path to the 'days' subcollection within the specific nutrition plan.
    // This now correctly points to: users/{userId}/nutritionPlans/{nutritionPlanId}
    const nutritionPlanDocRef = db.collection('users').doc(userId)
                                     .collection('nutritionPlans').doc(nutritionPlanId);

    console.log(`[ShopListFn] Attempting to fetch nutrition plan document from Firestore path: ${nutritionPlanDocRef.path}`);
    const nutritionPlanDocSnapshot = await nutritionPlanDocRef.get();

    if (!nutritionPlanDocSnapshot.exists) {
      console.log('[ShopListFn] Nutrition plan document not found for the specified ID. Returning empty list.');
      return res.status(200).json({ shoppingList: [], message: 'Nutrition plan document not found. The shopping list is empty.' });
    }

    const nutritionPlanData = nutritionPlanDocSnapshot.data();
    console.log(`[ShopListFn] Fetched nutrition plan data (top-level keys): ${Object.keys(nutritionPlanData || {})}`); // DEBUG

    if (!nutritionPlanData || !nutritionPlanData.days || typeof nutritionPlanData.days !== 'object') {
      console.log('[ShopListFn] Nutrition plan document found, but it does not contain valid "days" data. Returning empty list.');
      console.log(`[ShopListFn] nutritionPlanData: ${JSON.stringify(nutritionPlanData)}`); // DEBUG: Log full data if "days" is missing/invalid
      return res.status(200).json({ shoppingList: [], message: 'Nutrition plan found, but no days data. The shopping list is empty.' });
    }
    console.log(`[ShopListFn] 'days' field found. Type: ${typeof nutritionPlanData.days}. Keys: ${Object.keys(nutritionPlanData.days)}`); // DEBUG

    const planDays = nutritionPlanData.days;
    let allIngredientLines = [];
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

    for (const day of Object.keys(planDays)) {
        const dayData = planDays[day];
        console.log(`[ShopListFn] Processing day: ${day}. Day Data Keys: ${Object.keys(dayData || {})}`); // DEBUG

        for (const mealType of mealTypes) {
            console.log(`[ShopListFn] Checking ${day} - ${mealType}...`); // DEBUG
            if (dayData[mealType] && typeof dayData[mealType] === 'object' && dayData[mealType].Ingredients) {
                const ingredientString = dayData[mealType].Ingredients;
                console.log(`[ShopListFn] Found ingredients for ${day} - ${mealType}. Raw string length: ${ingredientString.length}. String (first 50 chars): "${ingredientString.substring(0, Math.min(ingredientString.length, 50))}..."`); // DEBUG: Log snippet

                const lines = ingredientString.split('/n').map(line => line.trim()).filter(line => line.length > 0);
                console.log(`[ShopListFn] Split ${lines.length} lines for ${day} - ${mealType}. First line: "${lines[0] || 'N/A'}"`); // DEBUG
                allIngredientLines = allIngredientLines.concat(lines);
            } else {
                console.log(`[ShopListFn] No 'Ingredients' found or invalid structure for ${day} - ${mealType}. MealType data: ${JSON.stringify(dayData[mealType])}`); // DEBUG: Log what was found for the mealType
            }
        }
    }

    if (allIngredientLines.length === 0) {
        console.log('[ShopListFn] No specific ingredient lines found within the fetched nutrition plan. Returning empty shopping list.');
        return res.status(200).json({ shoppingList: [], message: 'No ingredient lines found in your nutrition plan. The shopping list is empty.' });
    }

    console.log(`[ShopListFn] Successfully collected ${allIngredientLines.length} unique ingredient lines for annotation. Proceeding to Gemini...`);

    // --- 2. Send Ingredient Information to Google Gemini LLM API for Annotation ---
    const annotatedIngredients = [];
    const geminiApiKey = functions.config().gemini.api_key;
    if (!geminiApiKey) {
        console.error('[ShopListFn] ERROR: Gemini API key is not configured. Please set it using Firebase CLI.');
        return res.status(500).json({ error: 'Gemini API key not configured on the server.' });
    }

    const batchSize = 10; // Process 10 ingredient lines per Gemini API call
    const annotationPromises = [];

    for (let i = 0; i < allIngredientLines.length; i += batchSize) {
        const batch = allIngredientLines.slice(i, i + batchSize);
        
        const annotationPrompt = `
        You are an expert at extracting ingredient details from text. For EACH of the following ingredient lines, identify and extract the 'QUANTITY', 'UNIT', 'INGREDIENT', 'PREP_METHOD', 'SIZE', 'STATE', 'OTHER', and 'EQUIPMENT' entities.

        Return the output as a JSON ARRAY of objects. Each object in this array MUST represent one input line and MUST have:
        - 'text': (string) The ORIGINAL ingredient line that was provided.
        - 'entities': (array) An array of entity objects. Each entity object should have 'start' (number), 'end' (number), and 'label' (string).

        The 'start' and 'end' values must be precise character offsets within the 'text' string. If an entity type is not found for a given ingredient line, do not include that specific entity in its 'entities' array.

        Example Input Lines:
        - 1 teaspoon kosher salt
        - Nonstick vegetable oil spray

        Example JSON Output:
        [
          { "text": "1 teaspoon kosher salt", "entities": [ {"start": 0, "end": 1, "label": "QUANTITY"}, {"start": 2, "end": 10, "label": "UNIT"}, {"start": 11, "end": 22, "label": "INGREDIENT"} ] },
          { "text": "Nonstick vegetable oil spray", "entities": [ {"start": 0, "end": 28, "label": "INGREDIENT"} ] }
        ]

        Please annotate the following lines:
        ${batch.map(line => `- ${line}`).join('\n')}

        JSON Output:
        `;

        const batchGeminiPayload = {
            contents: [{ role: "user", parts: [{ text: annotationPrompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            text: { "type": "STRING" },
                            entities: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        start: { "type": "NUMBER" },
                                        end: { "type": "NUMBER" },
                                        label: { "type": "STRING" }
                                    },
                                    required: ["start", "end", "label"]
                                }
                            }
                        },
                        required: ["text", "entities"]
                    }
                }
            }
        };

        annotationPromises.push(
            fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(batchGeminiPayload),
                }
            )
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorBody => {
                        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorBody)}`);
                    });
                }
                return response.json();
            })
            .then(result => {
                if (result.candidates && result.candidates.length > 0 &&
                    result.candidates[0].content && result.candidates[0].content.parts &&
                    result.candidates[0].content.parts.length > 0) {
                    const jsonString = result.candidates[0].content.parts[0].text;
                    return JSON.parse(jsonString);
                } else {
                    console.warn(`[ShopListFn] Gemini returned unexpected structure for a batch. Full result:`, JSON.stringify(result));
                    return [];
                }
            })
            .catch(error => {
                console.error(`[ShopListFn] Error during Gemini annotation batch processing:`, error.message);
                return [];
            })
        );
    }

    const batchedAnnotatedResults = await Promise.all(annotationPromises);
    batchedAnnotatedResults.forEach(batchResult => {
        annotatedIngredients.push(...batchResult);
    });
    console.log(`[ShopListFn] All annotation batches processed. Total annotated lines collected: ${annotatedIngredients.length}.`);

    if (annotatedIngredients.length === 0) {
      console.log('[ShopListFn] No ingredients successfully annotated after batch processing. Returning empty list.');
      return res.status(200).json({ shoppingList: [], message: 'Failed to annotate any ingredients. The shopping list is empty.' });
    }

    // --- 3. Turn Annotated Ingredients into a Shopping List ---
    const shoppingListPrompt = `
    You are an intelligent shopping list generator. Your task is to take a detailed JSON list of annotated ingredients (from multiple recipes) and consolidate them into a concise, actionable shopping list.

    Here are the rules for consolidation and categorization:
    - Group similar ingredients together (e.g., "milk" and "milk").
    - Sum quantities where appropriate (e.g., "2 cups milk" and "1 cup milk" should be consolidated into "3 cups milk"). Handle different units if possible, or list them separately if conversion is ambiguous.
    - For items without a specific quantity (e.g., "salt to taste"), just list the item name without a quantity.
    - Exclude comments or non-ingredient related entities if they appear.
    - **Crucially, categorize each consolidated item.** The 'category' field for each item MUST be one of the following exact category names:
        - 'Produce (Fruits & Vegetables)'
        - 'Dairy & Alternatives'
        - 'Meat & Poultry'
        - 'Seafood'
        - 'Pantry (Dry Goods, Canned, Jarred)'
        - 'Baked Goods'
        - 'Frozen'
        - 'Spices & Condiments'
        - 'Beverages'
        - 'Other'
    - If you cannot determine a precise category from the list above, use 'Pantry (Dry Goods, Canned, Jarred)' or 'Other'.

    Output the shopping list as a JSON array of objects. Each object in this array MUST have:
    - 'item': (string) The consolidated, descriptive ingredient name (e.g., "whole milk", "fresh cilantro").
    - 'quantity': (string, optional) The total consolidated quantity and unit (e.g., "3 cups", "5 large"). If no quantity is applicable or found, omit this field.
    - 'category': (string) The category of the item, chosen *exactly* from the predefined list above.

    Example of desired output structure:
    [
      { "item": "Milk (whole)", "quantity": "3 cups", "category": "Dairy & Alternatives" },
      { "item": "Chicken Breasts", "quantity": "500g", "category": "Meat & Poultry" },
      { "item": "Spinach", "quantity": "200g bag", "category": "Produce (Fruits & Vegetables)" },
      { "item": "Dark chocolate", "quantity": "100g", "category": "Pantry (Dry Goods, Canned, Jarred)" }
    ]

    Annotated Ingredients JSON:
    ${JSON.stringify(annotatedIngredients, null, 2)}

    Shopping List JSON:
    `;

    // Define the payload for the second Gemini API request (shopping list generation).
    const geminiPayloadForShoppingList = {
      contents: [{ role: "user", parts: [{ text: shoppingListPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              item: { "type": "STRING" },
              quantity: { "type": "STRING" }, // Quantity as string to handle diverse formats (e.g., "3 cups", "5 large", "1.5 kg")
              category: { "type": "STRING" }  // NEW: Category field
            },
            required: ["item", "category"] // NEW: Category is now required
          }
        }
      }
    };

    let shoppingList = []; // Initialize an empty array for the shopping list
    try {
      console.log('[ShopListFn] Sending request to Gemini for final shopping list generation with categorization.');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayloadForShoppingList),
        }
      );

      const result = await response.json();
      // Check for valid content in the Gemini response for the shopping list.
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const jsonString = result.candidates[0].content.parts[0].text;
        shoppingList = JSON.parse(jsonString); // Parse the final shopping list JSON
        console.log('[ShopListFn] Shopping list successfully generated by Gemini with categories.');
      } else {
        console.warn('[ShopListFn] Gemini returned an unexpected structure for the shopping list (categorization phase). Full result:', JSON.stringify(result));
      }
    } catch (error) {
      // Log errors specifically related to shopping list generation.
      console.error('[ShopListFn] Error generating shopping list from annotated data (categorization phase):', error.message);
    }

    // --- 4. Store the generated shopping list in Firestore ---
    const shoppingListDocRef = db.collection('users').doc(userId)
                                 .collection('nutritionPlans').doc(nutritionPlanId)
                                 .collection('shoppingLists').doc('latest'); // Store as a specific document named 'latest'

    const shoppingListDataToStore = {
      generatedAt: admin.firestore.FieldValue.serverTimestamp(), // Use server timestamp
      items: shoppingList // The actual list of items
    };

    await shoppingListDocRef.set(shoppingListDataToStore);
    console.log('[ShopListFn] Shopping list successfully stored in Firestore.');

    // --- 5. Return the Shopping List to the Client ---
    // Send a successful HTTP 200 response with the generated shopping list.
    res.status(200).json({ shoppingList });

  } catch (error) {
    // Catch any unhandled exceptions that might occur during the Cloud Function's execution.
    console.error('[ShopListFn] Unhandled Cloud Function error during shopping list generation:', error);
    // Send a 500 Internal Server Error response to the client.
    res.status(500).json({ error: 'Failed to generate shopping list due to an internal server error.', details: error.message });
  }
});


// ✅ Updated function: CSV -> Firestore (with batching + throttling)
async function processCSVToFirestore(bucketName, filePath) {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filePath);

  try {
    const [buffer] = await file.download();
    const records = await new Promise((resolve, reject) => {
      parse(buffer, { columns: true, skipEmptyLines: true }, (err, output) => {
        err ? reject(err) : resolve(output);
      });
    });

    const collectionName = filePath.replace(/\.csv$/, '');
    const collectionRef = db.collection(collectionName);

    console.log(`📊 Processing ${records.length} rows for collection "${collectionName}"`);

    const batchSize = 100;
    let batch = db.batch();
    let count = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // Clean record: remove empty keys and null/undefined
      const cleanedRecord = Object.fromEntries(
        Object.entries(record).filter(([key, value]) => {
          return key && value !== null && value !== undefined;
        })
      );

      const docId = record.id ? record.id.toString() : undefined;
      const docRef = docId
        ? collectionRef.doc(docId)
        : collectionRef.doc(); // auto-generated ID

      batch.set(docRef, cleanedRecord);
      count++;

      // Commit in batches
      if (count % batchSize === 0 || i === records.length - 1) {
        await batch.commit();
        console.log(`✅ Committed ${count} records`);

        batch = db.batch(); // reset batch

        // Throttle every 500 records to avoid rate limits
        if (count % 500 === 0) {
          console.log(`🕒 Throttling after ${count} records...`);
          await new Promise(res => setTimeout(res, 500)); // 0.5 second pause
        }
      }
    }

    console.log(`🎉 Finished uploading ${count} records to collection: ${collectionName}`);
  } catch (error) {
    console.error(`❌ Failed to process CSV ${filePath}:`, error);
    throw error;
  }
}

// ✅ Gen1 Cloud Function (can migrate to Gen2 later with onObjectFinalized from v2/storage)
exports.processCSVsToFirestore = functions
  .runWith(runtimeOptions)
  .storage
  .object()
  .onFinalize(async (object) => {
    const bucketName = object.bucket;
    const filePath = object.name;

    const validCSVFiles = [
      'breakfast_list_full_may2025.csv',
      'lunch_list_full_may2025.csv',
      'dinner_list_full_may2025.csv',
      'snack_list_full_may2025.csv',
    ];

    if (!filePath || !validCSVFiles.includes(filePath)) {
      console.log(`ℹ️ Ignoring non-target file: ${filePath}`);
      return null;
    }

    console.log(`📥 CSV file uploaded: ${filePath}`);

    try {
      await processCSVToFirestore(bucketName, filePath);
      console.log(`✅ Successfully processed ${filePath}`);
      return null;
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
      throw error;
    }
  });




  

// Create Stripe Checkout session
exports.createStripeCheckout = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  const uid = context.auth.uid;

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    let customerId = userData?.stripeCustomerId;

    if (!customerId) {
      console.log("❌ No existing Stripe customer found. Creating a new one...");

      const customer = await stripe.customers.create({
        email: data.email,
        metadata: { firebaseUID: uid },
      });

      customerId = customer.id;

      await db.collection('users').doc(uid).set({
        stripeCustomerId: customerId,
      }, { merge: true });

      console.log("✅ Stripe customer created with ID:", customerId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: 'price_1RJx3cDNiU7g4QNyVyT5vujC', // Replace with your actual price ID
        quantity: 1,
      }],
      success_url: 'https://nufit-67bf0.web.app/success.html',
      cancel_url: 'https://nufit-67bf0.web.app/cancel.html',
      customer: customerId,
    });

    return { sessionUrl: session.url };
  } catch (error) {
    console.error("❌ Stripe session creation failed:", error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Webhook entry point
exports.handleStripeWebhook = functions.https.onRequest(webhookApp);

// Stripe webhook handler
webhookApp.post('*', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = functions.config().stripe.webhook_secret;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    console.log("📬 Received event:", event.type);
    console.log("📦 Event data:", JSON.stringify(event, null, 2));
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const dataObject = event.data.object;
  const customerId = dataObject.customer;
  let userDoc;

  if (!customerId) {
    console.warn("⚠️ No customer ID in webhook event");
    return res.status(400).send("Missing customer ID");
  }

  try {
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("stripeCustomerId", "==", customerId).limit(1).get();

    if (!snapshot.empty) {
      userDoc = snapshot.docs[0];
    } else {
      console.warn(`⚠️ No user found with stripeCustomerId: ${customerId}. Trying metadata fallback...`);

      const firebaseUID = dataObject?.metadata?.firebaseUID;
      if (firebaseUID) {
        const fallbackDoc = await db.collection("users").doc(firebaseUID).get();
        if (fallbackDoc.exists) {
          userDoc = fallbackDoc;
          console.log(`✅ Fallback succeeded. Found user by firebaseUID: ${firebaseUID}`);
        } else {
          console.warn(`❌ Fallback failed. No user with UID: ${firebaseUID}`);
          return res.status(404).send("User not found after fallback");
        }
      } else {
        console.warn("❌ No firebaseUID in metadata for fallback");
        return res.status(404).send("User not found and no fallback available");
      }
    }

    if (["customer.subscription.created", "customer.subscription.updated"].includes(event.type)) {
      console.log(`📲 Subscription event: ${event.type}`);

      await userDoc.ref.update({
        subscribed: ['active', 'trialing'].includes(dataObject.status),
        subscriptionId: dataObject.id,
        currentPeriodEnd: dataObject.current_period_end * 1000,
      });

      console.log(`✅ Subscription ${event.type} for user ${userDoc.id}`);
      console.log("🔍 Subscription status:", dataObject.status);
    } else if (event.type === "customer.subscription.deleted") {
      await userDoc.ref.update({
        subscribed: false,
        subscriptionId: admin.firestore.FieldValue.delete(),
        currentPeriodEnd: admin.firestore.FieldValue.delete(),
      });
      console.log(`⚠️ Subscription cancelled for user ${userDoc.id}`);
    }

    return res.status(200).json({ received: true });
  } catch (dbError) {
    console.error("❌ Firestore update failed:", dbError);
    return res.status(500).send("Internal Firestore error");
  }
});

// Cancel subscription
exports.cancelStripeSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const uid = context.auth.uid;

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();

    const subscriptionId = userData?.subscriptionId;
    if (!subscriptionId) {
      throw new functions.https.HttpsError("not-found", "No subscription found.");
    }

    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    await stripe.subscriptions.del(subscriptionId);

    await db.collection("users").doc(uid).update({
      subscribed: false,
      subscriptionId: admin.firestore.FieldValue.delete(),
      currentPeriodEnd: admin.firestore.FieldValue.delete(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});


function parseIngredients(rawIngredients) {
  if (!rawIngredients) return [];

  // Normalize to string if passed as array
  let combined = Array.isArray(rawIngredients) ? rawIngredients.join(' ') : rawIngredients;

  if (typeof combined !== 'string') return [];

  // Normalize whitespace and fix common patterns
  let processed = combined
    .replace(/(\d+)(g|kg|ml|tbsp|tsp|oz|cup|cups|clove|head|slice|slices|strip|strips|handful|handfuls|can|cans|piece|pieces|bag|bags)\b/gi, '$1 $2')
    .replace(/([a-z])(\d)/gi, '$1 $2')
    .replace(/([^\d\s])(\d)/g, '$1 $2')
    .replace(/([.,])(?=\d)/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split based on newlines or loose ingredient boundaries
  const splitter = /(?=(?:^|\s)(?:\d+[\s\/]*(?:g|kg|ml|tbsp|tsp|oz|cup|cups|clove|head|slice|slices|strip|strips|handful|handfuls|can|cans|piece|pieces|bag|bags)?\b))/gi;
  let parts = processed.split(splitter).map(p => p.trim()).filter(p => p.length > 0);

  // Smart merge fragments
  const mergedIngredients = [];
  for (let i = 0; i < parts.length; i++) {
    const current = parts[i];
    const last = mergedIngredients[mergedIngredients.length - 1];

    const isLikelyFragment =
      current.match(/^(mashed|zested|thinly|sliced|peeled|horizontally|extra|plus|optional|to serve|seeds|nuts|berries|drizzle|serve|yogurt|milk|syrup)$/i) ||
      (last && !last.endsWith(',') && current.match(/^[a-z]/i));

    if (isLikelyFragment && last) {
      mergedIngredients[mergedIngredients.length - 1] = last + ' ' + current;
    } else {
      mergedIngredients.push(current);
    }
  }

  return mergedIngredients.map(i => i.replace(/^[0-9a-z]+\s*/i, '').trim()).filter(Boolean);
}


function parseMethod(rawMethod) {
  if (!rawMethod || typeof rawMethod !== 'string') return [];

  const parts = rawMethod.split(/(step\s*\d+\s*)/i);
  const parsedSteps = [];
  let currentStepContent = '';
  let isFirstStep = true;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    if (part.toLowerCase().startsWith('step')) {
      if (currentStepContent) {
        parsedSteps.push(currentStepContent.trim());
      }
      currentStepContent = part.replace(/^step\s*\d+\s*/i, '').trim();
      isFirstStep = false;
    } else {
      if (isFirstStep) {
        parsedSteps.push(part);
        isFirstStep = false;
      } else {
        currentStepContent += (currentStepContent ? ' ' : '') + part;
      }
    }
  }

  if (currentStepContent) {
    parsedSteps.push(currentStepContent.trim());
  }

  return parsedSteps.filter(step => step.length > 0);
}

// --- Main Cloud Function ---
exports.methodsIngredientsParser = functions
  .runWith(runtimeOptions)
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed. Use POST.');
    }

    const { authKey } = req.body;
    const expectedAuthKey = functions.config().parser?.auth_key;

    if (!authKey || authKey !== expectedAuthKey) {
      console.warn('Unauthorized attempt to run parser function.');
      return res.status(403).send('Unauthorized');
    }

    console.log('🚀 Starting methodsIngredientsParser...');

    const collectionMappings = {
      'breakfast_list_full_may2025': 'breakfast_list_full_may2025_parsed',
      'lunch_list_full_may2025': 'lunch_list_full_may2025_parsed',
      'dinner_list_full_may2025': 'dinner_list_full_may2025_parsed',
      'snack_list_full_may2025': 'snack_list_full_may2025_parsed',
    };

    let totalProcessed = 0;
    let totalWritten = 0;
    let totalBatches = 0;

    try {
      for (const [sourceCollectionName, destinationCollectionName] of Object.entries(collectionMappings)) {
        console.log(`Processing collection: ${sourceCollectionName}`);

        const sourceRef = db.collection(sourceCollectionName);
        const destinationRef = db.collection(destinationCollectionName);
        let lastDoc = null;

        while (true) {
          let query = sourceRef.orderBy(admin.firestore.FieldPath.documentId()).limit(500);
          if (lastDoc) query = query.startAfter(lastDoc);
          const snapshot = await query.get();

          if (snapshot.empty) break;

          let batch = db.batch();
          let batchCount = 0;

          for (const doc of snapshot.docs) {
            const data = doc.data();
            const docId = doc.id;

            const parsedIngredients = typeof data.Ingredients === 'string' ? parseIngredients(data.Ingredients) : data.Ingredients;
            const parsedMethod = typeof data.Method === 'string' ? parseMethod(data.Method) : data.Method;

            const newDoc = {
              ...data,
              Ingredients: parsedIngredients,
              Method: parsedMethod,
              parsedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            batch.set(destinationRef.doc(docId), newDoc);
            batchCount++;
            totalProcessed++;
          }

          await batch.commit();
          totalWritten += batchCount;
          totalBatches++;
          lastDoc = snapshot.docs[snapshot.docs.length - 1];

          console.log(`✅ Committed ${batchCount} docs to ${destinationCollectionName}`);
        }
      }

      console.log(`🎉 Parsing completed. Total recipes processed: ${totalProcessed}, written: ${totalWritten}, batches: ${totalBatches}`);
      return res.status(200).send(`Success: Processed ${totalProcessed} recipes across ${totalBatches} batches.`);
    } catch (error) {
      console.error('🔥 Error parsing recipes:', error);
      return res.status(500).send('Internal Server Error');
    }
  });




// Enhanced runtime options for generateCalorieTargets
const generateCalorieTargetsRuntimeOptions = {
  timeoutSeconds: 540,  // 9 minutes
  memory: '4GB',        // Increased from default 256MB to 4GB for faster processing
  minInstances: 0,      // Cold start acceptable for this function
  maxInstances: 10      // Allow multiple concurrent executions
};

exports.generateCalorieTargets = functions
  .runWith(generateCalorieTargetsRuntimeOptions)
  .https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new new functions.https.HttpsError('unauthenticated', 'User must be authenticated to generate a plan.');
  }

  functions.logger.info(`Generating nutrition plan for user: ${uid}`);

  // Helper function: cleanObjectKeys
  function cleanObjectKeys(obj) {
    const cleanedObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Trim key, but also handle cases where key might have specific formatting like array indices
        // For keys like "Calories[1:nrow(breakfast_list_done)]", we only want "Calories"
        const cleanedKey = key.replace(/\[.*?\]/g, '').trim();
        cleanedObj[cleanedKey] = obj[key];
      }
    }
    return cleanedObj;
  }

  // Helper function: parseTime
  const parseTime = (timesString) => {
    let preparation = 0;
    let cooking = 0;

    if (typeof timesString !== 'string' || timesString.trim() === '') {
        return { preparation, cooking }; // Return 0s if input is not a string or empty
    }

    const lowerCaseTimesString = timesString.toLowerCase();

    // Case 1: "Total time: X mins"
    // Use RegExp.firstMatch() to find matches within the string.
    const totalMatch = lowerCaseTimesString.match(/total time:\s*(\d+)\s*mins?/);
    if (totalMatch) {
        const totalTime = parseInt(totalMatch[1]);
        cooking = totalTime; // Assuming total time is primarily cooking
    }

    // Case 2 & 3: "Preparation: X mins" or "Preparation: X mins ; Cooking: Y mins"
    const prepMatch = lowerCaseTimesString.match(/preparation:\s*(\d+)\s*mins?/);
    if (prepMatch) {
        preparation = parseInt(prepMatch[1]);
    }

    // Case 2 & 4: "Cooking: X mins" or "Preparation: X mins ; Cooking: Y mins"
    const cookMatch = lowerCaseTimesString.match(/cooking:\s*(\d+)\s*mins?/);
    if (cookMatch) {
        cooking = parseInt(cookMatch[1]);
    }

    return { preparation, cooking };
  };

  // Helper function: parseRecipeFields - Made async and handles parsing robustly
  async function parseRecipeFields(recipe, recipeIndex, collectionName) {
    const shouldLogDebug = (recipeIndex % 100 === 0);

    if (shouldLogDebug) {
      functions.logger.debug(`[RAW RECIPE DEBUG - ${collectionName} #${recipeIndex}] Before cleanObjectKeys - Recipe ID: ${recipe.id || 'N/A'}`);
      functions.logger.debug(`[RAW RECIPE DEBUG - ${collectionName} #${recipeIndex}] Full raw recipe object: ${JSON.stringify(recipe)}`);
    }

    const cleanedRecipe = cleanObjectKeys(recipe);
    // There should be NO line here like `parsedImageURL` by itself

    if (shouldLogDebug) {
      functions.logger.debug(`[CLEANED RECIPE DEBUG - ${collectionName} #${recipeIndex}] After cleanObjectKeys - Recipe ID: ${cleanedRecipe.id || 'N/A'}`);
      functions.logger.debug(`[CLEANED RECIPE DEBUG - ${collectionName} #${recipeIndex}] Full cleaned recipe object: ${JSON.stringify(cleanedRecipe)}`);
      functions.logger.debug(`[PARSE DEBUG - ${collectionName} #${recipeIndex}] Value of cleanedRecipe.Calories directly accessed: "${cleanedRecipe.Calories}" (Type: ${typeof cleanedRecipe.Calories})`);
      functions.logger.debug(`[PARSE DEBUG - ${collectionName} #${recipeIndex}] Keys present in cleanedRecipe: ${JSON.stringify(Object.keys(cleanedRecipe))}`);
    }

    const rawCaloriesValue = cleanedRecipe.Calories;
    let parsedCaloriesValue;

    const trimmedCaloriesString = typeof rawCaloriesValue === 'string' ? rawCaloriesValue.trim() : rawCaloriesValue;

    if (trimmedCaloriesString !== undefined && trimmedCaloriesString !== null && trimmedCaloriesString !== '') {
      parsedCaloriesValue = parseFloat(trimmedCaloriesString);
    } else {
      parsedCaloriesValue = 0;
      functions.logger.warn(`[PARSE WARNING] Recipe ID: ${recipe.id || 'N/A'} - 'Calories' field is missing, null, or empty after trimming. Setting to 0.`);
    }

    // Handle servings: Ensure it's a string, trim it, and default to empty string if undefined/null
    const parsedServings = typeof cleanedRecipe.servings === 'string' ? cleanedRecipe.servings.trim() : '';
    if (parsedServings === '') { // Log a warning if it's empty after trimming
      functions.logger.warn(`[PARSE WARNING] Recipe ID: ${recipe.id || 'N/A'} - 'servings' field is missing, null, or empty after trimming. Setting to empty string.`);
    }

    // Also check other string fields that are part of the recipe document structure
    // and might be undefined or have extra whitespace.
    // For example: Blurb, ImageURL, Ingredients, Method, Title, Webpage
    const parsedBlurb = typeof cleanedRecipe.Blurb === 'string' ? cleanedRecipe.Blurb.trim() : '';
    const parsedImageUrl = typeof cleanedRecipe.ImageURL === 'string' ? cleanedRecipe.ImageURL.trim() : '';
    const parsedIngredients = typeof cleanedRecipe.Ingredients === 'string' ? cleanedRecipe.Ingredients.trim() : '';
    const parsedMethod = typeof cleanedRecipe.Method === 'string' ? cleanedRecipe.Method.trim() : '';
    const parsedTitle = typeof cleanedRecipe.Title === 'string' ? cleanedRecipe.Title.trim() : '';
    const parsedWebpage = typeof cleanedRecipe.Webpage === 'string' ? cleanedRecipe.Webpage.trim() : '';
    const parsedTimes = typeof cleanedRecipe.Times === 'string' ? cleanedRecipe.Times.trim() : '';

    // OPTION 1: Derive preparation and cooking from the 'Times' string
    const { preparation: derivedPreparationTime, cooking: derivedCookingTime } = parseTime(parsedTimes);

    if (shouldLogDebug) {
      functions.logger.debug(`[PARSE DEBUG - ${collectionName} #${recipeIndex}] Recipe ID: ${recipe.id || 'N/A'}`);
      functions.logger.debug(`[PARSE DEBUG - ${collectionName} #${recipeIndex}] Parsed Servings: "${parsedServings}"`);
      functions.logger.debug(`[PARSE DEBUG - ${collectionName} #${recipeIndex}] Raw Calories Value: "${rawCaloriesValue}" (Type: ${typeof rawCaloriesValue})`);
      functions.logger.debug(`[PARSE DEBUG - ${collectionName} #${recipeIndex}] Trimmed Calories String: "${trimmedCaloriesString}" (Type: ${typeof trimmedCaloriesString})`);
      functions.logger.debug(`[PARSE DEBUG - ${collectionName} #${recipeIndex}] Parsed Calories Value (parseFloat): ${parsedCaloriesValue} (Type: ${typeof parsedCaloriesValue})`);
      functions.logger.debug(`[PARSE DEBUG - ${collectionName} #${recipeIndex}] Is NaN after parseFloat?: ${isNaN(parsedCaloriesValue)}`);
      functions.logger.debug(`[PARSE DEBUG - ${collectionName} #${recipeIndex}] Is Parsed Calories <= 0?: ${parsedCaloriesValue <= 0}`);
      functions.logger.debug(`[PARSE DEBUG - ${collectionName} #${recipeIndex}] Derived Preparation Time: ${derivedPreparationTime} (from 'Times' string)`);
      functions.logger.debug(`[PARSE DEBUG - ${collectionName} #${recipeIndex}] Derived Cooking Time: ${derivedCookingTime} (from 'Times' string)`);
    }

    const parsedRecipe = {
      // Keep the id from cleanedRecipe
      id: cleanedRecipe.id,
      // Explicitly set all fields, ensuring they are not undefined
      Calories: parsedCaloriesValue,
      Blurb: parsedBlurb,
      Carbs: parseFloat(String(cleanedRecipe.Carbs || '0').trim()) || 0,
      Fat: parseFloat(String(cleanedRecipe.Fat || '0').trim()) || 0,
      Fibre: parseFloat(String(cleanedRecipe.Fibre || '0').trim()) || 0,
      ImageUrl: parsedImageUrl,
      Ingredients: parsedIngredients,
      Method: parsedMethod,
      Protein: parseFloat(String(cleanedRecipe.Protein || '0').trim()) || 0,
      Salt: parseFloat(String(cleanedRecipe.Salt || '0').trim()) || 0,
      Saturates: parseFloat(String(cleanedRecipe.Saturates || '0').trim()) || 0,
      Sugars: parseFloat(String(cleanedRecipe.Sugars || '0').trim()) || 0,
      Times: parsedTimes, // Keep the original Times string
      Title: parsedTitle,
      Webpage: parsedWebpage,
      // Use the derived numerical values for preparation and cooking
      preparation: derivedPreparationTime,
      cooking: derivedCookingTime,
      perc_carbs: parseFloat(String(cleanedRecipe.perc_carbs || '0').trim()) || 0,
      perc_fat: parseFloat(String(cleanedRecipe.perc_fat || '0').trim()) || 0,
      perc_fibre: parseFloat(String(cleanedRecipe.perc_fibre || '0').trim()) || 0,
      // Removed perc_prot as it's not in Flutter model
      // perc_prot: parseFloat(String(cleanedRecipe.perc_prot || '0').trim()) || 0,
      total_g: parseFloat(String(cleanedRecipe.total_g || '0').trim()) || 0,
      servings: parsedServings
    };

    if (typeof parsedRecipe.Calories !== 'number' || isNaN(parsedRecipe.Calories)) {
      functions.logger.warn(`Recipe ID: ${parsedRecipe.id || 'N/A'} - Calories issue: Result is not a number or is NaN. Setting to 0 for filtering.`);
      parsedRecipe.Calories = 0;
    } else if (parsedRecipe.Calories <= 0) {
      functions.logger.warn(`Recipe ID: ${parsedRecipe.id || 'N/A'} - Calories issue: Result is 0 or negative (${parsedRecipe.Calories}).`);
    } else {
      if (shouldLogDebug) {
        functions.logger.debug(`Recipe ID: ${parsedRecipe.id || 'N/A'} - Successfully parsed Calories: ${parsedRecipe.Calories}`);
      }
    }
    return parsedRecipe;
  }

  // Helper function: isValidRecipe
  const isValidRecipe = recipe => {
    // This will now correctly receive numbers from parsedRecipe.preparation and .cooking
    const prepTime = recipe.preparation;
    const cookTime = recipe.cooking;

    return typeof prepTime === 'number' && !isNaN(prepTime) && prepTime <= 30 &&
           typeof cookTime === 'number' && !isNaN(cookTime) && cookTime <= 60;
  };

  // Helper function: logCalorieRangeForRecipes
  const logCalorieRangeForRecipes = (name, recipes) => {
    functions.logger.debug(`[DEBUG COUNTS] Starting ${name} with ${recipes.length} recipes.`);

    let failedCaloriesCount = 0;
    let logSampleCounter = 0;

    const afterCaloriesCheck = recipes.filter(r => {
      const isCalorieValid = typeof r.Calories === 'number' && !isNaN(r.Calories) && r.Calories > 0;

      if (!isCalorieValid) {
        failedCaloriesCount++;
        logSampleCounter++;

        // This CRITICAL DEBUG SAMPLE log now also samples at 1 in 100
        if (logSampleCounter % 100 === 1) { // Log the first failure, then every 100th
          functions.logger.error(`[CRITICAL DEBUG SAMPLE] ${name} Recipe ID: ${r.id || 'N/A'} - Calories failed check. Value: "${r.Calories}" (Type: ${typeof r.Calories}). isNaN: ${isNaN(r.Calories)}, is <= 0: ${r.Calories <= 0}`);
        }
      }
      return isCalorieValid;
    });

    functions.logger.debug(`[DEBUG COUNTS] ${name} remaining after Calories > 0 check: ${afterCaloriesCheck.length}`);

    let skippedCalories = recipes.length - afterCaloriesCheck.length;
    let skippedInvalidDetails = 0;

    const validRecipes = afterCaloriesCheck.filter(r => {
      const isRecipeDetailsValid = isValidRecipe(r);
      if (!isRecipeDetailsValid) {
        skippedInvalidDetails++;
        // Log details about why a recipe failed isValidRecipe
        if (logSampleCounter % 100 === 1) { // Log a sample of these failures too
          functions.logger.warn(`[INVALID RECIPE DETAILS SAMPLE] ${name} Recipe ID: ${r.id || 'N/A'} - Failed isValidRecipe check. PrepTime: ${r.preparation} (Type: ${typeof r.preparation}), CookTime: ${r.cooking} (Type: ${typeof r.cooking})`);
        }
      }
      return isRecipeDetailsValid;
    });

    functions.logger.debug(`[DEBUG COUNTS] ${name} remaining after isValidRecipe check: ${validRecipes.length}`);

    if (validRecipes.length === 0) {
      functions.logger.warn(`[RANGE] No valid calorie values found for ${name} recipes. Total skipped: ${recipes.length} (by Calories: ${skippedCalories}, by Invalid Recipe Details: ${skippedInvalidDetails})`);
      return;
    }

    const cals = validRecipes.map(r => r.Calories);
    const min = Math.min(...cals), max = Math.max(...cals), avg = (cals.reduce((a, b) => a + b) / cals.length).toFixed(1);
    functions.logger.debug(`[RANGE] ${name} — min: ${min}, max: ${max}, avg: ${avg}, total valid: ${validRecipes.length}, skipped (invalid calories): ${skippedCalories}, skipped (invalid recipe details): ${skippedInvalidDetails}`);
  };

  // Helper function: fetchRecipes - Now correctly awaits all parsing
  const fetchRecipes = async collection => {
    const snap = await db.collection(collection).get();
    const parsedRecipesPromises = snap.docs.map(async (doc, index) => { // Make inner function async
      // New [FETCH DEBUG] log, also conditional to 1 in 100
      if (index % 100 === 0) {
        functions.logger.debug(`[FETCH DEBUG] Collection: ${collection}, Document Index: ${index}, Document ID: ${doc.id}, Raw doc.data() exists: ${!!doc.data()}, doc.data() keys: ${JSON.stringify(Object.keys(doc.data()))}`);
      }
      const rawRecipe = { id: doc.id, ...doc.data() };
      return await parseRecipeFields(rawRecipe, index, collection); // Await the parsing
    });
    return Promise.all(parsedRecipesPromises); // Wait for all recipes in the collection to be parsed
  };

  // Helper function: shuffleArray
  const shuffleArray = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Helper function: filterRecipes
  const filterRecipes = (recipes, allergies, dislikes) => {
    return recipes.filter(recipe => {
      const ing = (recipe.Ingredients || '').toLowerCase();
      return !allergies.some(a => ing.includes(a.toLowerCase())) &&
             !dislikes.some(d => ing.includes(d.toLowerCase()));
    });
  };

  // Helper function: calculateMacroBalanceScore
  const calculateMacroBalanceScore = (recipe, targets) => {
    // Calculate percentage differences from targets
    const proteinDiff = Math.abs(recipe.Protein - targets.protein) / (targets.protein || 1);
    const carbsDiff = Math.abs(recipe.Carbs - targets.carbs) / (targets.carbs || 1);
    const fatDiff = Math.abs(recipe.Fat - targets.fat) / (targets.fat || 1);
    
    // Average deviation (lower is better)
    const avgDeviation = (proteinDiff + carbsDiff + fatDiff) / 3;
    
    // Penalty factors for health concerns
    let penalties = 0;
    
    // High sugar penalty (>15g = processed/unhealthy)
    if (recipe.Sugars > 15) {
      penalties += (recipe.Sugars - 15) * 0.1;
    }
    
    // High saturated fat penalty (>10g per meal)
    if (recipe.Saturates > 10) {
      penalties += (recipe.Saturates - 10) * 0.1;
    }
    
    // Low fiber bonus (reward high fiber)
    if (recipe.Fibre >= 5) {
      penalties -= recipe.Fibre * 0.05; // Negative penalty = bonus
    }
    
    // High sodium penalty
    if (recipe.Salt > 800) {
      penalties += (recipe.Salt - 800) * 0.0001;
    }
    
    // Calculate final score (0-100, higher is better)
    const baseScore = 100 * (1 - Math.min(avgDeviation, 1));
    const finalScore = Math.max(0, baseScore - (penalties * 10));
    
    return finalScore;
  };

  // Helper function: adjustTargetsForMealType
  const adjustTargetsForMealType = (baseTargets, mealType, activityCalories) => {
    const adjusted = { ...baseTargets };
    
    switch(mealType) {
      case 'breakfast':
        // Breakfast typically higher carbs for energy
        adjusted.carbs *= 1.1;
        adjusted.protein *= 0.9;
        break;
        
      case 'lunch':
        // Balanced meal - no adjustment
        break;
        
      case 'dinner':
        // Higher protein for muscle recovery
        adjusted.protein *= 1.15;
        adjusted.carbs *= 0.9;
        break;
        
      case 'snack':
        // Focus on protein/fiber for satiety
        adjusted.protein *= 1.2;
        break;
    }
    
    // Adjust for high activity days
    if (activityCalories > 500) {
      adjusted.carbs *= 1.15; // More carbs for fuel
    }
    
    return adjusted;
  };

  const selectBalancedMealForDay = (recipes, targetCalories, macroTargets, usedRecipeIds, mealType, activityCalories, relax = false, day = '') => {
    const tolerance = relax ? 100 : 50;
    const calorieMin = targetCalories - tolerance;
    const calorieMax = targetCalories + tolerance;
    
    // Adjust macro targets for meal type and activity level
    const adjustedTargets = adjustTargetsForMealType(macroTargets, mealType, activityCalories);
    
    // Filter to valid calorie range and exclude already used recipes
    const validRecipes = recipes.filter(r => {
      const cal = r?.Calories;
      return typeof cal === 'number' && 
             !isNaN(cal) && 
             cal >= calorieMin && 
             cal <= calorieMax && 
             isValidRecipe(r) &&
             !usedRecipeIds.has(r.id); // Ensure uniqueness
    });
    
    if (validRecipes.length === 0) {
      functions.logger.warn(`No valid recipes found for ${day} ${mealType} (relax=${relax}, available=${recipes.length})`);
      return null;
    }
    
    // Score all valid recipes based on macro balance
    const scoredRecipes = validRecipes.map(recipe => ({
      recipe,
      score: calculateMacroBalanceScore(recipe, adjustedTargets)
    }));
    
    // Sort by score (highest first)
    scoredRecipes.sort((a, b) => b.score - a.score);
    
    // Log top candidate for debugging
    const topCandidate = scoredRecipes[0];
    if (topCandidate) {
      functions.logger.debug(
        `${day} ${mealType}: Selected "${topCandidate.recipe.Title}" ` +
        `(Score: ${topCandidate.score.toFixed(1)}, Cal: ${topCandidate.recipe.Calories}, ` +
        `P: ${topCandidate.recipe.Protein}g/${adjustedTargets.protein.toFixed(0)}g, ` +
        `C: ${topCandidate.recipe.Carbs}g/${adjustedTargets.carbs.toFixed(0)}g, ` +
        `F: ${topCandidate.recipe.Fat}g/${adjustedTargets.fat.toFixed(0)}g)`
      );
    }
    
    // Return best match (highest score)
    return topCandidate.recipe;
  };


  try {
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User data not found.');

    const userData = userDoc.data();
    if (!userData) throw new functions.https.HttpsError('internal', 'User data is empty.');

    const {
      age, gender, height, weight, weeklyActivity = {},
      fitnessLevel = '', goal = '', foodAllergies = '', foodLikes = '', foodDislikes = '',
      name = '', email = '',
      proteinPercentage: userProtein, carbsPercentage: userCarbs, fatPercentage: userFat
    } = userData;

    const parsedAge = typeof age === 'string' ? parseInt(age) : age;
    const parsedHeight = typeof height === 'string' ? parseFloat(height) : height;
    const parsedWeight = typeof weight === 'string' ? parseFloat(weight) : weight;

    if (!['male', 'female'].includes((gender || '').toLowerCase())) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid gender.');
    }
    if (!parsedAge || parsedAge <= 0) throw new functions.https.HttpsError('invalid-argument', 'Invalid age.');
    if (!parsedHeight || parsedHeight <= 0) throw new functions.https.HttpsError('invalid-argument', 'Invalid height.');
    if (!parsedWeight || parsedWeight <= 0) throw new functions.https.HttpsError('invalid-argument', 'Invalid weight.');

    const bmr = (10 * parsedWeight) + (6.25 * parsedHeight) - (5 * parsedAge) + (gender.toLowerCase() === 'male' ? 5 : -161);
    functions.logger.info(`BMR for user ${uid}: ${bmr.toFixed(2)}`);

    let proteinPercentage, carbsPercentage, fatPercentage;
    if (userProtein != null && userCarbs != null && userFat != null) {
      proteinPercentage = Number(userProtein);
      carbsPercentage = Number(userCarbs);
      fatPercentage = Number(userFat);
    } else {
      switch (goal.toLowerCase()) {
        case 'lose weight': proteinPercentage = 0.4; fatPercentage = 0.25; carbsPercentage = 0.35; break;
        case 'gain muscle': proteinPercentage = 0.3; fatPercentage = 0.25; carbsPercentage = 0.45; break;
        default: proteinPercentage = 0.4; fatPercentage = 0.3; carbsPercentage = 0.3;
      }
    }

    const calorieAdjustment = {
      'lose weight': -550,
      'gain muscle': 250,
      'maintain': 0
    }[goal.toLowerCase()] ?? 0;

    const dailyTargetDetails = {};
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let totalWeeklyActivityCalories = 0;

    for (const day of daysOfWeek) {
      const activity = weeklyActivity?.[day];
      const activityCalories = typeof activity?.calories === 'number'
        ? activity.calories
        : parseInt(activity?.calories) || 0;

      totalWeeklyActivityCalories += activityCalories;

      const dailyTDEE = bmr + activityCalories;
      const adjustedCalories = dailyTDEE + calorieAdjustment;
      const minCalories = gender.toLowerCase() === 'male' ? 1500 : 1200;
      const maxCalories = dailyTDEE * 2.5;
      const finalCalories = Math.round(Math.min(maxCalories, Math.max(minCalories, adjustedCalories)));

      const proteinGrams = Math.round((finalCalories * proteinPercentage) / 4);
      const carbsGrams = Math.round((finalCalories * carbsPercentage) / 4);
      const fatGrams = Math.round((finalCalories * fatPercentage) / 9);

      let fuelingDemandCategory = 'low';
      if (activityCalories >= 800) fuelingDemandCategory = 'high';
      else if (activityCalories >= 400) fuelingDemandCategory = 'medium';

      dailyTargetDetails[day] = {
        calories: finalCalories,
        proteinGrams,
        carbsGrams,
        fatGrams,
        fuelingDemandCategory
      };

      functions.logger.debug(`${day} - Activity Calories: ${activityCalories}, Final Calories: ${finalCalories}`);
    }

    const allergyList = foodAllergies.split(',').map(s => s.trim()).filter(Boolean);
    const dislikeList = foodDislikes.split(',').map(s => s.trim()).filter(Boolean);

    functions.logger.info(`User allergies: ${JSON.stringify(allergyList)}, dislikes: ${JSON.stringify(dislikeList)}`);

    // Await all recipe fetching and parsing promises
    const [breakfastRaw, lunchRaw, dinnerRaw, snackRaw] = await Promise.all([
      fetchRecipes('breakfast_list_full_may2025'),
      fetchRecipes('lunch_list_full_may2025'),
      fetchRecipes('dinner_list_full_may2025'),
      fetchRecipes('snack_list_full_may2025')
    ]);

    const breakfastRecipes = filterRecipes(breakfastRaw, allergyList, dislikeList);
    const lunchRecipes = filterRecipes(lunchRaw, allergyList, dislikeList);
    const dinnerRecipes = filterRecipes(dinnerRaw, allergyList, dislikeList);
    const snackRecipes = filterRecipes(snackRaw, allergyList, dislikeList);

    functions.logger.info(`Filtered recipe counts — Breakfast: ${breakfastRecipes.length}, Lunch: ${lunchRecipes.length}, Dinner: ${dinnerRecipes.length}, Snack: ${snackRecipes.length}`);
    logCalorieRangeForRecipes('Breakfast', breakfastRecipes);
    logCalorieRangeForRecipes('Lunch', lunchRecipes);
    logCalorieRangeForRecipes('Dinner', dinnerRecipes);
    logCalorieRangeForRecipes('Snack', snackRecipes);

    const planDays = {};
    const usedRecipeIds = new Set(); // Track recipes used across the entire week
    
    // Helper function to select meal with fallback strategy
    const selectMealWithFallback = (recipes, targetCal, macroTargets, mealType, activityCal, day) => {
      // Try 1: Strict selection (±50 cal tolerance, unique recipes)
      let meal = selectBalancedMealForDay(
        recipes, targetCal, macroTargets, usedRecipeIds, 
        mealType, activityCal, false, day
      );
      
      if (meal) {
        usedRecipeIds.add(meal.id);
        return meal;
      }
      
      // Try 2: Relaxed tolerance (±100 cal)
      functions.logger.warn(`${day} ${mealType}: No match with strict criteria, trying relaxed tolerance...`);
      meal = selectBalancedMealForDay(
        recipes, targetCal, macroTargets, usedRecipeIds, 
        mealType, activityCal, true, day
      );
      
      if (meal) {
        usedRecipeIds.add(meal.id);
        return meal;
      }
      
      // Try 3: Allow recipe repetition if pool is exhausted
      functions.logger.warn(`${day} ${mealType}: Recipe pool exhausted, allowing repetition...`);
      const tempUsedIds = new Set(); // Empty set to allow any recipe
      meal = selectBalancedMealForDay(
        recipes, targetCal, macroTargets, tempUsedIds, 
        mealType, activityCal, true, day
      );
      
      if (meal) {
        // Don't add to usedRecipeIds since we're allowing repetition now
        return meal;
      }
      
      // Try 4: Final fallback - ignore macro balance, just match calories
      functions.logger.warn(`${day} ${mealType}: Final fallback - selecting any valid recipe...`);
      const validRecipes = recipes.filter(r => {
        const cal = r?.Calories;
        return typeof cal === 'number' && !isNaN(cal) && cal > 0 && isValidRecipe(r);
      });
      
      if (validRecipes.length > 0) {
        // Sort by calorie proximity and return closest match
        validRecipes.sort((a, b) => 
          Math.abs(a.Calories - targetCal) - Math.abs(b.Calories - targetCal)
        );
        return validRecipes[0];
      }
      
      functions.logger.error(`${day} ${mealType}: Could not find any valid recipe!`);
      return null;
    };
    
    for (const day of daysOfWeek) {
      const target = dailyTargetDetails[day].calories;
      const activityCal = weeklyActivity?.[day]?.calories || 0;
      
      // Calculate macro targets for each meal (proportional to calorie split)
      const breakfastMacros = {
        calories: target * 0.25,
        protein: dailyTargetDetails[day].proteinGrams * 0.25,
        carbs: dailyTargetDetails[day].carbsGrams * 0.25,
        fat: dailyTargetDetails[day].fatGrams * 0.25
      };
      
      const lunchMacros = {
        calories: target * 0.3,
        protein: dailyTargetDetails[day].proteinGrams * 0.3,
        carbs: dailyTargetDetails[day].carbsGrams * 0.3,
        fat: dailyTargetDetails[day].fatGrams * 0.3
      };
      
      const dinnerMacros = {
        calories: target * 0.3,
        protein: dailyTargetDetails[day].proteinGrams * 0.3,
        carbs: dailyTargetDetails[day].carbsGrams * 0.3,
        fat: dailyTargetDetails[day].fatGrams * 0.3
      };
      
      const snackMacros = {
        calories: target * 0.15,
        protein: dailyTargetDetails[day].proteinGrams * 0.15,
        carbs: dailyTargetDetails[day].carbsGrams * 0.15,
        fat: dailyTargetDetails[day].fatGrams * 0.15
      };
      
      // Select meals with fallback strategy
      const breakfast = selectMealWithFallback(
        breakfastRecipes, target * 0.25, breakfastMacros, 'breakfast', activityCal, day
      );
      
      const lunch = selectMealWithFallback(
        lunchRecipes, target * 0.3, lunchMacros, 'lunch', activityCal, day
      );
      
      const dinner = selectMealWithFallback(
        dinnerRecipes, target * 0.3, dinnerMacros, 'dinner', activityCal, day
      );
      
      const snack = selectMealWithFallback(
        snackRecipes, target * 0.15, snackMacros, 'snack', activityCal, day
      );
      
      planDays[day] = { breakfast, lunch, dinner, snack };
      
      // Calculate and log daily totals
      const dailyTotals = {
        calories: (breakfast?.Calories || 0) + (lunch?.Calories || 0) + 
                 (dinner?.Calories || 0) + (snack?.Calories || 0),
        protein: (breakfast?.Protein || 0) + (lunch?.Protein || 0) + 
                (dinner?.Protein || 0) + (snack?.Protein || 0),
        carbs: (breakfast?.Carbs || 0) + (lunch?.Carbs || 0) + 
              (dinner?.Carbs || 0) + (snack?.Carbs || 0),
        fat: (breakfast?.Fat || 0) + (lunch?.Fat || 0) + 
            (dinner?.Fat || 0) + (snack?.Fat || 0)
      };
      
      functions.logger.info(
        `${day} totals: ${dailyTotals.calories}/${target} cal, ` +
        `P: ${dailyTotals.protein.toFixed(0)}/${dailyTargetDetails[day].proteinGrams}g, ` +
        `C: ${dailyTotals.carbs.toFixed(0)}/${dailyTargetDetails[day].carbsGrams}g, ` +
        `F: ${dailyTotals.fat.toFixed(0)}/${dailyTargetDetails[day].fatGrams}g`
      );
    }
    
    // Log final statistics
    functions.logger.info(`Week plan complete. Unique recipes used: ${usedRecipeIds.size} out of 28 meals`);

    const generatedPlan = {
      planStartDate: new Date().toISOString(),
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      notes: `Plan based on goal "${goal}"`,
      dailyTargetDetails,
      days: planDays,
      inputDetails: {
        name,
        email,
        age,
        gender,
        height,
        weight,
        goal,
        fitnessLevel,
        foodAllergies,
        foodLikes,
        foodDislikes,
        weeklyActivity: weeklyActivity,
        totalWeeklyActivityCalories
      }
    };

    // Save the plan to Firestore
    await db.collection('users').doc(uid).collection('nutritionPlans').add(generatedPlan);
    functions.logger.info(`Nutrition plan successfully saved for user: ${uid}`);

    // Prepare the plan to be sent back to the client
    // We need to convert FieldValue.serverTimestamp() to a standard date string
    const planToReturn = {
      ...generatedPlan,
      generatedAt: new Date().toISOString()
    };

    // Return the plan data to the frontend
    return { success: true, plan: planToReturn };

  } catch (error) {
    functions.logger.error('Error generating plan:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate plan.', error.message);
  }
});


exports.recipeDebuggerHttp = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send({ error: 'Method not allowed. Use POST.' });
    }

    function cleanObjectKeys(obj) {
  const cleanedObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Trim whitespace/newlines from the key
      const cleanedKey = key.trim();
      cleanedObj[cleanedKey] = obj[key];
    }
  }
  return cleanedObj;
}


    const uid = req.body.uid;
    if (!uid) {
      return res.status(401).send({ error: 'Missing uid in request body.' });
    }

    functions.logger.info(`Debugging recipe availability for user: ${uid}`);

    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) return res.status(404).send({ error: 'User data not found.' });

    const userData = userDoc.data();
    if (!userData) return res.status(500).send({ error: 'User data is empty.' });

    const {
      age, gender, height, weight, weeklyActivity,
      fitnessLevel, goal, foodAllergies, foodLikes, foodDislikes,
    } = userData;

    if (!weeklyActivity || typeof weeklyActivity !== 'object') {
      return res.status(400).send({ error: 'Missing or invalid weeklyActivity.' });
    }

    const userGoal = goal?.trim()?.toLowerCase() ?? 'maintain';
    const bmr = (10 * weight) + (6.25 * height) - (5 * age) + (gender.toLowerCase() === 'male' ? 5 : -161);

    const calorieAdjustment = {
      'lose weight': -550,
      'gain muscle': 250,
      'maintain': 0
    }[userGoal] ?? 0;

    const proteinPercentage = userGoal === 'gain muscle' ? 0.30 : 0.40;
    const fatPercentage = 0.25;
    const carbsPercentage = 1 - proteinPercentage - fatPercentage;

    const dailyTargetDetails = {};
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    for (const day of daysOfWeek) {
      const activity = weeklyActivity[day];
      const activityCalories = (activity && typeof activity.calories === 'number') ? activity.calories : 0;
      let dailyTDEE = bmr + activityCalories;
      let adjustedCalories = dailyTDEE + calorieAdjustment;
      const finalCalories = Math.round(Math.max(adjustedCalories, gender.toLowerCase() === 'male' ? 1500 : 1200));

      const proteinGrams = Math.round((finalCalories * proteinPercentage) / 4);
      const carbsGrams = Math.round((finalCalories * carbsPercentage) / 4);
      const fatGrams = Math.round((finalCalories * fatPercentage) / 9);

      dailyTargetDetails[day] = {
        calories: finalCalories,
        proteinGrams,
        carbsGrams,
        fatGrams
      };
    }

    const collections = {
      breakfast: "breakfast_list_full_may2025",
      lunch: "lunch_list_full_may2025",
      dinner: "dinner_list_full_may2025",
      snack: "snack_list_full_may2025"
    };

    const filterRecipes = (recipes, allergies, dislikes) => {
      return recipes.filter(recipe => {
        const ing = (recipe.Ingredients || '').toLowerCase();
        return !allergies.some(a => ing.includes(a.toLowerCase())) &&
               !dislikes.some(d => ing.includes(d.toLowerCase()));
      });
    };

     async function parseRecipeFields(recipe) {
      const cleanedRecipe = cleanObjectKeys(recipe);
      functions.logger.debug("Cleaned recipe keys after trimming:", Object.keys(cleanedRecipe));

      return {
        ...cleanedRecipe, // Use the cleaned object here
        Calories: parseFloat(cleanedRecipe.Calories) || 0, // Access using cleaned key
        Carbs: parseFloat(cleanedRecipe.Carbs) || 0,
        Fat: parseFloat(cleanedRecipe.Fat) || 0,
        Fibre: parseFloat(cleanedRecipe.Fibre) || 0,
        Protein: parseFloat(cleanedRecipe.Protein) || 0,
        Salt: parseFloat(cleanedRecipe.Salt) || 0,
        Saturates: parseFloat(cleanedRecipe.Saturates) || 0,
        Sugars: parseFloat(cleanedRecipe.Sugars) || 0,
        // **IMPORTANT: Update these R-style names based on your actual Firestore keys after inspection**
        perc_carbs: parseFloat(cleanedRecipe["perc_carbs[1:nrow(lunch_list_done)]"]) || 0, // Assuming actual key is "perc_carbs"
        perc_fat: parseFloat(cleanedRecipe.perc_fat) || 0,
        perc_fibre: parseFloat(cleanedRecipe["perc_fibre[1:nrow(lunch_list_done)]"]) || 0,
        perc_prot: parseFloat(cleanedRecipe["perc_prot[1:nrow(lunch_list_done)]"]) || 0,
        total_g: parseFloat(cleanedRecipe["total_g[1:nrow(lunch_list_done)]"]) || 0
      };
    }

    async function fetchRecipes(collectionName) {
      const snapshot = await db.collection(collectionName).get();
      return snapshot.docs.map(doc => {
        const rawRecipe = { id: doc.id, ...doc.data() };
        // The id should be correctly populated now
        return parseRecipeFields(rawRecipe);
      });
    }


    const allergyList = (foodAllergies || '').split(',').map(s => s.trim()).filter(Boolean);
    const dislikeList = (foodDislikes || '').split(',').map(s => s.trim()).filter(Boolean);

    // Store filtered recipe data and their average calories
    const mealDebugResults = {};

    for (const [mealType, collectionName] of Object.entries(collections)) {
      const allRecipes = await fetchRecipes(collectionName);
      functions.logger.info(`${mealType} recipes total: ${allRecipes.length}`);

      const filtered = filterRecipes(allRecipes, allergyList, dislikeList);
      functions.logger.info(`${mealType} recipes after filtering: ${filtered.length}`);

      // Calculate mean calories for remaining recipes
      let totalCalories = 0;
      let validCalorieRecipesCount = 0;

      filtered.forEach(recipe => {
        // Ensure Calories is a number and not NaN, even if parseRecipeFields returned 0.
        // We avoid counting recipes with 0 calories from parsing failures for the average.
        if (typeof recipe.Calories === 'number' && !isNaN(recipe.Calories) && recipe.Calories > 0) {
          totalCalories += recipe.Calories;
          validCalorieRecipesCount++;
        } else {
            functions.logger.warn(`[DEBUG] Skipping recipe ${recipe.id} from ${mealType} average due to invalid or zero calories: ${recipe.Calories}`);
        }
      });

      const meanCalories = validCalorieRecipesCount > 0
        ? (totalCalories / validCalorieRecipesCount).toFixed(2)
        : 0; // Return 0 if no valid recipes remain

      functions.logger.info(`${mealType} mean calories (from ${validCalorieRecipesCount} valid recipes): ${meanCalories}`);

      mealDebugResults[mealType] = {
        totalRecipes: allRecipes.length,
        filteredRecipes: filtered.length,
        validRecipesForAverage: validCalorieRecipesCount,
        meanCalories: parseFloat(meanCalories) // Convert back to number for the JSON response
      };
    }

    return res.status(200).send({
      status: 'success',
      message: 'Recipe filtering debug complete.',
      dailyTargetDetails,
      mealDebugResults // Include the new debug results in the response
    });
  } catch (error) {
    functions.logger.error('Error debugging recipes:', error);
    return res.status(500).send({ error: 'Unexpected error in recipe debugger.', details: error.message });
  }
});

// ============================================
// PUBLIC REST API
// ============================================

/**
 * Public REST API - Handles all public HTTP endpoints
 * Routes defined in api-routes.js
 * 
 * Available endpoints:
 * - GET /health - Health check
 * - GET /recipes/count - Get recipe counts
 * - GET /recipes/:mealType - List recipes by meal type
 * - GET /recipes/:mealType/:recipeId - Get specific recipe
 * - POST /recipes/search - Advanced search (requires API key)
 * - GET /user/:userId/nutrition-plans - Get user plans (requires auth + API key)
 */
apiApp.use('/v1', apiRoutes);

// Root endpoint with API documentation
apiApp.get('/', (req, res) => {
  res.json({
    name: 'Nufit API',
    version: '1.0.0',
    description: 'Complete nutrition planning and recipe API',
    documentation: {
      baseUrl: `https://${process.env.FUNCTION_REGION || 'us-central1'}-${process.env.GCLOUD_PROJECT || 'nufit-67bf0'}.cloudfunctions.net/api`,
      fullDocs: 'See API_DOCUMENTATION.md for complete documentation',
      quickReference: 'See API_QUICK_REFERENCE.md for quick start guide',
      endpoints: {
        public: [
          'GET /v1/health - Health check',
          'GET /v1/recipes/count - Recipe counts',
          'GET /v1/recipes/:mealType - List recipes',
          'GET /v1/recipes/:mealType/:recipeId - Get recipe',
          'POST /v1/users/register - Register new user'
        ],
        requiresFirebaseAuth: [
          'GET /v1/users/:userId/profile - Get profile',
          'PUT /v1/users/:userId/profile - Update profile',
          'POST /v1/payments/create-checkout - Create Stripe checkout',
          'POST /v1/payments/cancel-subscription - Cancel subscription',
          'GET /v1/payments/subscription-status - Subscription status',
          'POST /v1/users/:userId/generate-nutrition-plan - Generate plan',
          'GET /v1/users/:userId/nutrition-plans - List plans',
          'POST /v1/users/:userId/nutrition-plans/:planId/generate-shopping-list - Generate shopping list',
          'GET /v1/users/:userId/nutrition-plans/:planId/shopping-list - Get shopping list'
        ],
        requiresApiKey: [
          'POST /v1/recipes/search - Advanced recipe search'
        ]
      },
      authentication: {
        firebase: 'Include Authorization: Bearer <firebase-id-token>',
        apiKey: 'Include x-api-key header for API key endpoints'
      },
      rateLimit: '100 requests per 15 minutes per IP',
      support: {
        email: 'api@nufit.com',
        console: 'https://console.firebase.google.com/project/nufit-67bf0'
      }
    },
    features: [
      'User registration and profile management',
      'Stripe payment integration',
      'AI-powered nutrition plan generation',
      'Smart shopping list generation with Gemini AI',
      'Recipe database with 5000+ recipes',
      'Personalized meal recommendations',
      'Allergen and preference filtering'
    ]
  });
});

exports.api = functions.https.onRequest(apiApp);

// Force redeploy - ensure latest profile endpoint is deployed
// Legacy endpoint - now redirects to new API
exports.countRecipes = functions.https.onRequest(async (req, res) => {
  functions.logger.warn('countRecipes endpoint is deprecated. Use /api/v1/recipes/count instead');
  
  try {
    const collections = [
      'breakfast_list_full_may2025',
      'lunch_list_full_may2025',
      'dinner_list_full_may2025',
      'snack_list_full_may2025'
    ];

    const counts = {};

    for (const col of collections) {
      const snapshot = await db.collection(col).get();
      counts[col] = snapshot.size;
    }

    functions.logger.info("Recipe counts:", counts);
    res.status(200).json({
      deprecated: true,
      message: 'This endpoint is deprecated. Please use /api/v1/recipes/count',
      newEndpoint: '/api/v1/recipes/count',
      counts
    });
  } catch (error) {
    functions.logger.error("Failed to count recipes", error);
    res.status(500).json({ error: 'Failed to count recipes', details: error.message });
  }
});

// ============================================
// SCHEDULED FUNCTIONS - SUBSCRIPTION MANAGEMENT
// ============================================

// Import subscription utility functions from api-routes
const { expireSubscriptions, resetQuotasOnAnniversary } = require('./api-routes');

/**
 * Scheduled function to expire subscriptions
 * Runs daily at 2:00 AM UTC
 * Checks for subscriptions past their end date and sets them to expired
 */
exports.scheduledExpireSubscriptions = functions.pubsub
  .schedule('0 2 * * *')  // Every day at 2:00 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('⏰ Starting scheduled subscription expiry check...');
    
    try {
      const result = await expireSubscriptions();
      console.log('✅ Subscription expiry complete:', result);
      
      if (result.expiredCount > 0) {
        console.log(`📊 Expired ${result.expiredCount} subscription(s)`);
      } else {
        console.log('📊 No subscriptions to expire');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error in scheduled subscription expiry:', error);
      throw error;
    }
  });

/**
 * Scheduled function to reset quotas on subscription anniversary
 * Runs daily at 3:00 AM UTC
 * Resets plan generation quotas for monthly/quarterly subscriptions every 30 days
 */
exports.scheduledResetQuotas = functions.pubsub
  .schedule('0 3 * * *')  // Every day at 3:00 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('⏰ Starting scheduled quota reset check...');
    
    try {
      const result = await resetQuotasOnAnniversary();
      console.log('✅ Quota reset complete:', result);
      
      if (result.resetCount > 0) {
        console.log(`📊 Reset quota for ${result.resetCount} subscription(s)`);
      } else {
        console.log('📊 No quotas to reset today');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error in scheduled quota reset:', error);
      throw error;
    }
  });






