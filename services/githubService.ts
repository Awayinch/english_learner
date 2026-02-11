import { Settings } from "../types";

// Helper to encode string to Base64 (UTF-8 safe)
const utf8_to_b64 = (str: string) => {
  return window.btoa(unescape(encodeURIComponent(str)));
};

// Helper to decode Base64 to string (UTF-8 safe)
const b64_to_utf8 = (str: string) => {
  try {
    // Standard legacy method for UTF-8 chars
    return decodeURIComponent(escape(window.atob(str)));
  } catch (e) {
    // Modern Fallback using TextDecoder if available
    try {
        const binaryString = window.atob(str);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    } catch (e2) {
        console.error("Base64 Decode Error:", e);
        throw new Error("Failed to decode file content.");
    }
  }
};

export const syncToGithub = async (
  settings: Settings,
  filename: string, // e.g., "2023-10-27.md"
  newContent: string
): Promise<void> => {
  const { githubToken, githubRepo, githubPath } = settings;

  if (!githubToken || !githubRepo) {
    throw new Error("Missing GitHub Settings. Please configure Token and Repo.");
  }

  // Ensure path ends with slash if it exists
  const basePath = githubPath ? (githubPath.endsWith('/') ? githubPath : `${githubPath}/`) : '';
  const fullPath = `${basePath}${filename}`;
  
  const apiUrl = `https://api.github.com/repos/${githubRepo}/contents/${fullPath}`;
  const headers = {
    'Authorization': `Bearer ${githubToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3+json'
  };

  try {
    // 1. Check if file exists to get SHA (needed for update)
    let sha: string | undefined;
    let existingContent = "";

    // Add cache buster to ensure we get latest SHA
    const getRes = await fetch(`${apiUrl}?t=${Date.now()}`, { method: 'GET', headers, cache: 'no-store' });
    
    if (getRes.status === 200) {
      const data = await getRes.json();
      sha = data.sha;
      
      // If file is small (<1MB), content is here. 
      // If >1MB, content is null, but we have SHA. 
      // For Sync (Upload), we often overwrite or append. 
      // If appending to a large file, we MUST fetch blob first.
      
      if (data.content) {
        existingContent = b64_to_utf8(data.content.replace(/\n/g, ''));
      } else if (data.sha) {
        // Fetch via Blob API for large files
        const blobRes = await fetch(`https://api.github.com/repos/${githubRepo}/git/blobs/${data.sha}`, { 
            method: 'GET', 
            headers,
            cache: 'no-store'
        });
        if (blobRes.ok) {
            const blobData = await blobRes.json();
            if (blobData.content && blobData.encoding === 'base64') {
                existingContent = b64_to_utf8(blobData.content.replace(/\n/g, ''));
            }
        }
      }
    } else if (getRes.status !== 404) {
      const err = await getRes.json();
      throw new Error(`GitHub Error: ${err.message}`);
    }

    // 2. Prepare content (Append mode for markdown, Overwrite for JSON/backup)
    // If filename ends in .json, we assume it's a backup and overwrite completely
    const isBackup = filename.endsWith('.json');
    
    const finalContent = (existingContent && !isBackup)
      ? `${existingContent}\n\n${newContent}` 
      : newContent;

    const encodedContent = utf8_to_b64(finalContent);

    // 3. Upload (Create or Update)
    const body: any = {
      message: `LingoLeap Sync: ${new Date().toISOString()}`,
      content: encodedContent
    };
    if (sha) {
      body.sha = sha;
    }

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(`Upload Failed: ${err.message}`);
    }

  } catch (error: any) {
    console.error("GitHub Sync Error:", error);
    throw error;
  }
};

export const loadFromGithub = async (settings: Settings, filename: string): Promise<string> => {
    const { githubToken, githubRepo, githubPath } = settings;

    if (!githubToken || !githubRepo) {
        throw new Error("Missing GitHub Settings.");
    }

    const basePath = githubPath ? (githubPath.endsWith('/') ? githubPath : `${githubPath}/`) : '';
    const fullPath = `${basePath}${filename}`;
    const apiUrl = `https://api.github.com/repos/${githubRepo}/contents/${fullPath}`;

    const headers = {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
    };

    // Add timestamp to prevent caching
    const res = await fetch(`${apiUrl}?t=${Date.now()}`, { 
        method: 'GET', 
        headers,
        cache: 'no-store' 
    });

    if (!res.ok) {
        if (res.status === 404) return ""; // File doesn't exist yet
        throw new Error(`Fetch failed: ${res.statusText}`);
    }

    const data = await res.json();
    
    // Case 1: Small file (<1MB), content is directly in response
    if (data.content) {
        return b64_to_utf8(data.content.replace(/\n/g, ''));
    }
    
    // Case 2: Large file (>1MB), content is null, fetch via Blob API using SHA
    if (data.sha) {
        const blobUrl = `https://api.github.com/repos/${githubRepo}/git/blobs/${data.sha}`;
        const blobRes = await fetch(blobUrl, { 
            method: 'GET', 
            headers,
            cache: 'no-store'
        });
        
        if (blobRes.ok) {
            const blobData = await blobRes.json();
            if (blobData.content && blobData.encoding === 'base64') {
                return b64_to_utf8(blobData.content.replace(/\n/g, ''));
            }
        }
    }

    return "";
};