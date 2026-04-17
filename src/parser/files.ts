import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function claudeProjectsPath(): string {
  return path.join(os.homedir(), '.claude', 'projects');
}

export interface ProjectFile {
  path: string;
  projectFolder: string;
}

/** Lists every *.jsonl file directly under each project folder in `projectsDir`. */
export function findJsonlFiles(projectsDir: string): ProjectFile[] {
  if (!fs.existsSync(projectsDir)) {
    return [];
  }
  const out: ProjectFile[] = [];
  for (const folder of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!folder.isDirectory()) {
      continue;
    }
    const dir = path.join(projectsDir, folder.name);
    for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith('.jsonl')) {
        out.push({ path: path.join(dir, file.name), projectFolder: folder.name });
      }
    }
  }
  return out;
}
