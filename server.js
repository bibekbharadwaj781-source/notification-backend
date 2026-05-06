require('dotenv').config();

const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Firebase init (Render env)
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

// ✅ Health check
app.get('/', (req, res) => {
  res.send('Server is running');
});

// ✅ Notification route (bidirectional)
app.post('/send-notification', async (req, res) => {
  try {
    const { role, receiverId } = req.body;

    console.log("====================================");
    console.log("Incoming Request");
    console.log("Role:", role);
    console.log("ReceiverId:", receiverId);

    let fcmToken = null;

    // ================================
    // 🔥 CASE 1: USER → ADMIN
    // ================================
    if (role === "admin") {
      console.log("Flow: USER → ADMIN");

      // dynamically fetch admin (no ID exposure)
      const adminSnap = await db.collection("admin")
        .where("role", "==", "admin")
        .limit(1)
        .get();

      if (adminSnap.empty) {
        console.log("❌ Admin not found");
        return res.status(404).send("Admin not found");
      }

      const adminDoc = adminSnap.docs[0];
      const adminData = adminDoc.data();

      fcmToken = adminData.fcmToken;

      console.log("✅ Admin found:", adminDoc.id);
    }

    // ================================
    // 🔥 CASE 2: ADMIN → USER
    // ================================
    else if (role === "user") {
      console.log("Flow: ADMIN → USER");

      if (!receiverId) {
        console.log("❌ Missing receiverId for user");
        return res.status(400).send("receiverId required");
      }

      const userDoc = await db.collection("user").doc(receiverId).get();

      if (!userDoc.exists) {
        console.log("❌ User not found:", receiverId);
        return res.status(404).send("User not found");
      }

      const userData = userDoc.data();
      fcmToken = userData.fcmToken;

      console.log("✅ User found:", receiverId);
    }

    else {
      console.log("❌ Invalid role");
      return res.status(400).send("Invalid role");
    }

    // ================================
    // 🔥 TOKEN CHECK
    // ================================
    if (!fcmToken) {
      console.log("❌ FCM token missing");
      return res.status(400).send("No FCM token");
    }

    console.log("📱 FCM Token:", fcmToken);

    // ================================
    // 🔥 SEND NOTIFICATION
    // ================================
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

    console.log("✅ Notification sent");
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