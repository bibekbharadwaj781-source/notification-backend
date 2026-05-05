require('dotenv').config();

const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// ✅ Firebase config using environment variables (REQUIRED for Render)
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

// Test route
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Notification route
app.post('/send-notification', async (req, res) => {
  try {
    const { receiverId, role } = req.body;

    const collection = role === "admin" ? "admin" : "user";

    const snapshot = await db.collection(collection)
  .where("userCode", "==", receiverId)
  .get();

if (snapshot.empty) {
  return res.status(404).send("User not found");
}

const fcmToken = snapshot.docs[0].data().fcmToken;

    if (!fcmToken) {
      return res.status(400).send("No FCM token");
    }

    const message = {
      token: fcmToken,
      notification: {
        title: "Lion Gate",
        body: "You may have new messages",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "high_importance_channel",
        },
      },
    };

    const response = await admin.messaging().send(message);

    console.log("Notification sent:", response);

    res.send("Success");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error sending notification");
  }
});

// ✅ IMPORTANT: Render port fix
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});