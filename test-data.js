async function testDataEndpoints() {
  try {
    // First, login to get token
    const loginResponse = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'y@gmail.com',
        password: '123456789'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;

    console.log('✅ Login successful');
    console.log('Token:', token.substring(0, 20) + '...');

    // Test users endpoint
    console.log('\n🔍 Testing users endpoint...');
    const usersResponse = await fetch('http://localhost:4000/api/auth/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (usersResponse.ok) {
      const usersData = await usersResponse.json();
      console.log('✅ Users endpoint working');
      console.log('Number of users:', usersData.length || 'unknown');
    } else {
      console.log('❌ Users endpoint failed:', usersResponse.status);
    }

    // Test leads endpoint
    console.log('\n🔍 Testing leads endpoint...');
    const leadsResponse = await fetch('http://localhost:4000/api/leads', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (leadsResponse.ok) {
      const leadsData = await leadsResponse.json();
      console.log('✅ Leads endpoint working');
      console.log('Number of leads:', leadsData.length || 'unknown');
    } else {
      console.log('❌ Leads endpoint failed:', leadsResponse.status);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDataEndpoints();