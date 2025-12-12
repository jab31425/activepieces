import { createAction, Property } from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import mime from 'mime-types';

export const getDocumentContent = createAction({
  name: 'minerUDocumentDataExtraction',
  displayName: 'Document content extraction with MinerU',
  description: 'Extract the content of the given document with MinuerU',
  props: {
    apiServerUrl: Property.ShortText({
        displayName: 'MinerU API server url',
        required: true
    }),
    file: Property.File({
        displayName: 'File for parsing',
        description: 'base64 file from readFile piece',
        required: true,
    }),
    langList: Property.ShortText({
        displayName: 'Document language',
        description: 'Improves OCR accuracy with "pipeline" backend only. Supported values : ch , ch_server, ch_lite, en, korean, japan, chinese_cht, ta, te, ka, th, el, latin, arabic, east_slavic, cyrillic, devanagari',
        required: false,
        defaultValue: '',
    }),
    backend: Property.StaticDropdown({
        displayName: 'Backend for parsing',
        description: 'pipeline: More general, vlm-transformers:  More general, but slower, vlm-mlx-engine: Faster than transformers (need apple silicon and macOS 13.5+), vlm-vllm-async-engine: Faster (vllm-engine, need vllm installed), vlm-lmdeploy-engine: Faster (lmdeploy-engine, need lmdeploy installed), vlm-http-client: Faster (client suitable for openai-compatible servers)',
        required: true,
        defaultValue: 'vlm-http-client',
        options: {
            options: [
                { label: 'pipeline', value: 'pipeline' },
                { label: 'vlm-transformers', value: 'vlm-transformers' },
                { label: 'vlm-mlx-engine', value: 'vlm-mlx-engine' },
                { label: 'vlm-vllm-async-engine', value: 'vlm-vllm-async-engine' },
                { label: 'vlm-lmdeploy-engine', value: 'vlm-lmdeploy-engine' },
                { label: 'vlm-http-client', value: 'vlm-http-client' },
            ],
        },
    }),
    backendServerUrl: Property.ShortText({
        displayName: 'Backend OpenAI compatible server url',
        description: 'Adapted only for "vlm-http-client" backend, e.g., http://127.0.0.1:30000',
        required: false
    }),
    parseMethod: Property.StaticDropdown({
        displayName: 'The method for parsing PDF',
        description: 'Adapted only for pipeline backend. "auto": Automatically determine the method based on the file type, "txt": Use text extraction method, "ocr": ocr',
        required: true,
        defaultValue: 'auto',
        options: {
            options: [
                { label: 'auto', value: 'auto' },
                { label: 'txt', value: 'txt' },
                { label: 'ocr', value: 'ocr' },
            ],
        },
    }),
    formulaEnable: Property.Checkbox({
        displayName: 'Enable formula parsing',
        required: false,
        defaultValue: true,
    }),
    tableEnable: Property.Checkbox({
        displayName: 'Enable table parsing',
        required: false,
        defaultValue: true,
    }),
    returnMD: Property.Checkbox({
        displayName: 'Return markdown content in response',
        required: false,
        defaultValue: true,
    }),
    returnMiddleJson: Property.Checkbox({
        displayName: 'Return middle JSON in response',
        required: false,
        defaultValue: false,
    }),
    returnModelOutput: Property.Checkbox({
        displayName: 'Return model output JSON in response',
        required: false,
        defaultValue: false,
    }),
    returnContentList: Property.Checkbox({
        displayName: 'Return content list JSON in response',
        required: false,
        defaultValue: false,
    }),
    returnImages: Property.Checkbox({
        displayName: 'Return extracted images in response',
        required: false,
        defaultValue: false,
    }),
    responseFormatZip: Property.Checkbox({
        displayName: 'Return results as a ZIP file instead of JSON',
        required: false,
        defaultValue: false,
    }),
    startPageId: Property.Number({
        displayName: 'Start page',
        description: 'The starting page for PDF parsing, beginning from 0',
        required: false,
        defaultValue: 0,
    }),
    endPageId: Property.Number({
        displayName: 'End page',
        description: 'The ending page for PDF parsing, beginning from 0',
        required: false,
        defaultValue: 99999,
    }),
  },
  async run(context) {
    const { apiServerUrl, file, langList, backend, backendServerUrl, parseMethod, formulaEnable, tableEnable, returnMD, returnMiddleJson, returnModelOutput, returnContentList, returnImages, responseFormatZip, startPageId, endPageId } = context.propsValue;

    //Determine the MIME type
    const mimeType = file.extension ? mime.lookup(file.extension) || 'application/octet-stream' : 'application/octet-stream';
    const blob = new Blob([file.data as unknown as ArrayBuffer], {
         type: mimeType,
    });
    const form = new FormData();
    
    form.append('files', blob, file.filename);
    if (langList) form.append('lang_list', langList);
    if (backend) form.append('backend', backend);
    if (parseMethod) form.append('parse_method', parseMethod);
    if (backendServerUrl) form.append('server_url', backendServerUrl);
    if (startPageId) form.append('start_page_id', String(startPageId));
    if (endPageId) form.append('end_page_id', String(endPageId));
    form.append('formula_enable', formulaEnable ? 'true' : 'false');
    form.append('table_enable', tableEnable ? 'true' : 'false');
    form.append('return_md', returnMD ? 'true' : 'false');
    form.append('return_middle_json', returnMiddleJson ? 'true' : 'false');
    form.append('return_model_output', returnModelOutput ? 'true' : 'false');
    form.append('return_content_list', returnContentList ? 'true' : 'false');
    form.append('return_images', returnImages ? 'true' : 'false');
    form.append('response_format_zip', responseFormatZip ? 'true' : 'false');

    const response = await httpClient.sendRequest({
        url: `${apiServerUrl}/file_parse`,
        method: HttpMethod.POST,
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        body: form, // httpClient knows how to handle FormData correctly
    });
    
    // Error Handling
    if (response.status >= 300) {
        throw new Error(`MinerU API request failed with status ${response.status}: ${JSON.stringify(response.body)}`);
    }

    // Handle ZIP response format
    if (responseFormatZip) {
        // Since httpClient returns the body directly, if it was a ZIP, it's a Buffer/Uint8Array
        // We ensure it's returned as a file object
        const zipData = response.body; 

        if (zipData instanceof Buffer || zipData instanceof Uint8Array) {
            return {
                filename: `${file.filename}_mineru_result.zip`,
                data: Buffer.from(zipData).toString('base64'),
                extension: 'zip',
            };
        } else {
             // Handle case where API might not return binary despite request
             throw new Error("Expected ZIP file response but received non-binary data.");
        }
    }

    // Default JSON response
    return await response.body;
  },
});
