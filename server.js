require('dotenv').config();

const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// ✅ Firebase config (Render env variables)
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

// ✅ Test route
app.get('/', (req, res) => {
  res.send('Server is running');
});

// ✅ Notification route
app.post('/send-notification', async (req, res) => {
  try {
    const { receiverId, role } = req.body;

    const collection = role === "admin" ? "admin" : "user";

    // 🔍 DEBUG LOGS (VERY IMPORTANT)
    console.log("====================================");
    console.log("Incoming Request");
    console.log("ReceiverId:", receiverId);
    console.log("Role:", role);
    console.log("Collection:", collection);

    // 🔍 Fetch document
    const doc = await db.collection(collection).doc(receiverId).get();

    if (!doc.exists) {
      console.log("❌ Document NOT found in Firestore");
      return res.status(404).send("User not found");
    }

    const data = doc.data();
    const fcmToken = data.fcmToken;

    console.log("✅ Document found");
    console.log("FCM Token:", fcmToken);

    if (!fcmToken) {
      console.log("❌ FCM token missing");
      return res.status(400).send("No FCM token");
    }

    // ✅ Create message
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

    // ✅ Send notification
    const response = await admin.messaging().send(message);

    console.log("✅ Notification sent successfully");
    console.log("Response:", response);
    console.log("====================================");

    res.send("Success");

  } catch (error) {
    console.error("❌ ERROR:", error);
    res.status(500).send("Error sending notification");
  }
});

// ✅ Render port
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});