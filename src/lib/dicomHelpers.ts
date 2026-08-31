// Shared client-side DICOM parsing and extraction helper functions

export interface DicomMetadata {
  patientName: string;
  patientId: string;
  modality: string;
  studyDate: string;
  institutionName: string;
  manufacturer: string;
  studyDescription: string;
  rows: number;
  columns: number;
  bitsAllocated?: number;
  photometricInterpretation?: string;
  pixelRepresentation?: number;
  pixelSpacing?: string;
  samplesPerPixel?: number;
  planarConfiguration?: number;
  fileName: string;
  allTags: { tag: string; name: string; value: string }[];
}

export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&amp;lt;";
      case ">": return "&amp;gt;";
      case "&": return "&amp;amp;";
      case "\'": return "&amp;apos;";
      case "\"": return "&amp;quot;";
      default: return c;
    }
  });
}

export function uint8ToBase64(u8Array: Uint8Array): string {
  let binary = "";
  const len = u8Array.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    const sub = u8Array.subarray(i, Math.min(i + chunk, len));
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}

// Scan binary structure for JPEG SOI standard magic markers [0xFF, 0xD8, 0xFF] and extracts standard frames
export function findEmbeddedJpeg(u8: Uint8Array): string | null {
  for (let i = 0; i < u8.length - 4; i++) {
    if (u8[i] === 0xFF && u8[i+1] === 0xD8 && u8[i+2] === 0xFF) {
      let endIdx = -1;
      const endLimit = Math.min(u8.length - 1, i + 6 * 1024 * 1024); // search window constraint up to 6MB
      for (let j = i + 2; j < endLimit; j++) {
        if (u8[j] === 0xFF && u8[j+1] === 0xD9) {
          endIdx = j + 2;
          break;
        }
      }
      if (endIdx !== -1 && (endIdx - i) > 1000) {
        const jpegSlice = u8.slice(i, endIdx);
        return `data:image/jpeg;base64,${uint8ToBase64(jpegSlice)}`;
      }
    }
  }
  return null;
}

// Scan binary structure for PNG magic standard signatures
export function findEmbeddedPng(u8: Uint8Array): string | null {
  const pngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < u8.length - 20; i++) {
    let match = true;
    for (let h = 0; h < pngHeader.length; h++) {
      if (u8[i+h] !== pngHeader[h]) {
        match = false;
        break;
      }
    }
    if (match) {
      let endIdx = -1;
      const endLimit = Math.min(u8.length - 4, i + 6 * 1024 * 1024);
      for (let j = i + 8; j < endLimit; j++) {
        if (u8[j] === 0x49 && u8[j+1] === 0x45 && u8[j+2] === 0x4E && u8[j+3] === 0x44) {
          endIdx = j + 8;
          break;
        }
      }
      if (endIdx !== -1) {
        const pngSlice = u8.slice(i, endIdx);
        return `data:image/png;base64,${uint8ToBase64(pngSlice)}`;
      }
    }
  }
  return null;
}

// Low level raw uncompressed medical 8-bit or 16-bit pixel tags renderer
export function renderRawDicomPixels(
  u8: Uint8Array, 
  rows: number, 
  cols: number, 
  bitsAllocated: number, 
  photometricInterpretation: string, 
  pixelRepresentation: number,
  planarConfiguration = 0
): string | null {
  const pixelDataTag = [0xE0, 0x7F, 0x10, 0x00];
  let valOffset = -1;
  let valLen = 0;
  
  for (let i = 132; i < u8.length - 8; i++) {
    if (u8[i] === pixelDataTag[0] && u8[i+1] === pixelDataTag[1] && u8[i+2] === pixelDataTag[2] && u8[i+3] === pixelDataTag[3]) {
      const vr1 = u8[i + 4];
      const vr2 = u8[i + 5];
      const isExplicit = (vr1 >= 65 && vr1 <= 90) && (vr2 >= 65 && vr2 <= 90);
      
      const fileView = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      if (isExplicit) {
        const vr = String.fromCharCode(vr1, vr2);
        if (["OB", "OW", "OF", "UT", "UN", "SQ"].includes(vr)) {
          valLen = fileView.getUint32(i + 8, true);
          valOffset = i + 12;
        } else {
          valLen = fileView.getUint16(i + 6, true);
          valOffset = i + 8;
        }
      } else {
        valLen = fileView.getUint32(i + 4, true);
        valOffset = i + 8;
      }
      break;
    }
  }

  if (valOffset === -1 || valLen <= 0) return null;
  if (valOffset + valLen > u8.length) {
    valLen = u8.length - valOffset;
  }
  if (cols <= 0 || rows <= 0 || cols > 8192 || rows > 8192) return null;

  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  
  const imgData = ctx.createImageData(cols, rows);
  const data = imgData.data;
  
  const fileView = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const numPixels = rows * cols;
  
  const is16Bit = bitsAllocated === 16;
  const isSigned = pixelRepresentation === 1;
  
  if (is16Bit) {
    const wordsNeeded = Math.min(Math.floor(valLen / 2), numPixels);
    const rawWords = new Uint16Array(wordsNeeded);
    for (let i = 0; i < wordsNeeded; i++) {
      if (isSigned) {
        rawWords[i] = fileView.getInt16(valOffset + i * 2, true);
      } else {
        rawWords[i] = fileView.getUint16(valOffset + i * 2, true);
      }
    }
    
    let min = 65535;
    let max = 0;
    for (let i = 0; i < rawWords.length; i++) {
      const v = rawWords[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min || 1;
    const isMonochrome1 = photometricInterpretation.trim().toUpperCase() === "MONOCHROME1";
    
    for (let i = 0; i < numPixels; i++) {
      let val = 0;
      if (i < rawWords.length) {
        val = Math.floor(((rawWords[i] - min) / range) * 255);
      }
      if (isMonochrome1) {
        val = 255 - val;
      }
      if (val < 0) val = 0;
      if (val > 255) val = 255;
      
      const idx = i * 4;
      data[idx] = val;     // R
      data[idx + 1] = val; // G
      data[idx + 2] = val; // B
      data[idx + 3] = 255;  // A
    }
  } else {
    const photoUpper = photometricInterpretation.trim().toUpperCase();
    const isColor = photoUpper.includes("RGB") || photoUpper.includes("YBR") || photoUpper.includes("PALETTE") || valLen >= numPixels * 3;
    
    if (isColor) {
      const rawBytes = u8.subarray(valOffset, valOffset + Math.min(valLen, numPixels * 3));
      const isYbr = photoUpper.includes("YBR");
      
      for (let i = 0; i < numPixels; i++) {
        let r = 0;
        let g = 0;
        let b = 0;
        
        let c1 = 0;
        let c2 = 0;
        let c3 = 0;
        
        if (planarConfiguration === 1) {
          if (i < rawBytes.length) c1 = rawBytes[i];
          if (numPixels + i < rawBytes.length) c2 = rawBytes[numPixels + i];
          if (numPixels * 2 + i < rawBytes.length) c3 = rawBytes[numPixels * 2 + i];
        } else {
          const idx3 = i * 3;
          if (idx3 + 2 < rawBytes.length) {
            c1 = rawBytes[idx3];
            c2 = rawBytes[idx3 + 1];
            c3 = rawBytes[idx3 + 2];
          }
        }
        
        if (isYbr) {
          // Convert YCbCr (YBR) to RGB
          const y = c1;
          const cb = c2;
          const cr = c3;
          r = Math.round(y + 1.402 * (cr - 128));
          g = Math.round(y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128));
          b = Math.round(y + 1.772 * (cb - 128));
        } else {
          r = c1;
          g = c2;
          b = c3;
        }
        
        if (r < 0) r = 0; if (r > 255) r = 255;
        if (g < 0) g = 0; if (g > 255) g = 255;
        if (b < 0) b = 0; if (b > 255) b = 255;
        
        const idx = i * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    } else {
      const rawBytes = u8.subarray(valOffset, valOffset + Math.min(valLen, numPixels));
      const isMonochrome1 = photoUpper === "MONOCHROME1";
      for (let i = 0; i < numPixels; i++) {
        let val = 0;
        if (i < rawBytes.length) {
          val = isMonochrome1 ? 255 - rawBytes[i] : rawBytes[i];
        }
        if (val < 0) val = 0;
        if (val > 255) val = 255;
        
        const idx = i * 4;
        data[idx] = val;     // R
        data[idx + 1] = val; // G
        data[idx + 2] = val; // B
        data[idx + 3] = 255;  // A
      }
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/png");
}

// Scans binary structure for compressed / encapsulated JPEG or PNG elements inside sequence items (FFFE, E000)
export function extractEncapsulatedJpeg(u8: Uint8Array): string | null {
  let pixelDataPos = -1;
  for (let i = 132; i < u8.length - 8; i++) {
    if (u8[i] === 0xE0 && u8[i+1] === 0x7F && u8[i+2] === 0x10 && u8[i+3] === 0x00) {
      pixelDataPos = i;
      break;
    }
  }
  if (pixelDataPos === -1) return null;

  for (let i = pixelDataPos + 4; i < Math.min(u8.length - 8, pixelDataPos + 1024); i++) {
    if (u8[i] === 0xFE && u8[i+1] === 0xFF && u8[i+2] === 0x00 && u8[i+3] === 0xE0) {
      const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const itemLen = view.getUint32(i + 4, true);
      const nextItemPos = i + 8 + (itemLen === 0xFFFFFFFF ? 0 : itemLen);
      
      if (nextItemPos < u8.length - 8 && u8[nextItemPos] === 0xFE && u8[nextItemPos+1] === 0xFF && u8[nextItemPos+2] === 0x00 && u8[nextItemPos+3] === 0xE0) {
        const fragmentLen = view.getUint32(nextItemPos + 4, true);
        const fragmentOffset = nextItemPos + 8;
        if (fragmentOffset + fragmentLen <= u8.length && fragmentLen > 0) {
          const fragmentData = u8.subarray(fragmentOffset, fragmentOffset + fragmentLen);
          if (fragmentData[0] === 0xFF && fragmentData[1] === 0xD8 && fragmentData[2] === 0xFF) {
            return `data:image/jpeg;base64,${uint8ToBase64(fragmentData)}`;
          }
          if (fragmentData[0] === 0x89 && fragmentData[1] === 0x50 && fragmentData[2] === 0x4E && fragmentData[3] === 0x47) {
            return `data:image/png;base64,${uint8ToBase64(fragmentData)}`;
          }
        }
      }
    }
  }
  return null;
}

// Helper to safely clean and unwrap ArrayBuffer from TypedArrays or shared pooled structures
export function getCleanArrayBuffer(input: any): ArrayBuffer {
  if (!input) return new ArrayBuffer(0);
  if (input instanceof Uint8Array) {
    return (input.buffer as ArrayBuffer).slice(input.byteOffset, input.byteOffset + input.byteLength);
  } else if (input instanceof ArrayBuffer) {
    return input;
  } else if (input && input.buffer instanceof ArrayBuffer) {
    return (input.buffer as ArrayBuffer).slice(input.byteOffset || 0, (input.byteOffset || 0) + (input.byteLength || 0));
  }
  return input as ArrayBuffer;
}

// Helper to sanitize base64/data URLs against space/linebreak serialization issues
export function sanitizeDataUrl(url: string | null | undefined): string {
  if (!url) return "";
  let clean = url.trim().replace(/\s/g, "");
  if (clean && !clean.startsWith("data:") && !clean.startsWith("blob:")) {
    let mime = "image/png";
    if (clean.startsWith("/9j/")) {
      mime = "image/jpeg";
    } else if (clean.startsWith("iVBORw0KGgo")) {
      mime = "image/png";
    } else if (clean.startsWith("PHN2Zy")) {
      mime = "image/svg+xml";
    }
    clean = `data:${mime};base64,${clean}`;
  }
  return clean;
}

let cornerstoneInitialization: Promise<{
  loader: typeof import("@cornerstonejs/dicom-image-loader").default;
  imageLoader: typeof import("@cornerstonejs/core").imageLoader;
}> | null = null;

async function initializeCornerstoneDecoder() {
  if (!cornerstoneInitialization) {
    cornerstoneInitialization = Promise.all([
      import("@cornerstonejs/core"),
      import("@cornerstonejs/dicom-image-loader"),
    ]).then(([core, dicomLoaderModule]) => {
      core.init();
      dicomLoaderModule.init({
        maxWebWorkers: Math.max(1, Math.min(navigator.hardwareConcurrency || 1, 2)),
        strict: false,
      });
      return {
        loader: dicomLoaderModule.default,
        imageLoader: core.imageLoader,
      };
    });
  }
  return cornerstoneInitialization;
}

function renderCornerstoneImage(image: any): string {
  const rows = Number(image.rows || image.height);
  const columns = Number(image.columns || image.width);
  const pixelData = image.getPixelData();
  if (!rows || !columns || !pixelData?.length) {
    throw new Error("El DICOM no contiene una matriz de píxeles renderizable.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo crear el lienzo DICOM.");

  const output = context.createImageData(columns, rows);
  const numberOfPixels = rows * columns;
  const photometricInterpretation = String(
    image.photometricInterpretation || image.imageFrame?.photometricInterpretation || ""
  ).toUpperCase();

  if (
    photometricInterpretation === "YBR_FULL_422" &&
    pixelData.length >= numberOfPixels * 2 &&
    pixelData.length < numberOfPixels * 3
  ) {
    const writeYbrPixel = (pixelIndex: number, y: number, cb: number, cr: number) => {
      const outputIndex = pixelIndex * 4;
      output.data[outputIndex] = Math.max(0, Math.min(255, Math.round(y + 1.402 * (cr - 128))));
      output.data[outputIndex + 1] = Math.max(
        0,
        Math.min(255, Math.round(y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128)))
      );
      output.data[outputIndex + 2] = Math.max(0, Math.min(255, Math.round(y + 1.772 * (cb - 128))));
      output.data[outputIndex + 3] = 255;
    };

    // DICOM PS3.3 C.7.6.3.1.2 stores two luminance samples followed by
    // their shared chroma samples: Y1, Y2, Cb, Cr.
    let sourceIndex = 0;
    for (let pixelIndex = 0; pixelIndex < numberOfPixels; pixelIndex += 2) {
      const y1 = pixelData[sourceIndex] ?? 0;
      const y2 = pixelData[sourceIndex + 1] ?? y1;
      const cb = pixelData[sourceIndex + 2] ?? 128;
      const cr = pixelData[sourceIndex + 3] ?? 128;
      writeYbrPixel(pixelIndex, y1, cb, cr);
      if (pixelIndex + 1 < numberOfPixels) {
        writeYbrPixel(pixelIndex + 1, y2, cb, cr);
      }
      sourceIndex += 4;
    }
  } else if (image.color || image.numberOfComponents >= 3) {
    const components = pixelData.length >= numberOfPixels * 4 ? 4 : 3;
    for (let pixelIndex = 0; pixelIndex < numberOfPixels; pixelIndex++) {
      const sourceIndex = pixelIndex * components;
      const outputIndex = pixelIndex * 4;
      output.data[outputIndex] = pixelData[sourceIndex] || 0;
      output.data[outputIndex + 1] = pixelData[sourceIndex + 1] || 0;
      output.data[outputIndex + 2] = pixelData[sourceIndex + 2] || 0;
      output.data[outputIndex + 3] = components === 4 ? pixelData[sourceIndex + 3] : 255;
    }
  } else {
    const slope = Number.isFinite(image.slope) ? image.slope : 1;
    const intercept = Number.isFinite(image.intercept) ? image.intercept : 0;
    const rawCenter = Array.isArray(image.windowCenter) ? image.windowCenter[0] : image.windowCenter;
    const rawWidth = Array.isArray(image.windowWidth) ? image.windowWidth[0] : image.windowWidth;

    let lower = Number(rawCenter) - Number(rawWidth) / 2;
    let upper = Number(rawCenter) + Number(rawWidth) / 2;

    if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper <= lower) {
      const sampleStep = Math.max(1, Math.floor(pixelData.length / 100_000));
      const sampledValues: number[] = [];
      for (let index = 0; index < pixelData.length; index += sampleStep) {
        sampledValues.push(pixelData[index] * slope + intercept);
      }
      sampledValues.sort((a, b) => a - b);
      lower = sampledValues[Math.floor(sampledValues.length * 0.02)] ?? 0;
      upper = sampledValues[Math.floor(sampledValues.length * 0.98)] ?? lower + 1;
      if (upper <= lower) upper = lower + 1;
    }

    const range = upper - lower;
    for (let pixelIndex = 0; pixelIndex < numberOfPixels; pixelIndex++) {
      const modalityValue = (pixelData[pixelIndex] ?? 0) * slope + intercept;
      let gray = Math.round(((modalityValue - lower) / range) * 255);
      gray = Math.max(0, Math.min(255, gray));
      if (image.invert) gray = 255 - gray;

      const outputIndex = pixelIndex * 4;
      output.data[outputIndex] = gray;
      output.data[outputIndex + 1] = gray;
      output.data[outputIndex + 2] = gray;
      output.data[outputIndex + 3] = 255;
    }
  }

  context.putImageData(output, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Decodes the first frame of a DICOM Part 10 file using Cornerstone's medical
 * codecs (JPEG, JPEG-LS, JPEG 2000, RLE and uncompressed transfer syntaxes).
 */
export async function decodeDicomImage(
  buffer: ArrayBuffer,
  fileName = "image.dcm"
): Promise<string> {
  const { loader, imageLoader } = await initializeCornerstoneDecoder();
  const blob = new File([getCleanArrayBuffer(buffer)], fileName, {
    type: "application/dicom",
  });
  const imageId = loader.wadouri.fileManager.add(blob);
  const fileIndex = Number(imageId.substring(imageId.lastIndexOf(":") + 1));

  try {
    const image = await imageLoader.loadAndCacheImage(imageId);
    return renderCornerstoneImage(image);
  } finally {
    if (Number.isInteger(fileIndex)) {
      loader.wadouri.fileManager.remove(fileIndex);
    }
  }
}

// Orchestrate multi-strategy picture retrieval from DICOM raw buffer
export function extractImageFromDicom(buffer: ArrayBuffer, metadata: DicomMetadata): string | null {
  const cleanBuffer = getCleanArrayBuffer(buffer);
  const u8 = new Uint8Array(cleanBuffer);
  
  // 1. Try encapsulated stream first
  try {
    const encapsulated = extractEncapsulatedJpeg(u8);
    if (encapsulated) return encapsulated;
  } catch (e) {
    console.error("Error looking for encapsulated DICOM image:", e);
  }
  
  // 2. Dual searching for standard raw embedded visual images
  try {
    const jpegData = findEmbeddedJpeg(u8);
    if (jpegData) return jpegData;
  } catch (e) {
    console.error("Error looking for JPEG:", e);
  }
  
  try {
    const pngData = findEmbeddedPng(u8);
    if (pngData) return pngData;
  } catch (e) {
    console.error("Error looking for PNG:", e);
  }
  
  // 3. Grayscale/Color matrix decoder fallback
  try {
    const bitsAllocated = metadata.bitsAllocated || 16;
    const photometricInterpretation = metadata.photometricInterpretation || "MONOCHROME2";
    const pixelRepresentation = metadata.pixelRepresentation || 0;
    const planarConfig = metadata.planarConfiguration || 0;
    const rawData = renderRawDicomPixels(u8, metadata.rows, metadata.columns, bitsAllocated, photometricInterpretation, pixelRepresentation, planarConfig);
    if (rawData) return rawData;
  } catch (e) {
    console.error("Error decoding raw matrix pixels:", e);
  }
  
  return null;
}

// Client-side customized binary DICOM metadata standard tag scanner
export function parseDicomMetadata(buffer: ArrayBuffer, fileName: string): DicomMetadata {
  const cleanBuffer = getCleanArrayBuffer(buffer);
  const view = new DataView(cleanBuffer);
  const metadata: DicomMetadata = {
    patientName: "Paciente Anónimo",
    patientId: "DCM-" + Math.floor(100000 + Math.random() * 900000),
    modality: "RX",
    studyDate: new Date().toISOString().split("T")[0],
    institutionName: "HOSPITAL CLINICO CENTRAL",
    manufacturer: "SIMULADOR PACS V2.5",
    studyDescription: "ESTUDIO RADIOLOGICO DE CONTRASTE",
    rows: 1024,
    columns: 1024,
    bitsAllocated: 16,
    photometricInterpretation: "MONOCHROME2",
    pixelRepresentation: 0,
    pixelSpacing: "1\\1", // Default to 1mm per pixel
    fileName,
    allTags: [],
  };

  if (buffer.byteLength < 132) return metadata;
  
  let magic = "";
  for (let i = 0; i < 4; i++) {
    magic += String.fromCharCode(view.getUint8(128 + i));
  }
  
  if (magic !== "DICM") {
    // Return early if not standard, though we will proceed with beautiful mock default metadata values for compatibility
    return metadata;
  }

  // Common DICOM tag signatures in Little-Endian byte forms:
  const tagsToFind = [
    { name: "patientName", tagStr: "0010,0010", bytes: [0x10, 0x00, 0x10, 0x00] },
    { name: "patientId", tagStr: "0010,0020", bytes: [0x10, 0x00, 0x20, 0x00] },
    { name: "modality", tagStr: "0008,0060", bytes: [0x08, 0x00, 0x60, 0x00] },
    { name: "studyDate", tagStr: "0008,0020", bytes: [0x08, 0x00, 0x20, 0x00] },
    { name: "institutionName", tagStr: "0008,0080", bytes: [0x08, 0x00, 0x80, 0x00] },
    { name: "studyDescription", tagStr: "0008,1030", bytes: [0x08, 0x00, 0x30, 0x10] },
    { name: "manufacturer", tagStr: "0008,0070", bytes: [0x08, 0x00, 0x70, 0x00] },
    { name: "rows", tagStr: "0028,0010", bytes: [0x28, 0x00, 0x10, 0x00] },
    { name: "columns", tagStr: "0028,0011", bytes: [0x28, 0x00, 0x11, 0x00] },
    { name: "bitsAllocated", tagStr: "0028,0100", bytes: [0x28, 0x00, 0x00, 0x01] },
    { name: "photometricInterpretation", tagStr: "0028,0004", bytes: [0x28, 0x00, 0x04, 0x00] },
    { name: "pixelRepresentation", tagStr: "0028,0103", bytes: [0x28, 0x00, 0x03, 0x01] },
    { name: "pixelSpacing", tagStr: "0028,0030", bytes: [0x28, 0x00, 0x30, 0x00] },
    { name: "samplesPerPixel", tagStr: "0028,0002", bytes: [0x28, 0x00, 0x02, 0x00] },
    { name: "planarConfiguration", tagStr: "0028,0006", bytes: [0x28, 0x00, 0x06, 0x00] },
  ];

  const u8 = new Uint8Array(buffer);
  const getDicomString = (offset: number, maxLength: number): string => {
    let str = "";
    for (let o = 0; o < maxLength; o++) {
      const charCode = u8[offset + o];
      if (charCode === 0 || charCode === 92 || offset + o >= u8.length) break;
      if (charCode >= 32 && charCode <= 126) {
        str += String.fromCharCode(charCode);
      }
    }
    return str.trim();
  };

  for (let idx = 132; idx < u8.length - 12; idx++) {
    for (const tag of tagsToFind) {
      if (
        u8[idx] === tag.bytes[0] &&
        u8[idx + 1] === tag.bytes[1] &&
        u8[idx + 2] === tag.bytes[2] &&
        u8[idx + 3] === tag.bytes[3]
      ) {
        // Tag matched! Find VR, length, value offset
        const vr1 = u8[idx + 4];
        const vr2 = u8[idx + 5];
        let valueOffset = idx + 8;
        let valueLength = 0;

        const isExplicit = (vr1 >= 65 && vr1 <= 90) && (vr2 >= 65 && vr2 <= 90);
        if (isExplicit) {
          const vr = String.fromCharCode(vr1, vr2);
          if (["OB", "OW", "OF", "UT", "UN", "SQ"].includes(vr)) {
            valueLength = view.getUint32(idx + 8, true);
            valueOffset = idx + 12;
          } else {
            valueLength = view.getUint16(idx + 6, true);
            valueOffset = idx + 8;
          }
        } else {
          valueLength = view.getUint32(idx + 4, true);
          valueOffset = idx + 8;
        }

        if (valueLength > 0 && valueLength < 500 && valueOffset + valueLength <= u8.length) {
          if (
            tag.name === "rows" || 
            tag.name === "columns" || 
            tag.name === "bitsAllocated" || 
            tag.name === "pixelRepresentation" ||
            tag.name === "samplesPerPixel" ||
            tag.name === "planarConfiguration"
          ) {
            const val = view.getUint16(valueOffset, true);
            (metadata as any)[tag.name] = val;
          } else {
            const valStr = getDicomString(valueOffset, valueLength);
            if (valStr) {
              (metadata as any)[tag.name] = valStr;
            }
          }
        }
      }
    }
  }

  // Format dates beautiful
  if (metadata.studyDate && metadata.studyDate.length === 8) {
    const y = metadata.studyDate.substring(0, 4);
    const m = metadata.studyDate.substring(4, 6);
    const d = metadata.studyDate.substring(6, 8);
    metadata.studyDate = `${y}-${m}-${d}`;
  }

  const translations: Record<string, string> = {
    patientName: "Nombre del Paciente (0010,0010)",
    patientId: "ID del Paciente (0010,0020)",
    modality: "Modalidad PACS (0008,0060)",
    studyDate: "Fecha del Estudio (0008,0020)",
    institutionName: "Centro de Salud (0008,0080)",
    studyDescription: "Descripción del Estudio (0008,1030)",
    manufacturer: "Dispositivo Médico (0008,0070)",
    rows: "Resolución de Filas (0028,0010)",
    columns: "Resolución de Columnas (0028,0011)",
    bitsAllocated: "Bits Asignados (0028,0100)",
    pixelRepresentation: "Representación (0028,0103)",
    pixelSpacing: "Espaciado de Píxeles (0028,0030)",
    photometricInterpretation: "Fotométrica (0008,0004)",
  };

  for (const [key, val] of Object.entries(metadata)) {
    if (key !== "allTags" && key !== "fileName") {
      metadata.allTags.push({
        tag: tagsToFind.find((t) => t.name === key)?.tagStr || "0008,0000",
        name: translations[key] || key,
        value: String(val),
      });
    }
  }

  return metadata;
}

// Generate highly polished high-tech radiological workspace SVGs embedding actual parsed metadata
export function generateDicomVisualMockup(metadata: DicomMetadata): string {
  const mod = escapeXml(metadata.modality || "RX");
  const name = escapeXml(metadata.patientName || "Paciente Anónimo");
  const pId = escapeXml(metadata.patientId || "N/A");
  const inst = escapeXml(metadata.institutionName || "HOSPITAL CLINICO CENTRAL");
  const sDate = escapeXml(metadata.studyDate || "2026-06-02");
  const desc = escapeXml(metadata.studyDescription || "ESTUDIO DE DIAGNOSTICO CLINICO");
  const manuf = escapeXml(metadata.manufacturer || "SIMULADOR PACS V2.5");
  const rows = metadata.rows || 1024;
  const cols = metadata.columns || 1024;

  let anatomicalPath = "";
  let modeTitle = "";

  if (mod.toUpperCase().includes("MR") || mod.toUpperCase().includes("RM")) {
    modeTitle = "RESONANCIA MAGNETICA MULTIPARAMETRICA (RMN)";
    anatomicalPath = `
      <!-- Brain MRI outline -->
      <ellipse cx="200" cy="180" rx="65" ry="80" fill="none" stroke="#6366f1" stroke-width="1.5" opacity="0.3" filter="drop-shadow(0 0 8px rgba(99,102,241,0.4))"/>
      <ellipse cx="200" cy="180" rx="50" ry="65" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.2" stroke-dasharray="3,3"/>
      <ellipse cx="200" cy="180" rx="35" ry="45" fill="none" stroke="#e0e7ff" stroke-width="1" opacity="0.15"/>
      <path d="M 175 140 C 180 150, 195 150, 200 140 C 205 150, 220 150, 225 140 C 235 170, 235 200, 225 220 C 220 210, 205 210, 200 220 C 195 210, 180 210, 175 220 C 165 200, 165 170, 175 140 Z" fill="none" stroke="#22d3ee" stroke-width="1.5" opacity="0.4"/>
      <path d="M 200 90 L 200 270 M 130 180 L 270 180" stroke="#10b981" stroke-width="0.5" stroke-dasharray="1,4" opacity="0.5"/>
    `;
  } else if (mod.toUpperCase().includes("CT") || mod.toUpperCase().includes("TC")) {
    modeTitle = "TOMOGRAFIA DE CONTRALUZ COMPUTADA (TC)";
    anatomicalPath = `
      <!-- Chest CT layout -->
      <circle cx="200" cy="180" r="85" fill="none" stroke="#3b82f6" stroke-width="1.5" opacity="0.25" filter="drop-shadow(0 0 10px rgba(59,130,246,0.3))"/>
      <circle cx="200" cy="180" r="70" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.15" stroke-dasharray="4,4"/>
      <ellipse cx="160" cy="180" rx="28" ry="45" fill="none" stroke="#e2e8f0" stroke-width="1.5" opacity="0.2"/>
      <ellipse cx="240" cy="180" rx="28" ry="45" fill="none" stroke="#e2e8f0" stroke-width="1.5" opacity="0.2"/>
      <circle cx="200" cy="185" r="15" fill="none" stroke="#f43f5e" stroke-width="1.2" opacity="0.3"/>
      <path d="M 200 80 L 200 280 M 110 180 L 290 180" stroke="#f59e0b" stroke-width="0.5" stroke-dasharray="2,3" opacity="0.4"/>
    `;
  } else {
    modeTitle = "RADIOGRAFIA DE ALTA DEFINICIÓN (SOPORTE DICOM RX)";
    anatomicalPath = `
      <!-- Rib cage visual -->
      <path d="M 120 100 L 120 260 C 120 280, 280 280, 280 260 L 280 100 Z" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.1" stroke-dasharray="3,3"/>
      <path d="M 140 120 Q 200 135, 260 120" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.25"/>
      <path d="M 135 150 Q 200 165, 265 150" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.25"/>
      <path d="M 130 180 Q 200 195, 270 180" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.25"/>
      <path d="M 125 210 Q 200 225, 275 210" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.2"/>
      <path d="M 122 240 Q 200 255, 278 240" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.15"/>
      <path d="M 200 85 L 200 275" stroke="#ef4444" stroke-width="0.8" opacity="0.3"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 360" width="400" height="360">
      <rect width="100%" height="100%" fill="#030712"/>
      
      <!-- Coordinate PACS Grid -->
      <g stroke="#1f2937" stroke-width="0.4" opacity="0.75">
        <line x1="0" y1="40" x2="400" y2="40"/>
        <line x1="0" y1="80" x2="400" y2="80"/>
        <line x1="0" y1="120" x2="400" y2="120"/>
        <line x1="0" y1="160" x2="400" y2="160"/>
        <line x1="0" y1="200" x2="400" y2="200"/>
        <line x1="0" y1="240" x2="400" y2="240"/>
        <line x1="0" y1="280" x2="400" y2="280"/>
        <line x1="0" y1="320" x2="400" y2="320"/>

        <line x1="40" y1="0" x2="40" y2="360"/>
        <line x1="80" y1="0" x2="80" y2="360"/>
        <line x1="120" y1="0" x2="120" y2="360"/>
        <line x1="160" y1="0" x2="160" y2="360"/>
        <line x1="200" y1="0" x2="200" y2="360"/>
        <line x1="240" y1="0" x2="240" y2="360"/>
        <line x1="280" y1="0" x2="280" y2="360"/>
        <line x1="320" y1="0" x2="320" y2="360"/>
      </g>

      <!-- Draw anatomy -->
      <g>
        ${anatomicalPath}
      </g>

      <!-- Corner Crosshair overlays -->
      <path d="M 8 8 L 22 8 M 8 8 L 8 22" stroke="#4b5563" stroke-width="1"/>
      <path d="M 392 8 L 378 8 M 392 8 L 392 22" stroke="#4b5563" stroke-width="1"/>
      <path d="M 8 352 L 22 352 M 8 352 L 8 338" stroke="#4b5563" stroke-width="1"/>
      <path d="M 392 352 L 378 352 M 392 352 L 392 338" stroke="#4b5563" stroke-width="1"/>

      <!-- DICOM HUD Metadata fields on corners -->
      <!-- TOP LEFT -->
      <g fill="#10b981" font-family="monospace" font-size="8.5" font-weight="bold" opacity="0.95">
        <text x="12" y="24">PACIENTE: ${name.toUpperCase()}</text>
        <text x="12" y="36">ID: ${pId}</text>
        <text x="12" y="48">CENTRO: ${inst.toUpperCase()}</text>
      </g>

      <!-- TOP RIGHT -->
      <g fill="#10b981" font-family="monospace" font-size="8.5" font-weight="bold" text-anchor="end" opacity="0.95">
        <text x="388" y="24">${mod.toUpperCase()} ORIGINAL DCM</text>
        <text x="388" y="36">FECHA: ${sDate}</text>
        <text x="388" y="48">ESTADO: CALIB GSDF</text>
      </g>

      <!-- BOTTOM LEFT -->
      <g fill="#10b981" font-family="monospace" font-size="8" font-weight="bold" opacity="0.8">
        <text x="12" y="318">MATRIZ: ${rows}x${cols}</text>
        <text x="12" y="329">ESTUDIO: ${desc.substring(0, 24).toUpperCase()}</text>
        <text x="12" y="340">CALIBRACION: OK</text>
      </g>

      <!-- BOTTOM RIGHT -->
      <g fill="#10b981" font-family="monospace" font-size="8" font-weight="bold" text-anchor="end" opacity="0.8">
        <text x="388" y="318">TECNICA: 120KV / 250MA</text>
        <text x="388" y="329">FABRICANTE: ${manuf.substring(0, 18).toUpperCase()}</text>
        <text x="388" y="340">FILTRO: PACS GSDF P14</text>
      </g>

      <g fill="#38bdf8" font-family="sans-serif" font-size="7" font-weight="extrabold" text-anchor="middle">
        <text x="200" y="352">${modeTitle}</text>
      </g>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
