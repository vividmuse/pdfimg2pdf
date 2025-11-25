import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/oss': {
          target: 'https://www.xiexinbao.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/oss/, '/oss_hz'),
          secure: false,
        },
        // 注意：order-status必须在order之前，避免被order规则匹配
        '/api/order-status': {
          target: 'https://www.xiexinbao.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/order-status/, '/yhl_order'),
          secure: false,
        },
        '/api/order': {
          target: 'https://p.xiexinbao.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/order/, '/yhl_order'),
          secure: false,
        },
      },
    },
    plugins: [
      react(),
      {
        name: 'oss-upload-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === '/api/oss/upload' && req.method === 'POST') {
              try {
                const busboy = await import('busboy');
                const fetch = (await import('node-fetch')).default;

                const bb = busboy.default({ headers: req.headers });
                let fileData: Buffer | null = null;
                let filename = '';

                bb.on('file', (name, file, info) => {
                  const chunks: Buffer[] = [];
                  file.on('data', (data) => chunks.push(data));
                  file.on('end', () => {
                    fileData = Buffer.concat(chunks);
                  });
                });

                bb.on('field', (name, val) => {
                  if (name === 'filename') {
                    filename = val;
                  }
                });

                bb.on('finish', async () => {
                  try {
                    if (!fileData || !filename) {
                      res.writeHead(400);
                      res.end(JSON.stringify({ error: 'Missing file or filename' }));
                      return;
                    }

                    console.log(`Uploading to OSS: ${filename}, size: ${fileData.length} bytes`);

                    // 获取OSS上传参数
                    const paramsUrl = `https://www.xiexinbao.com/oss_hz/params?mime=application/octet-stream&filename=${encodeURIComponent(filename)}`;
                    const paramsRes = await fetch(paramsUrl);
                    const params = await paramsRes.json() as any;

                    console.log(`Got OSS params:`, params);

                    // 提取ID（从filename中提取，格式为 //yhl/ori_file/20251125/[ID]/[ID].jpg）
                    const idMatch = filename.match(/\/(\d{15})\/\1\.jpg$/);
                    const id = idMatch ? idMatch[1] : 'file';

                    // 上传到OSS - 使用最小必需headers
                    const ossHost = params.host || params.host_cdn;
                    const ossFilename = params.filename?.startsWith('/') ? params.filename : `/${params.filename}`;
                    if (!ossHost || !params.authorization || !params.date || !params.filename) {
                      res.writeHead(500);
                      res.end(JSON.stringify({ error: '缺少OSS上传必要参数', details: params }));
                      return;
                    }

                    const uploadUrl = `https://${ossHost}${ossFilename}`;
                    console.log('Upload URL:', uploadUrl);
                    console.log('Using signed headers...');
                    const uploadRes = await fetch(uploadUrl, {
                      method: 'PUT',
                      headers: {
                        'Authorization': params.authorization,
                        'Content-Type': params.mime || 'application/octet-stream',
                        'x-oss-date': params.date,
                        'Content-Disposition': `attachment; filename=${id}.jpg`,
                        ...(params.security_token ? { 'x-oss-security-token': params.security_token } : {}),
                      },
                      body: fileData,
                    });

                    if (!uploadRes.ok) {
                      const errorText = await uploadRes.text();
                      console.error('OSS upload failed:', uploadRes.status, errorText);
                      res.writeHead(500);
                      res.end(JSON.stringify({ error: 'OSS upload failed', details: errorText }));
                      return;
                    }

                    console.log(`Successfully uploaded to ${uploadUrl}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ url: uploadUrl }));
                  } catch (error) {
                    console.error('Upload processing error:', error);
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Upload failed', message: (error as Error).message }));
                  }
                });

                req.pipe(bb);
              } catch (error) {
                console.error('Request handling error:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Request failed', message: (error as Error).message }));
              }
            } else {
              next();
            }
          });
        },
      },
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
