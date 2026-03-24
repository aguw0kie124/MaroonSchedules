const stream = require('@stream-io/node-sdk');

async function main() {
  // Use actual env variables or hardcode for this one-time admin task
  const apiKey = "vmy77qgj83nu";
  const apiSecret = "r753vsq9te54dmcjmrhgja47asyuz8w2j29z75kagfdvkhnt3aabyrb2yh3anmx7";
  
  // The V3 Server SDK uses StreamClient (or it's attached directly)
  const StreamClient = stream.StreamClient || stream.default?.StreamClient || stream;
  const client = new StreamClient(apiKey, apiSecret);

  try {
    console.log("Attempting to create V3 feed groups 'flat' and 'user'...");
    await client.feeds.createFeedGroup({ id: "flat" });
    await client.feeds.createFeedGroup({ id: "user" });
    console.log("Feed groups successfully created in V3 architecture!");

    console.log("Configuring Feed Visibility for 'user' and 'guest' roles...");
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
