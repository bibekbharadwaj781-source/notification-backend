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
  res.json({
    status: 'online',
    message: 'Notification server is running',
    timestamp: new Date().toISOString(),
  });
});

// =====================================
// ✅ SEND NOTIFICATION ROUTE
// =====================================

app.post('/send-notification', async (req, res) => {
  try {
    const {
      role,        // sender role
      receiverId,  // chat/user id
    } = req.body;

    console.log("====================================");
    console.log("📨 Incoming Notification Request");
    console.log("Sender Role:", role);
    console.log("ReceiverId:", receiverId);

    let fcmToken = null;
    let targetDoc = null;

    // =====================================================
    // ✅ USER → ADMIN
    // sender role = user
    // =====================================================

    if (role === "user") {

      console.log("🔄 Flow: USER → ADMIN");

      // Get admin document ONLY from admin collection

      const adminSnapshot = await db
        .collection("admin")
        .where("role", "==", "admin")
        .limit(1)
        .get();

      if (adminSnapshot.empty) {
        console.log("❌ No admin found");
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }

       targetDoc = adminSnapshot.docs[0];
       fcmToken = targetDoc.data().fcmToken;

      if (!fcmToken) {
        console.log("❌ Admin has no FCM token");
        return res.status(400).json({
          success: false,
          message: "Admin token missing",
        });
      }

      // =====================================
      // ✅ SEND TO ADMIN
      // =====================================

      const message = {
        token: fcmToken,

        notification: {
          title: "Lion Gate",
          body: "New message from User",
        },

        data: {
          chatId: receiverId || "",

          // IMPORTANT:
          // receiver is admin
          role: "admin",

          sender: "user",
          userCode: receiverId,
          isAdmin: "false",
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
      };

      const response = await admin.messaging().send(message);

      console.log("✅ Notification sent to ADMIN");
      console.log(response);

      return res.status(200).json({
        success: true,
        messageId: response,
      });
    }

    // =====================================================
    // ✅ ADMIN → USER
    // sender role = admin
    // =====================================================

    else if (role === "admin") {

      console.log("🔄 Flow: ADMIN → USER");

      if (!receiverId) {
        return res.status(400).json({
          success: false,
          message: "receiverId required",
        });
      }

      // ONLY from user collection

      const userDoc = await db
        .collection("user")
        .doc(receiverId)
        .get();

      if (!userDoc.exists) {
        console.log("❌ User not found");

        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const userData = userDoc.data();

      // SECURITY CHECK

      if (userData.role !== "user") {

        console.log("❌ Document is not a user");

        return res.status(403).json({
          success: false,
          message: "Invalid user document",
        });
      }

      fcmToken = userData.fcmToken;

      if (!fcmToken) {

        console.log("❌ User has no FCM token");

        return res.status(400).json({
          success: false,
          message: "User token missing",
        });
      }

      // =====================================
      // ✅ SEND TO USER
      // =====================================

      const message = {
        token: fcmToken,

        notification: {
          title: "Lion Gate",
          body: "New message from Bibek",
        },

        data: {
          chatId: receiverId || "",

          // IMPORTANT:
          // receiver is user
          role: "user",

          sender: "admin",
          userCode:receiverId,
          isAdmin:"false",
          adminCode:"",
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
      };

      const response = await admin.messaging().send(message);

      console.log("✅ Notification sent to USER");
      console.log(response);

      return res.status(200).json({
        success: true,
        messageId: response,
      });
    }

    // =====================================================
    // ❌ INVALID ROLE
    // =====================================================

    else {

      console.log("❌ Invalid role");

      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

  } catch (error) {

    console.error("❌ SERVER ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
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