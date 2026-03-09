#!/usr/bin/env node
/**
 * Test script to verify MCP server responds correctly
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

const serverPath = '/Users/josh.schoen/repos/surfaces-ui/packages/server/dist/index.js';

console.log('Starting MCP server...');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let responseData = '';
server.stdout.on('data', (data) => {
  responseData += data.toString();
});

// Send initialize request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' }
  }
};

console.log('Sending initialize request...');
server.stdin.write(JSON.stringify(initRequest) + '\n');

await setTimeout(1000);

// Send resources/list request
const listRequest = {
  jsonrpc: '2.0',
  id: 2,
  method: 'resources/list',
  params: {}
};

console.log('Sending resources/list request...');
server.stdin.write(JSON.stringify(listRequest) + '\n');

await setTimeout(1000);

// Send resources/read request
const readRequest = {
  jsonrpc: '2.0',
  id: 3,
  method: 'resources/read',
  params: { uri: 'surfaces-ui/apps/sql-editor-cdn' }
};

console.log('Sending resources/read request...');
server.stdin.write(JSON.stringify(readRequest) + '\n');

await setTimeout(2000);

console.log('\n=== Server Responses ===');
console.log(responseData);

server.kill();
console.log('\nTest complete');
