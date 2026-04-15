import admin from "./src/config/firebase.js";

async function test() {
  const message = {
    topic: "volunteer-updates",
    notification: {
      title: "Firebase Working 🚀",
      body: "Setup is complete"
    }
  };

  const response = await admin.messaging().send(message);
  console.log("Success:", response);
}

test().catch(console.error);