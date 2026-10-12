import { registerHooks } from 'node:module';
const dependencies = new Set();
registerHooks({ resolve(specifier, context, nextResolve) {
  const result = nextResolve(specifier, context);
  if (!specifier.startsWith('.') && !specifier.startsWith('node:') && !specifier.startsWith('file:') && result.url.includes('/node_modules/') && !result.url.includes('/desktop/node_modules/')) dependencies.add(specifier);
  return result;
} });
await import('./runtime/server/providers/local.js');
const voice = await import('./runtime/server/standalone/voiceTools.js');
voice.standaloneVoiceTools();
console.log('Runtime dependencies resolved from the development checkout:', [...dependencies]);
