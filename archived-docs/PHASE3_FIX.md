# Phase 3 Update: Age, Height, Weight Now Required

## What Changed?

The **Phase 3 (Health Information)** endpoint now requires three additional fields that are essential for nutrition plan generation:

- **age** (integer, 18-120)
- **height** (integer, 100-250 cm)
- **weight** (integer, 30-300 kg)

These fields were missing and causing the nutrition plan generation to fail with "Invalid age" error.

## Why Was This Needed?

The nutrition plan algorithm needs:
- **Age** to calculate metabolic rate and caloric needs
- **Height** to calculate BMI and portion recommendations
- **Weight** to determine caloric intake and macro distribution
- **Gender** (already required) to adjust caloric needs

Without these fields, the POST /generate-nutrition-plan endpoint returns:
```json
{
  "error": "Incomplete health information",
  "message": "Please complete your health information (Phase 3) with the following required fields: age, gender, height, weight"
}
```

## Updated Request Format

### Endpoint
```
PUT /v1/users/{userId}/health-information
```

### Required Headers
```
Authorization: Bearer {idToken}
Content-Type: application/json
```

### Complete Request Body

```javascript
{
  // NEW REQUIRED FIELDS FOR NUTRITION PLAN
  "age": 28,                                      // integer, 18-120
  "gender": "male",                               // 'male' or 'female'
  "height": 180,                                  // integer, 100-250 cm
  "weight": 75,                                   // integer, 30-300 kg

  // EXISTING HEALTH FIELDS (all optional except medicalConditions, smokingHabit, sleepDuration, stressLevel, currentAlcohol)
  "medicalConditions": "diabetes, hypertension",  // string - existing conditions
  "allergies": ["penicillin"],                    // array - medical allergies
  "smokingHabit": "non-smoker",                   // 'non-smoker', 'occasional', 'regular'
  "sleepDuration": 8,                             // number, 0-24 hours
  "stressLevel": "moderate",                      // 'low', 'moderate', 'high'
  "pastInjuries": "knee injury in 2020",          // string - previous injuries
  "medications": "metformin",                     // string - current medications
  "currentAlcohol": "occasional",                 // 'none', 'occasional', 'moderate', 'frequent'
  "lastAlcohol": "2025-12-25",                    // ISO date YYYY-MM-DD
  "otherIssues": "heartburn after meals"          // string - other notes
}
```

## Postman Example

### URL
```
PUT https://your-cloud-functions-url/v1/users/{userId}/health-information
```

### Headers Tab
```
Authorization: Bearer eyJhbGc...
Content-Type: application/json
```

### Body (JSON)
```json
{
  "age": 28,
  "gender": "male",
  "height": 180,
  "weight": 75,
  "medicalConditions": "none",
  "allergies": [],
  "smokingHabit": "non-smoker",
  "sleepDuration": 8,
  "stressLevel": "moderate",
  "pastInjuries": "none",
  "medications": "none",
  "currentAlcohol": "occasional",
  "lastAlcohol": "2025-12-25",
  "otherIssues": "none"
}
```

### Success Response
```json
{
  "success": true,
  "message": "Health information updated successfully (Phase 3/5)",
  "registrationProgress": {
    "basicInfo": true,
    "dietInfo": true,
    "healthInfo": true,
    "exercisePreference": false,
    "weeklyExercise": false,
    "complete": false
  }
}
```

## Validation Errors

### Missing Required Field
```json
{
  "error": "Missing required fields",
  "message": "The following fields are required for nutrition plan generation: age, gender",
  "missingFields": ["age", "gender"],
  "requiredFields": ["age", "gender", "height", "weight"]
}
```

### Invalid Age
```json
{
  "error": "Invalid age",
  "message": "Age must be a number between 18 and 120",
  "receivedValue": "abc"
}
```

### Invalid Height
```json
{
  "error": "Invalid height",
  "message": "Height must be a number between 100 and 250 cm",
  "receivedValue": 50
}
```

### Invalid Weight
```json
{
  "error": "Invalid weight",
  "message": "Weight must be a number between 30 and 300 kg",
  "receivedValue": 10
}
```

## Next Steps After Phase 3

Once Phase 3 is completed with these fields, you can proceed to:

1. **Phase 4**: Exercise Preferences (PUT /v1/users/{userId}/exercise-preference)
2. **Phase 5**: Weekly Exercise Schedule (PUT /v1/users/{userId}/weekly-exercise)
3. **Phase 6**: Generate Nutrition Plan (POST /v1/users/{userId}/generate-nutrition-plan)

## Testing Checklist

- [ ] Phase 3 endpoint returns 200 OK
- [ ] Response includes all health fields in registered data
- [ ] Age is stored as integer 18-120
- [ ] Gender is stored as 'male' or 'female'
- [ ] Height is stored as integer 100-250 cm
- [ ] Weight is stored as integer 30-300 kg
- [ ] Subsequent GET /v1/users/{userId}/profile returns age, gender, height, weight
- [ ] POST /v1/users/{userId}/generate-nutrition-plan now works without "Invalid age" error
- [ ] Invalid values (age < 18, height < 100, etc.) return appropriate 400 errors

## JavaScript Example

```javascript
async function updatePhase3Health(userId, idToken) {
  const response = await fetch(
    `https://your-api.com/v1/users/${userId}/health-information`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        age: 28,
        gender: 'male',
        height: 180,
        weight: 75,
        medicalConditions: 'none',
        smokingHabit: 'non-smoker',
        sleepDuration: 8,
        stressLevel: 'moderate',
        pastInjuries: 'none',
        medications: 'none',
        currentAlcohol: 'occasional',
        lastAlcohol: '2025-12-25',
        otherIssues: 'none'
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Phase 3 Update Failed:', error);
    return false;
  }

  const data = await response.json();
  console.log('Phase 3 Complete:', data);
  return true;
}
```

## Issue Resolution

This fix addresses:
- ✅ POST /generate-nutrition-plan returning 400 "Invalid age"
- ✅ Missing age/height/weight in Phase 3
- ✅ Documentation updated to show required fields
- ✅ Validation errors now clearly indicate missing fields
- ✅ Profile endpoint GET /v1/users/{userId}/profile includes these fields

For the 404 error on profile endpoint, this was likely a routing issue that has also been corrected.
