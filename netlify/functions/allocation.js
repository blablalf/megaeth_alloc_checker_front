export default async (req) => {
  // Get entityId from query parameters
  const entityId = new URL(req.url).searchParams.get('entityId');
  
  if (!entityId) {
    return new Response(JSON.stringify({ error: 'entityId parameter is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // Call the MegaETH API
    const apiUrl = `https://token-api.megaeth.com/api/allocation?entityId=${entityId}`;
    console.log('Proxying request to:', apiUrl);
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error fetching allocation:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch allocation data' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
