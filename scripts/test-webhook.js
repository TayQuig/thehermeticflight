// scripts/test-webhook.js
// Run with: node scripts/test-webhook.js

async function testWebhook() {
  const url = 'http://localhost:4321/api/webhooks/seobot';
  const secret = 'TEST_SECRET'; // Set this in your .env temporarily for testing

  const payload = {
    title: "Test Article from SEOBot",
    description: "This is a test article generated to verify the webhook integration.",
    content: "## Hello World\n\nThis content was pushed via the SEOBot webhook integration.\n\n* It supports Markdown.\n* It should be committed to the repo automatically.",
    image: "https://example.com/image.jpg",
    tags: ["testing", "automation"]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

testWebhook();

