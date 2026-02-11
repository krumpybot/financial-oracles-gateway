import { createAgent } from '@lucid-agents/core';
import { http } from '@lucid-agents/http';
import { createAgentApp } from '@lucid-agents/hono';

const agent = await createAgent({
  name: 'test',
  version: '1.0.0',
  description: 'test',
})
  .use(http())
  .build();

const app = createAgentApp(agent);
console.log('App type:', typeof app);
console.log('App keys:', Object.keys(app));
console.log('Has fetch:', 'fetch' in app);
