import { Speculator } from './src/index';
import { NodeFileProvider } from './src/io/NodeFileProvider';

async function run() {
  const speculator = new Speculator({
    fileProvider: new NodeFileProvider()
  });

  const doc = await speculator.parseDocument({
    id: 'test',
    path: 'test.md',
    content: `<aside class="issue">Open issue: <a href="https://example.com/issue/1">#1</a></aside>`
  });

  console.log(JSON.stringify(doc, null, 2));
}

run().catch(console.error);
