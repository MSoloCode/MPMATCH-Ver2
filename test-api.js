// Test the API endpoint from a running server
async function testAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/districts');
    const data = await response.json();
    
    console.log('API Response:', JSON.stringify(data, null, 2));
    console.log(`\nStatus: ${response.status}`);
    console.log(`Success: ${data.success}`);
    console.log(`Districts Count: ${data.data?.length || 0}`);
    
    if (data.data && data.data.length > 0) {
      console.log(`\nFirst 5 districts:`);
      data.data.slice(0, 5).forEach((d) => {
        console.log(`  - ${d.name}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();
