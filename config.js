/**
 * CCTV Archive Viewer — Customer Configuration
 * =============================================
 * Edit this file with your AWS values before deploying.
 * All other files work without modification.
 */
window.CCTV_CONFIG = {

  // API Gateway endpoint (from deployment Step 6)
  apiEndpoint: "https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod",

  // CloudFront domain for serving signed video URLs
  cloudfrontDomain: "YOUR_DISTRIBUTION.cloudfront.net",

  // Signed URL expiry in seconds (default 2 hours)
  signedUrlTtl: 7200,

  // S3 bucket structure — objects are stored as:
  // {location}/{camera}/{year}/{month}/{day}/{HH00}.mp4
  // e.g.  new-york/lobby-cam/2024/06/15/0800.mp4

  // ── Locations & Cameras ─────────────────────────────────────────
  // Define all your locations and cameras here.
  // id   = folder name used in S3 (must match exactly)
  // name = display label shown in the UI
  locations: [
    {
      id: "new-york",
      name: "New York HQ",
      cameras: [
        { id: "lobby-cam",    name: "Main Lobby"       },
        { id: "entrance-cam", name: "Front Entrance"    },
        { id: "parking-cam",  name: "Parking Level B1"  },
        { id: "server-cam",   name: "Server Room"       },
      ]
    },
    {
      id: "los-angeles",
      name: "Los Angeles West",
      cameras: [
        { id: "reception-cam", name: "Reception"       },
        { id: "warehouse-cam", name: "Warehouse Floor" },
        { id: "dock-cam",      name: "Loading Dock"    },
      ]
    },
    {
      id: "chicago",
      name: "Chicago Central",
      cameras: [
        { id: "floor1-cam", name: "Floor 1 — East Wing" },
        { id: "floor2-cam", name: "Floor 2 — West Wing" },
        { id: "roof-cam",   name: "Rooftop PTZ"          },
      ]
    },
    {
      id: "london",
      name: "London Office",
      cameras: [
        { id: "lobby-cam",  name: "Ground Floor Lobby" },
        { id: "office-cam", name: "Open Plan Office"   },
        { id: "exit-cam",   name: "Emergency Exit"     },
      ]
    },
  ],
};
