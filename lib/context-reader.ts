import fs from 'fs';
import path from 'path';

export function getContextContent(category: string, filename: string): string | null {
  try {
    const filePath = path.join(process.cwd(), 'context', category, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  } catch (error) {
    console.error(`Error reading context: ${category}/${filename}`, error);
    return null;
  }
}

export function getJsonContext(category: string, filename: string): any | null {
  try {
    const content = getContextContent(category, filename);
    return content ? JSON.parse(content) : null;
  } catch (error) {
    console.error(`Error parsing JSON context: ${category}/${filename}`, error);
    return null;
  }
}
