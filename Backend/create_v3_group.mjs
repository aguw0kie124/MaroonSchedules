import 'dotenv/config.js';
import { ServerClient } from '@stream-io/node-sdk';

async function main() {
  const apiKey = process.env.STREAM_FEEDS_API_KEY;
  const apiSecret = process.env.STREAM_FEEDS_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    console.error("Missing STREAM_FEEDS_API_KEY or STREAM_FEEDS_API_SECRET in Backend/.env");
    process.exit(1);
  }

  const client = new ServerClient(apiKey, apiSecret);

  try {
    console.log("Attempting to create V3 feed groups 'flat' and 'user'...");
    
    await client.feeds.createFeedGroup({
      id: "flat",
    });
    
    await client.feeds.createFeedGroup({
      id: "user",
    });

    console.log("Feed groups successfully created in V3 architecture!");

    console.log("Configuring Feed Visibility for 'user' and 'guest' roles...");
    // Grant read and write access to the flat feed group natively
    await client.feeds.updateFeedVisibility({
      name: "public",
      grants: {
        user: [
          "read-feed",
          "add-activity",
          "delete-activity-owner",
          "update-activity-owner"
        ]
      }
    });
    console.log("Permissions deployed securely!");
  } catch(e) {
    console.error("Warning or Error creating feed groups:", e.message);
  }
}

main();
