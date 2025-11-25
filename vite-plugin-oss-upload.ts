// Vite插件：处理OSS上传代理
import type { Plugin } from 'vite';
import fetch from 'node-fetch';

export function ossUploadPlugin(): Plugin {
    return {
        name: 'oss-upload-proxy',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url === '/api/oss/upload' && req.method === 'POST') {
                    try {
                        // 收集请求体
                        const chunks: Buffer[] = [];
                        req.on('data', (chunk) => chunks.push(chunk));
                        req.on('end', async () => {
                            try {
                                const buffer = Buffer.concat(chunks);

                                // 解析multipart/form-data
                                const boundary = req.headers['content-type']?.split('boundary=')[1];
                                if (!boundary) {
                                    res.writeHead(400);
                                    res.end(JSON.stringify({ error: 'No boundary found' }));
                                    return;
                                }

                                // 简单解析（仅用于开发）
                                const parts = buffer.toString('binary').split(`--${boundary}`);
                                let fileData: Buffer | null = null;
                                let filename = '';

                                for (const part of parts) {
                                    if (part.includes('name="filename"')) {
                                        const match = part.match(/\r\n\r\n(.*?)\r\n/);
                                        if (match) filename = match[1];
                                    }
                                    if (part.includes('name="file"')) {
                                        const startIndex = part.indexOf('\r\n\r\n') + 4;
                                        const endIndex = part.lastIndexOf('\r\n');
                                        if (startIndex > 3 && endIndex > startIndex) {
                                            fileData = Buffer.from(part.substring(startIndex, endIndex), 'binary');
                                        }
                                    }
                                }

                                if (!fileData || !filename) {
                                    res.writeHead(400);
                                    res.end(JSON.stringify({ error: 'Missing file or filename' }));
                                    return;
                                }

                                // 1. 获取OSS上传参数
                                const paramsUrl = `https://www.xiexinbao.com/oss_hz/params?mime=application/octet-stream&filename=${encodeURIComponent(filename)}`;
                                const paramsRes = await fetch(paramsUrl);
                                const params = await paramsRes.json() as any;

                                // 2. 上传到OSS（使用PUT方法）
                                const uploadUrl = `https://${params.host}${params.filename}`;
                                const uploadRes = await fetch(uploadUrl, {
                                    method: 'PUT',
                                    headers: {
                                        'Date': params.date,
                                        'Authorization': params.authorization,
                                        'Content-Type': params.mime,
                                    },
                                    body: fileData,
                                });

                                if (!uploadRes.ok) {
                                    const errorText = await uploadRes.text();
                                    console.error('OSS upload failed:', errorText);
                                    res.writeHead(500);
                                    res.end(JSON.stringify({ error: 'OSS upload failed', details: errorText }));
                                    return;
                                }

                                // 返回成功
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ url: uploadUrl }));
                            } catch (error) {
                                console.error('Upload processing error:', error);
                                res.writeHead(500);
                                res.end(JSON.stringify({ error: 'Upload processing failed', message: (error as Error).message }));
                            }
                        });
                    } catch (error) {
                        console.error('Request handling error:', error);
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: 'Request handling failed' }));
                    }
                } else {
                    next();
                }
            });
        },
    };
}
