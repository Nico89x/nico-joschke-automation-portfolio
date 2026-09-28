import { readdir, readFile } from 'node:fs/promises';

const workflowDir = new URL('../workflows/', import.meta.url);
const files = (await readdir(workflowDir)).filter((name) => name.endsWith('.json')).sort();
const problems = [];

for (const file of files) {
  const workflow = JSON.parse(await readFile(new URL(file, workflowDir), 'utf8'));
  if (workflow.active !== false) problems.push(`${file}: workflow must be inactive`);
  for (const node of workflow.nodes ?? []) {
    if (node.credentials && Object.keys(node.credentials).length > 0) problems.push(`${file}: ${node.name} exports a credential reference`);
  }
  const names = new Set((workflow.nodes ?? []).map((node) => node.name));
  for (const [source, outputs] of Object.entries(workflow.connections ?? {})) {
    if (!names.has(source)) problems.push(`${file}: missing connection source ${source}`);
    for (const outputGroup of Object.values(outputs)) {
      for (const branch of outputGroup ?? []) {
        for (const edge of branch ?? []) if (!names.has(edge.node)) problems.push(`${file}: missing connection target ${edge.node}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${files.length} inactive workflow exports contain no credential objects and all connections resolve.`);
}
