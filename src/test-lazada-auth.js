async function testAuthUrl() {
  const url = "https://auth.lazada.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fdaraz%2Fcallback&client_id=504904";
  console.log("Testing URL:", url);

  const res = await fetch(url);
  console.log("Status:", res.status);
  console.log("Final URL:", res.url);
}

testAuthUrl();
