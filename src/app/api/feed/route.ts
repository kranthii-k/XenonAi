export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Mock reviews for demo feed
      const mockReviews = Array.from({ length: 10 }).map((_, i) => ({
        id: `live-${Date.now()}-${i}`,
        product_id: "demo-product",
        text: `Customer experience report ${i}: The battery life is okay but packaging was damaged.`,
        created_at: new Date().toISOString()
      }));

      for (const review of mockReviews) {
        const data = `data: ${JSON.stringify(review)}\n\n`;
        controller.enqueue(encoder.encode(data));
        await new Promise(r => setTimeout(r, 800)); // 1 review per 0.8s
      }
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
