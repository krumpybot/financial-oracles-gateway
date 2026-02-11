import { createAgent } from '@lucid-agents/core';
import { http } from '@lucid-agents/http';
import { createAgentApp } from '@lucid-agents/hono';
import { Hono } from 'hono';

const agent = await createAgent({
  name: 'test',
  version: '1.0.0',
  description: 'test',
})
  .use(http())
  .build();

const app = createAgentApp(agent);

// Check if it's a Hono app
console.log('Is Hono-like:', app instanceof Hono ? 'yes' : 'no');
console.log('app.fetch type:', typeof (app as any).fetch);
console.log('Proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(app)));

// Try direct Hono approach
const honoApp = new Hono();
honoApp.get('/', (c) => c.text('Hello'));
console.log('Hono fetch type:', typeof honoApp.fetch);
