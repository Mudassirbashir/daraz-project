async function testCallbackUrls() {
  const appKey = "504904";
  const testUris = [
    "http://localhost:3000/api/auth/daraz/callback",
    "http://localhost:3000/api/auth/callback",
    "http://localhost:3000/callback",
    "http://localhost:3000/",
    "http://localhost:3000",
    "http://127.0.0.1:3000/api/auth/daraz/callback",
    "https://localhost:3000/api/auth/daraz/callback",
  ];

  console.log("Testing Callback URLs against Daraz Open Platform...");

  for (const uri of testUris) {
    const url = `https://api.daraz.pk/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(uri)}&client_id=${appKey}`;
    const res = await fetch(url);
    const text = await res.text();
    const hasMatchErr = text.includes("Redirect uri does not match");
    console.log(`URI [${uri}] -> MatchError: ${hasMatchErr}`);
    if (!hasMatchErr) {
      console.log(`>>> MATCHED CALLBACK URL FOUND! Text preview: ${text.slice(0, 200)}`);
    }
  }
}

testCallbackUrls();
