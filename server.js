require('dotenv').config();

const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// =====================================
// ✅ FIREBASE INITIALIZATION
// =====================================

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

// =====================================
// ✅ HEALTH CHECK
// =====================================

app.get('/', (req, res) => {
  res.send('Server is running');
});

// =====================================
// ✅ SEND NOTIFICATION ROUTE
// =====================================

app.post('/send-notification', async (req, res) => {
  try {
    const {
      role,
      receiverId,
    } = req.body;

    console.log("====================================");
    console.log("📨 Incoming Notification Request");
    console.log("Role:", role);
    console.log("ReceiverId:", receiverId);

    let fcmToken = null;
    let targetDocId = null;
    let targetCollection = null;
    let isAdminReceiver = false;

    // =====================================
    // ✅ USER → ADMIN
    // role = "user"
    // =====================================

    if (role === "user") {

      console.log("🔄 Flow: USER → ADMIN");

      // Fix: Get admin document directly or query properly
      const adminSnap = await db
        .collection("admin")
        .limit(1)
        .get();

      if (adminSnap.empty) {
        console.log("❌ Admin not found");
        return res.status(404).send("Admin not found");
      }

      const adminDoc = adminSnap.docs[0];
      const adminData = adminDoc.data();

      fcmToken = adminData.fcmToken;
      targetDocId = adminDoc.id;
      targetCollection = "admin";
      isAdminReceiver = true; // Receiver is admin

      console.log("✅ Admin Found:", adminDoc.id);
    }

    // =====================================
    // ✅ ADMIN → USER
    // role = "admin"
    // =====================================

    else if (role === "admin") {

      console.log("🔄 Flow: ADMIN → USER");

      if (!receiverId) {
        console.log("❌ receiverId missing");
        return res.status(400).send("receiverId required");
      }

      const userDoc = await db
        .collection("user")
        .doc(receiverId)
        .get();

      if (!userDoc.exists) {
        console.log("❌ User not found");
        return res.status(404).send("User not found");
      }

      const userData = userDoc.data();

      fcmToken = userData.fcmToken;
      targetDocId = receiverId;
      targetCollection = "user";
      isAdminReceiver = false; // Receiver is user

      console.log("✅ User Found:", receiverId);
    }

    // =====================================
    // ❌ INVALID ROLE
    // =====================================

    else {
      console.log("❌ Invalid role");
      return res.status(400).send("Invalid role");
    }

    // =====================================
    // ❌ TOKEN CHECK
    // =====================================

    if (!fcmToken) {
      console.log("❌ No FCM token found");
      return res.status(400).send("No FCM token");
    }

    console.log("📱 FCM Token:", fcmToken.substring(0, 20) + "...");

    // =====================================
    // ✅ MESSAGE PAYLOAD (UPDATED with isAdmin)
    // =====================================

    const message = {
      token: fcmToken,

      notification: {
        title: "Lion Gate",
        body: "You may have new messages",
      },

      data: {
        userCode: receiverId || "",
        chatId: receiverId || "",
        isAdmin: isAdminReceiver ? "true" : "false", // Add this field
      },

      android: {
        priority: "high",

        notification: {
          channelId: "high_importance_channel",
          priority: "high",
          sound: "default",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },

      apns: {
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true,
          },
        },
      },
    };

    // =====================================
    // ✅ SEND NOTIFICATION
    // =====================================

    try {

      const response = await admin
        .messaging()
        .send(message);

      console.log("✅ Notification Sent");
      console.log("📨 Firebase Response:", response);
      console.log("====================================");

      return res.status(200).json({ 
        success: true, 
        messageId: response,
        receiverIsAdmin: isAdminReceiver 
      });

    } catch (err) {

      console.error("❌ Firebase Messaging Error:", err);

      // =====================================
      // ✅ REMOVE INVALID TOKEN
      // =====================================

      if (err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-registration-token') {

        console.log("🗑 Removing invalid FCM token");

        await db
          .collection(targetCollection)
          .doc(targetDocId)
          .update({
            fcmToken: admin.firestore.FieldValue.delete(),
          });
      }

      return res
        .status(500)
        .json({ 
          success: false, 
          error: err.code,
          message: "Notification sending failed" 
        });
    }

  } catch (error) {

    console.error("❌ SERVER ERROR:", error);

    return res
      .status(500)
      .json({ 
        success: false, 
        error: error.message,
        message: "Internal server error" 
      });
  }
});

// =====================================
// ✅ START SERVER
// =====================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});