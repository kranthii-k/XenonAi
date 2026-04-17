const fetch = require('node-fetch');

async function testML() {
  const res = await fetch('http://127.0.0.1:5000/extract', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "The camera is fantastic, beautiful photos! But sadly the battery dies extremely fast." })
  });
  
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

testML();
