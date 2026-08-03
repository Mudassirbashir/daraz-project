async function testParams() {
  const appKey = "504904";
  const redirectUri = "http://localhost:3000/api/auth/daraz/callback";

  const combinations = [
    {
      name: "auth.lazada.com (client_id)",
      url: `https://auth.lazada.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${appKey}`,
    },
    {
      name: "auth.lazada.com (app_key)",
      url: `https://auth.lazada.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(redirectUri)}&app_key=${appKey}`,
    },
    {
      name: "auth.lazada.com (client_id + country pk)",
      url: `https://auth.lazada.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${appKey}&country=pk`,
    },
    {
      name: "api.daraz.pk (client_id)",
      url: `https://api.daraz.pk/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${appKey}`,
    },
    {
      name: "api.daraz.pk (app_key)",
      url: `https://api.daraz.pk/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(redirectUri)}&app_key=${appKey}`,
    },
  ];

  for (const combo of combinations) {
    const res = await fetch(combo.url);
    const text = await res.text();
    const hasError = text.includes("Missing parameter") || text.includes("Error") || text.includes("error");
    console.log(`[${combo.name}] -> Status: ${res.status}, HasErrorText: ${hasError}`);
    if (hasError) {
      const match = text.match(/Error Message:[^<]+/);
      console.log(`   Message: ${match ? match[0] : text.slice(0, 150)}`);
    } else {
      console.log(`   SUCCESS PREVIEW: ${text.slice(0, 150)}`);
    }
  }
}

testParams();
