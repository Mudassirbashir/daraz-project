const dns = require("dns").promises;

async function checkDomains() {
  const domains = [
    "auth.lazada.com",
    "api.daraz.pk",
    "auth.daraz.pk",
    "open.lazada.com",
  ];

  for (const domain of domains) {
    try {
      const addresses = await dns.lookup(domain);
      console.log(`DOMAIN [${domain}] -> IP: ${addresses.address}`);

      // Try fetching response headers
      try {
        const res = await fetch(`https://${domain}/oauth/authorize?response_type=code`, { method: "HEAD" });
        console.log(`   HEAD https://${domain}/oauth/authorize -> Status: ${res.status}`);
      } catch (fErr) {
        console.log(`   Fetch error for ${domain}: ${fErr.message}`);
      }
    } catch (err) {
      console.log(`DOMAIN [${domain}] RESOLUTION FAILED: ${err.message}`);
    }
  }
}

checkDomains();
