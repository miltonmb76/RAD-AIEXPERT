export const getDriveFolderId = async (folderName: string, accessToken: string): Promise<string> => {
  const query = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('getDriveFolderId Error:', res.status, errText);
    throw new Error(`Failed to search Drive folder: ${res.status}`);
  }
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  
  // Create folder
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error('getDriveFolderId (create) Error:', createRes.status, errText);
    throw new Error('Failed to create Drive folder');
  }
  const createData = await createRes.json();
  return createData.id;
};

export const uploadPdfToDrive = async (fileBlob: Blob, filename: string, accessToken: string, folderName?: string): Promise<any> => {
  let parents: string[] = [];
  if (folderName) {
    const folderId = await getDriveFolderId(folderName, accessToken);
    parents.push(folderId);
  }

  const metadata = {
    name: filename,
    mimeType: 'application/pdf',
    ...(parents.length > 0 ? { parents } : {})
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', fileBlob);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('uploadPdfToDrive Error:', res.status, errText);
    throw new Error(`Failed to upload file to Google Drive: ${res.status}`);
  }

  return await res.json();
};
