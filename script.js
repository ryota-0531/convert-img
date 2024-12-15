const inputFiles = document.getElementById('inputFiles');
const fromFormat = document.getElementById('fromFormat');
const toFormat = document.getElementById('toFormat');
const convertBtn = document.getElementById('convertBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const outputContainer = document.getElementById('outputContainer');

const imageMimeMap = {
    png:  { mime: 'image/png',  ext: 'png' },
    jpeg: { mime: 'image/jpeg', ext: 'jpg' },
    webp: { mime: 'image/webp', ext: 'webp' }
};


const supportedExtensions = ['png', 'jpg', 'jpeg', 'webp'];


let originalFiles = [];
let errorResults = [];
let convertedResults = [];

inputFiles.addEventListener('change', async () => {
    const files = Array.from(inputFiles.files);
    clearResults();

    if (files.length === 0) {
        convertBtn.disabled = true;
        downloadAllBtn.disabled = true;
        return;
    }

    originalFiles = [];
    errorResults = [];
    convertedResults = [];

    for (const file of files) {
        if (isZipFile(file)) {
            await handleZipFile(file);
        } else {
            await handleRegularFile(file);
        }
    }

    setFromFormatOption();

    for (const err of errorResults) {
        appendErrorResult(err);
    }

    if (originalFiles.length === 0) {
        convertBtn.disabled = true;
        downloadAllBtn.disabled = true;
    } else {
        convertBtn.disabled = false;
        downloadAllBtn.disabled = true;
    }
});

function clearResults() {
    outputContainer.innerHTML = '';
    convertedResults = [];
    errorResults = [];
    originalFiles = [];
}

function isZipFile(file) {
    return file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';
}

async function handleZipFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const entries = Object.keys(zip.files);

        for (const entryName of entries) {
            const zipEntry = zip.files[entryName];
            if (zipEntry.dir) {
                continue;
            }
            const ext = getExtension(entryName).toLowerCase();
            if (!supportedExtensions.includes(ext)) {
                errorResults.push(entryName + " は非対応の拡張子です。");
                continue;
            }

            const mimeType = guessMimeTypeFromExt(ext);
            if (!mimeType) {
                errorResults.push(entryName + " は処理できません。");
                continue;
            }

            const fileData = await zipEntry.async('arraybuffer');
            const blob = new Blob([fileData], {type: mimeType});
            const format = ext === 'jpg' ? 'jpeg' : (ext === 'jpeg' ? 'jpeg' : ext);

            originalFiles.push({blob: blob, originalName: entryName, format: format});
        }
    } catch (e) {
        errorResults.push(file.name + " の解凍に失敗しました。");
    }
}

async function handleRegularFile(file) {
    const ext = getExtension(file.name).toLowerCase();
    if (isImageFileSupported(file)) {
        let format;
        if (file.type === 'image/png') format = 'png';
        else if (file.type === 'image/jpeg') format = 'jpeg';
        else if (file.type === 'image/webp') format = 'webp';
        else {
            errorResults.push(file.name + " は非対応の画像形式です。");
            return;
        }

        originalFiles.push({blob: file, originalName: file.name, format: format});
    } else if (ext === 'zip') {
        errorResults.push(file.name + " のZIP処理中に問題がありました。");
    } else {
        errorResults.push(file.name + " は非対応の拡張子です。");
    }
}

function isImageFileSupported(file) {
    return file.type.match(/image\/(png|jpeg|webp)/);
}

function getExtension(filename) {
    const parts = filename.split('.');
    if (parts.length <= 1) return '';
    return parts[parts.length - 1];
}

function guessMimeTypeFromExt(ext) {
    switch(ext) {
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'webp': return 'image/webp';
        default: return '';
    }
}

function setFromFormatOption() {
    if (originalFiles.length === 0) {
        fromFormat.value = 'mixed';
        fromFormat.disabled = true;
        return;
    }

    const formats = new Set(originalFiles.map(f => f.format));
    if (formats.size === 1) {
        const singleFormat = [...formats][0];
        fromFormat.value = singleFormat;
        fromFormat.disabled = true;
    } else {
        fromFormat.value = 'mixed';
        fromFormat.disabled = true;
    }
}

convertBtn.addEventListener('click', async () => {
    if (originalFiles.length === 0) return;

    outputContainer.innerHTML = '';
    convertedResults = [];

    const toKey = toFormat.value;
    const toMime = imageMimeMap[toKey].mime;
    const toExt = imageMimeMap[toKey].ext;

    for (const fileObj of originalFiles) {
        const {blob, originalName} = fileObj;
        const resultBlob = await convertImageFile(blob, toMime);
        if (resultBlob) {
            const newFileName = changeExtension(originalName, toExt);
            const outputURL = URL.createObjectURL(resultBlob);
            appendResult(outputURL, newFileName);
            convertedResults.push({blob: resultBlob, filename: newFileName});
        } else {
            appendErrorResult(originalName + " の変換に失敗しました。");
        }
    }

    if (convertedResults.length > 0) {
        downloadAllBtn.disabled = false;
    }
});

function convertImageFile(fileBlob, outputMime) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                canvas.toBlob(function(blob) {
                    resolve(blob);
                }, outputMime);
            };
            img.onerror = function() {
                resolve(null);
            };
            img.src = e.target.result;
        };
        reader.onerror = function() {
            resolve(null);
        };
        reader.readAsDataURL(fileBlob);
    });
}

function appendResult(url, filename) {
    const div = document.createElement('div');
    div.className = 'image-result';
    const img = document.createElement('img');
    img.src = url;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.textContent = 'ダウンロード';

    div.appendChild(img);
    div.appendChild(document.createTextNode(filename + " "));
    div.appendChild(link);

    outputContainer.appendChild(div);
}

function appendErrorResult(msg) {
    const div = document.createElement('div');
    div.className = 'error-result';
    div.textContent = msg;
    outputContainer.appendChild(div);
}

function changeExtension(filename, newExt) {
    const parts = filename.split('.');
    if (parts.length <= 1) {
        return filename + '.' + newExt;
    }
    parts[parts.length - 1] = newExt;
    return parts.join('.');
}

downloadAllBtn.addEventListener('click', async () => {
    if (convertedResults.length === 0) return;

    const zip = new JSZip();
    const usedNames = new Set();

    for (const result of convertedResults) {
        const arrayBuffer = await blobToArrayBuffer(result.blob);
        const uniqueName = getUniqueFilename(result.filename, usedNames);
        usedNames.add(uniqueName);
        zip.file(uniqueName, arrayBuffer);
    }

    const zipBlob = await zip.generateAsync({type:"blob"});
    const zipURL = URL.createObjectURL(zipBlob);

    const tempLink = document.createElement('a');
    tempLink.href = zipURL;
    tempLink.download = 'converted_images.zip';
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
});

function blobToArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });
}

function getUniqueFilename(filename, usedNames) {
    if (!usedNames.has(filename)) {
        return filename;
    }

    const parts = filename.split('.');
    const ext = parts.pop();
    const baseName = parts.join('.') || 'file';

    let counter = 1;
    let newName;
    do {
        newName = `${baseName}(${counter}).${ext}`;
        counter++;
    } while (usedNames.has(newName));

    return newName;
}
